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

-- ⚠️  WARNING: INSECURE DEFAULT POLICY ⚠️
-- This policy allows unrestricted access for development/demo purposes.
-- **IMPORTANT**: Before going to production, you MUST:
--   1. Enable authentication in Supabase
--   2. Add a user_id column to track ownership
--   3. Replace this policy with proper user-scoped policies
--
-- Create a permissive policy for initial setup (DEVELOPMENT ONLY)
CREATE POLICY "Allow all operations for development" ON charging_sessions
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ========================================================================
-- PRODUCTION SECURITY SETUP (uncomment and modify after enabling auth)
-- ========================================================================
--
-- Step 1: Add user_id column to track ownership
-- ALTER TABLE charging_sessions ADD COLUMN user_id UUID REFERENCES auth.users(id);
--
-- Step 2: Remove the development policy
-- DROP POLICY IF EXISTS "Allow all operations for development" ON charging_sessions;
--
-- Step 3: Create secure policies for authenticated users
-- CREATE POLICY "Users can view their own sessions" ON charging_sessions
--   FOR SELECT USING (auth.uid() = user_id);
--
-- CREATE POLICY "Users can insert their own sessions" ON charging_sessions
--   FOR INSERT WITH CHECK (auth.uid() = user_id);
--
-- CREATE POLICY "Users can update their own sessions" ON charging_sessions
--   FOR UPDATE USING (auth.uid() = user_id);
--
-- CREATE POLICY "Users can delete their own sessions" ON charging_sessions
--   FOR DELETE USING (auth.uid() = user_id);
