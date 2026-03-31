/*
  # Update default weight increment

  1. Changes
    - Change default weight_increment from 2.5 to 2.3 in exercise_defaults table
*/

-- Update default weight increment
ALTER TABLE exercise_defaults 
ALTER COLUMN weight_increment SET DEFAULT 2.3;

-- Update existing rows that have the old default value
UPDATE exercise_defaults 
SET weight_increment = 2.3 
WHERE weight_increment = 2.5;