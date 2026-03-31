/*
  # Set initial admin user
  
  1. Changes
    - Set your account as an admin user
    - Update user settings to include admin status
*/

-- Set your account as an admin
UPDATE user_settings 
SET is_admin = true 
WHERE user_id = auth.uid();