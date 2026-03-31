/*
  # Fix exercise muscle groups RLS policies

  1. Changes
    - Drop existing policies
    - Create new policy that allows authenticated users to:
      - Read exercise muscle groups
      - Create exercise muscle groups
      - Update exercise muscle groups
      - Delete exercise muscle groups
    - Ensure RLS is enabled
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Exercise muscle groups are publicly readable" ON exercise_muscle_groups;
DROP POLICY IF EXISTS "Users can modify exercise muscle groups" ON exercise_muscle_groups;
DROP POLICY IF EXISTS "Users can access their own exercise muscle groups" ON exercise_muscle_groups;

-- Create new policy for all operations
CREATE POLICY "Users can modify exercise muscle groups"
ON exercise_muscle_groups
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM exercises e
    WHERE e.id = exercise_muscle_groups.exercise_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM exercises e
    WHERE e.id = exercise_muscle_groups.exercise_id
  )
);

-- Ensure RLS is enabled
ALTER TABLE exercise_muscle_groups ENABLE ROW LEVEL SECURITY;