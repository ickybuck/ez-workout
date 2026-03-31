/*
  # Add is_plate_loaded column to exercises table

  1. Changes
    - Add `is_plate_loaded` boolean column to `exercises` table with default value of false
    - This column indicates whether the exercise uses weight plates for loading

  2. Notes
    - The column is nullable and defaults to false
    - No data migration needed as new column has a default value
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'exercises' AND column_name = 'is_plate_loaded'
  ) THEN
    ALTER TABLE exercises 
    ADD COLUMN is_plate_loaded boolean DEFAULT false;
  END IF;
END $$;