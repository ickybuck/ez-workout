/*
  # Fix exercise_muscle_groups RLS policies

  1. Changes
    - Drop existing policies
    - Create new policy that allows authenticated users to modify exercise_muscle_groups
    - Policy checks if the user owns the exercise through exercise_defaults

  2. Security
    - Users can only modify muscle groups for exercises they have defaults for
    - Maintains data isolation between users
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Exercise muscle groups are publicly readable" ON exercise_muscle_groups;

-- Create new policy for all operations
CREATE POLICY "Users can modify exercise muscle groups"
ON exercise_muscle_groups
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM exercise_defaults ed
    WHERE ed.exercise_id = exercise_muscle_groups.exercise_id
    AND ed.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM exercise_defaults ed
    WHERE ed.exercise_id = exercise_muscle_groups.exercise_id
    AND ed.user_id = auth.uid()
  )
);