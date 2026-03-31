/*
  # Add timer visibility settings

  1. Changes
    - Add show_workout_timer and show_exercise_timer columns to user_settings table
    - Set default values to true
    - Update existing rows
*/

-- Add timer visibility columns
ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS show_workout_timer boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS show_exercise_timer boolean DEFAULT true;

-- Update existing rows
UPDATE user_settings
SET 
  show_workout_timer = true,
  show_exercise_timer = true
WHERE show_workout_timer IS NULL OR show_exercise_timer IS NULL;