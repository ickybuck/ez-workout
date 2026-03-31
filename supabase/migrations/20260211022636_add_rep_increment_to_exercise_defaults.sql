/*
  # Add rep_increment to exercise_defaults

  1. Changes
    - Add `rep_increment` column to `exercise_defaults` table
      - Type: integer (whole numbers like 1, 2, 3 reps)
      - Default value: 1
      - Nullable: true
  
  2. Purpose
    - Allows users to configure rep increment for bodyweight exercises
    - Weighted exercises use weight_increment, bodyweight exercises use rep_increment
    - Used by plateau detection to suggest appropriate rep increases
*/

-- Add rep_increment column to exercise_defaults
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'exercise_defaults' AND column_name = 'rep_increment'
  ) THEN
    ALTER TABLE exercise_defaults ADD COLUMN rep_increment integer DEFAULT 1;
  END IF;
END $$;