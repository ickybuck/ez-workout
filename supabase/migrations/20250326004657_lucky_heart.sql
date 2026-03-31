/*
  # Add exercise tracking capabilities

  1. New Tables
    - `exercise_defaults`
      - `id` (uuid, primary key)
      - `exercise_id` (uuid, foreign key to exercises)
      - `user_id` (uuid, foreign key to users)
      - `default_sets` (integer)
      - `default_reps` (integer)
      - `default_weight` (numeric)
      - `weight_increment` (numeric)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `exercise_defaults` table
    - Add policies for authenticated users to manage their own defaults

  3. Changes
    - Add default values for sets, reps, and weight increments
*/

-- Create exercise_defaults table
CREATE TABLE IF NOT EXISTS exercise_defaults (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id uuid REFERENCES exercises(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  default_sets integer DEFAULT 3,
  default_reps integer DEFAULT 10,
  default_weight numeric(10,2) DEFAULT 0,
  weight_increment numeric(10,2) DEFAULT 2.5,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(exercise_id, user_id)
);

-- Enable RLS
ALTER TABLE exercise_defaults ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can create their own exercise defaults"
  ON exercise_defaults
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own exercise defaults"
  ON exercise_defaults
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own exercise defaults"
  ON exercise_defaults
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own exercise defaults"
  ON exercise_defaults
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);