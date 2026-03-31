/*
  # Rename exercise defaults columns

  1. Changes
    - Rename columns in exercise_defaults table to remove "default_" prefix:
      - default_sets -> sets
      - default_reps -> reps
      - default_weight -> weight
    - Keep weight_increment as is since it's not a default value

  2. Notes
    - All data is preserved
    - All constraints and policies remain unchanged
*/

ALTER TABLE exercise_defaults
  RENAME COLUMN default_sets TO sets;

ALTER TABLE exercise_defaults
  RENAME COLUMN default_reps TO reps;

ALTER TABLE exercise_defaults
  RENAME COLUMN default_weight TO weight;