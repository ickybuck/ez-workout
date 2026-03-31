/*
  # Add weight unit preference to user settings

  1. Changes
    - Add weight_unit column to user_settings table
    - Set default to 'kg'
    - Add check constraint for valid units
*/

ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS weight_unit text NOT NULL DEFAULT 'kg'
CHECK (weight_unit IN ('kg', 'lb'));