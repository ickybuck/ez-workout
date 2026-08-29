/*
  # Remove the empty workout shells, and give body weight room to be exact

  Applied to production 2026-08-29. Recorded here so the repo tracks the live
  database.

  ## The 175 shells

  Workouts with no end_time, spanning 2025-03-27 to 2026-05-07. Verified before
  deleting rather than assumed: every one of the 175 had zero completed sets and
  zero reps recorded. Not one contained training.

  That verification mattered, because "unfinished" and "abandoned" are not the
  same thing and the instruction was to keep sessions ended early. It turned out
  none of these were that -- every session with real work in it carries an
  end_time and sits in the finished set. So the rule is simply "delete the ones
  with nothing in them", and it happens to catch all of them.

  Rows removed child-first: exercise_logs and workout_exercises do not cascade.

  This is what EZ-12 recorded as optional tidy-up. It also means the workout
  count finally tells the truth: 142 real sessions, not 317.

  ## Body weight

  EZ-30, and the one place today's pound-drift repair did not look: Settings
  read 190.04 lb. Stored as numeric(5,2), which gives 0.01 kg resolution --
  0.022 lb -- so a whole number of pounds cannot be represented exactly.

  Same defect as EZ-11, in the column EZ-11 explicitly skipped, on the reasoning
  that body weight is "typed by hand, not a converted value, so it has no round
  trip to lose". That reasoning was wrong: the field is labelled in pounds and
  converted for display, so it round-trips like every other weight. Worth
  remembering as a case where a migration comment argued itself out of a fix.

  Widened to numeric(6,3), matching what EZ-11 did for the exercise weights, and
  set to Eric's current 200 lb exactly.

  Verified after: 0 shells, 142 workouts, 4,259 exercise_logs intact, 0 orphaned
  workout_exercises, body weight reading 200.00 lb.
*/

DELETE FROM public.exercise_logs
WHERE workout_exercise_id IN (
  SELECT we.id FROM public.workout_exercises we
  JOIN public.workouts w ON w.id = we.workout_id
  WHERE w.end_time IS NULL
);

DELETE FROM public.workout_exercises
WHERE workout_id IN (SELECT id FROM public.workouts WHERE end_time IS NULL);

DELETE FROM public.workouts WHERE end_time IS NULL;

ALTER TABLE public.user_settings
  ALTER COLUMN weight TYPE numeric(6,3);

UPDATE public.user_settings us
SET weight = 200 / 2.20462262185,
    updated_at = now()
FROM auth.users u
WHERE u.id = us.user_id AND u.email = 'eric@thepetersens.ca';
