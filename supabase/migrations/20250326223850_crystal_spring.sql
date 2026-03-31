/*
  # Update template exercise policies

  1. Changes
    - Modify template exercise policies to allow editing exercises in all templates
    - Keep template protection for create/update/delete operations
    - Allow reading and updating exercises regardless of template ownership

  2. Security
    - Users can still only create/update/delete their own templates
    - Users can now edit exercises in any template they can view
*/

-- Drop existing template exercise policies
DROP POLICY IF EXISTS "Users can read template exercises" ON template_exercises;
DROP POLICY IF EXISTS "Users can read template exercises for their templates or defaul" ON template_exercises;
DROP POLICY IF EXISTS "Users can insert exercises into their templates" ON template_exercises;
DROP POLICY IF EXISTS "Users can update exercises in their templates" ON template_exercises;
DROP POLICY IF EXISTS "Users can delete exercises from their templates" ON template_exercises;

-- Create new template exercise policies that allow exercise modifications
CREATE POLICY "Users can read template exercises for any visible template"
ON template_exercises
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM workout_templates wt
    WHERE wt.id = template_id 
    AND (wt.user_id = auth.uid() OR wt.is_default = true)
  )
);

CREATE POLICY "Users can modify exercises in any visible template"
ON template_exercises
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM workout_templates wt
    WHERE wt.id = template_id 
    AND (wt.user_id = auth.uid() OR wt.is_default = true)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM workout_templates wt
    WHERE wt.id = template_id 
    AND (wt.user_id = auth.uid() OR wt.is_default = true)
  )
);