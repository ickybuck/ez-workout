/*
  # Fix template RLS policies

  1. Changes
    - Drop and recreate RLS policies for workout_templates
    - Add explicit checks for system user and default templates
    - Ensure proper isolation between user templates

  2. Security
    - Users can only read their own templates and default templates
    - Users can only modify their own non-default templates
    - System user's templates are protected from modification
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can read their own templates and default templates" ON workout_templates;
DROP POLICY IF EXISTS "Users can create their own templates" ON workout_templates;
DROP POLICY IF EXISTS "Users can update their own templates" ON workout_templates;
DROP POLICY IF EXISTS "Users can delete their own templates" ON workout_templates;

-- Policy for selecting workout templates
CREATE POLICY "Users can read their own templates and system templates"
ON workout_templates
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() OR 
  (is_default = true AND user_id = '00000000-0000-0000-0000-000000000000')
);

-- Policy for inserting workout templates
CREATE POLICY "Users can only create non-default templates"
ON workout_templates
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid() AND 
  is_default = false AND 
  user_id != '00000000-0000-0000-0000-000000000000'
);

-- Policy for updating workout templates
CREATE POLICY "Users can only update their non-default templates"
ON workout_templates
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid() AND 
  is_default = false AND 
  user_id != '00000000-0000-0000-0000-000000000000'
)
WITH CHECK (
  user_id = auth.uid() AND 
  is_default = false AND 
  user_id != '00000000-0000-0000-0000-000000000000'
);

-- Policy for deleting workout templates
CREATE POLICY "Users can only delete their non-default templates"
ON workout_templates
FOR DELETE
TO authenticated
USING (
  user_id = auth.uid() AND 
  is_default = false AND 
  user_id != '00000000-0000-0000-0000-000000000000'
);