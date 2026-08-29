import { useSyncExternalStore } from 'react';
import { workoutQueue } from '../lib/workoutSync';

/**
 * Number of workout changes still waiting to reach the server.
 *
 * Exists so the UI can say "still saving" rather than leaving an offline user
 * to infer it. Finishing a workout offline marks it done locally but it will
 * not appear in History until the write lands, and without an indicator that
 * looks exactly like losing the session.
 */
export function usePendingSync(): number {
  return useSyncExternalStore(
    workoutQueue.subscribe,
    workoutQueue.size,
    // Server snapshot: nothing is ever pending during SSR/prerender.
    () => 0,
  );
}
