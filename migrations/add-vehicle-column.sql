-- Migration: Add vehicle attribution to charging sessions

ALTER TABLE charging_sessions
ADD COLUMN IF NOT EXISTS vehicle VARCHAR(64);

CREATE INDEX IF NOT EXISTS idx_charging_sessions_vehicle
ON charging_sessions(vehicle);
