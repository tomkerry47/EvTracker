-- Migration: Add Octopus API integration columns
-- Run this in your Neon SQL Editor if you already have the charging_sessions table

-- Add source column to track manual vs imported sessions
ALTER TABLE charging_sessions 
ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'manual';

-- Add octopus_session_id for deduplication
ALTER TABLE charging_sessions 
ADD COLUMN IF NOT EXISTS octopus_session_id VARCHAR(255);

-- Create index on source for filtering
CREATE INDEX IF NOT EXISTS idx_charging_sessions_source ON charging_sessions(source);

-- Create unique index on octopus_session_id to prevent duplicate imports
CREATE UNIQUE INDEX IF NOT EXISTS idx_charging_sessions_octopus_id 
ON charging_sessions(octopus_session_id) 
WHERE octopus_session_id IS NOT NULL;

-- Update existing sessions to have source = 'manual'
UPDATE charging_sessions SET source = 'manual' WHERE source IS NULL;
