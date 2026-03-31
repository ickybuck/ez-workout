/*
  # Initial Schema Setup for Workout Tracking App

  1. New Tables
    - user_settings
      - Stores user preferences like units and timer settings
    - exercises
      - Main exercise library
    - equipment_types
      - Types of equipment (machine, barbell, etc.)
    - muscle_groups
      - Major muscle groups
    - body_parts
      - Body part categories
    - exercise_muscle_groups
      - Junction table for exercises and muscle groups
    - workout_templates
      - Saved workout templates
    - template_exercises
      - Exercises within templates
    - workouts
      - Active/completed workout sessions
    - workout_exercises
      - Exercises within workouts
    - exercise_logs
      - Individual set tracking
    
  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
*/

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Equipment Types
CREATE TABLE equipment_types (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Muscle Groups
CREATE TABLE muscle_groups (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Body Parts
CREATE TABLE body_parts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- User Settings
CREATE TABLE user_settings (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES auth.users NOT NULL,
  use_metric boolean DEFAULT false,
  rest_timer_duration integer DEFAULT 90,
  auto_start_timer boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- Exercises
CREATE TABLE exercises (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  description text,
  equipment_type_id uuid REFERENCES equipment_types,
  body_part_id uuid REFERENCES body_parts,
  is_compound boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Exercise Muscle Groups (Junction)
CREATE TABLE exercise_muscle_groups (
  exercise_id uuid REFERENCES exercises ON DELETE CASCADE,
  muscle_group_id uuid REFERENCES muscle_groups ON DELETE CASCADE,
  is_primary boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (exercise_id, muscle_group_id)
);

-- Workout Templates
CREATE TABLE workout_templates (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES auth.users NOT NULL,
  name text NOT NULL,
  description text,
  is_default boolean DEFAULT false,
  is_hidden boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Template Exercises
CREATE TABLE template_exercises (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id uuid REFERENCES workout_templates ON DELETE CASCADE,
  exercise_id uuid REFERENCES exercises,
  order_index integer NOT NULL,
  default_sets integer DEFAULT 3,
  default_reps integer DEFAULT 10,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Workouts
CREATE TABLE workouts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES auth.users NOT NULL,
  template_id uuid REFERENCES workout_templates,
  name text NOT NULL,
  start_time timestamptz DEFAULT now(),
  end_time timestamptz,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Workout Exercises
CREATE TABLE workout_exercises (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  workout_id uuid REFERENCES workouts ON DELETE CASCADE,
  exercise_id uuid REFERENCES exercises,
  order_index integer NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Exercise Logs
CREATE TABLE exercise_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  workout_exercise_id uuid REFERENCES workout_exercises ON DELETE CASCADE,
  set_number integer NOT NULL,
  weight numeric(10,2),
  reps integer,
  completed boolean DEFAULT false,
  failed_reps integer DEFAULT 0,
  recommend_increase boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_muscle_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can read their own settings"
  ON user_settings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings"
  ON user_settings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own settings"
  ON user_settings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Everyone can read exercises
CREATE POLICY "Exercises are publicly readable"
  ON exercises FOR SELECT
  TO authenticated
  USING (true);

-- Everyone can read exercise muscle groups
CREATE POLICY "Exercise muscle groups are publicly readable"
  ON exercise_muscle_groups FOR SELECT
  TO authenticated
  USING (true);

-- Template policies
CREATE POLICY "Users can read their own templates"
  ON workout_templates FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR is_default = true);

CREATE POLICY "Users can insert their own templates"
  ON workout_templates FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own templates"
  ON workout_templates FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own templates"
  ON workout_templates FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Template exercises policies
CREATE POLICY "Users can read template exercises"
  ON template_exercises FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM workout_templates
    WHERE id = template_exercises.template_id
    AND (user_id = auth.uid() OR is_default = true)
  ));

-- Workout policies
CREATE POLICY "Users can read their own workouts"
  ON workouts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own workouts"
  ON workouts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own workouts"
  ON workouts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own workouts"
  ON workouts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Insert default equipment types
INSERT INTO equipment_types (name) VALUES
  ('Barbell'),
  ('Dumbbell'),
  ('Machine'),
  ('Bodyweight'),
  ('Cable'),
  ('Kettlebell'),
  ('Resistance Band');

-- Insert default muscle groups
INSERT INTO muscle_groups (name) VALUES
  ('Chest'),
  ('Back'),
  ('Shoulders'),
  ('Biceps'),
  ('Triceps'),
  ('Quadriceps'),
  ('Hamstrings'),
  ('Calves'),
  ('Core'),
  ('Glutes');

-- Insert default body parts
INSERT INTO body_parts (name) VALUES
  ('Chest'),
  ('Back'),
  ('Shoulders'),
  ('Arms'),
  ('Legs'),
  ('Core');