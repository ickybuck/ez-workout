/*
  # Add template type to workouts table

  1. Changes
    - Add template_type column to workouts table
    - Set default value to 'regular'
    - Add check constraint for valid types
    - Update existing rows
*/

-- Add template_type column to workouts
ALTER TABLE workouts
ADD COLUMN IF NOT EXISTS template_type text DEFAULT 'regular';

-- Add check constraint for valid types
ALTER TABLE workouts
ADD CONSTRAINT workouts_type_check
CHECK (template_type IN ('regular', 'superset'));

-- Update existing rows
UPDATE workouts
SET template_type = 'regular'
WHERE template_type IS NULL;