/*
  # Add Plate Availability Settings

  1. Changes
    - Add `available_plates_kg` column to store available kg plates as JSON array
    - Add `available_plates_lb` column to store available lb plates as JSON array
    
  2. Default Values
    - kg plates: [25, 20, 15, 10, 5, 2.5, 1.25] - standard Olympic plate set
    - lb plates: [45, 35, 25, 10, 5, 2.5] - standard US gym plate set
    
  3. Notes
    - JSON arrays allow flexible plate configurations per user
    - Defaults represent common gym equipment availability
    - Users can customize to match their specific gym's equipment
*/

-- Add plate availability columns with default values
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_settings' AND column_name = 'available_plates_kg'
  ) THEN
    ALTER TABLE user_settings 
    ADD COLUMN available_plates_kg jsonb DEFAULT '[25, 20, 15, 10, 5, 2.5, 1.25]'::jsonb;
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_settings' AND column_name = 'available_plates_lb'
  ) THEN
    ALTER TABLE user_settings 
    ADD COLUMN available_plates_lb jsonb DEFAULT '[45, 35, 25, 10, 5, 2.5]'::jsonb;
  END IF;
END $$;

-- Update existing rows to have default values
UPDATE user_settings
SET available_plates_kg = '[25, 20, 15, 10, 5, 2.5, 1.25]'::jsonb
WHERE available_plates_kg IS NULL;

UPDATE user_settings
SET available_plates_lb = '[45, 35, 25, 10, 5, 2.5]'::jsonb
WHERE available_plates_lb IS NULL;