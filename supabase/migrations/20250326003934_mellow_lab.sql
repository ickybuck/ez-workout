/*
  # Expand Exercise Library

  1. Additional Equipment Types
    - Add more specific equipment categories
  
  2. Additional Body Parts
    - Add more specific body part categories
  
  3. Additional Muscle Groups
    - Add comprehensive list of muscle groups
  
  4. Expanded Exercise List
    - Add comprehensive list of standard gym exercises
    - Include detailed descriptions
    - Link exercises to appropriate muscle groups
*/

-- Additional Equipment Types
INSERT INTO equipment_types (name) VALUES
  ('Smith Machine'),
  ('Resistance Band'),
  ('Medicine Ball'),
  ('Foam Roller'),
  ('Suspension Trainer'),
  ('EZ Bar'),
  ('Yoga Mat'),
  ('Stability Ball'),
  ('Plate Loaded Machine'),
  ('Sled')
ON CONFLICT (name) DO NOTHING;

-- Additional Body Parts
INSERT INTO body_parts (name) VALUES
  ('Upper Back'),
  ('Lower Back'),
  ('Biceps'),
  ('Triceps'),
  ('Forearms'),
  ('Calves'),
  ('Glutes'),
  ('Hip Flexors'),
  ('Neck'),
  ('Cardio')
ON CONFLICT (name) DO NOTHING;

-- Additional Muscle Groups
INSERT INTO muscle_groups (name) VALUES
  ('Rhomboids'),
  ('Teres Major'),
  ('Teres Minor'),
  ('Infraspinatus'),
  ('Supraspinatus'),
  ('Serratus Anterior'),
  ('Gastrocnemius'),
  ('Soleus'),
  ('Tibialis Anterior'),
  ('Gluteus Maximus'),
  ('Gluteus Medius'),
  ('Gluteus Minimus'),
  ('Iliopsoas'),
  ('Tensor Fasciae Latae'),
  ('Sartorius'),
  ('Pectineus'),
  ('Gracilis'),
  ('Adductor Magnus'),
  ('Adductor Longus'),
  ('Vastus Lateralis'),
  ('Vastus Medialis'),
  ('Vastus Intermedius'),
  ('Rectus Femoris'),
  ('Semitendinosus'),
  ('Semimembranosus'),
  ('Biceps Femoris'),
  ('External Obliques'),
  ('Internal Obliques'),
  ('Transverse Abdominis'),
  ('Brachialis'),
  ('Brachioradialis'),
  ('Pronator Teres'),
  ('Flexor Carpi Radialis'),
  ('Flexor Carpi Ulnaris'),
  ('Extensor Carpi Radialis'),
  ('Extensor Carpi Ulnaris'),
  ('Sternocleidomastoid'),
  ('Trapezius Upper'),
  ('Trapezius Middle'),
  ('Trapezius Lower'),
  ('Anterior Deltoid'),
  ('Lateral Deltoid'),
  ('Posterior Deltoid')
ON CONFLICT (name) DO NOTHING;

-- Insert Additional Exercises
DO $$ 
DECLARE
  -- Equipment Type IDs
  v_barbell_id uuid;
  v_dumbbell_id uuid;
  v_machine_id uuid;
  v_bodyweight_id uuid;
  v_cable_id uuid;
  v_smith_id uuid;
  v_plate_machine_id uuid;
  
  -- Body Part IDs
  v_chest_id uuid;
  v_back_id uuid;
  v_upper_back_id uuid;
  v_lower_back_id uuid;
  v_shoulders_id uuid;
  v_biceps_id uuid;
  v_triceps_id uuid;
  v_legs_id uuid;
  v_calves_id uuid;
  v_core_id uuid;
  v_glutes_id uuid;
  
  -- Muscle Group IDs
  v_pec_major_id uuid;
  v_lats_id uuid;
  v_traps_upper_id uuid;
  v_traps_middle_id uuid;
  v_traps_lower_id uuid;
  v_anterior_delt_id uuid;
  v_lateral_delt_id uuid;
  v_posterior_delt_id uuid;
  v_biceps_brachii_id uuid;
  v_triceps_brachii_id uuid;
  v_quads_id uuid;
  v_hamstrings_id uuid;
  v_glute_max_id uuid;
  v_abs_id uuid;
  v_obliques_id uuid;
  v_erector_spinae_id uuid;
BEGIN
  -- Get Equipment Type IDs
  SELECT id INTO v_barbell_id FROM equipment_types WHERE name = 'Barbell' LIMIT 1;
  SELECT id INTO v_dumbbell_id FROM equipment_types WHERE name = 'Dumbbell' LIMIT 1;
  SELECT id INTO v_machine_id FROM equipment_types WHERE name = 'Machine' LIMIT 1;
  SELECT id INTO v_bodyweight_id FROM equipment_types WHERE name = 'Body Weight' LIMIT 1;
  SELECT id INTO v_cable_id FROM equipment_types WHERE name = 'Cable' LIMIT 1;
  SELECT id INTO v_smith_id FROM equipment_types WHERE name = 'Smith Machine' LIMIT 1;
  SELECT id INTO v_plate_machine_id FROM equipment_types WHERE name = 'Plate Loaded Machine' LIMIT 1;
  
  -- Get Body Part IDs
  SELECT id INTO v_chest_id FROM body_parts WHERE name = 'Chest' LIMIT 1;
  SELECT id INTO v_back_id FROM body_parts WHERE name = 'Back' LIMIT 1;
  SELECT id INTO v_upper_back_id FROM body_parts WHERE name = 'Upper Back' LIMIT 1;
  SELECT id INTO v_lower_back_id FROM body_parts WHERE name = 'Lower Back' LIMIT 1;
  SELECT id INTO v_shoulders_id FROM body_parts WHERE name = 'Shoulders' LIMIT 1;
  SELECT id INTO v_biceps_id FROM body_parts WHERE name = 'Biceps' LIMIT 1;
  SELECT id INTO v_triceps_id FROM body_parts WHERE name = 'Triceps' LIMIT 1;
  SELECT id INTO v_legs_id FROM body_parts WHERE name = 'Legs' LIMIT 1;
  SELECT id INTO v_calves_id FROM body_parts WHERE name = 'Calves' LIMIT 1;
  SELECT id INTO v_core_id FROM body_parts WHERE name = 'Core' LIMIT 1;
  SELECT id INTO v_glutes_id FROM body_parts WHERE name = 'Glutes' LIMIT 1;
  
  -- Get Muscle Group IDs
  SELECT id INTO v_pec_major_id FROM muscle_groups WHERE name = 'Pectoralis Major' LIMIT 1;
  SELECT id INTO v_lats_id FROM muscle_groups WHERE name = 'Latissimus Dorsi' LIMIT 1;
  SELECT id INTO v_traps_upper_id FROM muscle_groups WHERE name = 'Trapezius Upper' LIMIT 1;
  SELECT id INTO v_traps_middle_id FROM muscle_groups WHERE name = 'Trapezius Middle' LIMIT 1;
  SELECT id INTO v_traps_lower_id FROM muscle_groups WHERE name = 'Trapezius Lower' LIMIT 1;
  SELECT id INTO v_anterior_delt_id FROM muscle_groups WHERE name = 'Anterior Deltoid' LIMIT 1;
  SELECT id INTO v_lateral_delt_id FROM muscle_groups WHERE name = 'Lateral Deltoid' LIMIT 1;
  SELECT id INTO v_posterior_delt_id FROM muscle_groups WHERE name = 'Posterior Deltoid' LIMIT 1;
  SELECT id INTO v_biceps_brachii_id FROM muscle_groups WHERE name = 'Biceps Brachii' LIMIT 1;
  SELECT id INTO v_triceps_brachii_id FROM muscle_groups WHERE name = 'Triceps Brachii' LIMIT 1;
  SELECT id INTO v_quads_id FROM muscle_groups WHERE name = 'Quadriceps' LIMIT 1;
  SELECT id INTO v_hamstrings_id FROM muscle_groups WHERE name = 'Hamstrings' LIMIT 1;
  SELECT id INTO v_glute_max_id FROM muscle_groups WHERE name = 'Gluteus Maximus' LIMIT 1;
  SELECT id INTO v_abs_id FROM muscle_groups WHERE name = 'Rectus Abdominis' LIMIT 1;
  SELECT id INTO v_obliques_id FROM muscle_groups WHERE name = 'External Obliques' LIMIT 1;
  SELECT id INTO v_erector_spinae_id FROM muscle_groups WHERE name = 'Erector Spinae' LIMIT 1;

  -- Insert exercises and their muscle group associations
  WITH inserted_exercises AS (
    -- Chest Exercises
    INSERT INTO exercises (name, description, equipment_type_id, body_part_id, is_compound)
    VALUES
      ('Incline Bench Press', 'Perform bench press on an inclined bench to target upper chest', v_barbell_id, v_chest_id, true),
      ('Decline Bench Press', 'Perform bench press on a declined bench to target lower chest', v_barbell_id, v_chest_id, true),
      ('Dumbbell Flyes', 'Lie on bench, arms extended with dumbbells, lower with slight bend in elbows', v_dumbbell_id, v_chest_id, false),
      ('Cable Flyes', 'Stand between cable machines, perform fly motion with cables', v_cable_id, v_chest_id, false),
      ('Push-Ups', 'Standard push-up from plank position', v_bodyweight_id, v_chest_id, true),
      ('Dips', 'Lower body between parallel bars and push back up', v_bodyweight_id, v_chest_id, true),
      
      -- Back Exercises
      ('Bent Over Rows', 'Bend at hips, pull barbell to lower chest', v_barbell_id, v_back_id, true),
      ('Lat Pulldowns', 'Pull overhead bar down to upper chest', v_cable_id, v_back_id, true),
      ('Seated Cable Rows', 'Pull cable attachment to stomach while seated', v_cable_id, v_back_id, true),
      ('T-Bar Rows', 'Bend over and row weight up using T-bar setup', v_plate_machine_id, v_back_id, true),
      ('Face Pulls', 'Pull rope attachment to face, targeting rear delts', v_cable_id, v_upper_back_id, false),
      ('Meadows Rows', 'Single-arm row with barbell in landmine attachment', v_barbell_id, v_back_id, true),
      
      -- Shoulder Exercises
      ('Lateral Raises', 'Raise dumbbells to sides to shoulder level', v_dumbbell_id, v_shoulders_id, false),
      ('Front Raises', 'Raise dumbbells in front to shoulder level', v_dumbbell_id, v_shoulders_id, false),
      ('Reverse Flyes', 'Bent over, raise dumbbells to sides', v_dumbbell_id, v_shoulders_id, false),
      ('Arnold Press', 'Press dumbbells overhead with rotation', v_dumbbell_id, v_shoulders_id, true),
      ('Push Press', 'Overhead press with leg drive', v_barbell_id, v_shoulders_id, true),
      
      -- Leg Exercises
      ('Romanian Deadlift', 'Hinge at hips with straight legs', v_barbell_id, v_legs_id, true),
      ('Bulgarian Split Squats', 'Single leg squat with rear foot elevated', v_dumbbell_id, v_legs_id, true),
      ('Hack Squats', 'Squat movement on hack squat machine', v_machine_id, v_legs_id, true),
      ('Lunges', 'Step forward into lunge position', v_dumbbell_id, v_legs_id, true),
      ('Leg Extensions', 'Extend legs from seated position', v_machine_id, v_legs_id, false),
      ('Leg Curls', 'Curl legs from prone or seated position', v_machine_id, v_legs_id, false),
      ('Calf Raises', 'Raise heels while standing', v_machine_id, v_calves_id, false),
      
      -- Arm Exercises
      ('Hammer Curls', 'Curl dumbbells with neutral grip', v_dumbbell_id, v_biceps_id, false),
      ('Preacher Curls', 'Curl on preacher bench', v_barbell_id, v_biceps_id, false),
      ('Skull Crushers', 'Lower weight to forehead lying on bench', v_barbell_id, v_triceps_id, false),
      ('Overhead Tricep Extension', 'Extend weight overhead', v_dumbbell_id, v_triceps_id, false),
      ('Cable Curls', 'Curl using cable machine', v_cable_id, v_biceps_id, false),
      ('Rope Pushdowns', 'Pushdown using rope attachment', v_cable_id, v_triceps_id, false),
      
      -- Core Exercises
      ('Planks', 'Hold plank position', v_bodyweight_id, v_core_id, false),
      ('Russian Twists', 'Seated twist with weight', v_plate_machine_id, v_core_id, false),
      ('Cable Woodchoppers', 'Rotate torso pulling cable diagonally', v_cable_id, v_core_id, false),
      ('Hanging Leg Raises', 'Raise legs while hanging from bar', v_bodyweight_id, v_core_id, false),
      ('Ab Wheel Rollouts', 'Roll out and back using ab wheel', v_bodyweight_id, v_core_id, true)
    RETURNING id, body_part_id
  )
  -- Insert exercise muscle group associations
  INSERT INTO exercise_muscle_groups (exercise_id, muscle_group_id, is_primary)
  SELECT 
    e.id,
    m.id,
    CASE
      WHEN e.body_part_id = v_chest_id AND m.id = v_pec_major_id THEN true
      WHEN e.body_part_id = v_back_id AND m.id = v_lats_id THEN true
      WHEN e.body_part_id = v_shoulders_id AND m.id = v_anterior_delt_id THEN true
      WHEN e.body_part_id = v_biceps_id AND m.id = v_biceps_brachii_id THEN true
      WHEN e.body_part_id = v_triceps_id AND m.id = v_triceps_brachii_id THEN true
      WHEN e.body_part_id = v_legs_id AND m.id = v_quads_id THEN true
      WHEN e.body_part_id = v_core_id AND m.id = v_abs_id THEN true
      ELSE false
    END as is_primary
  FROM inserted_exercises e
  CROSS JOIN (
    SELECT id
    FROM muscle_groups
    WHERE id IN (
      v_pec_major_id, v_lats_id, v_anterior_delt_id, v_lateral_delt_id,
      v_posterior_delt_id, v_biceps_brachii_id, v_triceps_brachii_id,
      v_quads_id, v_hamstrings_id, v_glute_max_id, v_abs_id, v_obliques_id
    )
  ) m;

END $$;