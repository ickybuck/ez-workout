/*
  # Update exercise logs to handle skipped and not attempted exercises

  1. Changes
    - Add status column to exercise_logs table
    - Set default status as 'pending'
    - Add check constraint for valid statuses
    - Update existing rows based on completion and failed reps
    - Make status column required
*/

-- Add status column
ALTER TABLE exercise_logs
ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';

-- Add check constraint for valid statuses
ALTER TABLE exercise_logs
ADD CONSTRAINT exercise_logs_status_check
CHECK (status IN ('pending', 'completed', 'failed', 'skipped', 'not_attempted'));

-- Update existing rows based on completion and failed reps
UPDATE exercise_logs
SET status = CASE
  WHEN completed = true AND failed_reps = reps THEN 'not_attempted'
  WHEN completed = true AND failed_reps > 0 THEN 'skipped'
  WHEN completed = true AND failed_reps = 0 THEN 'completed'
  WHEN completed = false THEN 'failed'
  ELSE 'pending'
END;

-- Make status column required
ALTER TABLE exercise_logs
ALTER COLUMN status SET NOT NULL;