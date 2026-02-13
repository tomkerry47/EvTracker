# Fix: Octopus Import Error - Missing start_time Column

## The Error You're Seeing

```
Error importing sessions from Octopus: error: column "start_time" of relation "charging_sessions" does not exist
PostgreSQL error code: 42703
```

## What This Means

Your database table is missing the `start_time` and `end_time` columns that are needed for the Octopus Energy import feature. This happens if you created your table with an older version of the schema.

## How to Fix (2 Minutes)

### Option 1: Run Migration SQL in Neon (Recommended)

1. **Go to Neon SQL Editor**
   - Visit: https://console.neon.tech
   - Select your project
   - Click "SQL Editor"

2. **Copy and paste this SQL:**

```sql
-- Add the missing time columns
ALTER TABLE charging_sessions 
ADD COLUMN IF NOT EXISTS start_time TIME;

ALTER TABLE charging_sessions 
ADD COLUMN IF NOT EXISTS end_time TIME;
```

3. **Click "Run"**
   - Should see "ALTER TABLE" success message
   - Takes just a few seconds

4. **Done!** ✅
   - Octopus import will now work
   - No data is lost

### Option 2: Recreate Table (If You Have No Data Yet)

If your table is empty and you want to start fresh:

1. **Delete the old table:**
```sql
DROP TABLE charging_sessions;
```

2. **Run the complete schema from `neon-schema.sql`:**

```sql
-- Create the charging_sessions table with all columns
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

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_charging_sessions_date ON charging_sessions(date DESC);
CREATE INDEX IF NOT EXISTS idx_charging_sessions_created_at ON charging_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_charging_sessions_source ON charging_sessions(source);
CREATE UNIQUE INDEX IF NOT EXISTS idx_charging_sessions_octopus_id 
  ON charging_sessions(octopus_session_id) 
  WHERE octopus_session_id IS NOT NULL;
```

## Verification

After running the migration, verify it worked:

```sql
-- Check the table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'charging_sessions' 
ORDER BY ordinal_position;
```

You should see columns including:
- `start_time` (time without time zone)
- `end_time` (time without time zone)

## Test the Import

1. Go to your EvTracker app
2. Find the "Import from Octopus Energy" section
3. Select a date range
4. Click "Import Sessions"
5. Should see success message with number of sessions imported

## Why This Happened

The database schema was updated to include `start_time` and `end_time` columns for better session tracking. If you created your table before this update, these columns are missing.

## Files Reference

- Migration SQL: `migrations/add-time-columns.sql`
- Full schema: `neon-schema.sql`

## Still Having Issues?

Check the Vercel logs for more details:
1. Go to Vercel Dashboard
2. Click your project
3. Go to "Logs" tab
4. Look for detailed error messages

Common issues:
- ❌ Columns still missing → Run the ALTER TABLE commands again
- ❌ Permission denied → Check you're logged into correct Neon account
- ❌ Other import errors → Check OCTOPUS_API_KEY, OCTOPUS_MPAN, OCTOPUS_SERIAL are set in Vercel

---

**Quick Fix:** Just run those two ALTER TABLE commands in Neon SQL Editor and you're done! 🎯
