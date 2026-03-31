-- Drop existing policies
DROP POLICY IF EXISTS "Users can manage their own exercise logs" ON exercise_logs;

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
    WHERE we.id = workout_exercise_id
    AND w.user_id = auth.uid()
  )
);

-- Ensure RLS is enabled
ALTER TABLE exercise_logs ENABLE ROW LEVEL SECURITY;