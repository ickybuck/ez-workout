/*
  # Add Missing User Settings Columns

  1. Changes
    - Add `show_volume_graph` column (boolean, default true)
    - Add `show_consistency_tracker` column (boolean, default true)
    - Add `weekly_workout_goal` column (integer, default 3)
    - Add `goal_weekday_start` column (integer, default 0 for Sunday)
    - Add `recent_workouts_count` column (integer, default 3)
  
  2. Notes
    - These columns are required for dashboard and history page settings
    - All columns have sensible defaults to maintain backward compatibility
    - No data loss occurs with this migration
*/

-- Add the missing columns to user_settings table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_settings' AND column_name = 'show_volume_graph'
  ) THEN
    ALTER TABLE user_settings ADD COLUMN show_volume_graph BOOLEAN DEFAULT true NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_settings' AND column_name = 'show_consistency_tracker'
  ) THEN
    ALTER TABLE user_settings ADD COLUMN show_consistency_tracker BOOLEAN DEFAULT true NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_settings' AND column_name = 'weekly_workout_goal'
  ) THEN
    ALTER TABLE user_settings ADD COLUMN weekly_workout_goal INTEGER DEFAULT 3 NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_settings' AND column_name = 'goal_weekday_start'
  ) THEN
    ALTER TABLE user_settings ADD COLUMN goal_weekday_start INTEGER DEFAULT 0 NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_settings' AND column_name = 'recent_workouts_count'
  ) THEN
    ALTER TABLE user_settings ADD COLUMN recent_workouts_count INTEGER DEFAULT 3 NOT NULL;
  END IF;
END $$;