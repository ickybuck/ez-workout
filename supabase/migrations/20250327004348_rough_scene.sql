/*
  # Update equipment types to include emojis

  1. Changes
    - Add emoji column to equipment_types table
    - Update existing equipment types with emojis
    - Make emoji column required
*/

-- Add emoji column
ALTER TABLE equipment_types
ADD COLUMN emoji text;

-- Update existing equipment types with emojis
UPDATE equipment_types
SET emoji = CASE name
  WHEN 'Machine' THEN '⚙️'
  WHEN 'Barbell' THEN '🏋️'
  WHEN 'Dumbbell' THEN '💪'
  WHEN 'Body Weight' THEN '🤸‍♂️'
  WHEN 'Cable' THEN '⚙️'
  WHEN 'Smith Machine' THEN '⚙️'
  WHEN 'Plate Loaded Machine' THEN '⚙️'
  WHEN 'Resistance Band' THEN '💪'
  WHEN 'Medicine Ball' THEN '💪'
  WHEN 'Foam Roller' THEN '🤸‍♂️'
  WHEN 'Suspension Trainer' THEN '💪'
  WHEN 'EZ Bar' THEN '🏋️'
  WHEN 'Yoga Mat' THEN '🤸‍♂️'
  WHEN 'Stability Ball' THEN '🤸‍♂️'
  WHEN 'Sled' THEN '⚙️'
  WHEN 'Kettlebell' THEN '💪'
  ELSE '⚙️'
END;

-- Make emoji column required
ALTER TABLE equipment_types
ALTER COLUMN emoji SET NOT NULL;