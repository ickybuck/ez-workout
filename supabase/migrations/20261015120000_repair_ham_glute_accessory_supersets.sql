/*
  # Ham/Glute: pair the accessories by station, not by muscle

  EZ-44. The 2026-09 rebuild paired Leg Curls with Hip Abductor, then Standing
  Calf Raises with Suitcase Carry. At Eric's gym the abductor machine is not
  near the seated leg curl, so that first pair breaks the rebuild's own rule
  that a superset stays at one station -- the reason supersets are paired this
  way at all in a busy commercial gym.

  Wanted instead: Leg Curls with Standing Calf Raises, and Hip Abductor with
  Suitcase Carry.

  ## Why this is a reorder and not a relabel

  The finding proposed changing superset_group alone. That cannot work. The
  exercises sit at positions 4, 5, 6, 7 as Leg Curls, Hip Abductor, Calf
  Raises, Suitcase Carry, so pairing 4 with 6 would leave a group straddling
  position 5. supersets.normalise() dissolves a non-contiguous group to
  straight sets, deliberately: you cannot alternate between two exercises with
  a third in between. So the rows move and the groups follow the positions.

  ## Why it moves in two passes

  template_exercises carries a unique constraint on (template_id, order_index),
  which the obvious single UPDATE violates mid-statement: Hip Abductor cannot
  take position 6 while Calf Raises still holds it. The rows are parked at
  +100 first and brought back afterwards. Any future reorder of a template
  needs the same shape.

  Set counts per cycle are unchanged -- nothing is added or removed, and no
  weights or rep targets are touched. Only the order and the pairing move.

  Not verified from here, and worth checking on the next Ham/Glute session:
  that the abductor is close enough to the dumbbells for the Suitcase Carry
  half of its new pair. The leg curl and calf raise are both machines, which
  is the easier of the two claims.
*/

-- Pass 1: park the two that swap, clear of every occupied index.
UPDATE public.template_exercises te
SET order_index = te.order_index + 100,
    updated_at = now()
FROM public.workout_templates t, public.exercises e
WHERE t.id = te.template_id
  AND e.id = te.exercise_id
  AND t.name = '3 Ham/Glute Focused'
  AND t.is_hidden = false
  AND t.created_at > '2026-09-01'
  AND lower(trim(e.name)) IN ('hip abductor', 'standing calf raises');

-- Pass 2: final positions and pairing.
WITH wanted(name, order_index, superset_group) AS (
  VALUES
    ('leg curls',            4, 0),
    ('standing calf raises', 5, 0),
    ('hip abductor',         6, 1),
    ('suitcase carry',       7, 1)
)
UPDATE public.template_exercises te
SET order_index = w.order_index,
    superset_group = w.superset_group,
    updated_at = now()
FROM public.workout_templates t, public.exercises e, wanted w
WHERE t.id = te.template_id
  AND e.id = te.exercise_id
  AND t.name = '3 Ham/Glute Focused'
  AND t.is_hidden = false
  AND t.created_at > '2026-09-01'
  AND lower(trim(e.name)) = w.name;
