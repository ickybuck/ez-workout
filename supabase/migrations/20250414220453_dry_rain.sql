/*
  # Add workout consistency tracking settings
  
  1. Changes
    - Add show_consistency_tracker boolean to user_settings
    - Add weekly_workout_goal integer to user_settings
    - Add goal_weekday_start integer to user_settings
    - Add constraints for valid values
    - Set default values
*/

-- Add new columns
ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS show_consistency_tracker boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS weekly_workout_goal integer DEFAULT 3,
ADD COLUMN IF NOT EXISTS goal_weekday_start integer DEFAULT 0;

-- Add check constraints
ALTER TABLE user_settings
ADD CONSTRAINT user_settings_weekly_workout_goal_check
CHECK (weekly_workout_goal BETWEEN 1 AND 7),
ADD CONSTRAINT user_settings_goal_weekday_start_check
CHECK (goal_weekday_start BETWEEN 0 AND 6);

-- Update existing rows
UPDATE user_settings
SET 
  show_consistency_tracker = true,
  weekly_workout_goal = 3,
  goal_weekday_start = 0
WHERE show_consistency_tracker IS NULL
   OR weekly_workout_goal IS NULL
   OR goal_weekday_start IS NULL;