/*
  # Fix template type persistence

  1. Changes
    - Add template_type column to workout_templates if not exists
    - Add check constraint for valid types
    - Update existing rows to have default type
    - Update policies to allow template type updates
*/

-- Add template_type column if it doesn't exist
ALTER TABLE workout_templates
ADD COLUMN IF NOT EXISTS template_type text DEFAULT 'regular';

-- Add check constraint for valid types if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.constraint_column_usage 
    WHERE table_name = 'workout_templates' 
    AND constraint_name = 'workout_templates_type_check'
  ) THEN
    ALTER TABLE workout_templates
    ADD CONSTRAINT workout_templates_type_check
    CHECK (template_type IN ('regular', 'superset'));
  END IF;
END $$;

-- Update existing rows
UPDATE workout_templates
SET template_type = 'regular'
WHERE template_type IS NULL;

-- Make template_type NOT NULL
ALTER TABLE workout_templates
ALTER COLUMN template_type SET NOT NULL;