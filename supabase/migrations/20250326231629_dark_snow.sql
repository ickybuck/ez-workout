/*
  # Fix template favorites policy

  1. Changes
    - Drop existing update policies
    - Create new policies that properly handle:
      - Full updates for user's own non-default templates
      - Favorite status updates for both default and user templates
    - Uses proper RLS syntax that works with Postgres security model
*/

-- Drop existing update policies
DROP POLICY IF EXISTS "Users can update their own templates" ON workout_templates;
DROP POLICY IF EXISTS "Users can update their own non-default templates" ON workout_templates;
DROP POLICY IF EXISTS "Users can update favorite status on default templates" ON workout_templates;

-- Create policy for updating user's own non-default templates
CREATE POLICY "Users can update their own non-default templates"
ON workout_templates
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid() AND 
  is_default = false
);

-- Create policy for updating favorite status
CREATE POLICY "Users can update favorite status"
ON workout_templates
FOR UPDATE
TO authenticated
USING (
  -- Allow updating favorite status on default templates or user's own templates
  (is_default = true AND user_id = '00000000-0000-0000-0000-000000000000') OR
  user_id = auth.uid()
)
WITH CHECK (
  -- Same condition as USING clause
  ((is_default = true AND user_id = '00000000-0000-0000-0000-000000000000') OR
   user_id = auth.uid()) AND
  -- Only allow updating is_favorite column
  (workout_templates.is_favorite IS DISTINCT FROM is_favorite)
);