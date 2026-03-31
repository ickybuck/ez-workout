/*
  # Set initial admin user
  
  1. Changes
    - Set the first user in the system as an admin
    - This ensures there is at least one admin user
*/

-- Get the first user and make them an admin
UPDATE user_settings
SET is_admin = true
WHERE user_id IN (
  SELECT id 
  FROM auth.users 
  ORDER BY created_at 
  LIMIT 1
);