/*
  # EZ-11 data repair — configuration weights only

  Applied to production 2026-08-29 and recorded here so the repo tracks the
  live database.

  Until today the client rounded weights to one decimal place of a kilogram
  before saving. For someone working in pounds that is lossy: 165 lb was
  stored as 74.8 kg, which reads back as 164.91 lb. **Every pound value ever
  entered was affected**, not only the small increments the finding first
  described — the old display simply hid it by rounding pounds back to whole
  numbers. Removing that rounding so 2.5 lb plates could survive is what made
  the existing damage visible.

  Storage is numeric(10,3) as of the previous migration, so new saves
  round-trip exactly. This repairs what was already stored.

  ## Scope, agreed with Eric

  Configuration only: `exercise_defaults.weight` and
  `template_exercises.default_weight`. These are settings he would retype
  anyway.

  `exercise_logs` is deliberately NOT touched — 8,939 rows of recorded
  history. Rewriting what a past session logged is a different act from
  correcting a setting, even by a tenth of a pound. The cost is that old
  workout details keep showing 164.91; that was judged acceptable.

  `weight_increment` and `bar_weight` are also untouched. An increment stored
  as 2.3 kg could have meant 5 lb or 2.5 kg, and a 20 kg bar is a standard
  Olympic bar as readily as a mis-stored 45 lb one. There is no evidence
  either way, so no guess is made.

  ## Why the tolerance is 0.15 lb

  Rounding to one decimal of a kilogram shifts a value by at most 0.05 kg,
  which is 0.11 lb. So anything within 0.15 lb of a whole pound is explained
  by this bug and is repaired.

  The 18 rows outside that window drift by 0.16 to 0.48 lb and sit on clean
  half-kilogram values — 75.0, 45.5, 90.5, 72.5, 27.3 — so they were entered
  in kilograms rather than damaged, and are left exactly as they are. The
  tolerance separates two real populations; it is not an arbitrary cut.

  Verified after applying: Bench Press 74.800 -> 74.843 kg (165.00 lb),
  Deadlift 115.700 -> 115.666 (255.00), Bicep Curls 18.200 -> 18.144 (40.00),
  Seated Calf Raises unchanged at 90.500 (199.52, kg-native).
*/

UPDATE public.exercise_defaults
SET weight = round(round(weight * 2.20462262185) / 2.20462262185, 3)
WHERE weight > 0
  AND abs(weight * 2.20462262185 - round(weight * 2.20462262185)) <= 0.15;

UPDATE public.template_exercises
SET default_weight = round(round(default_weight * 2.20462262185) / 2.20462262185, 3)
WHERE default_weight > 0
  AND abs(default_weight * 2.20462262185 - round(default_weight * 2.20462262185)) <= 0.15;
