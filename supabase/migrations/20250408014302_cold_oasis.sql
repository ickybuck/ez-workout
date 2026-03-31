/*
  # Add recent workouts count setting

  1. Changes
    - Add recent_workouts_count column to user_settings table
    - Set default value to 3
    - Add check constraint to limit range from 1 to 6
    - Update existing rows
*/

-- Add recent_workouts_count column
ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS recent_workouts_count integer DEFAULT 3;

-- Add check constraint
ALTER TABLE user_settings
ADD CONSTRAINT user_settings_recent_workouts_count_check
CHECK (recent_workouts_count BETWEEN 1 AND 6);

-- Update existing rows
UPDATE user_settings
SET recent_workouts_count = 3
WHERE recent_workouts_count IS NULL;