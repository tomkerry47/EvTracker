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
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create an index on date for faster queries
CREATE INDEX IF NOT EXISTS idx_charging_sessions_date ON charging_sessions(date DESC);

-- Create an index on created_at for faster queries
CREATE INDEX IF NOT EXISTS idx_charging_sessions_created_at ON charging_sessions(created_at DESC);

