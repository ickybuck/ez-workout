/*
  # Populate Exercise Data

  1. Initial Data
    - Add unique constraints on name columns
    - Populate equipment_types, body_parts, and muscle_groups
    - Add initial exercises with muscle group relationships

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
*/

-- Add unique constraints
ALTER TABLE equipment_types ADD CONSTRAINT equipment_types_name_key UNIQUE (name);
ALTER TABLE body_parts ADD CONSTRAINT body_parts_name_key UNIQUE (name);
ALTER TABLE muscle_groups ADD CONSTRAINT muscle_groups_name_key UNIQUE (name);

-- Equipment Types
INSERT INTO equipment_types (name) VALUES
  ('Barbell'),
  ('Dumbbell'),
  ('Machine'),
  ('Body Weight'),
  ('Cable'),
  ('Kettlebell')
ON CONFLICT (name) DO NOTHING;

-- Body Parts
INSERT INTO body_parts (name) VALUES
  ('Chest'),
  ('Back'),
  ('Shoulders'),
  ('Arms'),
  ('Legs'),
  ('Core'),
  ('Full Body')
ON CONFLICT (name) DO NOTHING;

-- Muscle Groups
INSERT INTO muscle_groups (name) VALUES
  ('Pectoralis Major'),
  ('Pectoralis Minor'),
  ('Latissimus Dorsi'),
  ('Trapezius'),
  ('Deltoids'),
  ('Biceps Brachii'),
  ('Triceps Brachii'),
  ('Quadriceps'),
  ('Hamstrings'),
  ('Calves'),
  ('Rectus Abdominis'),
  ('Obliques'),
  ('Erector Spinae')
ON CONFLICT (name) DO NOTHING;

-- Enable RLS
ALTER TABLE equipment_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE body_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE muscle_groups ENABLE ROW LEVEL SECURITY;

-- Add RLS Policies
CREATE POLICY "Equipment types are viewable by authenticated users"
  ON equipment_types
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Body parts are viewable by authenticated users"
  ON body_parts
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Muscle groups are viewable by authenticated users"
  ON muscle_groups
  FOR SELECT
  TO authenticated
  USING (true);

-- Insert Initial Exercises
DO $$ 
DECLARE
  v_barbell_id uuid;
  v_dumbbell_id uuid;
  v_machine_id uuid;
  v_bodyweight_id uuid;
  v_chest_id uuid;
  v_back_id uuid;
  v_legs_id uuid;
  v_shoulders_id uuid;
  v_arms_id uuid;
  v_core_id uuid;
  v_pec_major_id uuid;
  v_lats_id uuid;
  v_delts_id uuid;
  v_quads_id uuid;
  v_triceps_id uuid;
  v_biceps_id uuid;
  v_abs_id uuid;
BEGIN
  -- Get IDs
  SELECT id INTO v_barbell_id FROM equipment_types WHERE name = 'Barbell';
  SELECT id INTO v_dumbbell_id FROM equipment_types WHERE name = 'Dumbbell';
  SELECT id INTO v_machine_id FROM equipment_types WHERE name = 'Machine';
  SELECT id INTO v_bodyweight_id FROM equipment_types WHERE name = 'Body Weight';
  
  SELECT id INTO v_chest_id FROM body_parts WHERE name = 'Chest';
  SELECT id INTO v_back_id FROM body_parts WHERE name = 'Back';
  SELECT id INTO v_legs_id FROM body_parts WHERE name = 'Legs';
  SELECT id INTO v_shoulders_id FROM body_parts WHERE name = 'Shoulders';
  SELECT id INTO v_arms_id FROM body_parts WHERE name = 'Arms';
  SELECT id INTO v_core_id FROM body_parts WHERE name = 'Core';
  
  SELECT id INTO v_pec_major_id FROM muscle_groups WHERE name = 'Pectoralis Major';
  SELECT id INTO v_lats_id FROM muscle_groups WHERE name = 'Latissimus Dorsi';
  SELECT id INTO v_delts_id FROM muscle_groups WHERE name = 'Deltoids';
  SELECT id INTO v_quads_id FROM muscle_groups WHERE name = 'Quadriceps';
  SELECT id INTO v_triceps_id FROM muscle_groups WHERE name = 'Triceps Brachii';
  SELECT id INTO v_biceps_id FROM muscle_groups WHERE name = 'Biceps Brachii';
  SELECT id INTO v_abs_id FROM muscle_groups WHERE name = 'Rectus Abdominis';

  -- Insert Exercises
  WITH inserted_exercises AS (
    INSERT INTO exercises (name, description, equipment_type_id, body_part_id, is_compound)
    VALUES
      ('Bench Press', 'Lie on a flat bench, lower the barbell to your chest, and press back up', v_barbell_id, v_chest_id, true),
      ('Pull-ups', 'Hang from a bar and pull yourself up until your chin is over the bar', v_bodyweight_id, v_back_id, true),
      ('Squats', 'Stand with barbell on shoulders, squat down until thighs are parallel to ground', v_barbell_id, v_legs_id, true),
      ('Overhead Press', 'Press barbell from shoulders overhead while standing', v_barbell_id, v_shoulders_id, true),
      ('Bicep Curls', 'Curl dumbbells from full extension to full flexion', v_dumbbell_id, v_arms_id, false),
      ('Tricep Pushdowns', 'Push cable attachment down using triceps', v_machine_id, v_arms_id, false),
      ('Leg Press', 'Push weight sled with legs while seated', v_machine_id, v_legs_id, true),
      ('Crunches', 'Lie on back, lift shoulders off ground using abs', v_bodyweight_id, v_core_id, false)
    RETURNING id, name
  )
  -- Link Exercises to Muscle Groups
  INSERT INTO exercise_muscle_groups (exercise_id, muscle_group_id, is_primary)
  SELECT id, v_pec_major_id, true
  FROM inserted_exercises
  WHERE name = 'Bench Press'
  UNION ALL
  SELECT id, v_triceps_id, false
  FROM inserted_exercises
  WHERE name = 'Bench Press'
  UNION ALL
  SELECT id, v_lats_id, true
  FROM inserted_exercises
  WHERE name = 'Pull-ups'
  UNION ALL
  SELECT id, v_biceps_id, false
  FROM inserted_exercises
  WHERE name = 'Pull-ups'
  UNION ALL
  SELECT id, v_quads_id, true
  FROM inserted_exercises
  WHERE name = 'Squats'
  UNION ALL
  SELECT id, v_delts_id, true
  FROM inserted_exercises
  WHERE name = 'Overhead Press'
  UNION ALL
  SELECT id, v_triceps_id, false
  FROM inserted_exercises
  WHERE name = 'Overhead Press'
  UNION ALL
  SELECT id, v_biceps_id, true
  FROM inserted_exercises
  WHERE name = 'Bicep Curls'
  UNION ALL
  SELECT id, v_triceps_id, true
  FROM inserted_exercises
  WHERE name = 'Tricep Pushdowns'
  UNION ALL
  SELECT id, v_quads_id, true
  FROM inserted_exercises
  WHERE name = 'Leg Press'
  UNION ALL
  SELECT id, v_abs_id, true
  FROM inserted_exercises
  WHERE name = 'Crunches';
END $$;