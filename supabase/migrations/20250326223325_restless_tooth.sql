/*
  # Fix workout templates RLS policies

  1. Changes
    - Drop existing policies
    - Recreate RLS policies for workout_templates table to:
      - Allow users to read their own templates and default templates
      - Allow users to update only their own templates (not defaults)
      - Allow users to delete only their own templates (not defaults)
      - Allow users to insert new templates

  2. Security
    - Ensure default templates cannot be modified
    - Maintain data access control through RLS
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can read their own templates and default templates" ON workout_templates;
DROP POLICY IF EXISTS "Users can create their own templates" ON workout_templates;
DROP POLICY IF EXISTS "Users can update their own templates" ON workout_templates;
DROP POLICY IF EXISTS "Users can delete their own templates" ON workout_templates;

-- Policy for selecting workout templates
CREATE POLICY "Users can read their own templates and default templates"
ON workout_templates
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() OR is_default = true
);

-- Policy for inserting workout templates
CREATE POLICY "Users can create their own templates"
ON workout_templates
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid() AND is_default = false
);

-- Policy for updating workout templates
CREATE POLICY "Users can update their own templates"
ON workout_templates
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid() AND is_default = false
)
WITH CHECK (
  user_id = auth.uid() AND is_default = false
);

-- Policy for deleting workout templates
CREATE POLICY "Users can delete their own templates"
ON workout_templates
FOR DELETE
TO authenticated
USING (
  user_id = auth.uid() AND is_default = false
);