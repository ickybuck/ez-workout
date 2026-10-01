/*
  # A longer rest for the lifts that earn it

  One rest timer, one duration, for every exercise in every workout. 90 seconds
  is either too long after lateral raises or too short after a set of squats;
  it cannot be both right.

  ## Why a flag per exercise rather than per category

  The obvious lever was exercises.is_compound, and it is the wrong one twice
  over. It is wrong as data -- 42 of 65 rows are flagged compound, including
  Crunches, Side Plank, Face Pulls, Tricep Pushdowns and both calf raises --
  and it is wrong as a concept, because the question here is not "is this a
  compound movement" but "do I need two minutes after this". Those mostly
  agree and sometimes do not: Leg Press earns the long rest, Dips supersetted
  with Pull-ups does not.

  So: a plain checkbox that says what it does. is_compound is left exactly as
  it is, still driving the library badge and the sets-and-reps hint.

  ## Why it sits on exercise_defaults

  That table is already the answer to "how do I do this exercise" -- sets,
  reps, weight, increment, bar weight, hidden -- and it is keyed per user. A
  rest preference is the same shape, and putting it here means one account's
  choice cannot reach into the other's timer. exercises is admin-curated and
  shared; this is neither.

  ## Seeding

  The eight lifts in the 2026-09 templates that are loaded enough to want it:
  the seven from the plan's "Heavy lifts" row, plus Leg Press, which the plan
  omits despite it being the heaviest load in the programme.

  Dips and Pull-ups are deliberately NOT seeded. They are loaded compounds,
  but they are supersetted with each other in Upper A, and that block is paced
  by the pair rather than by either exercise.

  Every other exercise keeps the normal rest, including the dormant barbell
  lifts nobody is currently running. Guessing now would be worse than ticking
  the box the first time one is used.
*/

ALTER TABLE public.exercise_defaults
  ADD COLUMN IF NOT EXISTS extended_rest boolean NOT NULL DEFAULT false;

-- 120 seconds, chosen by Eric. The plan says 2-3 minutes on the heavy lifts;
-- this is the bottom of that range, on the grounds that a timer you routinely
-- cut short teaches you to ignore it.
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS rest_timer_duration_extended integer DEFAULT 120;

UPDATE public.exercise_defaults ed
SET extended_rest = true,
    updated_at = now()
FROM public.exercises e
WHERE e.id = ed.exercise_id
  AND ed.extended_rest = false
  AND lower(trim(e.name)) IN (
    'squats',
    'leg press',
    'bench press',
    'deadlift',
    'romanian deadlift',
    'hip thrust',
    'split squats',
    'bent over rows'
  );
