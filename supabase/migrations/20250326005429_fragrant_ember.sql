/*
  # Simplify muscle groups categorization

  1. Changes
    - Add category column first
    - Delete existing muscle groups
    - Insert new simplified muscle group categories with proper categorization
    - Add description column
    - Update descriptions for all muscle groups

  2. New Categories
    - Upper Body Push
    - Upper Body Pull
    - Lower Body
    - Core
    - Auxiliary
*/

-- First add the category column
ALTER TABLE muscle_groups 
ADD COLUMN IF NOT EXISTS category text;

-- Add the description column
ALTER TABLE muscle_groups 
ADD COLUMN IF NOT EXISTS description text;

-- Delete existing muscle groups (this will cascade to exercise_muscle_groups)
TRUNCATE muscle_groups CASCADE;

-- Insert new muscle group categories with their categories
INSERT INTO muscle_groups (id, name, category) VALUES
  -- Upper Body Push
  (gen_random_uuid(), 'Chest', 'Upper Body Push'),
  (gen_random_uuid(), 'Front Shoulders', 'Upper Body Push'),
  (gen_random_uuid(), 'Side Shoulders', 'Upper Body Push'),
  (gen_random_uuid(), 'Triceps', 'Upper Body Push'),

  -- Upper Body Pull
  (gen_random_uuid(), 'Upper Back', 'Upper Body Pull'),
  (gen_random_uuid(), 'Lats', 'Upper Body Pull'),
  (gen_random_uuid(), 'Rear Shoulders', 'Upper Body Pull'),
  (gen_random_uuid(), 'Biceps', 'Upper Body Pull'),
  (gen_random_uuid(), 'Forearms', 'Upper Body Pull'),

  -- Lower Body
  (gen_random_uuid(), 'Quadriceps', 'Lower Body'),
  (gen_random_uuid(), 'Hamstrings', 'Lower Body'),
  (gen_random_uuid(), 'Glutes', 'Lower Body'),
  (gen_random_uuid(), 'Calves', 'Lower Body'),

  -- Core
  (gen_random_uuid(), 'Abdominals', 'Core'),
  (gen_random_uuid(), 'Obliques', 'Core'),
  (gen_random_uuid(), 'Lower Back', 'Core'),

  -- Auxiliary
  (gen_random_uuid(), 'Rotator Cuff', 'Auxiliary'),
  (gen_random_uuid(), 'Serratus', 'Auxiliary'),
  (gen_random_uuid(), 'Hip Flexors', 'Auxiliary'),
  (gen_random_uuid(), 'Adductors', 'Auxiliary');

-- Now make the category column NOT NULL and add the check constraint
ALTER TABLE muscle_groups 
ALTER COLUMN category SET NOT NULL,
ADD CONSTRAINT muscle_groups_category_check 
CHECK (category IN ('Upper Body Push', 'Upper Body Pull', 'Lower Body', 'Core', 'Auxiliary'));

-- Update descriptions
UPDATE muscle_groups SET description = CASE name
  -- Upper Body Push
  WHEN 'Chest' THEN 'Includes pectoralis major and minor'
  WHEN 'Front Shoulders' THEN 'Anterior deltoid'
  WHEN 'Side Shoulders' THEN 'Lateral deltoid'
  WHEN 'Triceps' THEN 'Long head, lateral head, and medial head'
  
  -- Upper Body Pull
  WHEN 'Upper Back' THEN 'Includes trapezius (upper, middle, lower) and rhomboids'
  WHEN 'Lats' THEN 'Latissimus dorsi'
  WHEN 'Rear Shoulders' THEN 'Posterior deltoid'
  WHEN 'Biceps' THEN 'Biceps brachii (short and long head) and brachialis'
  WHEN 'Forearms' THEN 'Includes flexors and extensors'
  
  -- Lower Body
  WHEN 'Quadriceps' THEN 'Rectus femoris, vastus lateralis, vastus medialis, vastus intermedius'
  WHEN 'Hamstrings' THEN 'Biceps femoris, semitendinosus, semimembranosus'
  WHEN 'Glutes' THEN 'Gluteus maximus, medius, and minimus'
  WHEN 'Calves' THEN 'Gastrocnemius and soleus'
  
  -- Core
  WHEN 'Abdominals' THEN 'Rectus abdominis and transverse abdominis'
  WHEN 'Obliques' THEN 'Internal and external obliques'
  WHEN 'Lower Back' THEN 'Erector spinae and quadratus lumborum'
  
  -- Auxiliary
  WHEN 'Rotator Cuff' THEN 'Supraspinatus, infraspinatus, teres minor, subscapularis'
  WHEN 'Serratus' THEN 'Serratus anterior'
  WHEN 'Hip Flexors' THEN 'Iliopsoas (psoas major and iliacus) and rectus femoris'
  WHEN 'Adductors' THEN 'Adductor longus, brevis, magnus, and gracilis'
  ELSE NULL
END;