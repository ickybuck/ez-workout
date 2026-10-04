/*
  # One convention for two-dumbbell lifts: log the pair, count real reps

  EZ-42. Volume is weight x (reps - failed_reps), one row per set, and the app
  has no notion of "per side" anywhere. So a two-dumbbell lift logged at the
  per-hand weight records half the work actually done, and the only ways to fix
  it are conventions rather than code.

  ## The standard, decided by Eric 2026-10-04

  - **One side at a time** (Lunges, Split Squats, Suitcase Carry): count reps
    across both sides, weight as loaded. 10 per leg is 20 reps. Volume comes out
    right because each rep really is one rep at that load. This is already what
    the data does -- nothing changes.

  - **Both dumbbells together** (presses, curls, raises, flyes): log the PAIR
    weight, reps as actually performed. Two 40s is 80, ten curls is 10.

  Doubling the reps instead would also fix the volume, and it is what the curl
  history did for a year (40 lb x 20). It is rejected because the rep count is
  not only a volume input: the 8-12 target range, double progression, the
  estimated one-rep max and the stall detector all read it, and ten presses
  recorded as twenty reps is wrong for every one of them.

  ## What this changes

  Almost nothing, because the switch was already under way. Hammer Curls was
  already at 80 lb in both templates and in exercise_defaults, and the sets
  logged on 2026-10-02 read 80 x 12. Incline Dumbbell Curl is the one row still
  on the old scheme: 3 x 20 reps at 0 lb, against sets logged 2026-09-29 at
  35 lb x 10 -- per hand, so 70 as a pair.

  Legacy templates ("2 Push Upper Focused", "4 Pull Upper Focused", "Upper Body
  2") are deliberately untouched. They are superseded and not in the rotation;
  editing them would only make their history harder to read.

  ## What is NOT changed, on purpose

  exercise_logs. It is the record of what was lifted, and the same call was made
  for EZ-11 and for the 2026-08-29 snap. Note the consequence honestly: the curl
  series now carries a step from 40 to 80 that is a change of units, not of
  strength -- and it is the second such step, since Bicep Curls already ran at
  60.4 lb x 20 until 2025-09-17 and then dropped to 30 x 20. Any trend reading
  on curls spans at least two conventions and should be read as three separate
  series, not one.
*/

-- Incline Dumbbell Curl: pair weight, real reps.
WITH target AS (
  SELECT e.id FROM public.exercises e WHERE lower(trim(e.name)) = 'incline dumbbell curl'
)
UPDATE public.template_exercises te
SET default_reps = 10,
    default_weight = 70 / 2.20462262185,
    updated_at = now()
FROM public.workout_templates t, target
WHERE t.id = te.template_id
  AND te.exercise_id = target.id
  AND t.is_hidden = false
  AND t.name = '2 Upper A';

WITH target AS (
  SELECT e.id FROM public.exercises e WHERE lower(trim(e.name)) = 'incline dumbbell curl'
)
UPDATE public.exercise_defaults ed
SET reps = 10,
    weight = 70 / 2.20462262185,
    updated_at = now()
FROM target
WHERE ed.exercise_id = target.id
  AND ed.weight = 0;
