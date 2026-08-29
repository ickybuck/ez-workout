import { toast } from 'sonner';
import { supabase } from './supabase';
import { createMutationQueue, localStorageAdapter, type QueuedMutation } from './mutationQueue';

/**
 * The application-level write queue for an in-progress workout.
 *
 * Everything here is wiring; the behaviour and its tests live in
 * mutationQueue.ts, which has no knowledge of Supabase, localStorage or the
 * browser so that it can be tested exhaustively.
 */

/**
 * Tables this queue is allowed to write. Narrow on purpose — the queue only
 * handles updates to rows that already exist, and widening it without
 * thinking is how an insert ends up replayed twice.
 */
type SyncTable = 'exercise_logs' | 'workouts' | 'workout_exercises';

const storage = localStorageAdapter();

export const workoutQueue = createMutationQueue({
  execute: async (m: QueuedMutation) => {
    const { error } = await supabase
      .from(m.table as SyncTable)
      // The queue is deliberately schema-agnostic, so values arrive as a
      // plain record. The cast is the one place that shape meets the
      // generated row types; the SyncTable union above is what keeps it honest.
      .update(m.values as never)
      .eq('id', m.rowId);

    if (error) throw error;
  },

  load: storage.load,
  save: storage.save,
  now: () => Date.now(),

  // navigator.onLine only reliably reports the *absence* of a connection, so
  // treat anything else as online and let a failed write requeue itself.
  isOnline: () => (typeof navigator === 'undefined' ? true : navigator.onLine !== false),

  onAbandoned: (m, error) => {
    console.error('Gave up syncing a change', m, error);
    toast.error(
      'A change could not be saved after several attempts. Check the workout before finishing.',
    );
  },
});

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => void workoutQueue.flush());
  // Anything left over from a previous session goes out as soon as we load.
  void workoutQueue.flush();
}
