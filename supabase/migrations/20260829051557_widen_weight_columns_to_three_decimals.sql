/*
  # EZ-11 — widen weight columns so pound values survive storage

  Applied to production 2026-08-29 and recorded here so the repo tracks the
  live database.

  Weights are stored in kilograms. The columns were numeric(10,2), and 0.01 kg
  is 0.022 lb — too coarse for a user working in pounds, because a pound value
  cannot always survive the round trip through storage.

  Found by a round-trip test rather than by inspection, which is worth noting:
  the original diagnosis was that `parseWeight` rounded to one decimal and
  `convertWeight` rounded pounds to whole numbers. Both were true and both are
  fixed in src/lib/weight.ts. But with those fixed and storage still at two
  decimals, 135 lb becomes 61.23 kg and reads back as 134.99 lb. Only the test
  caught that third layer.

  Scale 3 gives 1 gram resolution — 0.0022 lb — finer than any plate anyone
  owns, and enough for the display to round cleanly to two decimals in either
  unit.

  Widening numeric scale is non-destructive: existing values keep their exact
  value and simply gain available precision. No rows are rewritten.

  user_settings.weight is deliberately left at numeric(5,2). It is body weight
  typed by hand, not a converted value, so it has no round trip to lose.
*/

ALTER TABLE public.exercise_defaults
  ALTER COLUMN weight           TYPE numeric(10,3),
  ALTER COLUMN weight_increment TYPE numeric(10,3),
  ALTER COLUMN bar_weight       TYPE numeric(10,3);

ALTER TABLE public.exercise_logs
  ALTER COLUMN weight TYPE numeric(10,3);

ALTER TABLE public.template_exercises
  ALTER COLUMN default_weight TYPE numeric(10,3);
