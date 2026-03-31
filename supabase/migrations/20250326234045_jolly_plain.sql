/*
  # Add template type support
  
  1. Changes
    - Add template_type column to workout_templates table
    - Set default type as 'regular'
    - Add check constraint to ensure valid types
    - Update existing rows
*/

-- Add template_type column
ALTER TABLE workout_templates
ADD COLUMN IF NOT EXISTS template_type text DEFAULT 'regular';

-- Add check constraint for valid types
ALTER TABLE workout_templates
ADD CONSTRAINT workout_templates_type_check
CHECK (template_type IN ('regular', 'superset'));

-- Update existing rows
UPDATE workout_templates
SET template_type = 'regular'
WHERE template_type IS NULL;