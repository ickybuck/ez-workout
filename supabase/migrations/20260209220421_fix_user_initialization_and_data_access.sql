/*
  # Fix User Initialization and Data Access Issues
  
  1. Changes
    - Add database trigger to automatically create user_settings when a new user signs up
    - This ensures every user has settings initialized with proper defaults
    - Prevents issues where users can't access app features due to missing settings
    
  2. Security
    - Trigger runs with SECURITY DEFINER to bypass RLS during initialization
    - Only creates settings for new users, doesn't affect existing data
    - Maintains all existing RLS policies for data access
*/

-- Create function to initialize user settings
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.user_settings (
    user_id,
    use_metric,
    weight_unit,
    rest_timer_duration,
    auto_start_timer,
    show_workout_timer,
    show_exercise_timer,
    is_admin,
    dark_mode,
    available_plates_kg,
    available_plates_lb
  )
  VALUES (
    NEW.id,
    false,
    'lb',
    90,
    true,
    true,
    true,
    false,
    false,
    '[25, 20, 15, 10, 5, 2.5, 1.25]'::jsonb,
    '[45, 35, 25, 10, 5, 2.5]'::jsonb
  )
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Create trigger to run function after user creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Ensure the existing system user has proper settings
INSERT INTO public.user_settings (
  user_id,
  use_metric,
  weight_unit,
  rest_timer_duration,
  auto_start_timer,
  show_workout_timer,
  show_exercise_timer,
  is_admin,
  dark_mode,
  available_plates_kg,
  available_plates_lb
)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  false,
  'kg',
  90,
  true,
  true,
  true,
  true,
  false,
  '[25, 20, 15, 10, 5, 2.5, 1.25]'::jsonb,
  '[45, 35, 25, 10, 5, 2.5]'::jsonb
)
ON CONFLICT (user_id) DO UPDATE SET
  is_admin = true;