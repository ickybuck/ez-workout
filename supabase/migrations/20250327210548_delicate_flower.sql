/*
  # Add user profile fields
  
  1. Changes
    - Add first_name and last_name to auth.users
    - Add username, weight, and height to user_settings
    - Add check constraints for valid values
    - Add unique constraint for username
*/

-- Add profile fields to user_settings
ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS username text UNIQUE,
ADD COLUMN IF NOT EXISTS first_name text,
ADD COLUMN IF NOT EXISTS last_name text,
ADD COLUMN IF NOT EXISTS weight numeric(5,2),
ADD COLUMN IF NOT EXISTS height numeric(5,2);

-- Add check constraints for valid values
ALTER TABLE user_settings
ADD CONSTRAINT user_settings_weight_check
  CHECK (weight > 0 AND weight < 500),
ADD CONSTRAINT user_settings_height_check
  CHECK (height > 0 AND height < 300);