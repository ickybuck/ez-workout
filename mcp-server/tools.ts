/*
 * The tools.
 *
 * Nine of them, and the count is deliberate. This is driven from a phone
 * between sets, so the surface has to be small enough that the right tool is
 * obvious and every argument is something a person would say out loud. Names,
 * never ids. Weights in whatever unit the person thinks in. Set numbers
 * optional, because "log ten at eighty" is the whole sentence.
 *
 * Four conventions are load-bearing, and each one is stated in the tool
 * descriptions as well as enforced here, because the model reads the former:
 *
 *   Weights are stored in kilograms and the plates are in pounds. A weight
 *   without a unit is in the person's own unit, never a default of kilograms.
 *
 *   A dumbbell weight is the PAIR. Two 40s is 80, with reps as performed on
 *   one side. Halving or doubling either number breaks comparison with every
 *   row logged since EZ-42.
 *
 *   `reps` in the database is the prescription, not the performance. planSet
 *   owns that translation.
 *
 *   An edit touches one set. Dropping the last set because you are tired is
 *   not a decision about the programme, and must not rewrite the template
 *   (EZ-46).
 */

import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { format as formatWeight, formatVolume, type WeightUnit } from '../src/lib/weight';
import { normalise } from '../src/lib/supersets';
import { planWeightEdit } from '../src/lib/setWeightEdit';
import { restDurationFor } from '../src/lib/restTimer';
import { planSet, performedFrom } from './planSet';
import { planLogWrite } from './planLogWrite';
import { AmbiguousExerciseError, UnknownExerciseError } from './matchExercise';
import { NotYoursError } from './userScope';
import type { Ctx } from './context';
import {
  exerciseHistory,
  listWorkouts,
  logsFor,
  templateDetails,
} from './queries';


const unitArg = z
  .enum(['kg', 'lb'])
  .optional()
  .describe('Unit of the weight given. Defaults to the unit set on the account.');

/*
 * These three are annotated with CallToolResult rather than letting TypeScript
 * infer them. Inferred, the handler return type has to be reconciled against
 * registerTool's generics for every tool, and the compiler gives up with
 * TS2589 ("type instantiation is excessively deep"). Naming the type costs
 * nothing and keeps the whole file inferring in reasonable time.
 */
function text(body: string): CallToolResult {
  return { content: [{ type: 'text', text: body }] };
}

function fail(body: string): CallToolResult {
  return { content: [{ type: 'text', text: body }], isError: true };
}

/** Turns the expected refusals into something a person can act on. */
async function guard(run: () => Promise<CallToolResult>): Promise<CallToolResult> {
  try {
    return await run();
  } catch (error) {
    if (
      error instanceof AmbiguousExerciseError ||
      error instanceof UnknownExerciseError ||
      error instanceof NotYoursError
    ) {
      return fail(error.message);
    }
    throw error;
  }
}

const describeSets = (
  sets: Array<{ weightKg: number | null; performed: number; prescribed: number }>,
  unit: WeightUnit,
) =>
  sets
    .map((s) => {
      const weight = s.weightKg != null ? formatWeight(s.weightKg, unit) : 'bodyweight';
      const short = s.performed < s.prescribed ? ` (target ${s.prescribed})` : '';
      const over = s.performed > s.prescribed ? ` (target ${s.prescribed})` : '';
      return `${weight} x ${s.performed}${short}${over}`;
    })
    .join(', ');

export function registerTools(server: McpServer, ctx: Ctx): void {
  /* ---------------------------------------------------------------- read */

  server.registerTool(
    'ez_whoami',
    {
      title: 'Who the workout server thinks you are',
      description:
        'The account these tools are acting for, the weight unit it will use, and whether a workout is currently running. Useful when something looks like it belongs to someone else.',
      inputSchema: {},
    },
    async () =>
      guard(async () => {
        const [unit, settings, active, workouts] = await Promise.all([
          ctx.unit(),
          ctx.settings(),
          ctx.activeWorkout(),
          listWorkouts(ctx),
        ]);

        const name = settings?.first_name ? `${settings.first_name}, ` : '';
        return text(
          [
            `${name}${ctx.identity.email ?? ctx.identity.userId} (identified by ${ctx.identity.source}).`,
            `Weights in ${unit}. ${workouts.length} workouts logged.`,
            active ? 'A workout is in progress.' : 'No workout in progress.',
          ].join('\n'),
        );
      }),
  );

  server.registerTool(
    'ez_list_templates',
    {
      title: 'List workout templates',
      description:
        'The saved templates, with their exercises in order, their target sets and reps, and which pairs are supersets. Supersets are shown as one block because they are performed alternating, with a single rest at the end.',
      inputSchema: {
        include_hidden: z
          .boolean()
          .optional()
          .describe('Include templates hidden from the start screen. Default false.'),
      },
    },
    async ({ include_hidden }) =>
      guard(async () => {
        const [unit, templates] = await Promise.all([ctx.unit(), templateDetails(ctx, !!include_hidden)]);
        if (!templates.length) return text('No templates.');

        const body = templates
          .map((t) => {
            const marks = [t.isFavorite ? 'favourite' : null, t.isHidden ? 'hidden' : null]
              .filter(Boolean)
              .join(', ');
            const head = `${t.name}${marks ? ` (${marks})` : ''} - ${t.category}`;

            const lines = t.blocks.map((block) => {
              const parts = block.map((row) => {
                const sets = row.default_sets ?? '?';
                const reps = row.default_reps ?? '?';
                const weight =
                  row.default_weight != null ? ` at ${formatWeight(row.default_weight, unit)}` : '';
                return `${row.exerciseName} ${sets}x${reps}${weight}`;
              });
              return block.length > 1 ? `  superset: ${parts.join(' + ')}` : `  ${parts[0]}`;
            });

            return [head, ...lines].join('\n');
          })
          .join('\n\n');

        return text(body);
      }),
  );

  server.registerTool(
    'ez_exercise_history',
    {
      title: 'What you last did on an exercise',
      description:
        'Recent sessions for one exercise, newest first, with the weight and reps actually performed. Reps shown are performed reps; where they fell short of the target the target is shown too. For dumbbells the weight is the pair.',
      inputSchema: {
        exercise: z.string().describe('Exercise name, as spoken. Partial names are fine if unambiguous.'),
        sessions: z.number().int().min(1).max(20).optional().describe('How many sessions back. Default 5.'),
      },
    },
    async ({ exercise, sessions }) =>
      guard(async () => {
        const [unit, match] = await Promise.all([ctx.unit(), ctx.resolveExercise(exercise)]);
        const history = await exerciseHistory(ctx, match.exercise.id, sessions ?? 5);

        if (!history.length) return text(`No logged sets for ${match.exercise.name}.`);

        const how = match.kind === 'exact' ? '' : ` (matched on ${match.kind})`;
        const body = history
          .map((session) => {
            const when = session.workout.start_time?.slice(0, 10) ?? 'undated';
            return `${when}  ${describeSets(session.sets, unit)}`;
          })
          .join('\n');

        return text(`${match.exercise.name}${how}\n${body}`);
      }),
  );

  server.registerTool(
    'ez_last_session',
    {
      title: 'Your last workout',
      description:
        'The most recent workout and everything logged in it, so you can pick up where you left off. Optionally the most recent run of one template.',
      inputSchema: {
        template: z.string().optional().describe('Only consider workouts from this template.'),
      },
    },
    async ({ template }) =>
      guard(async () => {
        const unit = await ctx.unit();
        let workouts = (await listWorkouts(ctx)).filter((w) => w.end_time);

        if (template) {
          const templates = await templateDetails(ctx, true);
          const wanted = templates.find(
            (t) => t.name.toLowerCase().trim() === template.toLowerCase().trim(),
          );
          if (!wanted) return fail(`No template called "${template}".`);
          workouts = workouts.filter((w) => w.template_id === wanted.id);
        }

        const last = workouts[0];
        if (!last) return text('No finished workouts yet.');

        const proven = await ctx.scope.proveWorkout(last.id);
        const wes = await ctx.scope.exercisesOf(proven);
        const logs = await logsFor(
          ctx,
          wes.map((we) => we.id),
        );
        const library = new Map((await ctx.library()).map((e) => [e.id, e.name]));

        const lines = wes.map((we) => {
          const mine = logs
            .filter((l) => l.workout_exercise_id === we.id)
            .sort((a, b) => a.set_number - b.set_number)
            .map((l) => ({
              weightKg: l.weight,
              performed: performedFrom(l),
              prescribed: l.reps ?? 0,
            }));

          const name = library.get(we.exerciseId ?? '') ?? 'unknown exercise';
          return `  ${name}: ${mine.length ? describeSets(mine, unit) : 'nothing logged'}`;
        });

        return text(
          [`${last.name} - ${last.start_time?.slice(0, 10) ?? 'undated'}`, ...lines].join('\n'),
        );
      }),
  );

  server.registerTool(
    'ez_performance_summary',
    {
      title: 'How training has gone lately',
      description:
        'Sessions, sets and volume over a recent window, with the exercises carrying the most of it. Volume counts only completed sets and only reps actually performed.',
      inputSchema: {
        days: z.number().int().min(1).max(365).optional().describe('Window in days. Default 28.'),
      },
    },
    async ({ days }) =>
      guard(async () => {
        const window = days ?? 28;
        const since = new Date(Date.now() - window * 24 * 60 * 60 * 1000).toISOString();
        const unit = await ctx.unit();

        const workouts = (await listWorkouts(ctx)).filter((w) => (w.start_time ?? '') >= since);
        if (!workouts.length) return text(`No workouts in the last ${window} days.`);

        const proven = await Promise.all(workouts.map((w) => ctx.scope.proveWorkout(w.id)));
        const wes = (await Promise.all(proven.map((p) => ctx.scope.exercisesOf(p)))).flat();
        const logs = await logsFor(
          ctx,
          wes.map((we) => we.id),
        );

        const exerciseOf = new Map(wes.map((we) => [we.id, we.exerciseId]));
        const library = new Map((await ctx.library()).map((e) => [e.id, e.name]));

        let sets = 0;
        let volumeKg = 0;
        const byExercise = new Map<string, number>();

        for (const log of logs) {
          if (!log.completed) continue;
          const performed = performedFrom(log);
          if (performed <= 0) continue;
          sets += 1;

          const volume = (log.weight ?? 0) * performed;
          volumeKg += volume;

          const exerciseId = log.workout_exercise_id ? exerciseOf.get(log.workout_exercise_id) : null;
          const name = library.get(exerciseId ?? '') ?? 'unknown exercise';
          byExercise.set(name, (byExercise.get(name) ?? 0) + volume);
        }

        const top = [...byExercise.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([name, volume]) => `  ${name}: ${formatVolume(volume, unit)}`);

        return text(
          [
            `Last ${window} days: ${workouts.length} workouts, ${sets} completed sets.`,
            `Total volume ${formatVolume(volumeKg, unit)}.`,
            ...(top.length ? ['Most volume:', ...top] : []),
          ].join('\n'),
        );
      }),
  );

  /* --------------------------------------------------------------- write */

  server.registerTool(
    'ez_start_workout',
    {
      title: 'Start a workout from a template',
      description:
        'Begins a workout from a saved template, copying its exercises and superset pairing. Refuses if a workout is already running, because two open workouts make every later "log this set" ambiguous.',
      inputSchema: {
        template: z.string().describe('Template name, as spoken.'),
      },
      annotations: { destructiveHint: false, idempotentHint: false },
    },
    async ({ template }) =>
      guard(async () => {
        const open = await ctx.activeWorkout();
        if (open) {
          return fail('A workout is already in progress. Finish it first with ez_finish_workout.');
        }

        const templates = await templateDetails(ctx, true);
        const wanted =
          templates.find((t) => t.name.toLowerCase().trim() === template.toLowerCase().trim()) ??
          templates.find((t) => t.name.toLowerCase().includes(template.toLowerCase().trim()));
        if (!wanted) {
          return fail(`No template matches "${template}". Templates: ${templates.map((t) => t.name).join(', ')}.`);
        }

        const [created] = await ctx.scope.insertOwn('workouts', [
          {
            name: wanted.name,
            template_id: wanted.id,
            template_type: wanted.templateType,
            start_time: new Date().toISOString(),
          },
        ]);

        const workout = await ctx.scope.proveWorkout(created.id as string);

        // Flatten the blocks back to rows, then normalise so a group that is
        // no longer contiguous dissolves rather than travelling into the
        // workout as a superset that cannot be performed.
        const rows = normalise(
          wanted.blocks.flat().map((row, index) => ({
            order_index: index,
            superset_group: row.superset_group,
            exercise_id: row.exercise_id,
          })),
        );

        for (const row of rows) {
          if (!row.exercise_id) continue;
          await ctx.scope.addWorkoutExercise(workout, {
            exercise_id: row.exercise_id,
            order_index: row.order_index,
            superset_group: row.superset_group ?? null,
          });
        }

        const blocks = wanted.blocks
          .map((block) => block.map((r) => r.exerciseName).join(' + '))
          .join(', ');
        return text(`Started ${wanted.name}. ${rows.length} exercises: ${blocks}.`);
      }),
  );

  server.registerTool(
    'ez_log_set',
    {
      title: 'Log a set',
      description:
        'Records a set in the workout currently running. Give the reps you actually performed; the target comes from the template and the shortfall or overage is worked out here. Weight is optional and carries forward from the previous set of the same exercise. For dumbbells give the weight of the PAIR (two 40s is 80) with reps as performed on one side. Repeating the same call for the same set number overwrites it rather than adding a second set, so a retry is safe.',
      inputSchema: {
        exercise: z.string().describe('Exercise name, as spoken.'),
        reps: z.number().int().min(0).describe('Reps actually performed. 0 records the set as not done.'),
        weight: z.number().min(0).optional().describe('Weight lifted. Omit to reuse the previous set.'),
        unit: unitArg,
        set: z
          .number()
          .int()
          .min(1)
          .optional()
          .describe('Which set this is. Defaults to the next one not yet logged.'),
      },
      annotations: { destructiveHint: false, idempotentHint: true },
    },
    async ({ exercise, reps, weight, unit, set }) =>
      guard(async () => {
        const workout = await ctx.activeWorkout();
        if (!workout) return fail('No workout is running. Start one with ez_start_workout.');

        const displayUnit = await ctx.unit();
        const match = await ctx.resolveExercise(exercise);

        const existing = await ctx.scope.exercisesOf(workout);
        let we = existing.find((row) => row.exerciseId === match.exercise.id);

        if (!we) {
          // Not in the template, done anyway. Appended rather than refused:
          // the gym is not the place to argue about the plan.
          const nextIndex = existing.reduce((max, row) => Math.max(max, row.orderIndex + 1), 0);
          we = await ctx.scope.addWorkoutExercise(workout, {
            exercise_id: match.exercise.id,
            order_index: nextIndex,
            superset_group: null,
          });
        }

        const logs = await ctx.scope.logsOf(we);
        const defaults = (await ctx.defaults()).get(match.exercise.id);

        // Which set, which weight and which target: all three in planLogWrite
        // so they can be tested without a database behind them.
        const write = planLogWrite({
          existing: logs.map((row) => ({
            set_number: Number(row.set_number),
            weight: (row.weight as number | null) ?? null,
            reps: (row.reps as number | null) ?? null,
          })),
          performed: reps,
          requestedSet: set,
          requestedWeightKg: weight != null ? await ctx.toStorage(weight, unit) : null,
          defaultWeightKg: defaults?.weight ?? null,
          defaultReps: defaults?.reps ?? null,
        });

        await ctx.scope.writeLog(we, {
          set_number: write.setNumber,
          weight: write.weightKg,
          reps: write.plan.reps,
          failed_reps: write.plan.failed_reps,
          extra_reps: write.plan.extra_reps,
          completed: write.plan.completed,
        });

        const shown = write.weightKg != null ? formatWeight(write.weightKg, displayUnit) : 'bodyweight';
        const against =
          write.plan.failed_reps > 0
            ? ` (${write.plan.failed_reps} short of ${write.plan.reps})`
            : write.plan.extra_reps > 0
              ? ` (${write.plan.extra_reps} over ${write.plan.reps})`
              : '';
        const overwrote = write.replacing ? ' (replaced the previous entry for that set)' : '';

        // The rest that follows this block, so the answer is useful between
        // sets rather than only afterwards.
        const extendedIds = new Set(
          [...(await ctx.defaults()).values()]
            .filter((d) => d.extended_rest && d.exercise_id)
            .map((d) => d.exercise_id as string),
        );
        const settings = await ctx.settings();
        const rest = restDurationFor([match.exercise.id], extendedIds, {
          normal: settings?.rest_timer_duration,
          extended: settings?.rest_timer_duration_extended,
        });

        return text(
          `${match.exercise.name} set ${write.setNumber}: ${shown} x ${reps}${against}${overwrote}. Rest ${rest}s.`,
        );
      }),
  );

  server.registerTool(
    'ez_edit_set',
    {
      title: 'Correct a set already logged',
      description:
        'Changes the weight or reps of one set in the running workout. It touches that set only: the sets after it, the exercise default and the template are all left alone, because a correction or a drop set is not a change of plan.',
      inputSchema: {
        exercise: z.string().describe('Exercise name, as spoken.'),
        set: z.number().int().min(1).describe('Which set to correct.'),
        weight: z.number().min(0).optional().describe('Corrected weight.'),
        unit: unitArg,
        reps: z.number().int().min(0).optional().describe('Corrected reps performed.'),
      },
      annotations: { destructiveHint: true, idempotentHint: true },
    },
    async ({ exercise, set, weight, unit, reps }) =>
      guard(async () => {
        if (weight == null && reps == null) return fail('Give a weight, reps, or both.');

        const workout = await ctx.activeWorkout();
        if (!workout) return fail('No workout is running, so there is no set to correct.');

        const displayUnit = await ctx.unit();
        const match = await ctx.resolveExercise(exercise);
        const we = (await ctx.scope.exercisesOf(workout)).find((row) => row.exerciseId === match.exercise.id);
        if (!we) return fail(`${match.exercise.name} is not in the workout running now.`);

        const logs = await ctx.scope.logsOf(we);
        const existing = logs.find((row) => Number(row.set_number) === set);
        if (!existing) return fail(`${match.exercise.name} has no set ${set} logged.`);

        const patch: Record<string, unknown> = {};

        if (weight != null) {
          const weightKg = await ctx.toStorage(weight, unit);
          // Routed through the app's own rule for what an edit may touch, so
          // the two cannot drift. Scope 'set' is not configurable here.
          const edit = planWeightEdit({
            workoutExerciseId: we.id,
            exerciseId: match.exercise.id,
            setNumber: set,
            weightKg,
            scope: 'set',
          });
          if (edit.updatesDefaults || edit.updatesTemplates) {
            throw new Error('planWeightEdit widened the scope of a single-set edit.');
          }
          patch.weight = edit.weightKg;
        }

        if (reps != null) {
          const plan = planSet({ performed: reps, prescribed: (existing.reps as number | null) ?? null });
          patch.reps = plan.reps;
          patch.failed_reps = plan.failed_reps;
          patch.extra_reps = plan.extra_reps;
          patch.completed = plan.completed;
        }

        await ctx.scope.writeLog(we, { ...existing, ...patch, set_number: set });

        const after = { ...existing, ...patch } as { weight: number | null; reps: number | null };
        const shown = after.weight != null ? formatWeight(after.weight, displayUnit) : 'bodyweight';
        return text(
          `${match.exercise.name} set ${set} is now ${shown} x ${performedFrom({ ...existing, ...patch } as never)}. This set only.`,
        );
      }),
  );

  server.registerTool(
    'ez_finish_workout',
    {
      title: 'Finish the workout',
      description:
        'Closes the workout currently running and reports what was logged. Nothing is deleted; finishing only stamps the end time.',
      inputSchema: {},
      annotations: { destructiveHint: false, idempotentHint: true },
    },
    async () =>
      guard(async () => {
        const workout = await ctx.activeWorkout();
        if (!workout) return text('No workout is running.');

        const wes = await ctx.scope.exercisesOf(workout);
        const logs = await logsFor(
          ctx,
          wes.map((we) => we.id),
        );
        const done = logs.filter((l) => l.completed).length;

        await ctx.scope.updateOwn('workouts', workout.id, { end_time: new Date().toISOString() });

        return text(`Finished. ${wes.length} exercises, ${done} completed sets.`);
      }),
  );

  /* A small convenience that saves a round trip in the gym: what is next. */
  server.registerTool(
    'ez_whats_next',
    {
      title: 'What is left in this workout',
      description:
        'The exercises in the running workout with what has been logged against each, so you can see what is still to do without listing the template.',
      inputSchema: {},
    },
    async () =>
      guard(async () => {
        const workout = await ctx.activeWorkout();
        if (!workout) return text('No workout is running.');

        const unit = await ctx.unit();
        const wes = await ctx.scope.exercisesOf(workout);
        const logs = await logsFor(
          ctx,
          wes.map((we) => we.id),
        );
        const library = new Map((await ctx.library()).map((e) => [e.id, e.name]));
        const defaults = await ctx.defaults();

        const lines = wes.map((we) => {
          const name = library.get(we.exerciseId ?? '') ?? 'unknown exercise';
          const mine = logs.filter((l) => l.workout_exercise_id === we.id);
          const target = defaults.get(we.exerciseId ?? '')?.sets ?? null;
          const done = mine.filter((l) => l.completed).length;

          const detail = mine.length
            ? describeSets(
                mine
                  .sort((a, b) => a.set_number - b.set_number)
                  .map((l) => ({ weightKg: l.weight, performed: performedFrom(l), prescribed: l.reps ?? 0 })),
                unit,
              )
            : 'nothing yet';

          const of = target ? `${done}/${target}` : `${done}`;
          return `  ${name} [${of}]: ${detail}`;
        });

        return text(lines.join('\n'));
      }),
  );
}

/** Used by the entry points so both transports expose the same server. */
export function createServer(ctx: Ctx): McpServer {
  const server = new McpServer(
    { name: 'ez-workout', version: '0.1.0' },
    {
      instructions:
        'Workout tracking for ez-workout. Weights are stored in kilograms but spoken in the unit on the account; ' +
        'a dumbbell weight is the pair, not one hand. Reps given to these tools are reps actually performed. ' +
        'Start a workout before logging sets, and correct a mistake with ez_edit_set rather than logging it twice.',
    },
  );

  registerTools(server, ctx);
  return server;
}
