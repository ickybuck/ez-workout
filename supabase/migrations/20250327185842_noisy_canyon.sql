/*
  # Fix exercise RLS policies

  1. Changes
    - Drop existing policies
    - Create new policies that allow authenticated users to:
      - Read all exercises
      - Update exercises they have defaults for
      - Delete exercises they have defaults for
      - Insert new exercises

  2. Security
    - Users can read all exercises
    - Users can only modify exercises they have defaults for
    - Ensures data integrity by linking permissions to exercise_defaults
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Exercises are publicly readable" ON exercises;
DROP POLICY IF EXISTS "Users can modify their own exercises" ON exercises;

-- Create new policies
CREATE POLICY "Users can read all exercises"
ON exercises
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can update exercises they have defaults for"
ON exercises
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM exercise_defaults
    WHERE exercise_defaults.exercise_id = exercises.id
    AND exercise_defaults.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete exercises they have defaults for"
ON exercises
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM exercise_defaults
    WHERE exercise_defaults.exercise_id = exercises.id
    AND exercise_defaults.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert new exercises"
ON exercises
FOR INSERT
TO authenticated
WITH CHECK (true);