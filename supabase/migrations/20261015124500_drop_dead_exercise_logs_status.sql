/*
  # Drop exercise_logs.status

  EZ-32, decided by Eric 2026-10-15 after sitting on "Needs decision" since
  2026-08-30. Drop rather than populate.

  The column was added and backfilled once in March 2025 and the app has never
  written it since. Every one of the 4,319 rows read 'pending', including the
  4,148 that are complete -- the backfill predates every surviving row. It was
  NOT NULL with a CHECK over pending/completed/failed/skipped/not_attempted,
  which is exactly what made it dangerous: it looked like state worth trusting.

  completed, failed_reps, extra_reps and stop_reason already carry the meaning
  between them, and they are the columns the app actually maintains.

  ## Ordering, which matters here

  The export that surfaced this value was changed first and deployed to the NAS
  before this ran. The app is served as a built bundle from a container, so a
  drop while the old bundle was live would have made the workout export fail on
  a column that no longer exists -- a PostgREST 400, not a graceful degradation.
  Code out (commit a3e4bca, merged as 139c6b54), deployed and verified running,
  then this.

  Nothing else in the client referenced it: the only reads were in
  src/lib/workoutExport.ts.
*/

ALTER TABLE public.exercise_logs DROP COLUMN IF EXISTS status;
