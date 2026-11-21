/*
  # One row per set number, per exercise in a workout

  A set is identified by its position within an exercise: set 2 of the leg
  press in Tuesday's workout is one thing, and there is no sense in which
  there are two of it. The app has always behaved that way -- it creates a row
  per planned set and updates it -- but nothing in the database said so, and
  all 4,770 existing rows already satisfy it with zero duplicate pairs.

  Writing it down matters now because the MCP server logs sets over a phone
  connection, where a retry is normal. With this index the write is an upsert
  on (workout_exercise_id, set_number) and a repeated call is harmless. Without
  it, idempotency would have to be a read-then-write in application code, which
  is a race rather than a guarantee.

  workout_exercise_id is nullable and currently has no nulls. Null is not equal
  to null in a unique index, so orphan rows would not collide -- that is fine
  here, because an orphan log is already broken for other reasons.

  Safe for the running bundle: the app writes one row per set and updates by
  id, so no existing write path can violate this.

  Applied to production 2026-11-20 before this file was committed, per the
  order in CLAUDE.md.
*/

CREATE UNIQUE INDEX IF NOT EXISTS exercise_logs_exercise_set_unique
  ON public.exercise_logs (workout_exercise_id, set_number);
