/*
  # Fix exercise logs RLS policies

  1. Changes
    - Drop existing policies
    - Create new simplified policy that allows all operations based on workout ownership
    - Ensure proper joins through workout_exercises to workouts
    - Add explicit check for user ownership

  2. Security
    - Users can only access and modify logs for their own workouts
    - Ownership is verified through workout_exercises -> workouts join
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can read their own exercise logs" ON exercise_logs;
DROP POLICY IF EXISTS "Users can update their own exercise logs" ON exercise_logs;
DROP POLICY IF EXISTS "Users can insert their own exercise logs" ON exercise_logs;

-- Create a single policy for all operations
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
)
WITH CHECK (
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