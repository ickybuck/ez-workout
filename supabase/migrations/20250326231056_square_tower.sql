/*
  # Add template favorites

  1. Changes
    - Add `is_favorite` column to `workout_templates` table
    - Set default value to false
    - Update RLS policies to allow updating is_favorite
*/

-- Add is_favorite column
ALTER TABLE workout_templates
ADD COLUMN IF NOT EXISTS is_favorite boolean DEFAULT false;

-- Update existing rows
UPDATE workout_templates
SET is_favorite = false
WHERE is_favorite IS NULL;