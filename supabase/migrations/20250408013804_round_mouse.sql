/*
  # Add graph visibility setting

  1. Changes
    - Add show_volume_graph column to user_settings table
    - Set default value to true
    - Update existing rows
*/

-- Add show_volume_graph column
ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS show_volume_graph boolean DEFAULT true;

-- Update existing rows
UPDATE user_settings
SET show_volume_graph = true
WHERE show_volume_graph IS NULL;