/*
  # Add admin users and default data functionality
  
  1. Changes
    - Add is_admin column to user_settings
    - Add function to copy default data to new users
    - Add trigger to automatically copy defaults on user creation
    - Add function to set user's data as default template
*/

-- Add is_admin column to user_settings
ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;

-- Create a function to copy default data from a source user to a target user
CREATE OR REPLACE FUNCTION copy_user_defaults(
  source_user_id uuid,
  target_user_id uuid
) RETURNS void AS $$
DECLARE
  v_exercise record;
  v_template record;
  v_new_template_id uuid;
  v_new_exercise_id uuid;
BEGIN
  -- Copy exercise defaults
  FOR v_exercise IN 
    SELECT e.*, ed.*
    FROM exercises e
    JOIN exercise_defaults ed ON e.id = ed.exercise_id
    WHERE ed.user_id = source_user_id
  LOOP
    -- Create exercise defaults for the new user
    INSERT INTO exercise_defaults (
      exercise_id,
      user_id,
      sets,
      reps,
      weight,
      weight_increment
    ) VALUES (
      v_exercise.exercise_id,
      target_user_id,
      v_exercise.sets,
      v_exercise.reps,
      v_exercise.weight,
      v_exercise.weight_increment
    );

    -- Copy muscle group associations
    INSERT INTO exercise_muscle_groups (
      exercise_id,
      muscle_group_id,
      is_primary
    )
    SELECT 
      v_exercise.exercise_id,
      muscle_group_id,
      is_primary
    FROM exercise_muscle_groups
    WHERE exercise_id = v_exercise.exercise_id
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- Copy workout templates
  FOR v_template IN 
    SELECT *
    FROM workout_templates
    WHERE user_id = source_user_id
  LOOP
    -- Create new template
    INSERT INTO workout_templates (
      user_id,
      name,
      description,
      is_hidden,
      is_favorite,
      template_type
    ) VALUES (
      target_user_id,
      v_template.name,
      v_template.description,
      v_template.is_hidden,
      v_template.is_favorite,
      v_template.template_type
    )
    RETURNING id INTO v_new_template_id;

    -- Copy template exercises
    INSERT INTO template_exercises (
      template_id,
      exercise_id,
      order_index,
      default_sets,
      default_reps,
      default_weight
    )
    SELECT 
      v_new_template_id,
      exercise_id,
      order_index,
      default_sets,
      default_reps,
      default_weight
    FROM template_exercises
    WHERE template_id = v_template.id;
  END LOOP;

  -- Copy user settings
  INSERT INTO user_settings (
    user_id,
    use_metric,
    rest_timer_duration,
    auto_start_timer,
    weight_unit,
    show_workout_timer,
    show_exercise_timer
  )
  SELECT
    target_user_id,
    use_metric,
    rest_timer_duration,
    auto_start_timer,
    weight_unit,
    show_workout_timer,
    show_exercise_timer
  FROM user_settings
  WHERE user_id = source_user_id
  ON CONFLICT (user_id) DO UPDATE SET
    use_metric = EXCLUDED.use_metric,
    rest_timer_duration = EXCLUDED.rest_timer_duration,
    auto_start_timer = EXCLUDED.auto_start_timer,
    weight_unit = EXCLUDED.weight_unit,
    show_workout_timer = EXCLUDED.show_workout_timer,
    show_exercise_timer = EXCLUDED.show_exercise_timer;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to set a user's data as the default template
CREATE OR REPLACE FUNCTION set_user_data_as_default(admin_user_id uuid)
RETURNS void AS $$
BEGIN
  -- Verify the user is an admin
  IF NOT EXISTS (
    SELECT 1 FROM user_settings 
    WHERE user_id = admin_user_id AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'User is not an admin';
  END IF;

  -- Store the admin's user ID as the default template source
  INSERT INTO public.storage (key, value)
  VALUES ('default_template_user_id', admin_user_id::text)
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Modify the handle_new_user function to copy defaults
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
DECLARE
  default_user_id uuid;
BEGIN
  -- Get the default template user ID
  SELECT value::uuid INTO default_user_id
  FROM public.storage
  WHERE key = 'default_template_user_id';

  -- If we have a default template user, copy their data
  IF default_user_id IS NOT NULL THEN
    PERFORM copy_user_defaults(default_user_id, NEW.id);
  ELSE
    -- Just create basic user settings
    INSERT INTO public.user_settings (user_id, weight_unit)
    VALUES (NEW.id, 'kg')
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;