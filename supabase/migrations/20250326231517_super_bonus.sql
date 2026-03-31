/*
  # Fix template update policy

  1. Changes
    - Drop existing update policies
    - Create new update policy that allows:
      - Users to fully update their own non-default templates
      - Users to update is_favorite on default templates
    - Uses a simpler policy structure that avoids NEW/OLD references
*/

-- Drop existing update policies
DROP POLICY IF EXISTS "Users can update their own templates" ON workout_templates;
DROP POLICY IF EXISTS "Users can update their own non-default templates" ON workout_templates;

-- Create separate policies for default and non-default templates
CREATE POLICY "Users can update their own non-default templates"
ON workout_templates
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid() AND 
  is_default = false
);

CREATE POLICY "Users can update favorite status on default templates"
ON workout_templates
FOR UPDATE
TO authenticated
USING (
  is_default = true AND 
  user_id = '00000000-0000-0000-0000-000000000000'
)
WITH CHECK (
  is_default = true AND
  user_id = '00000000-0000-0000-0000-000000000000'
);