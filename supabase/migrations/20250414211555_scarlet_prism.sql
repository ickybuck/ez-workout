/*
  # Add workout categories
  
  1. Changes
    - Add category column to workout_templates table
    - Add check constraint for valid categories
    - Update existing templates with default categories
*/

-- Add category column
ALTER TABLE workout_templates
ADD COLUMN IF NOT EXISTS category text DEFAULT 'Whole Body';

-- Add check constraint
ALTER TABLE workout_templates
ADD CONSTRAINT workout_templates_category_check
CHECK (category IN ('Upper Body', 'Lower Body', 'Core Focused', 'Whole Body'));

-- Update existing rows
UPDATE workout_templates
SET category = 'Whole Body'
WHERE category IS NULL;

-- Make category required
ALTER TABLE workout_templates
ALTER COLUMN category SET NOT NULL;