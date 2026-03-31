/*
  # Add RLS policies for workout tables

  1. Changes
    - Add RLS policies for workout_exercises table
    - Add RLS policies for exercise_logs table
    - Ensure users can only access their own workout data
    - Allow users to create and modify their own workout records

  2. Security
    - Users can only access workout data they own
    - Access is controlled through the workouts table ownership
*/

-- Enable RLS on workout_exercises if not already enabled
ALTER TABLE workout_exercises ENABLE ROW LEVEL SECURITY;

-- Enable RLS on exercise_logs if not already enabled
ALTER TABLE exercise_logs ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies
DROP POLICY IF EXISTS "Users can access their own workout exercises" ON workout_exercises;
DROP POLICY IF EXISTS "Users can modify their own workout exercises" ON workout_exercises;
DROP POLICY IF EXISTS "Users can access their own exercise logs" ON exercise_logs;
DROP POLICY IF EXISTS "Users can modify their own exercise logs" ON exercise_logs;

-- Create policies for workout_exercises
CREATE POLICY "Users can access their own workout exercises"
ON workout_exercises
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM workouts
    WHERE workouts.id = workout_exercises.workout_id
    AND workouts.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM workouts
    WHERE workouts.id = workout_exercises.workout_id
    AND workouts.user_id = auth.uid()
  )
);

-- Create policies for exercise_logs
CREATE POLICY "Users can access their own exercise logs"
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