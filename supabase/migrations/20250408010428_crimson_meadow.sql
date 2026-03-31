DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'exercises' AND column_name = 'is_plate_loaded'
  ) THEN
    ALTER TABLE exercises 
    ADD COLUMN is_plate_loaded boolean DEFAULT false;
  END IF;
END $$;