/*
  # Muscle mappings: two missing exercises, then the ones that were one line deep

  Applied to production 2026-08-29 in two steps, recorded here together.

  The effective-set calculation is the first thing in this app to read
  exercise_muscle_groups closely, and it exposed how thin the data was.

  ## Step 1 -- exercises with no mapping at all

  Seated Cable Rows (117 logged sets) and Leg Press (99) had no rows
  whatsoever, so 216 sets were attributed to nothing. Mapped by mirroring T-Bar
  Rows and Squats respectively, omitting the bracing muscles in both cases
  because the seated and machine variants support the trunk.

  ## Step 2 -- exercises mapped one line deep

  Ten exercises in active use carried one or two muscles, several a single
  primary with no secondaries: Leg Curls across 201 sets, Lat Pulldowns and
  Face Pulls across 117 each.

  The consequential one: Face Pulls were not mapped to Rotator Cuff, and they
  are one of the two main cuff movements in this programme. So the reading that
  "Rotator Cuff is the standout deficit at 3.7 sets a week" was drawn from a
  figure excluding its largest contributor. With the mapping corrected it is
  5.5 -- still under-served, but not what it looked like. A mapping nobody reads
  is harmless; one that something now depends on is not.

  Six exercises with no logged sets (Push Press, Hack Squats, Pull-ups,
  Overhead Press, Incline Bench Press, Meadows Rows) were mapped too, so they
  are not a surprise the first time they are used.

  These are conventional assignments mirroring the already-detailed exercises in
  this same table. They are a training judgement rather than a fact, and they
  are ordinary rows -- easy to change, and worth reviewing.

  Effect on the 180-day picture: Upper Back 11.0 -> 14.7, Front Shoulders
  10.9 -> 12.8, Rear Shoulders 7.3 -> 8.3, Rotator Cuff 3.7 -> 5.5. Chest is
  unchanged at 7.4 and is now the clearest deficit among the major muscles.
*/

INSERT INTO public.exercise_muscle_groups (exercise_id, muscle_group_id, is_primary)
SELECT e.id, mg.id, v.is_primary
FROM (VALUES
  ('Seated Cable Rows',  'Lats',            true),
  ('Seated Cable Rows',  'Upper Back',      true),
  ('Seated Cable Rows',  'Biceps',          false),
  ('Seated Cable Rows',  'Rear Shoulders',  false),
  ('Seated Cable Rows',  'Forearms',        false),
  ('Leg Press',          'Quadriceps',      true),
  ('Leg Press',          'Glutes',          true),
  ('Leg Press',          'Hamstrings',      false),
  ('Leg Press',          'Calves',          false),
  ('Leg Press',          'Adductors',       false),
  ('Leg Curls',          'Hamstrings',      true),
  ('Leg Curls',          'Calves',          false),
  ('Lat Pulldowns',      'Lats',            true),
  ('Lat Pulldowns',      'Upper Back',      true),
  ('Lat Pulldowns',      'Biceps',          false),
  ('Lat Pulldowns',      'Rear Shoulders',  false),
  ('Lat Pulldowns',      'Forearms',        false),
  ('Face Pulls',         'Rear Shoulders',  true),
  ('Face Pulls',         'Rotator Cuff',    true),
  ('Face Pulls',         'Upper Back',      false),
  ('Lateral Raises',     'Side Shoulders',  true),
  ('Lateral Raises',     'Front Shoulders', false),
  ('Lateral Raises',     'Upper Back',      false),
  ('Planks',             'Abdominals',      true),
  ('Planks',             'Obliques',        false),
  ('Planks',             'Lower Back',      false),
  ('Planks',             'Serratus',        false),
  ('Hanging Leg Raises', 'Abdominals',      true),
  ('Hanging Leg Raises', 'Hip Flexors',     false),
  ('Hanging Leg Raises', 'Obliques',        false),
  ('Hanging Leg Raises', 'Forearms',        false),
  ('Hammer Curls',       'Biceps',          true),
  ('Hammer Curls',       'Forearms',        true),
  ('Cable Curls',        'Biceps',          true),
  ('Cable Curls',        'Forearms',        false),
  ('Skull Crushers',     'Triceps',         true),
  ('Skull Crushers',     'Front Shoulders', false),
  ('Leg Extensions',     'Quadriceps',      true),
  ('Overhead Press',     'Front Shoulders', true),
  ('Overhead Press',     'Side Shoulders',  true),
  ('Overhead Press',     'Triceps',         false),
  ('Overhead Press',     'Upper Back',      false),
  ('Overhead Press',     'Abdominals',      false),
  ('Incline Bench Press','Chest',           true),
  ('Incline Bench Press','Front Shoulders', true),
  ('Incline Bench Press','Triceps',         false),
  ('Pull-ups',           'Lats',            true),
  ('Pull-ups',           'Upper Back',      true),
  ('Pull-ups',           'Biceps',          false),
  ('Pull-ups',           'Forearms',        false),
  ('Pull-ups',           'Abdominals',      false),
  ('Push Press',         'Front Shoulders', true),
  ('Push Press',         'Side Shoulders',  true),
  ('Push Press',         'Triceps',         false),
  ('Push Press',         'Quadriceps',      false),
  ('Push Press',         'Glutes',          false),
  ('Hack Squats',        'Quadriceps',      true),
  ('Hack Squats',        'Glutes',          true),
  ('Hack Squats',        'Hamstrings',      false),
  ('Hack Squats',        'Calves',          false),
  ('Meadows Rows',       'Lats',            true),
  ('Meadows Rows',       'Upper Back',      true),
  ('Meadows Rows',       'Biceps',          false),
  ('Meadows Rows',       'Rear Shoulders',  false),
  ('Meadows Rows',       'Lower Back',      false)
) AS v(exercise_name, muscle_name, is_primary)
JOIN public.exercises e ON e.name = v.exercise_name
JOIN public.muscle_groups mg ON mg.name = v.muscle_name
WHERE NOT EXISTS (
  SELECT 1 FROM public.exercise_muscle_groups m
  WHERE m.exercise_id = e.id AND m.muscle_group_id = mg.id
);
