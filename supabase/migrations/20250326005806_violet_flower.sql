/*
  # Update muscle groups schema and data

  1. Changes
    - Add category and description columns to muscle_groups table
    - Populate muscle groups with new categorized data structure
    - Ensure category constraint exists
    - Add detailed descriptions for each muscle group

  2. Data Structure
    - Organized into 5 main categories:
      - Upper Body Push
      - Upper Body Pull
      - Lower Body
      - Core
      - Auxiliary
*/

-- First add the category and description columns if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'muscle_groups' AND column_name = 'category') 
  THEN
    ALTER TABLE muscle_groups ADD COLUMN category text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'muscle_groups' AND column_name = 'description') 
  THEN
    ALTER TABLE muscle_groups ADD COLUMN description text;
  END IF;
END $$;

-- Delete existing muscle groups (this will cascade to exercise_muscle_groups)
TRUNCATE muscle_groups CASCADE;

-- Ensure the category check constraint exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.constraint_column_usage 
    WHERE table_name = 'muscle_groups' AND constraint_name = 'muscle_groups_category_check') 
  THEN
    ALTER TABLE muscle_groups 
    ADD CONSTRAINT muscle_groups_category_check 
    CHECK (category IN ('Upper Body Push', 'Upper Body Pull', 'Lower Body', 'Core', 'Auxiliary'));
  END IF;
END $$;

-- Insert new muscle groups with their categories and descriptions
INSERT INTO muscle_groups (id, name, category, description) VALUES
  -- Upper Body Push
  (gen_random_uuid(), 'Chest', 'Upper Body Push', 'Includes pectoralis major and minor'),
  (gen_random_uuid(), 'Front Shoulders', 'Upper Body Push', 'Anterior deltoid'),
  (gen_random_uuid(), 'Side Shoulders', 'Upper Body Push', 'Lateral deltoid'),
  (gen_random_uuid(), 'Triceps', 'Upper Body Push', 'Long head, lateral head, and medial head'),

  -- Upper Body Pull
  (gen_random_uuid(), 'Upper Back', 'Upper Body Pull', 'Includes trapezius (upper, middle, lower) and rhomboids'),
  (gen_random_uuid(), 'Lats', 'Upper Body Pull', 'Latissimus dorsi'),
  (gen_random_uuid(), 'Rear Shoulders', 'Upper Body Pull', 'Posterior deltoid'),
  (gen_random_uuid(), 'Biceps', 'Upper Body Pull', 'Biceps brachii (short and long head) and brachialis'),
  (gen_random_uuid(), 'Forearms', 'Upper Body Pull', 'Includes flexors and extensors'),

  -- Lower Body
  (gen_random_uuid(), 'Quadriceps', 'Lower Body', 'Rectus femoris, vastus lateralis, vastus medialis, vastus intermedius'),
  (gen_random_uuid(), 'Hamstrings', 'Lower Body', 'Biceps femoris, semitendinosus, semimembranosus'),
  (gen_random_uuid(), 'Glutes', 'Lower Body', 'Gluteus maximus, medius, and minimus'),
  (gen_random_uuid(), 'Calves', 'Lower Body', 'Gastrocnemius and soleus'),

  -- Core
  (gen_random_uuid(), 'Abdominals', 'Core', 'Rectus abdominis and transverse abdominis'),
  (gen_random_uuid(), 'Obliques', 'Core', 'Internal and external obliques'),
  (gen_random_uuid(), 'Lower Back', 'Core', 'Erector spinae and quadratus lumborum'),

  -- Auxiliary
  (gen_random_uuid(), 'Rotator Cuff', 'Auxiliary', 'Supraspinatus, infraspinatus, teres minor, subscapularis'),
  (gen_random_uuid(), 'Serratus', 'Auxiliary', 'Serratus anterior'),
  (gen_random_uuid(), 'Hip Flexors', 'Auxiliary', 'Iliopsoas (psoas major and iliacus) and rectus femoris'),
  (gen_random_uuid(), 'Adductors', 'Auxiliary', 'Adductor longus, brevis, magnus, and gracilis');

-- Now make the category column NOT NULL if it isn't already
DO $$ 
BEGIN
  ALTER TABLE muscle_groups ALTER COLUMN category SET NOT NULL;
EXCEPTION
  WHEN others THEN NULL;
END $$;