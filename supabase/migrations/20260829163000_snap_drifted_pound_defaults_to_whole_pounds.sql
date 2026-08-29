/*
  # Snap drifted pound weights back to whole pounds

  Applied to production 2026-08-29. Recorded here so the repo tracks the live
  database.

  Weights are stored in kilograms and increments were applied in kilograms too,
  while the plates are in pounds. Squats stepped by 9.1 kg, which is 20.06 lb;
  bench, deadlift, hip thrust and leg press by 4.5 kg, which is 9.92 lb. Every
  press landed a little further off a round number, and the error compounded
  over seventeen months.

  The result was visible in the app as weights nobody would ever say out loud:
  Seated Calf Raises at 199.52 lb, Tricep Pushdowns at 65.48, Leg Extensions at
  199.74, Russian Twists at 50.27, Squats at 295.06.

  The cause is fixed in the client (commit 4e64d0d) -- steps now happen in
  display units and round to how plates actually load -- but that only stops the
  drift growing. This clears what had already accumulated.

  ## Scope

  CONFIG ONLY. exercise_defaults.weight and template_exercises.default_weight,
  which are the prescription for future sessions. exercise_logs is deliberately
  untouched: it is the record of what was actually lifted, and rewriting it
  would be editing history to match a preference. Same call as EZ-11.

  Restricted to users whose weight_unit is 'lb'. Rounding to a whole pound is
  only meaningful for someone working in pounds -- for the kilogram user it
  would introduce exactly the drift this removes. She had none either way.

  Only rows already more than 0.005 lb off are touched, so a weight that is
  already round is left byte-identical rather than rewritten through a lossy
  round trip.

  Verified before: 10 drifted defaults and 10 drifted template rows, all
  belonging to the pounds user; 0 for the kilogram user.

  Verified after: 0 drifted rows in either table, 8,939 exercise_logs rows
  untouched, and the ten now reading 200, 65, 165, 100, 50, 200, 65, 60, 160
  and 295 lb exactly.
*/

WITH lb_users AS (
  SELECT user_id FROM public.user_settings WHERE weight_unit = 'lb'
)
UPDATE public.exercise_defaults ed
SET weight = ROUND((ed.weight * 2.20462262185)::numeric) / 2.20462262185,
    updated_at = now()
WHERE ed.user_id IN (SELECT user_id FROM lb_users)
  AND ed.weight > 0
  AND ABS(ROUND((ed.weight * 2.20462262185)::numeric) - (ed.weight * 2.20462262185)::numeric) > 0.005;

WITH lb_users AS (
  SELECT user_id FROM public.user_settings WHERE weight_unit = 'lb'
)
UPDATE public.template_exercises te
SET default_weight = ROUND((te.default_weight * 2.20462262185)::numeric) / 2.20462262185,
    updated_at = now()
FROM public.workout_templates t
WHERE te.template_id = t.id
  AND t.user_id IN (SELECT user_id FROM lb_users)
  AND te.default_weight > 0
  AND ABS(ROUND((te.default_weight * 2.20462262185)::numeric) - (te.default_weight * 2.20462262185)::numeric) > 0.005;
