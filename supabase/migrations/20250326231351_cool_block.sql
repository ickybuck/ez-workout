/*
  # Update template policies

  1. Changes
    - Drop existing update policy
    - Create new update policy that allows users to update their own templates
    - Allow updating is_favorite for both default and non-default templates
*/

-- Drop existing update policy
DROP POLICY IF EXISTS "Users can update their own non-default templates" ON workout_templates;

-- Create new update policy that allows updating is_favorite
CREATE POLICY "Users can update their own templates"
ON workout_templates
FOR UPDATE
TO authenticated
USING (
  -- Users can only update their own templates
  user_id = auth.uid()
);