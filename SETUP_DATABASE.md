# Database Setup Guide

## Create the `charging_sessions` Table in Neon

### Current Status

If you're seeing this error:
```
Error: relation "charging_sessions" does not exist
PostgreSQL error code: 42P01
```

**Good news!** Your database connection is working. You just need to create the table (one-time, 2-minute task).

---

## Quick Method: Neon SQL Editor (Recommended)

### Step 1: Access Neon Console

1. Go to https://console.neon.tech
2. Sign in with your account
3. Select your project (the one with your database)

### Step 2: Open SQL Editor

1. In the left sidebar, click **"SQL Editor"**
2. Make sure the correct database is selected (should be `neondb`)

### Step 3: Run the Schema

Copy this complete SQL and paste it into the SQL Editor:

```sql
-- Create the charging_sessions table
CREATE TABLE IF NOT EXISTS charging_sessions (
  id VARCHAR(255) PRIMARY KEY,
  date TIMESTAMP NOT NULL,
  energy_added DECIMAL(10, 2) NOT NULL,
  start_soc INTEGER,
  end_soc INTEGER,
  tariff_rate DECIMAL(10, 4),
  cost DECIMAL(10, 2),
  duration INTEGER,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  source VARCHAR(50) DEFAULT 'manual',
  octopus_session_id VARCHAR(255)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_charging_sessions_date 
  ON charging_sessions(date);

CREATE INDEX IF NOT EXISTS idx_charging_sessions_created_at 
  ON charging_sessions(created_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_charging_sessions_octopus_id 
  ON charging_sessions(octopus_session_id) 
  WHERE octopus_session_id IS NOT NULL;
```

### Step 4: Execute

1. Click the **"Run"** button (or press `Cmd+Enter` / `Ctrl+Enter`)
2. You should see a success message: `CREATE TABLE` or `Command completed successfully`

### Step 5: Verify

Run this query to verify the table was created:

```sql
SELECT * FROM charging_sessions LIMIT 1;
```

You should get an empty result (no rows) but no error. This confirms the table exists!

---

## Alternative Method: psql Command Line

If you prefer using the command line:

### Step 1: Install psql

```bash
# macOS
brew install postgresql

# Ubuntu/Debian
sudo apt-get install postgresql-client

# Windows
# Download from https://www.postgresql.org/download/windows/
```

### Step 2: Connect to Neon

```bash
psql 'postgresql://neondb_owner:npg_3gZqomRLMVh0@ep-dry-moon-abu5f8m3-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=verify-full'
```

### Step 3: Run Schema

Once connected, paste the SQL from above or run:

```bash
\i neon-schema.sql
```

(if you have the `neon-schema.sql` file locally)

---

## What This Creates

### Table Structure

The `charging_sessions` table stores all your EV charging data:

| Column | Type | Description |
|--------|------|-------------|
| `id` | VARCHAR(255) | Unique session identifier |
| `date` | TIMESTAMP | When the charging session occurred |
| `energy_added` | DECIMAL(10,2) | Energy added in kWh |
| `start_soc` | INTEGER | Battery % at start (optional) |
| `end_soc` | INTEGER | Battery % at end (optional) |
| `tariff_rate` | DECIMAL(10,4) | Price per kWh in £ |
| `cost` | DECIMAL(10,2) | Total cost in £ |
| `duration` | INTEGER | Duration in minutes (optional) |
| `notes` | TEXT | Any notes about the session |
| `created_at` | TIMESTAMP | When record was created |
| `source` | VARCHAR(50) | 'manual' or 'octopus' |
| `octopus_session_id` | VARCHAR(255) | Unique ID for Octopus imports |

### Indexes

Three indexes are created for performance:
1. **Date index**: Fast queries by charging date
2. **Created_at index**: Fast queries by record creation
3. **Octopus_session_id unique index**: Prevents duplicate imports

---

## Verification

### Method 1: Check in Neon Console

1. Go to Neon Console → Tables
2. You should see `charging_sessions` listed

### Method 2: Query the Table

```sql
SELECT COUNT(*) FROM charging_sessions;
```

Should return `0` (zero rows, but no error).

### Method 3: Check Vercel Logs

After creating the table, check your Vercel deployment logs. You should see:

```
Connected to Neon Postgres database
GET /api/sessions 200
GET /api/stats 200
```

No more "relation charging_sessions does not exist" errors!

---

## Common Issues

### Issue: "permission denied for table charging_sessions"

**Solution:** Make sure you're connected as the database owner. The connection string should use the `neondb_owner` user.

### Issue: "table charging_sessions already exists"

**Good!** The table is already there. The error you're seeing must be something else. Check:
1. Is DATABASE_URL correct in Vercel?
2. Are you connecting to the right database?

### Issue: SQL Editor times out

**Solution:** 
1. Check your internet connection
2. Try the psql command-line method instead
3. Contact Neon support if persistent

---

## For Existing Databases

If you already have a `charging_sessions` table but need to add the Octopus columns, run:

```sql
-- Add source column if it doesn't exist
ALTER TABLE charging_sessions 
ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'manual';

-- Add octopus_session_id column if it doesn't exist
ALTER TABLE charging_sessions 
ADD COLUMN IF NOT EXISTS octopus_session_id VARCHAR(255);

-- Create unique index if it doesn't exist
CREATE UNIQUE INDEX IF NOT EXISTS idx_charging_sessions_octopus_id 
  ON charging_sessions(octopus_session_id) 
  WHERE octopus_session_id IS NOT NULL;
```

See `migrations/add-octopus-columns.sql` for the full migration.

---

## Next Steps

After creating the table:

1. ✅ Refresh your Vercel deployment (or wait for auto-deploy)
2. ✅ Visit your app URL
3. ✅ You should see the dashboard with an empty session list
4. ✅ Try adding a manual session or importing from Octopus
5. ✅ Start tracking your EV charges! 🚗⚡

---

## Need Help?

- Check [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for common errors
- Review [QUICKSTART.md](./QUICKSTART.md) for the complete setup flow
- See [VERCEL_ENV_CHECKLIST.md](./VERCEL_ENV_CHECKLIST.md) for environment variables

The table creation is a one-time task. Once done, your EvTracker app is fully functional!
