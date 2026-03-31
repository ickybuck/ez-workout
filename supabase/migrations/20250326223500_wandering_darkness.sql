/*
  # Fix default templates setup

  1. Changes
    - Create system user for default templates in auth schema
    - Insert default templates with system user as owner
    - Add template exercises for default templates

  2. Security
    - System user is used only for default templates
    - Templates are marked as default and read-only
*/

-- Create system user for default templates if it doesn't exist
DO $$
BEGIN
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    confirmation_token,
    email_change_token_new,
    recovery_token
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'system@workoutapp.local',
    'not-a-real-password',
    NOW(),
    NOW(),
    NOW(),
    '',
    '',
    ''
  )
  ON CONFLICT (id) DO NOTHING;
END $$;

-- Insert default templates
INSERT INTO workout_templates (id, user_id, name, description, is_default, is_hidden)
VALUES
  (
    'fb4c90a1-5d6f-4647-9c2c-f0b2e0556107',
    '00000000-0000-0000-0000-000000000000',
    'Full Body Workout',
    'A comprehensive full body workout targeting all major muscle groups',
    true,
    false
  ),
  (
    'a8d91e3c-3f7f-4c6a-9f0d-b7c2f72d9b88',
    '00000000-0000-0000-0000-000000000000',
    'Lower Body + Core',
    'Focus on legs and core strength',
    true,
    false
  ),
  (
    'c5b6d8e7-9f4a-4b2c-8d1e-3a7c6f5d4b2a',
    '00000000-0000-0000-0000-000000000000',
    'Upper Body + Core',
    'Targeting upper body muscles with core stability work',
    true,
    false
  )
ON CONFLICT (id) DO NOTHING;

-- Full Body Workout Exercises
INSERT INTO template_exercises (template_id, exercise_id, order_index, default_sets, default_reps)
SELECT
  'fb4c90a1-5d6f-4647-9c2c-f0b2e0556107',
  e.id,
  pos.order_index,
  CASE 
    WHEN e.is_compound THEN 4
    ELSE 3
  END as default_sets,
  CASE 
    WHEN e.is_compound THEN 8
    ELSE 12
  END as default_reps
FROM (
  VALUES
    ('Barbell Squat', 1),
    ('Bench Press', 2),
    ('Bent Over Row', 3),
    ('Romanian Deadlift', 4),
    ('Overhead Press', 5),
    ('Pull Ups', 6),
    ('Plank', 7)
) as pos(exercise_name, order_index)
JOIN exercises e ON e.name = pos.exercise_name
ON CONFLICT DO NOTHING;

-- Lower Body + Core Exercises
INSERT INTO template_exercises (template_id, exercise_id, order_index, default_sets, default_reps)
SELECT
  'a8d91e3c-3f7f-4c6a-9f0d-b7c2f72d9b88',
  e.id,
  pos.order_index,
  CASE 
    WHEN e.is_compound THEN 4
    ELSE 3
  END as default_sets,
  CASE 
    WHEN e.is_compound THEN 8
    ELSE 12
  END as default_reps
FROM (
  VALUES
    ('Barbell Squat', 1),
    ('Romanian Deadlift', 2),
    ('Leg Press', 3),
    ('Leg Extension', 4),
    ('Leg Curl', 5),
    ('Calf Raises', 6),
    ('Plank', 7),
    ('Russian Twist', 8),
    ('Leg Raises', 9)
) as pos(exercise_name, order_index)
JOIN exercises e ON e.name = pos.exercise_name
ON CONFLICT DO NOTHING;

-- Upper Body + Core Exercises
INSERT INTO template_exercises (template_id, exercise_id, order_index, default_sets, default_reps)
SELECT
  'c5b6d8e7-9f4a-4b2c-8d1e-3a7c6f5d4b2a',
  e.id,
  pos.order_index,
  CASE 
    WHEN e.is_compound THEN 4
    ELSE 3
  END as default_sets,
  CASE 
    WHEN e.is_compound THEN 8
    ELSE 12
  END as default_reps
FROM (
  VALUES
    ('Bench Press', 1),
    ('Bent Over Row', 2),
    ('Overhead Press', 3),
    ('Pull Ups', 4),
    ('Lateral Raises', 5),
    ('Tricep Pushdown', 6),
    ('Bicep Curl', 7),
    ('Plank', 8),
    ('Russian Twist', 9)
) as pos(exercise_name, order_index)
JOIN exercises e ON e.name = pos.exercise_name
ON CONFLICT DO NOTHING;