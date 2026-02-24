-- Migration: Add dispatch block metadata for GraphQL completed-dispatch imports
-- Run this in Neon SQL editor before using the new import flow.

ALTER TABLE charging_sessions
ADD COLUMN IF NOT EXISTS dispatch_count INTEGER;

ALTER TABLE charging_sessions
ADD COLUMN IF NOT EXISTS dispatch_blocks JSONB;

CREATE INDEX IF NOT EXISTS idx_charging_sessions_dispatch_count
ON charging_sessions(dispatch_count);
Í