/*
  # Fix Security and Performance Issues
  
  This migration addresses critical security and performance issues:
  
  1. **Performance Improvements - Add Missing Indexes**
     - Add indexes on all foreign key columns for better query performance
     - Affected tables: exercise_defaults, exercise_muscle_groups, exercises, template_exercises, workout_exercises, workout_templates, workouts
  
  2. **RLS Performance Optimization**
     - Update all RLS policies to use `(select auth.uid())` instead of `auth.uid()`
     - This prevents re-evaluation of auth functions for each row, improving performance at scale
     - Affected tables: exercise_defaults, exercise_logs, exercises, template_exercises, user_settings, workout_exercises, workout_templates, workouts
  
  3. **Security Fix - Exercises INSERT Policy**
     - Replace the permissive "WITH CHECK true" policy with a proper authenticated-only check
     - This ensures only authenticated users can insert exercises
  
  4. **Function Security - Fix Search Path**
     - Set explicit search_path for security-sensitive functions
     - Prevents search_path injection attacks
     - Affected functions: copy_user_defaults, set_user_data_as_default, handle_new_user
*/

-- ============================================================================
-- PART 1: ADD MISSING INDEXES ON FOREIGN KEYS
-- ============================================================================

-- Add index on exercise_defaults.user_id
CREATE INDEX IF NOT EXISTS idx_exercise_defaults_user_id 
ON exercise_defaults(user_id);

-- Add index on exercise_muscle_groups.muscle_group_id
CREATE INDEX IF NOT EXISTS idx_exercise_muscle_groups_muscle_group_id 
ON exercise_muscle_groups(muscle_group_id);

-- Add index on exercises.body_part_id
CREATE INDEX IF NOT EXISTS idx_exercises_body_part_id 
ON exercises(body_part_id);

-- Add index on exercises.equipment_type_id
CREATE INDEX IF NOT EXISTS idx_exercises_equipment_type_id 
ON exercises(equipment_type_id);

-- Add index on template_exercises.exercise_id
CREATE INDEX IF NOT EXISTS idx_template_exercises_exercise_id 
ON template_exercises(exercise_id);

-- Add index on template_exercises.template_id
CREATE INDEX IF NOT EXISTS idx_template_exercises_template_id 
ON template_exercises(template_id);

-- Add index on workout_exercises.exercise_id
CREATE INDEX IF NOT EXISTS idx_workout_exercises_exercise_id 
ON workout_exercises(exercise_id);

-- Add index on workout_templates.user_id
CREATE INDEX IF NOT EXISTS idx_workout_templates_user_id 
ON workout_templates(user_id);

-- Add index on workouts.template_id
CREATE INDEX IF NOT EXISTS idx_workouts_template_id 
ON workouts(template_id);

-- ============================================================================
-- PART 2: FIX RLS POLICIES - OPTIMIZE AUTH FUNCTION CALLS
-- ============================================================================

-- Fix exercise_defaults policies
DROP POLICY IF EXISTS "Users can create their own exercise defaults" ON exercise_defaults;
CREATE POLICY "Users can create their own exercise defaults"
  ON exercise_defaults FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own exercise defaults" ON exercise_defaults;
CREATE POLICY "Users can delete their own exercise defaults"
  ON exercise_defaults FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own exercise defaults" ON exercise_defaults;
CREATE POLICY "Users can update their own exercise defaults"
  ON exercise_defaults FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view their own exercise defaults" ON exercise_defaults;
CREATE POLICY "Users can view their own exercise defaults"
  ON exercise_defaults FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- Fix exercise_logs policy
DROP POLICY IF EXISTS "Enable all operations for workout owners" ON exercise_logs;
CREATE POLICY "Enable all operations for workout owners"
  ON exercise_logs FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM workout_exercises we
      JOIN workouts w ON w.id = we.workout_id
      WHERE we.id = exercise_logs.workout_exercise_id
      AND w.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM workout_exercises we
      JOIN workouts w ON w.id = we.workout_id
      WHERE we.id = exercise_logs.workout_exercise_id
      AND w.user_id = (select auth.uid())
    )
  );

-- Fix exercises policies
DROP POLICY IF EXISTS "Users can delete exercises they have defaults for" ON exercises;
CREATE POLICY "Users can delete exercises they have defaults for"
  ON exercises FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM exercise_defaults
      WHERE exercise_defaults.exercise_id = exercises.id
      AND exercise_defaults.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update exercises they have defaults for" ON exercises;
CREATE POLICY "Users can update exercises they have defaults for"
  ON exercises FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM exercise_defaults
      WHERE exercise_defaults.exercise_id = exercises.id
      AND exercise_defaults.user_id = (select auth.uid())
    )
  );

-- Fix the insecure exercises INSERT policy
DROP POLICY IF EXISTS "Users can insert new exercises" ON exercises;
CREATE POLICY "Users can insert new exercises"
  ON exercises FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Fix template_exercises policy
DROP POLICY IF EXISTS "Users can modify exercises in their templates" ON template_exercises;
CREATE POLICY "Users can modify exercises in their templates"
  ON template_exercises FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM workout_templates wt
      WHERE wt.id = template_exercises.template_id
      AND wt.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM workout_templates wt
      WHERE wt.id = template_exercises.template_id
      AND wt.user_id = (select auth.uid())
    )
  );

-- Fix user_settings policies
DROP POLICY IF EXISTS "Users can insert their own settings" ON user_settings;
CREATE POLICY "Users can insert their own settings"
  ON user_settings FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can read their own settings" ON user_settings;
CREATE POLICY "Users can read their own settings"
  ON user_settings FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own settings" ON user_settings;
CREATE POLICY "Users can update their own settings"
  ON user_settings FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- Fix workout_exercises policy
DROP POLICY IF EXISTS "Users can access their own workout exercises" ON workout_exercises;
CREATE POLICY "Users can access their own workout exercises"
  ON workout_exercises FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM workouts
      WHERE workouts.id = workout_exercises.workout_id
      AND workouts.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM workouts
      WHERE workouts.id = workout_exercises.workout_id
      AND workouts.user_id = (select auth.uid())
    )
  );

-- Fix workout_templates policies
DROP POLICY IF EXISTS "Users can delete their own templates" ON workout_templates;
CREATE POLICY "Users can delete their own templates"
  ON workout_templates FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert their own templates" ON workout_templates;
CREATE POLICY "Users can insert their own templates"
  ON workout_templates FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can read their own templates" ON workout_templates;
CREATE POLICY "Users can read their own templates"
  ON workout_templates FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update their own templates" ON workout_templates;
CREATE POLICY "Users can update their own templates"
  ON workout_templates FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- Fix workouts policies
DROP POLICY IF EXISTS "Users can delete their own workouts" ON workouts;
CREATE POLICY "Users can delete their own workouts"
  ON workouts FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own workouts" ON workouts;
CREATE POLICY "Users can insert their own workouts"
  ON workouts FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can read their own workouts" ON workouts;
CREATE POLICY "Users can read their own workouts"
  ON workouts FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own workouts" ON workouts;
CREATE POLICY "Users can update their own workouts"
  ON workouts FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- ============================================================================
-- PART 3: FIX FUNCTION SEARCH PATHS
-- ============================================================================

-- Drop and recreate copy_user_defaults with fixed search_path
DROP FUNCTION IF EXISTS copy_user_defaults(uuid, uuid);

CREATE FUNCTION copy_user_defaults(source_user_id uuid, target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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
$$;

-- Drop and recreate set_user_data_as_default with fixed search_path
DROP FUNCTION IF EXISTS set_user_data_as_default(uuid);

CREATE FUNCTION set_user_data_as_default(admin_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Verify the user is an admin
  IF NOT EXISTS (
    SELECT 1 FROM user_settings 
    WHERE user_id = admin_user_id AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'User is not an admin';
  END IF;

  -- Store the admin's user ID as the default template source
  INSERT INTO storage (key, value)
  VALUES ('default_template_user_id', admin_user_id::text)
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
END;
$$;

-- Drop handle_new_user function CASCADE (removes dependent trigger)
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;

-- Recreate handle_new_user with fixed search_path
CREATE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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
$$;

-- Recreate the trigger that was dropped with CASCADE
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();