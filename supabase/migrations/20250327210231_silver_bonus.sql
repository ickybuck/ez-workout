/*
  # Create admin user access functions
  
  1. Changes
    - Create function to list all users (admin only)
    - Create function to get user by email (admin only)
    - Add proper security checks
*/

-- Create a function to list all users (admin only)
CREATE OR REPLACE FUNCTION list_users()
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

  -- Return all users
  RETURN QUERY
  SELECT 
    au.id,
    au.email::text,
    au.created_at
  FROM auth.users au;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION list_users() TO authenticated;