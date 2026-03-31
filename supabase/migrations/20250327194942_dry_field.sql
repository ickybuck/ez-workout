/*
  # Fix exercise logs RLS policy

  1. Changes
    - Drop existing policy
    - Create new simplified policy that allows all operations
    - Use correct column reference in policy condition
    - Remove redundant WITH CHECK clause

  2. Security
    - Users can only access logs for workouts they own
    - Policy checks workout ownership through joins
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can manage their own exercise logs" ON exercise_logs;

-- Create new simplified policy
CREATE POLICY "Users can manage their own exercise logs"
ON exercise_logs
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM workout_exercises we
    JOIN workouts w ON w.id = we.workout_id
    WHERE we.id = exercise_logs.workout_exercise_id
    AND w.user_id = auth.uid()
  )
);

-- Ensure RLS is enabled
ALTER TABLE exercise_logs ENABLE ROW LEVEL SECURITY;