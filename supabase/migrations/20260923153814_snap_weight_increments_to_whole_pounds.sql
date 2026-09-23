/*
  # Snap weight increments to whole pounds, and stop minting new crooked ones

  EZ-38. The 2026-08-29 snap (20260829163000) fixed the weights and said so
  plainly: "CONFIG ONLY. exercise_defaults.weight and
  template_exercises.default_weight." weight_increment was never in scope, so
  every step this app offers a pounds user is still a kilogram number wearing
  pounds:

    2.3 kg -> 5.07 lb   42 rows
    4.5 kg -> 9.92 lb   14 rows
    9.1 kg -> 20.06 lb   5 rows

  Only 2 of 64 rows were a whole number of pounds. 2.3 kg is the worst of them
  because it is not a rounding error at all -- it was chosen deliberately in
  20250408000132 as "about five pounds", and has been the default ever since.

  A crooked increment is worse than a crooked weight. A weight is wrong once; an
  increment is wrong every time it is applied, and it is what dragged the stored
  weights off round numbers in the first place -- which is what the 08-29
  migration had to clean up. Fixing the weights and leaving the steps that
  moved them was half a fix.

  ## Scope

  exercise_defaults.weight_increment only, and only for users whose weight_unit
  is 'lb'. Rounding to a whole pound is meaningful only for someone working in
  pounds; for the kilogram user it would introduce exactly the drift this
  removes. Rows already within 0.005 lb of whole are left byte-identical rather
  than rewritten through a lossy round trip.

  Nothing in exercise_logs is touched. That is the record of what was lifted,
  not a setting -- the same call as EZ-11 and the 08-29 snap.

  ## The column default

  Also changed, from 2.3 to 2.267962 kg, which is five pounds exactly. It reads
  as 2.3 kg to one decimal place, so the kilogram display does not move; only
  the pounds one stops saying 5.07. The client now sends an explicit,
  unit-appropriate increment on every insert, so this default should rarely
  apply -- but when it does it should not be wrong.
*/

ALTER TABLE public.exercise_defaults
  ALTER COLUMN weight_increment SET DEFAULT 2.267962;

WITH lb_users AS (
  SELECT user_id FROM public.user_settings WHERE weight_unit = 'lb'
)
UPDATE public.exercise_defaults ed
SET weight_increment = ROUND((ed.weight_increment * 2.20462262185)::numeric) / 2.20462262185,
    updated_at = now()
WHERE ed.user_id IN (SELECT user_id FROM lb_users)
  AND ed.weight_increment > 0
  AND ABS(
        ROUND((ed.weight_increment * 2.20462262185)::numeric)
        - (ed.weight_increment * 2.20462262185)::numeric
      ) > 0.005;
