/*
  # Fix user settings initialization for new users

  1. Changes
    - Drop trigger first
    - Drop function
    - Recreate function with updated logic
    - Recreate trigger
*/

-- First drop the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Now we can safely drop the function
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Create updated trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
DECLARE
  default_user_id uuid;
BEGIN
  -- Insert default user settings
  INSERT INTO public.user_settings (
    user_id,
    weight_unit,
    use_metric,
    rest_timer_duration,
    auto_start_timer,
    show_workout_timer,
    show_exercise_timer,
    is_admin,
    username,
    first_name,
    last_name,
    weight,
    height
  ) VALUES (
    NEW.id,
    'kg',
    false,
    90,
    true,
    true,
    true,
    false,
    null,
    null,
    null,
    null,
    null
  )
  ON CONFLICT (user_id) DO NOTHING;

  -- Get the default template user ID
  SELECT value::uuid INTO default_user_id
  FROM storage
  WHERE key = 'default_template_user_id';

  -- If we have a default template user, copy their data
  IF default_user_id IS NOT NULL THEN
    PERFORM copy_user_defaults(default_user_id, NEW.id);
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the user creation
    RAISE NOTICE 'Error in handle_new_user: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();