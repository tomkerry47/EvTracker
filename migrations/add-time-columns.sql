-- Migration: Add start_time and end_time columns
-- This migration adds the time columns needed for Octopus Energy import
-- Run this if you created your table before these columns were added

-- Add start_time column (allow NULL for existing rows)
ALTER TABLE charging_sessions 
ADD COLUMN IF NOT EXISTS start_time TIME;

-- Add end_time column (allow NULL for existing rows)
ALTER TABLE charging_sessions 
ADD COLUMN IF NOT EXISTS end_time TIME;

-- Optional: For existing rows without times, you can set default times
-- This is just a placeholder - adjust as needed for your data
-- UPDATE charging_sessions 
-- SET start_time = '00:00:00', end_time = '01:00:00' 
-- WHERE start_time IS NULL;

-- After running this migration, the Octopus import feature will work correctly
