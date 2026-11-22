import { describe, it, expect } from 'vitest';
import { scopeFor, NotAdminError, NotYoursError } from './userScope';
import type { Client } from './supabase';

/*
 * A recording stand-in for the Supabase client.
 *
 * These tests are about what the scope *sends* -- which filters, which
 * conflict target, which shape of ownership check -- because that is where
 * the isolation actually lives. Results are queued per table and handed out
 * in order; anything awaited without a queued result comes back empty.
 */
interface Recorded {
  table: string;
  ops: string[];
  args: unknown[][];
}

function makeClient(results: Record<string, unknown[]> = {}) {
  const calls: Recorded[] = [];
  const queue: Record<string, unknown[]> = {};
  for (const [table, list] of Object.entries(results)) queue[table] = [...list];

  const from = (table: string) => {
    const rec: Recorded = { table, ops: [], args: [] };
    calls.push(rec);

    const take = () => queue[table]?.shift() ?? { data: null, error: null };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const builder: any = new Proxy(
      {},
      {
        get(_target, prop: string) {
          if (prop === 'then') {
            const result = take();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject);
          }
          if (prop === 'maybeSingle' || prop === 'single') {
            return async () => take();
          }
          return (...args: unknown[]) => {
            rec.ops.push(prop);
            rec.args.push(args);
            return builder;
          };
        },
      },
    );

    return builder;
  };

  return { client: { from } as unknown as Client, calls };
}

const argsFor = (rec: Recorded, op: string) => rec.args[rec.ops.indexOf(op)];

describe('scopeFor', () => {
  it('refuses to build a scope with no user', () => {
    // An empty user id would make every filter match nothing and every
    // insert write an unowned row.
    expect(() => scopeFor(makeClient().client, '')).toThrow(/needs a user id/);
  });
});

describe('owned tables', () => {
  it('filters every select to this user', () => {
    const { client, calls } = makeClient();
    scopeFor(client, 'u-1').own('workout_templates');

    expect(calls[0].table).toBe('workout_templates');
    expect(argsFor(calls[0], 'eq')).toEqual(['user_id', 'u-1']);
  });

  it('stamps user_id on every inserted row, whatever the caller passed', async () => {
    const { client, calls } = makeClient({ workouts: [{ data: [{ id: 'w-1' }], error: null }] });
    // Note the hostile input: a caller trying to write as somebody else.
    await scopeFor(client, 'u-1').insertOwn('workouts', [{ name: 'A', user_id: 'u-2' }, { name: 'B' }]);

    expect(argsFor(calls[0], 'insert')).toEqual([
      [
        { name: 'A', user_id: 'u-1' },
        { name: 'B', user_id: 'u-1' },
      ],
    ]);
  });

  it('filters updates to this user as well as by id', async () => {
    const { client, calls } = makeClient({ user_settings: [{ data: { id: 's-1' }, error: null }] });
    await scopeFor(client, 'u-1').updateOwn('user_settings', 's-1', { weight_unit: 'lb' });

    expect(calls[0].args.filter((_, i) => calls[0].ops[i] === 'eq')).toEqual([
      ['id', 's-1'],
      ['user_id', 'u-1'],
    ]);
  });

  it('does not filter the shared exercise library by user', () => {
    const { client, calls } = makeClient();
    scopeFor(client, 'u-1').shared('exercises');

    expect(calls[0].ops).not.toContain('eq');
  });
});

describe('proving ownership', () => {
  it('rejects a workout that is not yours', async () => {
    const { client } = makeClient({ workouts: [{ data: null, error: null }] });
    await expect(scopeFor(client, 'u-1').proveWorkout('w-9')).rejects.toBeInstanceOf(NotYoursError);
  });

  it('rejects a template that is not yours', async () => {
    const { client } = makeClient({ workout_templates: [{ data: null, error: null }] });
    await expect(scopeFor(client, 'u-1').proveTemplate('t-9')).rejects.toBeInstanceOf(NotYoursError);
  });

  it('checks the parent workout in a separate query, never an embedded filter', async () => {
    // EZ-09: a filter on an embedded resource does not error when it fails,
    // it stops filtering. Here that would mean handing back another person's
    // set, so ownership is two plain queries instead.
    const { client, calls } = makeClient({
      workout_exercises: [{ data: { id: 'we-1', workout_id: 'w-1', exercise_id: 'e-1', order_index: 0, superset_group: null }, error: null }],
      workouts: [{ data: { id: 'w-1' }, error: null }],
    });

    const we = await scopeFor(client, 'u-1').proveWorkoutExercise('we-1');

    expect(we.workoutId).toBe('w-1');
    expect(calls.map((c) => c.table)).toEqual(['workout_exercises', 'workouts']);
    expect(argsFor(calls[1], 'eq')).toEqual(['id', 'w-1']);
    expect(calls[1].args.filter((_, i) => calls[1].ops[i] === 'eq')).toContainEqual(['user_id', 'u-1']);
    // No select anywhere asks the database to filter through a join.
    expect(JSON.stringify(calls.map((c) => c.args))).not.toContain('!inner');
  });

  it('refuses a set belonging to someone else even though the child row exists', async () => {
    // The child row is readable -- it has no user_id to filter on. The refusal
    // has to come from the second query, and it does.
    const { client } = makeClient({
      workout_exercises: [{ data: { id: 'we-1', workout_id: 'w-other', exercise_id: 'e-1', order_index: 0, superset_group: null }, error: null }],
      workouts: [{ data: null, error: null }],
    });

    await expect(scopeFor(client, 'u-1').proveWorkoutExercise('we-1')).rejects.toBeInstanceOf(NotYoursError);
  });

  it('refuses a child row with no parent at all', async () => {
    const { client } = makeClient({
      workout_exercises: [{ data: { id: 'we-1', workout_id: null, exercise_id: 'e-1', order_index: 0, superset_group: null }, error: null }],
    });

    await expect(scopeFor(client, 'u-1').proveWorkoutExercise('we-1')).rejects.toBeInstanceOf(NotYoursError);
  });
});

describe('writing a set', () => {
  it('upserts on the set identity so a retry cannot double-log', async () => {
    const { client, calls } = makeClient({
      workout_exercises: [{ data: { id: 'we-1', workout_id: 'w-1', exercise_id: 'e-1', order_index: 0, superset_group: null }, error: null }],
      workouts: [{ data: { id: 'w-1' }, error: null }],
      exercise_logs: [{ data: { id: 'l-1', set_number: 2 }, error: null }],
    });

    const scope = scopeFor(client, 'u-1');
    const we = await scope.proveWorkoutExercise('we-1');
    await scope.writeLog(we, { set_number: 2, weight: 31.751, reps: 10, completed: true });

    const logs = calls.find((c) => c.table === 'exercise_logs')!;
    expect(argsFor(logs, 'upsert')).toEqual([
      { set_number: 2, weight: 31.751, reps: 10, completed: true, workout_exercise_id: 'we-1' },
      { onConflict: 'workout_exercise_id,set_number' },
    ]);
  });

  it('pins the log to the proven exercise, ignoring any id in the row', async () => {
    const { client, calls } = makeClient({
      workout_exercises: [{ data: { id: 'we-1', workout_id: 'w-1', exercise_id: 'e-1', order_index: 0, superset_group: null }, error: null }],
      workouts: [{ data: { id: 'w-1' }, error: null }],
      exercise_logs: [{ data: { id: 'l-1' }, error: null }],
    });

    const scope = scopeFor(client, 'u-1');
    const we = await scope.proveWorkoutExercise('we-1');
    await scope.writeLog(we, { workout_exercise_id: 'we-somebody-else', set_number: 1 });

    const logs = calls.find((c) => c.table === 'exercise_logs')!;
    expect((argsFor(logs, 'upsert')[0] as Record<string, unknown>).workout_exercise_id).toBe('we-1');
  });
});

describe('reading a workout', () => {
  it('pages the children with a stable order', async () => {
    // EZ-35/EZ-39: a select returns at most 1,000 rows and says nothing about
    // it, so every list goes through fetchAllPages with an explicit range and
    // a tie-broken order.
    const { client, calls } = makeClient({
      workout_exercises: [{ data: [], error: null }],
      workouts: [{ data: { id: 'w-1' }, error: null }],
    });

    const scope = scopeFor(client, 'u-1');
    const workout = await scope.proveWorkout('w-1');
    await scope.exercisesOf(workout);

    const children = calls.filter((c) => c.table === 'workout_exercises')[0];
    expect(children.ops).toContain('range');
    expect(children.args.filter((_, i) => children.ops[i] === 'order')).toEqual([['order_index'], ['id']]);
  });
});

describe('the shared library (EZ-51)', () => {
  it('refuses to prove admin for someone not in admin_users', async () => {
    const { client } = makeClient({ admin_users: [{ data: null, error: null }] });
    await expect(scopeFor(client, 'u-1').proveAdmin()).rejects.toBeInstanceOf(NotAdminError);
  });

  it('checks admin_users for this user, not any user', async () => {
    const { client, calls } = makeClient({ admin_users: [{ data: { user_id: 'u-1' }, error: null }] });
    await scopeFor(client, 'u-1').proveAdmin();
    expect(argsFor(calls[0], 'eq')).toEqual(['user_id', 'u-1']);
  });

  it('stamps created_by on a new exercise, whatever the caller passed', async () => {
    const { client, calls } = makeClient({
      admin_users: [{ data: { user_id: 'u-1' }, error: null }],
      exercises: [{ data: { id: 'e-1', name: 'X' }, error: null }],
    });
    const scope = scopeFor(client, 'u-1');
    const admin = await scope.proveAdmin();
    await scope.insertExercise(admin, { name: 'X', created_by: 'u-2' });
    const insert = calls.find((c) => c.table === 'exercises')!;
    expect(argsFor(insert, 'insert')).toEqual([{ name: 'X', created_by: 'u-1' }]);
  });

  it('will not accept an admin proof minted for another user', async () => {
    const other = makeClient({ admin_users: [{ data: { user_id: 'u-2' }, error: null }] });
    const proof = await scopeFor(other.client, 'u-2').proveAdmin();
    const { client, calls } = makeClient();
    await expect(scopeFor(client, 'u-1').updateExercise(proof, 'e-1', { name: 'Y' })).rejects.toBeInstanceOf(NotAdminError);
    expect(calls).toHaveLength(0);
  });
});

describe('template rows', () => {
  async function provenTemplate() {
    const made = makeClient({
      workout_templates: [{ data: { id: 't-1', name: 'Legs' }, error: null }],
      template_exercises: [
        {
          data: [
            { id: 'r-1', template_id: 't-1', exercise_id: 'e-1', order_index: 0, superset_group: null },
            { id: 'r-2', template_id: 't-1', exercise_id: 'e-2', order_index: 1, superset_group: null },
          ],
          error: null,
        },
      ],
    });
    const scope = scopeFor(made.client, 'u-1');
    const template = await scope.proveTemplate('t-1');
    return { ...made, scope, template };
  }

  it('confines updates and deletes to the proven template as well as the row', async () => {
    const { scope, template, calls } = await provenTemplate();
    const [row] = await scope.templateExercisesOf(template);
    await scope.updateTemplateExercise(row, { default_sets: 4 });
    await scope.deleteTemplateExercise(row);
    const writes = calls.filter((c) => c.table === 'template_exercises' && (c.ops.includes('update') || c.ops.includes('delete')));
    for (const w of writes) {
      expect(w.args.filter((_, i) => w.ops[i] === 'eq')).toEqual([
        ['id', 'r-1'],
        ['template_id', 't-1'],
      ]);
    }
    expect(writes).toHaveLength(2);
  });

  it('writes a swap in two passes so the unique order index is never held twice', async () => {
    const { scope, template, calls } = await provenTemplate();
    await scope.writeTemplateLayout(template, [
      { id: 'r-2', superset_group: null },
      { id: 'r-1', superset_group: null },
    ]);
    const updates = calls
      .filter((c) => c.table === 'template_exercises' && c.ops.includes('update'))
      .map((c) => argsFor(c, 'update')[0] as { order_index: number });
    expect(updates.map((u) => u.order_index)).toEqual([1_000_000, 1_000_001, 0, 1]);
  });
});

describe('deleting a template (EZ-52)', () => {
  it('filters the delete to this user and refuses when nothing was deleted', async () => {
    const { client, calls } = makeClient({
      workout_templates: [
        { data: { id: 't-1', name: 'Legs' }, error: null },
        { data: [], error: null },
      ],
    });
    const scope = scopeFor(client, 'u-1');
    const template = await scope.proveTemplate('t-1');
    await expect(scope.deleteTemplate(template)).rejects.toBeInstanceOf(NotYoursError);
    const del = calls.find((c) => c.ops.includes('delete'))!;
    expect(del.args.filter((_, i) => del.ops[i] === 'eq')).toEqual([
      ['id', 't-1'],
      ['user_id', 'u-1'],
    ]);
  });
});
