/*
  # Simplify equipment types

  1. Changes
    - Consolidate equipment types into 5 categories:
      - Barbell
      - Body Weight
      - Dumbbell
      - Machine
      - Other
    - Update emojis for each type
    - Migrate existing exercises to new types

  2. Security
    - Maintain RLS policies
    - Ensure data integrity during migration
*/

-- Create new equipment types first
WITH new_types AS (
  INSERT INTO equipment_types (id, name, emoji)
  VALUES 
    (gen_random_uuid(), 'Other', '🟡')
  RETURNING id, name
),
-- Update exercises to use the 'Other' type temporarily
exercise_updates AS (
  UPDATE exercises
  SET equipment_type_id = (SELECT id FROM new_types WHERE name = 'Other')
  WHERE equipment_type_id IN (
    SELECT id FROM equipment_types 
    WHERE name NOT IN ('Barbell', 'Body Weight', 'Dumbbell', 'Machine')
  )
  RETURNING 1
)
-- Now we can safely delete old types
DELETE FROM equipment_types
WHERE name NOT IN ('Barbell', 'Body Weight', 'Dumbbell', 'Machine');

-- Update emojis for remaining types
UPDATE equipment_types
SET emoji = CASE name
  WHEN 'Barbell' THEN '🏋️'
  WHEN 'Body Weight' THEN '🤸‍♂️'
  WHEN 'Dumbbell' THEN '💪'
  WHEN 'Machine' THEN '⚙️'
  ELSE '🟡'
END;

-- Make emoji column required if it isn't already
ALTER TABLE equipment_types
ALTER COLUMN emoji SET NOT NULL;