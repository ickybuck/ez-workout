/*
  # Fix exercise logs RLS policies

  1. Changes
    - Drop existing policies
    - Create new policies that allow:
      - Users to read their own exercise logs
      - Users to update their own exercise logs
      - Users to insert exercise logs for their workouts
    - Ensure proper joins through workout_exercises to workouts
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can read their own exercise logs" ON exercise_logs;
DROP POLICY IF EXISTS "Users can update their own exercise logs" ON exercise_logs;
DROP POLICY IF EXISTS "Users can insert their own exercise logs" ON exercise_logs;

-- Create new policies for exercise_logs
CREATE POLICY "Users can read their own exercise logs"
ON exercise_logs
FOR SELECT
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

CREATE POLICY "Users can update their own exercise logs"
ON exercise_logs
FOR UPDATE
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

CREATE POLICY "Users can insert their own exercise logs"
ON exercise_logs
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM workout_exercises we
    JOIN workouts w ON w.id = we.workout_id
    WHERE we.id = workout_exercise_id
    AND w.user_id = auth.uid()
  )
);

-- Ensure RLS is enabled
ALTER TABLE exercise_logs ENABLE ROW LEVEL SECURITY;