/*
  # Update template policies

  1. Changes
    - Allow users to modify exercises in default templates
    - Allow users to update default templates
    - Keep existing restrictions on deletion and creation

  2. Security
    - Users can still only delete their own non-default templates
    - Users can still only create their own templates
    - Users can now edit default templates
*/

-- Drop existing template exercise policies
DROP POLICY IF EXISTS "Users can modify exercises in any visible template" ON template_exercises;

-- Create new template exercise policy that allows modifications
CREATE POLICY "Users can modify exercises in any visible template"
ON template_exercises
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM workout_templates wt
    WHERE wt.id = template_exercises.template_id
    AND ((wt.user_id = auth.uid()) OR (wt.is_default = true))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM workout_templates wt
    WHERE wt.id = template_exercises.template_id
    AND ((wt.user_id = auth.uid()) OR (wt.is_default = true))
  )
);

-- Drop existing workout template policies
DROP POLICY IF EXISTS "Users can read their own templates and system templates" ON workout_templates;
DROP POLICY IF EXISTS "Users can insert their own templates" ON workout_templates;
DROP POLICY IF EXISTS "Users can update their own non-default templates" ON workout_templates;
DROP POLICY IF EXISTS "Users can delete their own non-default templates" ON workout_templates;
DROP POLICY IF EXISTS "Users can update favorite status" ON workout_templates;

-- Create new workout template policies
CREATE POLICY "Users can read their own templates and system templates"
ON workout_templates
FOR SELECT
TO authenticated
USING (
  (user_id = auth.uid()) OR 
  (is_default = true AND user_id = '00000000-0000-0000-0000-000000000000')
);

CREATE POLICY "Users can insert their own templates"
ON workout_templates
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
);

CREATE POLICY "Users can update any visible template"
ON workout_templates
FOR UPDATE
TO authenticated
USING (
  (user_id = auth.uid()) OR 
  (is_default = true AND user_id = '00000000-0000-0000-0000-000000000000')
);

CREATE POLICY "Users can delete their own non-default templates"
ON workout_templates
FOR DELETE
TO authenticated
USING (
  user_id = auth.uid() AND 
  is_default = false
);