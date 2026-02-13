-- EvTracker Neon Postgres Database Schema
-- This SQL creates the charging_sessions table in your Neon Postgres database

-- Create the charging_sessions table
CREATE TABLE IF NOT EXISTS charging_sessions (
  id TEXT PRIMARY KEY,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  energy_added DECIMAL(10, 2) NOT NULL,
  start_soc INTEGER,
  end_soc INTEGER,
  tariff_rate DECIMAL(10, 2) NOT NULL,
  cost DECIMAL(10, 2) NOT NULL,
  notes TEXT,
  source VARCHAR(50) DEFAULT 'manual',
  octopus_session_id VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create an index on date for faster queries
CREATE INDEX IF NOT EXISTS idx_charging_sessions_date ON charging_sessions(date DESC);

-- Create an index on created_at for faster queries
CREATE INDEX IF NOT EXISTS idx_charging_sessions_created_at ON charging_sessions(created_at DESC);

-- Create index on source for filtering
CREATE INDEX IF NOT EXISTS idx_charging_sessions_source ON charging_sessions(source);

-- Create unique index on octopus_session_id to prevent duplicate imports
CREATE UNIQUE INDEX IF NOT EXISTS idx_charging_sessions_octopus_id ON charging_sessions(octopus_session_id) WHERE octopus_session_id IS NOT NULL;
