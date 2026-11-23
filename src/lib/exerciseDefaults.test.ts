import { describe, it, expect, vi } from 'vitest';
import { saveMyExerciseDefaults } from './exerciseDefaults';

function fakeClient({ userId = 'user-1', error = null as unknown } = {}) {
  const upsert = vi.fn().mockResolvedValue({ error });
  const from = vi.fn(() => ({ upsert }));
  const getSession = vi.fn().mockResolvedValue({
    data: { session: userId ? { user: { id: userId } } : null },
  });
  return { client: { from, auth: { getSession } } as never, from, upsert };
}

describe('saveMyExerciseDefaults', () => {
  it('upserts the signed-in person\'s row, so a first save creates it', async () => {
    const { client, from, upsert } = fakeClient();
    await saveMyExerciseDefaults(client, 'ex-1', { bar_weight: 11.34, weight: 52.2 });

    expect(from).toHaveBeenCalledWith('exercise_defaults');
    const [row, options] = upsert.mock.calls[0];
    expect(row).toMatchObject({ exercise_id: 'ex-1', user_id: 'user-1', bar_weight: 11.34, weight: 52.2 });
    expect(row.updated_at).toEqual(expect.any(String));
    expect(options).toEqual({ onConflict: 'exercise_id,user_id' });
  });

  it('sends only the fields given, so an existing row keeps the rest', async () => {
    const { client, upsert } = fakeClient();
    await saveMyExerciseDefaults(client, 'ex-1', { weight: 40 });
    expect(Object.keys(upsert.mock.calls[0][0]).sort()).toEqual(['exercise_id', 'updated_at', 'user_id', 'weight']);
  });

  it('throws the database error instead of reporting success', async () => {
    const { client } = fakeClient({ error: { message: 'denied' } });
    await expect(saveMyExerciseDefaults(client, 'ex-1', { weight: 1 })).rejects.toEqual({ message: 'denied' });
  });

  it('refuses when nobody is signed in', async () => {
    const { client, upsert } = fakeClient({ userId: '' });
    await expect(saveMyExerciseDefaults(client, 'ex-1', { weight: 1 })).rejects.toThrow(/signed in/);
    expect(upsert).not.toHaveBeenCalled();
  });
});
