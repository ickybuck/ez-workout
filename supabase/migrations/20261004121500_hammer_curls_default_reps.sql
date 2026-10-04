/*
  # Hammer Curls: the defaults row still carried the doubled rep count

  Follow-on to 20261004120000. The weight was converted to the pair (80 lb) in
  both the templates and exercise_defaults, and the sets logged 2026-10-02 read
  80 x 12 -- but exercise_defaults.reps was left at 20, the count from the old
  per-hand convention where ten curls were logged as twenty reps.

  It is only visible when the exercise is used outside a template, since a
  template's own default_reps wins. Fixed anyway: a 20 sitting in the defaults
  is the same unit confusion this pair of migrations exists to remove, and the
  next person to read it has no way to tell it is stale.
*/

UPDATE public.exercise_defaults ed
SET reps = 12,
    updated_at = now()
FROM public.exercises e
WHERE e.id = ed.exercise_id
  AND lower(trim(e.name)) = 'hammer curls'
  AND ed.reps = 20;
