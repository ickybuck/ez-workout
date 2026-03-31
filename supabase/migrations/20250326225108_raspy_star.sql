/*
  # Add default weight to template exercises

  1. Changes
    - Add default_weight column to template_exercises table
    - Set default value to 0 for existing rows
*/

-- Add default_weight column to template_exercises
ALTER TABLE template_exercises 
ADD COLUMN IF NOT EXISTS default_weight numeric(10,2) DEFAULT 0;

-- Update existing rows to have a default value
UPDATE template_exercises 
SET default_weight = 0 
WHERE default_weight IS NULL;