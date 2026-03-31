/*
  # Remove default template designation
  
  1. Changes
    - Remove is_default column from workout_templates table
    - Update RLS policies to treat all templates equally
    - Update existing templates to be owned by actual users
    - Clean up system user data properly
    - Handle dependent policies properly

  2. Security
    - Drop dependent policies first
    - Maintain data integrity during migration
*/

-- First, drop the dependent policies
DROP POLICY IF EXISTS "Users can modify exercises in any visible template" ON template_exercises;

-- Create new template exercise policy without is_default dependency
CREATE POLICY "Users can modify exercises in their templates"
ON template_exercises
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM workout_templates wt
    WHERE wt.id = template_exercises.template_id
    AND wt.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM workout_templates wt
    WHERE wt.id = template_exercises.template_id
    AND wt.user_id = auth.uid()
  )
);

-- First, assign all default templates to the first user we find
DO $$
DECLARE
  first_user_id uuid;
BEGIN
  -- Get the first non-system user
  SELECT id INTO first_user_id
  FROM auth.users
  WHERE id != '00000000-0000-0000-0000-000000000000'
  LIMIT 1;

  IF first_user_id IS NOT NULL THEN
    -- Update all default templates to be owned by this user
    UPDATE workout_templates
    SET user_id = first_user_id,
        is_default = false
    WHERE is_default = true;

    -- Delete system user settings since the real user already has their own
    DELETE FROM user_settings
    WHERE user_id = '00000000-0000-0000-0000-000000000000';

    -- Now we can safely delete the system user
    DELETE FROM auth.users
    WHERE id = '00000000-0000-0000-0000-000000000000';
  END IF;
END $$;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can read their own templates and system templates" ON workout_templates;
DROP POLICY IF EXISTS "Users can insert their own templates" ON workout_templates;
DROP POLICY IF EXISTS "Users can update any visible template" ON workout_templates;
DROP POLICY IF EXISTS "Users can delete any visible template" ON workout_templates;

-- Create new simplified policies
CREATE POLICY "Users can read their own templates"
ON workout_templates
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own templates"
ON workout_templates
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own templates"
ON workout_templates
FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own templates"
ON workout_templates
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- Drop the is_default column
ALTER TABLE workout_templates DROP COLUMN is_default;