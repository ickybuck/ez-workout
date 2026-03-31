/*
  # Fix template exercises RLS policies

  1. Changes
    - Add RLS policies for template_exercises table to allow:
      - Insert when user owns the template
      - Update when user owns the template
      - Delete when user owns the template
      - Select when user owns the template or template is default

  2. Security
    - Enable RLS on template_exercises table
    - Add policies for CRUD operations
    - Ensure users can only modify their own template exercises
*/

-- Enable RLS
ALTER TABLE template_exercises ENABLE ROW LEVEL SECURITY;

-- Policy for selecting template exercises
CREATE POLICY "Users can read template exercises for their templates or default templates"
ON template_exercises
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM workout_templates
    WHERE id = template_exercises.template_id
    AND (user_id = auth.uid() OR is_default = true)
  )
);

-- Policy for inserting template exercises
CREATE POLICY "Users can insert exercises into their templates"
ON template_exercises
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM workout_templates
    WHERE id = template_id
    AND user_id = auth.uid()
  )
);

-- Policy for updating template exercises
CREATE POLICY "Users can update exercises in their templates"
ON template_exercises
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM workout_templates
    WHERE id = template_id
    AND user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM workout_templates
    WHERE id = template_id
    AND user_id = auth.uid()
  )
);

-- Policy for deleting template exercises
CREATE POLICY "Users can delete exercises from their templates"
ON template_exercises
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM workout_templates
    WHERE id = template_id
    AND user_id = auth.uid()
  )
);