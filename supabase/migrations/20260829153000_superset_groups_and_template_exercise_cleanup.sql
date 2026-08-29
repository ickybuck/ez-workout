/*
  # Supersets become explicit, and a template can mix them with straight sets

  Applied to production 2026-08-29. Recorded here so the repo tracks the live
  database.

  Pairing has never been stored. workout_templates.template_type is a single
  flag for the whole template, and the UI infers which exercises are paired
  from adjacency -- index % 2 === 0 in ExerciseList. Three consequences: a
  template is entirely supersets or entirely not, pairs cannot be declared, and
  changing a partner means reordering.

  That matters now because the pairing is a deliberate design decision under
  active revision, not incidental layout. It cannot be tuned while it is an
  ordering convention rather than data.

  ## First, 23 dead rows

  template_exercises held 23 rows with exercise_id IS NULL -- 91 rows for what
  is really 68 exercises. They date from April 2025, the app's first two weeks,
  the same window that produced the orphaned workouts in EZ-12. Every read path
  already filters them, so they were invisible in the app, which is why they
  survived seventeen months.

  They cannot survive a pairing scheme keyed on position. Removed first, and
  once gone (template_id, order_index) is unique with zero collisions -- so a
  unique index goes on to stop the shape recurring.

  Nothing references template_exercises.id (checked against
  information_schema), so the delete is self-contained.

  ## Then superset_group

  A nullable integer on both template_exercises and workout_exercises. Rows
  sharing a group within the same template or workout are performed together;
  NULL means a straight set with its own rest. An integer rather than a
  "paired_with" reference because it expresses a triple as easily as a pair,
  and because the alternative needs two rows updated in step to stay
  consistent.

  Backfilled to preserve today's behaviour exactly rather than to impose a
  better one: every existing template is template_type = 'superset', so
  consecutive rows are paired as the UI already pairs them. Nobody's workout
  changes shape because of this migration.

  workout_exercises is backfilled too, so a session already in progress keeps
  its pairing rather than losing it mid-workout.

  template_type is deliberately left in place. It still drives live code, and
  removing it in the same migration that adds its replacement is how you get an
  outage between two deploys -- the mistake this project already made once and
  documented, in the migration that dropped user_settings.is_admin.

  Verified after applying: 0 rows with a null exercise_id, 68 template
  exercises all grouped, 2934 workout exercises grouped, and Eric's Ham/Glute
  template pairing exactly as the app renders it (Deadlift+Crunches, Hip
  Thrust+Bicycle Crunch, Split Squats+Mountain Climbers, Leg Curls+Seated Calf
  Raises, Glute Kickbacks+Standing Calf Raises).
*/

DELETE FROM public.template_exercises WHERE exercise_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS template_exercises_template_order_idx
  ON public.template_exercises (template_id, order_index);

ALTER TABLE public.template_exercises
  ADD COLUMN IF NOT EXISTS superset_group integer;
ALTER TABLE public.workout_exercises
  ADD COLUMN IF NOT EXISTS superset_group integer;

ALTER TABLE public.template_exercises
  DROP CONSTRAINT IF EXISTS template_exercises_superset_group_check;
ALTER TABLE public.template_exercises
  ADD CONSTRAINT template_exercises_superset_group_check
  CHECK (superset_group IS NULL OR superset_group >= 0);

ALTER TABLE public.workout_exercises
  DROP CONSTRAINT IF EXISTS workout_exercises_superset_group_check;
ALTER TABLE public.workout_exercises
  ADD CONSTRAINT workout_exercises_superset_group_check
  CHECK (superset_group IS NULL OR superset_group >= 0);

WITH ranked AS (
  SELECT te.id,
         ((ROW_NUMBER() OVER (PARTITION BY te.template_id ORDER BY te.order_index) - 1) / 2)::int AS grp
  FROM public.template_exercises te
  JOIN public.workout_templates t ON t.id = te.template_id
  WHERE t.template_type = 'superset'
)
UPDATE public.template_exercises te
SET superset_group = ranked.grp
FROM ranked
WHERE te.id = ranked.id;

WITH ranked AS (
  SELECT we.id,
         ((ROW_NUMBER() OVER (PARTITION BY we.workout_id ORDER BY we.order_index) - 1) / 2)::int AS grp
  FROM public.workout_exercises we
  JOIN public.workouts w ON w.id = we.workout_id
  WHERE w.template_type = 'superset'
)
UPDATE public.workout_exercises we
SET superset_group = ranked.grp
FROM ranked
WHERE we.id = ranked.id;

COMMENT ON COLUMN public.template_exercises.superset_group IS
  'Exercises sharing a group within a template are performed as a superset. NULL means a straight set with its own rest.';
COMMENT ON COLUMN public.workout_exercises.superset_group IS
  'Snapshot of the template pairing at the time the workout started.';
