/*
  # Add bar weight to exercise defaults

  1. Changes
    - Add bar_weight column to exercise_defaults table
    - Set default value to 20 (standard Olympic bar)
    - Update existing rows with default value
*/

-- Add bar_weight column
ALTER TABLE exercise_defaults
ADD COLUMN IF NOT EXISTS bar_weight numeric(10,2) DEFAULT 20;

-- Update existing rows
UPDATE exercise_defaults
SET bar_weight = CASE
  WHEN EXISTS (
    SELECT 1 FROM exercises e
    WHERE e.id = exercise_defaults.exercise_id
    AND e.is_plate_loaded = true
  ) THEN 20 -- Default Olympic bar weight
  ELSE 0    -- Default for machines
END
WHERE bar_weight IS NULL;