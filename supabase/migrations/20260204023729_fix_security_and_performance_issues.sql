/*
  # Fix Security and Performance Issues

  1. Add Missing Indexes for Foreign Keys
    - Add indexes for all unindexed foreign keys to improve query performance
    - Tables affected: exercise_defaults, exercise_muscle_groups, exercises, template_exercises, workout_exercises, workout_templates, workouts

  2. Optimize RLS Policies
    - Update all RLS policies to use (select auth.uid()) instead of auth.uid()
    - This prevents re-evaluation of auth functions for each row, improving performance at scale
    - Tables affected: user_settings, workouts, exercise_defaults, template_exercises, workout_templates, workout_exercises, exercises, exercise_logs

  3. Remove Unused Indexes
    - Drop indexes that are not being used to reduce maintenance overhead
    - Indexes: idx_exercise_logs_workout_exercise_id, idx_workout_exercises_workout_id, idx_workouts_user_id

  4. Fix Function Search Paths
    - Update functions to have immutable search paths for security
    - Functions: copy_user_defaults, set_user_data_as_default, handle_new_user

  5. Add Exercise Ownership Columns
    - Add is_custom and created_by columns to exercises table
    - This enables proper tracking of user-created exercises

  6. Fix Unrestricted RLS Policy
    - Update the "Users can insert new exercises" policy to properly restrict access

  Note: Auth DB Connection Strategy and Leaked Password Protection must be configured in Supabase Dashboard
  - Auth DB Connection: Go to Settings > Database > Connection Pooling > Change to percentage-based
  - Password Protection: Go to Authentication > Providers > Email > Enable "Leaked Password Protection"
*/

-- =====================================================
-- 1. ADD MISSING INDEXES FOR FOREIGN KEYS
-- =====================================================

-- exercise_defaults: user_id foreign key
CREATE INDEX IF NOT EXISTS idx_exercise_defaults_user_id ON public.exercise_defaults(user_id);

-- exercise_muscle_groups: muscle_group_id foreign key
CREATE INDEX IF NOT EXISTS idx_exercise_muscle_groups_muscle_group_id ON public.exercise_muscle_groups(muscle_group_id);

-- exercises: body_part_id foreign key
CREATE INDEX IF NOT EXISTS idx_exercises_body_part_id ON public.exercises(body_part_id);

-- exercises: equipment_type_id foreign key
CREATE INDEX IF NOT EXISTS idx_exercises_equipment_type_id ON public.exercises(equipment_type_id);

-- template_exercises: exercise_id foreign key
CREATE INDEX IF NOT EXISTS idx_template_exercises_exercise_id ON public.template_exercises(exercise_id);

-- template_exercises: template_id foreign key
CREATE INDEX IF NOT EXISTS idx_template_exercises_template_id ON public.template_exercises(template_id);

-- workout_exercises: exercise_id foreign key
CREATE INDEX IF NOT EXISTS idx_workout_exercises_exercise_id ON public.workout_exercises(exercise_id);

-- workout_templates: user_id foreign key
CREATE INDEX IF NOT EXISTS idx_workout_templates_user_id ON public.workout_templates(user_id);

-- workouts: template_id foreign key
CREATE INDEX IF NOT EXISTS idx_workouts_template_id ON public.workouts(template_id);

-- =====================================================
-- 2. DROP UNUSED INDEXES
-- =====================================================

DROP INDEX IF EXISTS public.idx_exercise_logs_workout_exercise_id;
DROP INDEX IF EXISTS public.idx_workout_exercises_workout_id;
DROP INDEX IF EXISTS public.idx_workouts_user_id;

-- =====================================================
-- 3. ADD EXERCISE OWNERSHIP COLUMNS
-- =====================================================

-- Add is_custom column to track user-created exercises
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'exercises'
    AND column_name = 'is_custom'
  ) THEN
    ALTER TABLE public.exercises ADD COLUMN is_custom boolean DEFAULT false;
  END IF;
END $$;

-- Add created_by column to track exercise creators
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'exercises'
    AND column_name = 'created_by'
  ) THEN
    ALTER TABLE public.exercises ADD COLUMN created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add index for created_by foreign key
CREATE INDEX IF NOT EXISTS idx_exercises_created_by ON public.exercises(created_by);

-- =====================================================
-- 4. OPTIMIZE RLS POLICIES - USER_SETTINGS
-- =====================================================

DROP POLICY IF EXISTS "Users can read their own settings" ON public.user_settings;
CREATE POLICY "Users can read their own settings"
  ON public.user_settings
  FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update their own settings" ON public.user_settings;
CREATE POLICY "Users can update their own settings"
  ON public.user_settings
  FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert their own settings" ON public.user_settings;
CREATE POLICY "Users can insert their own settings"
  ON public.user_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

-- =====================================================
-- 5. OPTIMIZE RLS POLICIES - WORKOUTS
-- =====================================================

DROP POLICY IF EXISTS "Users can read their own workouts" ON public.workouts;
CREATE POLICY "Users can read their own workouts"
  ON public.workouts
  FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert their own workouts" ON public.workouts;
CREATE POLICY "Users can insert their own workouts"
  ON public.workouts
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update their own workouts" ON public.workouts;
CREATE POLICY "Users can update their own workouts"
  ON public.workouts
  FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete their own workouts" ON public.workouts;
CREATE POLICY "Users can delete their own workouts"
  ON public.workouts
  FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- =====================================================
-- 6. OPTIMIZE RLS POLICIES - EXERCISE_DEFAULTS
-- =====================================================

DROP POLICY IF EXISTS "Users can create their own exercise defaults" ON public.exercise_defaults;
CREATE POLICY "Users can create their own exercise defaults"
  ON public.exercise_defaults
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can view their own exercise defaults" ON public.exercise_defaults;
CREATE POLICY "Users can view their own exercise defaults"
  ON public.exercise_defaults
  FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update their own exercise defaults" ON public.exercise_defaults;
CREATE POLICY "Users can update their own exercise defaults"
  ON public.exercise_defaults
  FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete their own exercise defaults" ON public.exercise_defaults;
CREATE POLICY "Users can delete their own exercise defaults"
  ON public.exercise_defaults
  FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- =====================================================
-- 7. OPTIMIZE RLS POLICIES - TEMPLATE_EXERCISES
-- =====================================================

DROP POLICY IF EXISTS "Users can modify exercises in their templates" ON public.template_exercises;
CREATE POLICY "Users can modify exercises in their templates"
  ON public.template_exercises
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workout_templates
      WHERE workout_templates.id = template_exercises.template_id
      AND workout_templates.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workout_templates
      WHERE workout_templates.id = template_exercises.template_id
      AND workout_templates.user_id = (select auth.uid())
    )
  );

-- =====================================================
-- 8. OPTIMIZE RLS POLICIES - WORKOUT_TEMPLATES
-- =====================================================

DROP POLICY IF EXISTS "Users can read their own templates" ON public.workout_templates;
CREATE POLICY "Users can read their own templates"
  ON public.workout_templates
  FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert their own templates" ON public.workout_templates;
CREATE POLICY "Users can insert their own templates"
  ON public.workout_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update their own templates" ON public.workout_templates;
CREATE POLICY "Users can update their own templates"
  ON public.workout_templates
  FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete their own templates" ON public.workout_templates;
CREATE POLICY "Users can delete their own templates"
  ON public.workout_templates
  FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- =====================================================
-- 9. OPTIMIZE RLS POLICIES - WORKOUT_EXERCISES
-- =====================================================

DROP POLICY IF EXISTS "Users can access their own workout exercises" ON public.workout_exercises;
CREATE POLICY "Users can access their own workout exercises"
  ON public.workout_exercises
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workouts
      WHERE workouts.id = workout_exercises.workout_id
      AND workouts.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workouts
      WHERE workouts.id = workout_exercises.workout_id
      AND workouts.user_id = (select auth.uid())
    )
  );

-- =====================================================
-- 10. OPTIMIZE RLS POLICIES - EXERCISES
-- =====================================================

DROP POLICY IF EXISTS "Users can update exercises they have defaults for" ON public.exercises;
CREATE POLICY "Users can update exercises they have defaults for"
  ON public.exercises
  FOR UPDATE
  TO authenticated
  USING (
    is_custom = true AND created_by = (select auth.uid())
  );

DROP POLICY IF EXISTS "Users can delete exercises they have defaults for" ON public.exercises;
CREATE POLICY "Users can delete exercises they have defaults for"
  ON public.exercises
  FOR DELETE
  TO authenticated
  USING (
    is_custom = true AND created_by = (select auth.uid())
  );

-- Fix the unrestricted insert policy
DROP POLICY IF EXISTS "Users can insert new exercises" ON public.exercises;
CREATE POLICY "Users can insert new exercises"
  ON public.exercises
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_custom = true
    AND created_by = (select auth.uid())
  );

-- =====================================================
-- 11. OPTIMIZE RLS POLICIES - EXERCISE_LOGS
-- =====================================================

DROP POLICY IF EXISTS "Enable all operations for workout owners" ON public.exercise_logs;
CREATE POLICY "Enable all operations for workout owners"
  ON public.exercise_logs
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workout_exercises we
      JOIN workouts w ON w.id = we.workout_id
      WHERE we.id = exercise_logs.workout_exercise_id
      AND w.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workout_exercises we
      JOIN workouts w ON w.id = we.workout_id
      WHERE we.id = exercise_logs.workout_exercise_id
      AND w.user_id = (select auth.uid())
    )
  );

-- =====================================================
-- 12. FIX FUNCTION SEARCH PATHS
-- =====================================================

-- Drop and recreate copy_user_defaults with secure search path
DROP FUNCTION IF EXISTS public.copy_user_defaults(uuid, uuid) CASCADE;

CREATE FUNCTION public.copy_user_defaults(
  source_user_id uuid,
  target_user_id uuid
)
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
    -- Check if exercise already exists for target user
    IF NOT EXISTS (
      SELECT 1 FROM exercise_defaults 
      WHERE user_id = target_user_id AND exercise_id = v_exercise.exercise_id
    ) THEN
      -- If exercise is custom, create a copy for the new user
      IF v_exercise.is_custom = true THEN
        INSERT INTO exercises (
          name,
          description,
          equipment_type_id,
          body_part_id,
          is_compound,
          is_custom,
          created_by
        ) VALUES (
          v_exercise.name,
          v_exercise.description,
          v_exercise.equipment_type_id,
          v_exercise.body_part_id,
          v_exercise.is_compound,
          true,
          target_user_id
        )
        RETURNING id INTO v_new_exercise_id;
        
        -- Copy muscle groups for the new exercise
        INSERT INTO exercise_muscle_groups (exercise_id, muscle_group_id, is_primary)
        SELECT v_new_exercise_id, muscle_group_id, is_primary
        FROM exercise_muscle_groups
        WHERE exercise_id = v_exercise.exercise_id;
      ELSE
        v_new_exercise_id := v_exercise.exercise_id;
      END IF;
      
      -- Create exercise defaults for target user
      INSERT INTO exercise_defaults (
        user_id,
        exercise_id,
        default_sets,
        default_reps,
        default_weight,
        weight_increment
      ) VALUES (
        target_user_id,
        v_new_exercise_id,
        v_exercise.default_sets,
        v_exercise.default_reps,
        v_exercise.default_weight,
        v_exercise.weight_increment
      );
    END IF;
  END LOOP;

  -- Copy templates
  FOR v_template IN 
    SELECT * FROM workout_templates 
    WHERE user_id = source_user_id
  LOOP
    INSERT INTO workout_templates (user_id, name, description)
    VALUES (target_user_id, v_template.name, v_template.description)
    RETURNING id INTO v_new_template_id;
    
    -- Copy template exercises
    INSERT INTO template_exercises (
      template_id,
      exercise_id,
      order_index,
      default_sets,
      default_reps
    )
    SELECT 
      v_new_template_id,
      CASE 
        WHEN e.is_custom = true THEN (
          SELECT ed.exercise_id 
          FROM exercise_defaults ed 
          WHERE ed.user_id = target_user_id 
          AND ed.exercise_id IN (
            SELECT id FROM exercises 
            WHERE name = e.name AND created_by = target_user_id
          )
          LIMIT 1
        )
        ELSE te.exercise_id
      END,
      te.order_index,
      te.default_sets,
      te.default_reps
    FROM template_exercises te
    JOIN exercises e ON e.id = te.exercise_id
    WHERE te.template_id = v_template.id;
  END LOOP;
END;
$$;

-- Drop and recreate set_user_data_as_default with secure search path
DROP FUNCTION IF EXISTS public.set_user_data_as_default(uuid) CASCADE;

CREATE FUNCTION public.set_user_data_as_default(admin_user_id uuid)
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

-- Recreate handle_new_user with secure search path
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  default_user_id uuid;
BEGIN
  -- Get the default template user ID
  SELECT value::uuid INTO default_user_id
  FROM storage
  WHERE key = 'default_template_user_id';

  -- If we have a default template user, copy their data
  IF default_user_id IS NOT NULL THEN
    PERFORM copy_user_defaults(default_user_id, NEW.id);
  ELSE
    -- Just create basic user settings
    INSERT INTO public.user_settings (user_id, weight_unit, dark_mode)
    VALUES (NEW.id, 'kg', false)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;