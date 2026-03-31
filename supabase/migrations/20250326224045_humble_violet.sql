/*
  # Update template policies for exercise editing

  1. Changes
    - Allow users to fully edit exercises in any template they can see
    - Remove restrictions on template exercise modifications
    - Keep template metadata protection (name, description) for default templates

  2. Security
    - Users can edit exercises in both their own and default templates
    - Template ownership and visibility rules remain unchanged
*/

-- Drop ALL existing template exercise policies to start fresh
DROP POLICY IF EXISTS "Users can read template exercises" ON template_exercises;
DROP POLICY IF EXISTS "Users can read template exercises for any visible template" ON template_exercises;
DROP POLICY IF EXISTS "Users can read template exercises for their templates or defaul" ON template_exercises;
DROP POLICY IF EXISTS "Users can insert exercises into their templates" ON template_exercises;
DROP POLICY IF EXISTS "Users can update exercises in their templates" ON template_exercises;
DROP POLICY IF EXISTS "Users can delete exercises from their templates" ON template_exercises;
DROP POLICY IF EXISTS "Users can modify exercises in any visible template" ON template_exercises;

-- Create a single ALL policy for template exercises
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
);

-- Drop ALL existing workout template policies
DROP POLICY IF EXISTS "Users can read their own templates" ON workout_templates;
DROP POLICY IF EXISTS "Users can read their own templates and system templates" ON workout_templates;
DROP POLICY IF EXISTS "Users can read their own templates and default templates" ON workout_templates;
DROP POLICY IF EXISTS "Users can insert their own templates" ON workout_templates;
DROP POLICY IF EXISTS "Users can only create non-default templates" ON workout_templates;
DROP POLICY IF EXISTS "Users can update their own templates" ON workout_templates;
DROP POLICY IF EXISTS "Users can only update their non-default templates" ON workout_templates;
DROP POLICY IF EXISTS "Users can delete their own templates" ON workout_templates;
DROP POLICY IF EXISTS "Users can only delete their non-default templates" ON workout_templates;

-- Create new simplified policies for workout templates
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

CREATE POLICY "Users can update their own non-default templates"
ON workout_templates
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid() AND 
  is_default = false
);

CREATE POLICY "Users can delete their own non-default templates"
ON workout_templates
FOR DELETE
TO authenticated
USING (
  user_id = auth.uid() AND 
  is_default = false
);