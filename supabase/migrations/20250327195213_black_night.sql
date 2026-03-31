-- Drop existing policies
DROP POLICY IF EXISTS "Users can manage their own exercise logs" ON exercise_logs;

-- Create new policy that allows all operations based on workout ownership
CREATE POLICY "Enable all operations for workout owners"
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

-- Add indexes to improve join performance
CREATE INDEX IF NOT EXISTS idx_exercise_logs_workout_exercise_id 
ON exercise_logs(workout_exercise_id);

CREATE INDEX IF NOT EXISTS idx_workout_exercises_workout_id
ON workout_exercises(workout_id);

CREATE INDEX IF NOT EXISTS idx_workouts_user_id
ON workouts(user_id);