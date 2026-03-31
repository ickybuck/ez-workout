-- Drop existing workout template policies
DROP POLICY IF EXISTS "Users can read their own templates and system templates" ON workout_templates;
DROP POLICY IF EXISTS "Users can insert their own templates" ON workout_templates;
DROP POLICY IF EXISTS "Users can update any visible template" ON workout_templates;
DROP POLICY IF EXISTS "Users can delete their own non-default templates" ON workout_templates;

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

CREATE POLICY "Users can delete any visible template"
ON workout_templates
FOR DELETE
TO authenticated
USING (
  (user_id = auth.uid()) OR 
  (is_default = true AND user_id = '00000000-0000-0000-0000-000000000000')
);