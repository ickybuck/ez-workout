-- Update default weight increment
ALTER TABLE exercise_defaults 
ALTER COLUMN weight_increment SET DEFAULT 2.3;

-- Update existing rows that have the old default value
UPDATE exercise_defaults 
SET weight_increment = 2.3 
WHERE weight_increment = 2.5;