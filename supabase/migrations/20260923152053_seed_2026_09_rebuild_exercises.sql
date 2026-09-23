/*
  # Seven exercises for the 2026-09 template rebuild, with muscle mappings

  EZ-37. The rebuild file `docs/templates/ez-workout-templates-rebuild-2026-09-23.json`
  lists these under proposed_exercises and cannot be imported until the
  catalogue holds them, because a template row resolves its exercise by name.

  Names are exact, and they are the names the import file uses. Changing one
  here without changing it there breaks the import quietly -- the exercise is
  simply not found.

  ## The seven

  - Dumbbell Shoulder Press -- the shoulder press machine at this gym is far
    from the free weights, so the dumbbell version is what actually gets done.
    Kept as its own exercise rather than renaming the machine, so the machine's
    logged history stays attached to the machine.
  - Incline Dumbbell Curl -- replaces Cable Curls in the rebuild; the incline
    puts the long head on stretch.
  - Cable External Rotation -- rotator cuff work, added because Cable Upright
    Row was dropped. Equipment is Machine: the catalogue's Cable type was
    removed in 20250327181824 and only Barbell, Body Weight, Dumbbell and
    Machine remain.
  - Pallof Press -- anti-rotation core, part of the diastasis-recti plan.
  - Dead Bug -- anti-extension core, same.
  - Romanian Deadlift -- done on the Smith machine; there is no free barbell
    at this gym, so equipment is Machine like the other Smith lifts.
  - Suitcase Carry -- loaded carry, one side at a time.

  ## Why the mappings ship with them

  The effective-set calculation reads exercise_muscle_groups. An exercise with
  no rows there contributes its sets to nothing at all, which is what happened
  to Seated Cable Rows and Leg Press before 20260829170000 -- 216 sets
  attributed to no muscle, and a muscle-balance reading built on the gap. New
  exercises are worth mapping on the way in rather than after the first
  surprise.

  These are conventional assignments, mirroring the already-detailed rows in
  this same table. They are a training judgement, not a fact, and they are
  ordinary rows -- easy to change.

  ## Idempotence

  Both inserts skip what is already there, so a re-run is a no-op. Exercises
  match on lower(trim(name)), the same expression as the exercises_name_unique_ci
  index, so an exercise that already exists under a different equipment type is
  left exactly as it is rather than being duplicated or rewritten.
*/

-- ---------------------------------------------------------------------------
-- The exercises
-- ---------------------------------------------------------------------------

INSERT INTO public.exercises (name, description, equipment_type_id, body_part_id, is_compound)
SELECT
  v.name,
  v.description,
  et.id,
  bp.id,
  v.is_compound
FROM (VALUES
  ('Dumbbell Shoulder Press', 'Seated or standing dumbbell overhead press. Stands in for the shoulder press machine, which is across the gym from the free weights.', 'Dumbbell',   'Shoulders', true),
  ('Incline Dumbbell Curl',   'Curl on an inclined bench, arms hanging behind the torso to keep the long head on stretch.',                                             'Dumbbell',   'Biceps',    false),
  ('Cable External Rotation', 'Elbow at the side, forearm rotating outward against the cable. Rotator cuff work on the crossover.',                                   'Machine',    'Shoulders', false),
  ('Pallof Press',            'Anti-rotation press from a cable at chest height. Resist the twist; do not create one.',                                               'Machine',    'Core',      false),
  ('Dead Bug',                'Supine, opposite arm and leg lowering while the lower back stays flat. Anti-extension core.',                                          'Body Weight','Core',      false),
  ('Romanian Deadlift',       'Hip hinge from the top with soft knees, bar close to the legs. Done on the Smith machine at this gym.',                                'Machine',    'Legs',      true),
  ('Suitcase Carry',          'Walk with load in one hand, ribs down and shoulders level. Anti-lateral-flexion core.',                                                'Dumbbell',   'Core',      false)
) AS v(name, description, equipment_name, body_part_name, is_compound)
JOIN public.equipment_types et ON et.name = v.equipment_name
JOIN public.body_parts bp ON bp.name = v.body_part_name
ON CONFLICT (lower(trim(name))) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Their muscle mappings
-- ---------------------------------------------------------------------------

INSERT INTO public.exercise_muscle_groups (exercise_id, muscle_group_id, is_primary)
SELECT e.id, mg.id, v.is_primary
FROM (VALUES
  ('Dumbbell Shoulder Press', 'Front Shoulders', true),
  ('Dumbbell Shoulder Press', 'Side Shoulders',  false),
  ('Dumbbell Shoulder Press', 'Triceps',         false),
  ('Incline Dumbbell Curl',   'Biceps',          true),
  ('Incline Dumbbell Curl',   'Forearms',        false),
  ('Cable External Rotation', 'Rotator Cuff',    true),
  ('Cable External Rotation', 'Rear Shoulders',  false),
  ('Pallof Press',            'Obliques',        true),
  ('Pallof Press',            'Abdominals',      false),
  ('Dead Bug',                'Abdominals',      true),
  ('Dead Bug',                'Obliques',        false),
  ('Dead Bug',                'Hip Flexors',     false),
  ('Romanian Deadlift',       'Hamstrings',      true),
  ('Romanian Deadlift',       'Glutes',          true),
  ('Romanian Deadlift',       'Lower Back',      false),
  ('Romanian Deadlift',       'Adductors',       false),
  ('Romanian Deadlift',       'Forearms',        false),
  ('Suitcase Carry',          'Obliques',        true),
  ('Suitcase Carry',          'Forearms',        true),
  ('Suitcase Carry',          'Abdominals',      false),
  ('Suitcase Carry',          'Upper Back',      false)
) AS v(exercise_name, muscle_name, is_primary)
JOIN public.exercises e ON lower(trim(e.name)) = lower(trim(v.exercise_name))
JOIN public.muscle_groups mg ON mg.name = v.muscle_name
WHERE NOT EXISTS (
  SELECT 1 FROM public.exercise_muscle_groups m
  WHERE m.exercise_id = e.id AND m.muscle_group_id = mg.id
);
