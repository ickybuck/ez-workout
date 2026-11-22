/*
 * Changing the exercise library and templates (EZ-51).
 *
 * The training tools in tools.ts record what happened; these change the plan.
 * They are kept apart because the two must not blur: logging a set never
 * rewrites a template (EZ-46), and nothing here touches a logged workout.
 *
 * Two kinds of thing are edited, with different owners:
 *
 *   The exercise library is shared. Every account sees the same exercises,
 *   and a logged set points at one by id, so renaming "Leg Press" renames it
 *   in everyone's history. Adding to it or changing it is for admins only,
 *   and a change to an existing exercise is not written until the caller
 *   passes confirm_affects_everyone -- the tool's first answer is the warning,
 *   which the model is told to relay. New names are checked for near-
 *   duplicates first (newExercise.ts), because a near-duplicate makes every
 *   later spoken name ambiguous.
 *
 *   A person's own targets (exercise_defaults) and templates are theirs. Any
 *   change is allowed and none of it is visible to anyone else.
 *
 * Template layout goes through templateLayout.ts, which reuses the app's own
 * superset rules, and is written through scope.writeTemplateLayout, which
 * orders the writes so the (template_id, order_index) unique index is never
 * hit mid-change.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { defaultIncrementKg, format as formatWeight, type WeightUnit } from '../src/lib/weight';
import { hasAnySuperset } from '../src/lib/supersets';
import { PARKING_OFFSET } from '../src/lib/templateOrder';
import { canonical, matchExercise } from './matchExercise';
import { checkNewName } from './newExercise';
import { templateDetails } from './queries';
import {
  insertItem,
  LayoutError,
  moveItem,
  pairWithNext,
  removeItem,
  unpair,
  type LayoutItem,
} from './templateLayout';
import { fail, guard, renderTemplate, text } from './toolResult';
import type { Ctx, LibraryExercise, ReferenceTable } from './context';
import type { OwnedTemplate, OwnedTemplateExercise } from './userScope';

const CATEGORIES = ['Upper Body', 'Lower Body', 'Core Focused', 'Whole Body'] as const;

const unitArg = z
  .enum(['kg', 'lb'])
  .optional()
  .describe('Unit of any weight given. Defaults to the unit set on the account.');

const setsArg = z.number().int().min(1).max(20);
const repsArg = z.number().int().min(0).max(200);
const weightArg = z.number().min(0);

/* ------------------------------------------------------------- helpers */

async function referenceId(ctx: Ctx, table: ReferenceTable, name: string, noun: string): Promise<string> {
  return matchExercise(name, await ctx.reference(table), { noun, listKnown: true }).exercise.id;
}

async function muscleRows(
  ctx: Ctx,
  primary: string[] | undefined,
  secondary: string[] | undefined,
): Promise<Array<{ muscle_group_id: string; is_primary: boolean }>> {
  const rows = new Map<string, boolean>();
  for (const name of secondary ?? []) rows.set(await referenceId(ctx, 'muscle_groups', name, 'muscle group'), false);
  // Primary wins if a muscle is named in both lists.
  for (const name of primary ?? []) rows.set(await referenceId(ctx, 'muscle_groups', name, 'muscle group'), true);
  return [...rows].map(([muscle_group_id, is_primary]) => ({ muscle_group_id, is_primary }));
}

/** The template as it stands now, rendered with positions, for the reply. */
async function showTemplate(ctx: Ctx, template: OwnedTemplate, unit: WeightUnit): Promise<string> {
  const detail = (await templateDetails(ctx, true)).find((t) => t.id === template.id);
  return detail ? renderTemplate(detail, unit) : template.name;
}

function layoutOf(rows: OwnedTemplateExercise[]): LayoutItem[] {
  return rows.map((row) => ({ key: row.id, superset_group: row.supersetGroup }));
}

function rowFor(rows: OwnedTemplateExercise[], exercise: LibraryExercise, template: OwnedTemplate): OwnedTemplateExercise {
  const row = rows.find((r) => r.exerciseId === exercise.id);
  if (!row) throw new LayoutError(`${exercise.name} is not in ${template.name}.`);
  return row;
}

/** The app's starting targets for an exercise added to a template. */
function startingTargets(
  exercise: LibraryExercise,
  defaults: { sets: number | null; reps: number | null; weight: number | null } | undefined,
) {
  return {
    sets: defaults?.sets || (exercise.is_compound ? 4 : 3),
    reps: defaults?.reps || (exercise.is_compound ? 8 : 12),
    weightKg: defaults?.weight || 0,
  };
}

/* --------------------------------------------------------------- tools */

export function registerEditTools(server: McpServer, ctx: Ctx): void {
  /* ------------------------------------------------- the shared library */

  server.registerTool(
    'ez_search_exercises',
    {
      title: 'Search the exercise library',
      description:
        'Finds exercises in the shared library by words in their name. Use it before adding an exercise, so the library does not end up with two names for one movement, and when a name given to another tool was ambiguous.',
      inputSchema: {
        query: z.string().optional().describe('Words to look for, e.g. "curl" or "hip". Omit to list everything.'),
      },
    },
    async ({ query }) =>
      guard(async () => {
        const [library, defaults] = await Promise.all([ctx.library(), ctx.defaults()]);
        const words = canonical(query ?? '').split(' ').filter(Boolean);
        const hits = library.filter((e) => {
          const name = canonical(e.name);
          return words.every((w) => name.includes(w));
        });
        if (!hits.length) return text(`No exercise names contain "${query}".`);

        const lines = hits.map((e) => {
          const mine = defaults.get(e.id);
          return `${e.name}${mine?.hidden ? ' (hidden for you)' : ''}`;
        });
        return text(`${hits.length} exercise${hits.length === 1 ? '' : 's'}:\n${lines.join('\n')}`);
      }),
  );

  server.registerTool(
    'ez_create_exercise',
    {
      title: 'Add an exercise to the shared library',
      description:
        'Adds a new exercise that everyone using the app will see, plus the caller\'s own starting targets for it. Admins only. Refuses a name already in the library, and stops at names that look like an existing exercise ("Hip Abduction" next to "Hip Abductor") until confirm_distinct is true -- ask the person before setting it. Equipment, body part and muscle names are matched against the app\'s lists; a wrong one is refused with the list.',
      inputSchema: {
        name: z.string().min(2).max(80).describe('The exercise name as it should appear in the app.'),
        equipment: z.string().optional().describe('E.g. barbell, dumbbell, machine, cable, bodyweight.'),
        body_part: z.string().optional().describe('Main body part, e.g. legs, chest, back.'),
        primary_muscles: z.array(z.string()).optional(),
        secondary_muscles: z.array(z.string()).optional(),
        compound: z.boolean().optional().describe('Works several joints, like a squat or press.'),
        plate_loaded: z.boolean().optional().describe('Loaded with plates, so the plate calculator applies.'),
        description: z.string().max(500).optional(),
        sets: setsArg.optional().describe('Your starting sets. Default 3.'),
        reps: repsArg.optional().describe('Your starting reps. Default 10.'),
        weight: weightArg.optional().describe('Your starting weight. Default 0.'),
        unit: unitArg,
        confirm_distinct: z
          .boolean()
          .optional()
          .describe('Set true only after the person has confirmed this is not one of the similar exercises listed.'),
      },
      annotations: { destructiveHint: false, idempotentHint: false },
    },
    async (args) =>
      guard(async () => {
        const admin = await ctx.scope.proveAdmin();
        const name = args.name.trim().replace(/\s+/g, ' ');
        const library = await ctx.library();

        const check = checkNewName(name, library);
        if (check.same) return fail(`"${check.same}" is already in the library. Use it rather than adding another.`);
        if (check.similar.length && !args.confirm_distinct) {
          return fail(
            `Not added. These are already in the library and look similar: ${check.similar.join(', ')}. ` +
              'Ask whether one of them is the same exercise. If it really is a different one, call again with confirm_distinct true.',
          );
        }

        // Resolve every name before writing anything, so a typo in a muscle
        // does not leave a half-made exercise behind.
        const equipmentId = args.equipment ? await referenceId(ctx, 'equipment_types', args.equipment, 'equipment type') : null;
        const bodyPartId = args.body_part ? await referenceId(ctx, 'body_parts', args.body_part, 'body part') : null;
        const muscles = await muscleRows(ctx, args.primary_muscles, args.secondary_muscles);
        const unit = await ctx.unit();

        const created = await ctx.scope.insertExercise(admin, {
          name,
          description: args.description ?? null,
          equipment_type_id: equipmentId,
          body_part_id: bodyPartId,
          is_compound: args.compound ?? false,
          is_plate_loaded: args.plate_loaded ?? false,
        });
        if (muscles.length) await ctx.scope.replaceMuscleGroups(admin, created.id, muscles);

        const weightKg = args.weight != null ? await ctx.toStorage(args.weight, args.unit) : 0;
        await ctx.scope.upsertDefaults(created.id, {
          sets: args.sets ?? 3,
          reps: args.reps ?? 10,
          weight: weightKg,
          weight_increment: defaultIncrementKg(unit),
        });

        ctx.forget();
        return text(
          `Added ${created.name} to the shared library. Your targets: ${args.sets ?? 3}x${args.reps ?? 10} at ${formatWeight(weightKg, unit)}.`,
        );
      }),
  );

  server.registerTool(
    'ez_update_my_exercise_settings',
    {
      title: 'Change your own targets for an exercise',
      description:
        'Changes the caller\'s own sets, reps, weight, weight step, bar weight, longer rest, or whether the exercise is hidden from their library. Private to the caller; nobody else is affected. Like the app\'s exercise editor, new sets, reps or weight also update that exercise in all of the caller\'s templates unless update_templates is false. To change targets in one template only, use ez_template_edit_exercise.',
      inputSchema: {
        exercise: z.string().describe('Exercise name, as spoken.'),
        sets: setsArg.optional(),
        reps: repsArg.optional(),
        weight: weightArg.optional(),
        weight_step: weightArg.optional().describe('How much the weight goes up or down by.'),
        bar_weight: weightArg.optional().describe('Weight of the bar or sled before plates.'),
        unit: unitArg,
        longer_rest: z.boolean().optional().describe('Use the longer rest timer after this exercise.'),
        hidden: z.boolean().optional().describe('Hide it from your exercise library and pickers.'),
        update_templates: z.boolean().optional().describe('Default true.'),
      },
      annotations: { destructiveHint: false, idempotentHint: true },
    },
    async (args) =>
      guard(async () => {
        const match = await ctx.resolveExercise(args.exercise);
        const patch: Record<string, unknown> = {};
        if (args.sets != null) patch.sets = args.sets;
        if (args.reps != null) patch.reps = args.reps;
        if (args.weight != null) patch.weight = await ctx.toStorage(args.weight, args.unit);
        if (args.weight_step != null) patch.weight_increment = await ctx.toStorage(args.weight_step, args.unit);
        if (args.bar_weight != null) patch.bar_weight = await ctx.toStorage(args.bar_weight, args.unit);
        if (args.longer_rest != null) patch.extended_rest = args.longer_rest;
        if (args.hidden != null) patch.hidden = args.hidden;
        if (!Object.keys(patch).length) return fail('Nothing to change. Give sets, reps, weight, weight_step, bar_weight, longer_rest or hidden.');

        await ctx.scope.upsertDefaults(match.exercise.id, patch);

        let touched = 0;
        const targets: Record<string, unknown> = {};
        if (patch.sets != null) targets.default_sets = patch.sets;
        if (patch.reps != null) targets.default_reps = patch.reps;
        if (patch.weight != null) targets.default_weight = patch.weight;

        if (Object.keys(targets).length && args.update_templates !== false) {
          for (const summary of await ctx.templates()) {
            const template = await ctx.scope.proveTemplate(summary.id);
            for (const row of await ctx.scope.templateExercisesOf(template)) {
              if (row.exerciseId !== match.exercise.id) continue;
              await ctx.scope.updateTemplateExercise(row, targets);
              touched += 1;
            }
          }
        }

        ctx.forget();
        const unit = await ctx.unit();
        const said = [
          args.sets != null ? `${args.sets} sets` : null,
          args.reps != null ? `${args.reps} reps` : null,
          patch.weight != null ? formatWeight(patch.weight as number, unit) : null,
          patch.weight_increment != null ? `steps of ${formatWeight(patch.weight_increment as number, unit)}` : null,
          patch.bar_weight != null ? `bar ${formatWeight(patch.bar_weight as number, unit)}` : null,
          args.longer_rest != null ? (args.longer_rest ? 'longer rest' : 'normal rest') : null,
          args.hidden != null ? (args.hidden ? 'hidden' : 'shown') : null,
        ].filter(Boolean);
        const where = touched ? ` Also updated in ${touched} template entr${touched === 1 ? 'y' : 'ies'}.` : '';
        return text(`${match.exercise.name}: ${said.join(', ')}. Only your settings changed.${where}`);
      }),
  );

  server.registerTool(
    'ez_edit_exercise',
    {
      title: 'Change a shared exercise (affects everyone)',
      description:
        'Changes what an exercise is -- name, description, equipment, body part, muscles, compound, plate-loaded -- for EVERY user, in their templates and their workout history. Admins only. The first call without confirm_affects_everyone saves nothing and returns a warning: tell the person, in those terms, that this changes the exercise for everyone, and only call again with confirm_affects_everyone true if they still want it. For a personal variation, add a new exercise with ez_create_exercise and swap it into their templates instead. For their own sets, reps or weight use ez_update_my_exercise_settings.',
      inputSchema: {
        exercise: z.string().describe('The exercise to change, as spoken.'),
        name: z.string().min(2).max(80).optional().describe('New name.'),
        description: z.string().max(500).optional(),
        equipment: z.string().optional(),
        body_part: z.string().optional(),
        primary_muscles: z.array(z.string()).optional().describe('Replaces the primary muscles.'),
        secondary_muscles: z.array(z.string()).optional().describe('Replaces the secondary muscles.'),
        compound: z.boolean().optional(),
        plate_loaded: z.boolean().optional(),
        confirm_affects_everyone: z
          .boolean()
          .optional()
          .describe('Set true only after the person has been told this changes the exercise for every user and still wants it.'),
      },
      annotations: { destructiveHint: true, idempotentHint: true },
    },
    async (args) =>
      guard(async () => {
        const admin = await ctx.scope.proveAdmin();
        const match = await ctx.resolveExercise(args.exercise);
        const exercise = match.exercise;

        const patch: Record<string, unknown> = {};
        const changing: string[] = [];

        if (args.name != null) {
          const name = args.name.trim().replace(/\s+/g, ' ');
          const others = (await ctx.library()).filter((e) => e.id !== exercise.id);
          const clash = checkNewName(name, others).same;
          if (clash) return fail(`"${clash}" is already in the library, so ${exercise.name} cannot take that name.`);
          if (name !== exercise.name) {
            patch.name = name;
            changing.push(`name (to "${name}")`);
          }
        }
        if (args.description != null) {
          patch.description = args.description;
          changing.push('description');
        }
        if (args.equipment != null) {
          patch.equipment_type_id = await referenceId(ctx, 'equipment_types', args.equipment, 'equipment type');
          changing.push(`equipment (to ${args.equipment})`);
        }
        if (args.body_part != null) {
          patch.body_part_id = await referenceId(ctx, 'body_parts', args.body_part, 'body part');
          changing.push(`body part (to ${args.body_part})`);
        }
        if (args.compound != null) {
          patch.is_compound = args.compound;
          changing.push(args.compound ? 'compound (on)' : 'compound (off)');
        }
        if (args.plate_loaded != null) {
          patch.is_plate_loaded = args.plate_loaded;
          changing.push(args.plate_loaded ? 'plate-loaded (on)' : 'plate-loaded (off)');
        }

        let muscles: Array<{ muscle_group_id: string; is_primary: boolean }> | null = null;
        if (args.primary_muscles || args.secondary_muscles) {
          // Whichever list was not given is kept as it is.
          const { data: current, error } = await ctx.scope
            .shared('exercise_muscle_groups', 'muscle_group_id, is_primary')
            .eq('exercise_id', exercise.id);
          if (error) throw error;
          const keep = ((current ?? []) as Array<{ muscle_group_id: string; is_primary: boolean }>).filter((m) =>
            m.is_primary ? !args.primary_muscles : !args.secondary_muscles,
          );
          const given = await muscleRows(ctx, args.primary_muscles, args.secondary_muscles);
          const byId = new Map(keep.map((m) => [m.muscle_group_id, m.is_primary]));
          for (const m of given) byId.set(m.muscle_group_id, m.is_primary);
          muscles = [...byId].map(([muscle_group_id, is_primary]) => ({ muscle_group_id, is_primary }));
          changing.push('muscles');
        }

        if (!changing.length) return fail(`Nothing to change on ${exercise.name}.`);

        if (!args.confirm_affects_everyone) {
          return text(
            `Not saved yet. This would change the ${changing.join(', ')} of "${exercise.name}" for everyone who uses it, ` +
              'in their templates and in their logged workout history. Tell the person that. ' +
              'If they still want it, call ez_edit_exercise again with the same changes and confirm_affects_everyone true. ' +
              'If they only want their own version, add a new exercise with ez_create_exercise and swap it into their templates with ez_template_edit_exercise (replace_with).',
          );
        }

        const updated = Object.keys(patch).length
          ? await ctx.scope.updateExercise(admin, exercise.id, patch)
          : { id: exercise.id, name: exercise.name };
        if (muscles) await ctx.scope.replaceMuscleGroups(admin, exercise.id, muscles);
        ctx.forget();

        return text(`Changed the ${changing.join(', ')} of ${exercise.name} for everyone. It is now "${updated.name}".`);
      }),
  );

  /* ---------------------------------------------------------- templates */

  server.registerTool(
    'ez_create_template',
    {
      title: 'Create a workout template',
      description:
        'Creates one of the caller\'s templates, optionally with its exercises in order. Each exercise can join the one before it as a superset. Exercises must already be in the library; add missing ones with ez_create_exercise first. Targets not given come from the caller\'s own settings for that exercise.',
      inputSchema: {
        name: z.string().min(1).max(80),
        category: z.enum(CATEGORIES),
        description: z.string().max(500).optional(),
        exercises: z
          .array(
            z.object({
              exercise: z.string(),
              sets: setsArg.optional(),
              reps: repsArg.optional(),
              weight: weightArg.optional(),
              superset_with_previous: z.boolean().optional().describe('Perform alternating with the exercise before it.'),
            }),
          )
          .max(30)
          .optional(),
        unit: unitArg,
      },
      annotations: { destructiveHint: false, idempotentHint: false },
    },
    async (args) =>
      guard(async () => {
        const name = args.name.trim().replace(/\s+/g, ' ');
        const existing = (await ctx.templates()).find((t) => canonical(t.name) === canonical(name));
        if (existing) return fail(`You already have a template called "${existing.name}".`);

        // Resolve and plan everything before the first write.
        const defaults = await ctx.defaults();
        const planned: Array<{ key: string; exercise: LibraryExercise; sets: number; reps: number; weightKg: number }> = [];
        let layout: LayoutItem[] = [];
        for (const [index, entry] of (args.exercises ?? []).entries()) {
          const exercise = (await ctx.resolveExercise(entry.exercise)).exercise;
          if (planned.some((p) => p.exercise.id === exercise.id)) {
            return fail(`${exercise.name} is listed twice. A template has each exercise once.`);
          }
          const start = startingTargets(exercise, defaults.get(exercise.id));
          const key = `new-${index}`;
          planned.push({
            key,
            exercise,
            sets: entry.sets ?? start.sets,
            reps: entry.reps ?? start.reps,
            weightKg: entry.weight != null ? await ctx.toStorage(entry.weight, args.unit) : start.weightKg,
          });
          layout = insertItem(layout, { key, superset_group: null }, { superset: !!entry.superset_with_previous && index > 0 });
        }

        const [created] = await ctx.scope.insertOwn('workout_templates', [
          {
            name,
            category: args.category,
            description: args.description ?? null,
            template_type: hasAnySuperset(layout) ? 'superset' : 'regular',
            updated_at: new Date().toISOString(),
          },
        ]);
        const template = await ctx.scope.proveTemplate(created.id as string);

        // A new template has no rows to collide with, so each goes straight
        // to its final position.
        for (const [order, item] of layout.entries()) {
          const p = planned.find((x) => x.key === item.key)!;
          await ctx.scope.addTemplateExercise(template, {
            exercise_id: p.exercise.id,
            order_index: order,
            superset_group: item.superset_group,
            default_sets: p.sets,
            default_reps: p.reps,
            default_weight: p.weightKg,
          });
        }

        ctx.forget();
        return text(`Created.\n${await showTemplate(ctx, template, await ctx.unit())}`);
      }),
  );

  server.registerTool(
    'ez_update_template',
    {
      title: 'Rename or file a template',
      description:
        'Changes a template\'s name, description or category, marks it a favourite, or hides it from the start screen. Templates are not deleted here: hiding keeps the link from past workouts to the template they came from. Hidden templates can be found by name and shown again.',
      inputSchema: {
        template: z.string().describe('Template name, as spoken.'),
        name: z.string().min(1).max(80).optional(),
        description: z.string().max(500).optional(),
        category: z.enum(CATEGORIES).optional(),
        favourite: z.boolean().optional(),
        hidden: z.boolean().optional(),
      },
      annotations: { destructiveHint: false, idempotentHint: true },
    },
    async (args) =>
      guard(async () => {
        const template = await ctx.resolveTemplate(args.template);
        const patch: Record<string, unknown> = {};
        if (args.name != null) {
          const name = args.name.trim().replace(/\s+/g, ' ');
          const clash = (await ctx.templates()).find((t) => t.id !== template.id && canonical(t.name) === canonical(name));
          if (clash) return fail(`You already have a template called "${clash.name}".`);
          patch.name = name;
        }
        if (args.description != null) patch.description = args.description;
        if (args.category != null) patch.category = args.category;
        if (args.favourite != null) patch.is_favorite = args.favourite;
        if (args.hidden != null) patch.is_hidden = args.hidden;
        if (!Object.keys(patch).length) return fail('Nothing to change.');

        await ctx.scope.updateOwn('workout_templates', template.id, { ...patch, updated_at: new Date().toISOString() });
        ctx.forget();
        return text(`Updated.\n${await showTemplate(ctx, template, await ctx.unit())}`);
      }),
  );

  server.registerTool(
    'ez_template_add_exercise',
    {
      title: 'Add an exercise to a template',
      description:
        'Adds an exercise from the library to one of the caller\'s templates, at the end or at a 1-based position, optionally as a superset with the exercise directly above it. If the exercise is not in the library, search for it, then add it with ez_create_exercise first. Targets not given come from the caller\'s own settings for that exercise.',
      inputSchema: {
        template: z.string(),
        exercise: z.string(),
        position: z.number().int().min(1).optional().describe('1 is first. Default: last.'),
        superset_with_previous: z.boolean().optional().describe('Join the exercise directly above it.'),
        sets: setsArg.optional(),
        reps: repsArg.optional(),
        weight: weightArg.optional(),
        unit: unitArg,
      },
      annotations: { destructiveHint: false, idempotentHint: false },
    },
    async (args) =>
      guard(async () => {
        const template = await ctx.resolveTemplate(args.template);
        const exercise = (await ctx.resolveExercise(args.exercise)).exercise;
        const rows = await ctx.scope.templateExercisesOf(template);
        if (rows.some((r) => r.exerciseId === exercise.id)) {
          return fail(`${exercise.name} is already in ${template.name}. Use ez_template_edit_exercise to move it or change its targets.`);
        }

        // Plan first: a bad position is refused before anything is written.
        const desired = insertItem(layoutOf(rows), { key: 'new', superset_group: null }, {
          position: args.position,
          superset: !!args.superset_with_previous,
        });

        const start = startingTargets(exercise, (await ctx.defaults()).get(exercise.id));
        const added = await ctx.scope.addTemplateExercise(template, {
          exercise_id: exercise.id,
          // Inserted clear of every real and parked index, then placed.
          order_index: PARKING_OFFSET * 2,
          superset_group: null,
          default_sets: args.sets ?? start.sets,
          default_reps: args.reps ?? start.reps,
          default_weight: args.weight != null ? await ctx.toStorage(args.weight, args.unit) : start.weightKg,
        });

        await ctx.scope.writeTemplateLayout(
          template,
          desired.map((item) => ({ id: item.key === 'new' ? added.id : item.key, superset_group: item.superset_group })),
        );

        return text(`Added ${exercise.name}.\n${await showTemplate(ctx, template, await ctx.unit())}`);
      }),
  );

  server.registerTool(
    'ez_template_remove_exercise',
    {
      title: 'Remove an exercise from a template',
      description:
        'Takes an exercise out of one of the caller\'s templates. Past workouts are not touched. A superset left with one exercise becomes a straight set.',
      inputSchema: {
        template: z.string(),
        exercise: z.string(),
      },
      annotations: { destructiveHint: true, idempotentHint: true },
    },
    async (args) =>
      guard(async () => {
        const template = await ctx.resolveTemplate(args.template);
        const exercise = (await ctx.resolveExercise(args.exercise)).exercise;
        const rows = await ctx.scope.templateExercisesOf(template);
        const row = rowFor(rows, exercise, template);

        const desired = removeItem(layoutOf(rows), row.id);
        await ctx.scope.deleteTemplateExercise(row);
        await ctx.scope.writeTemplateLayout(
          template,
          desired.map((item) => ({ id: item.key, superset_group: item.superset_group })),
        );

        return text(`Removed ${exercise.name}.\n${await showTemplate(ctx, template, await ctx.unit())}`);
      }),
  );

  server.registerTool(
    'ez_template_edit_exercise',
    {
      title: 'Change an exercise within a template',
      description:
        'For one exercise in one of the caller\'s templates: change its sets, reps or weight in this template only, move it to a 1-based position, pair it with the exercise below as a superset, take it out of its superset, or swap in a different exercise in the same slot (replace_with). Moving an exercise takes it out of its superset first.',
      inputSchema: {
        template: z.string(),
        exercise: z.string(),
        sets: setsArg.optional(),
        reps: repsArg.optional(),
        weight: weightArg.optional(),
        unit: unitArg,
        move_to: z.number().int().min(1).optional().describe('New 1-based position.'),
        pair_with_next: z.boolean().optional().describe('Make a superset with the exercise directly below.'),
        unpair: z.boolean().optional().describe('Take it out of its superset.'),
        replace_with: z.string().optional().describe('Another exercise to put in this slot instead, keeping position and pairing.'),
      },
      annotations: { destructiveHint: false, idempotentHint: true },
    },
    async (args) =>
      guard(async () => {
        if (args.pair_with_next && args.unpair) return fail('Choose pair_with_next or unpair, not both.');

        const template = await ctx.resolveTemplate(args.template);
        const exercise = (await ctx.resolveExercise(args.exercise)).exercise;
        const rows = await ctx.scope.templateExercisesOf(template);
        const row = rowFor(rows, exercise, template);

        // Plan the layout before writing anything, so a bad position is a
        // refusal rather than a half-applied edit.
        let layout = layoutOf(rows);
        const layoutChanges: string[] = [];
        if (args.move_to != null) {
          layout = moveItem(layout, row.id, args.move_to);
          layoutChanges.push(`moved to ${args.move_to}`);
        }
        if (args.unpair) {
          layout = unpair(layout, row.id);
          layoutChanges.push('out of its superset');
        }
        if (args.pair_with_next) {
          layout = pairWithNext(layout, row.id);
          layoutChanges.push('paired with the next exercise');
        }

        let replacement: LibraryExercise | null = null;
        if (args.replace_with) {
          replacement = (await ctx.resolveExercise(args.replace_with)).exercise;
          if (replacement.id === exercise.id) replacement = null;
          else if (rows.some((r) => r.exerciseId === replacement!.id)) {
            return fail(`${replacement.name} is already in ${template.name}.`);
          }
        }

        const patch: { default_sets?: number; default_reps?: number; default_weight?: number; exercise_id?: string } = {};
        if (args.sets != null) patch.default_sets = args.sets;
        if (args.reps != null) patch.default_reps = args.reps;
        if (args.weight != null) patch.default_weight = await ctx.toStorage(args.weight, args.unit);
        if (replacement) patch.exercise_id = replacement.id;

        if (!Object.keys(patch).length && !layoutChanges.length) return fail('Nothing to change.');

        if (Object.keys(patch).length) await ctx.scope.updateTemplateExercise(row, patch);
        if (layoutChanges.length) {
          await ctx.scope.writeTemplateLayout(
            template,
            layout.map((item) => ({ id: item.key, superset_group: item.superset_group })),
          );
        }

        const said = [
          replacement ? `replaced by ${replacement.name}` : null,
          args.sets != null || args.reps != null || args.weight != null ? 'targets changed in this template' : null,
          ...layoutChanges,
        ].filter(Boolean);
        return text(`${exercise.name}: ${said.join(', ')}.\n${await showTemplate(ctx, template, await ctx.unit())}`);
      }),
  );
}
