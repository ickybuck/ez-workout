/*
  # Add Dark Mode Setting

  1. Changes
    - Add `dark_mode` column to `user_settings` table
      - Type: boolean
      - Default: false (light mode by default)
  
  2. Notes
    - This allows users to toggle between light and dark themes
    - The default is set to false so existing users will see light mode
    - The column is nullable to handle existing rows gracefully
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_settings' AND column_name = 'dark_mode'
  ) THEN
    ALTER TABLE user_settings ADD COLUMN dark_mode boolean DEFAULT false;
  END IF;
END $$;