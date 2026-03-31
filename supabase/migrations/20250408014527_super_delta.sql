/*
  # Add missing user settings columns

  1. Changes
    - Add show_volume_graph column if it doesn't exist
    - Add recent_workouts_count column if it doesn't exist
    - Set default values and constraints
    - Update existing rows
*/

-- Add show_volume_graph column
ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS show_volume_graph boolean DEFAULT true;

-- Add recent_workouts_count column
ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS recent_workouts_count integer DEFAULT 3;

-- Add check constraint if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.constraint_column_usage 
    WHERE table_name = 'user_settings' 
    AND constraint_name = 'user_settings_recent_workouts_count_check'
  ) THEN
    ALTER TABLE user_settings
    ADD CONSTRAINT user_settings_recent_workouts_count_check
    CHECK (recent_workouts_count BETWEEN 1 AND 6);
  END IF;
END $$;

-- Update existing rows
UPDATE user_settings
SET 
  show_volume_graph = true,
  recent_workouts_count = 3
WHERE show_volume_graph IS NULL OR recent_workouts_count IS NULL;