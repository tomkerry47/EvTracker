-- EvTracker Supabase Database Schema
-- This SQL creates the charging_sessions table in your Supabase database

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

-- Enable Row Level Security (RLS)
ALTER TABLE charging_sessions ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows all operations for now
-- You can customize this based on your authentication needs
CREATE POLICY "Enable all operations for all users" ON charging_sessions
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Note: For production, you should implement proper authentication
-- and create policies like:
-- CREATE POLICY "Users can only access their own sessions" ON charging_sessions
--   FOR ALL
--   USING (auth.uid() = user_id);
