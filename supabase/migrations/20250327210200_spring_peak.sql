/*
  # Create admin user access function

  1. Changes
    - Create a function to safely expose user data to admins
    - Function checks admin status before returning results
    - Remove problematic view and RLS setup

  2. Security
    - Only admins can access user data
    - Access control handled through function
*/

-- Create a function to get user details (only accessible by admins)
CREATE OR REPLACE FUNCTION get_user_details(user_email text)
RETURNS TABLE (
  id uuid,
  email text,
  created_at timestamptz
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if the calling user is an admin
  IF NOT EXISTS (
    SELECT 1 
    FROM user_settings 
    WHERE user_id = auth.uid() 
      AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Return user details if found
  RETURN QUERY
  SELECT 
    au.id,
    au.email::text,
    au.created_at
  FROM auth.users au
  WHERE au.email = user_email;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_user_details(text) TO authenticated;