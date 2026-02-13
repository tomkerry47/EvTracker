# EvTracker Troubleshooting Guide

This guide helps you diagnose and fix common deployment and runtime errors with EvTracker.

## Table of Contents
- [Database Connection Errors](#database-connection-errors)
- [Octopus API Errors](#octopus-api-errors)
- [Vercel Deployment Issues](#vercel-deployment-issues)
- [SSL/Security Warnings](#sslsecurity-warnings)

---

## Database Connection Errors

### Error: `ENOTFOUND base`

**Full Error:**
```
Error connecting to database: Error: getaddrinfo ENOTFOUND base
hostname: 'base'
```

**What This Means:**
The application is trying to connect to a database server called "base", which doesn't exist. This happens when the DATABASE_URL environment variable is malformed or incorrectly formatted.

**Root Cause:**
Your DATABASE_URL in Vercel is **NOT** correctly formatted. Common issues:
1. Still has `psql` command prefix
2. Still has quotes around the URL
3. Has HTML-encoded `&amp;` instead of plain `&`
4. Is truncated or incomplete
5. Was not saved correctly in Vercel

**Solution:**

1. **Go to Vercel Dashboard:**
   - Visit: https://vercel.com/dashboard
   - Click your EvTracker project
   - Go to: Settings → Environment Variables

2. **Find DATABASE_URL and check its value**
   - Click the eye icon to reveal the value
   - Does it look correct?

3. **The correct format should be:**
   ```
   postgresql://neondb_owner:npg_3gZqomRLMVh0@ep-dry-moon-abu5f8m3-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=verify-full&channel_binding=require
   ```

4. **Common mistakes to check for:**
   
   ❌ **WRONG - Has psql prefix:**
   ```
   psql 'postgresql://...'
   ```
   
   ❌ **WRONG - Has quotes:**
   ```
   'postgresql://...'
   ```
   
   ❌ **WRONG - Has &amp; instead of &:**
   ```
   ...?sslmode=verify-full&amp;channel_binding=require
   ```
   
   ✅ **CORRECT - Plain URL:**
   ```
   postgresql://neondb_owner:npg_3gZqomRLMVh0@ep-dry-moon-abu5f8m3-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=verify-full&channel_binding=require
   ```

5. **To fix:**
   - Click "Edit" on the DATABASE_URL variable
   - Delete everything in the value field
   - Copy the correct format above
   - Paste it exactly (no spaces before/after)
   - Make sure to select all environments (Production, Preview, Development)
   - Click "Save"
   - Vercel will auto-redeploy (takes 2-3 minutes)

6. **Verify the fix:**
   - Go to your Vercel deployment logs
   - Look for: `Connected to Neon Postgres database`
   - Should NOT see: `ENOTFOUND base`

**See also:** [VERIFY_DATABASE_URL.md](./VERIFY_DATABASE_URL.md) for detailed validation steps.

---

### Error: `Connection timeout` or `ETIMEDOUT`

**What This Means:**
The application can reach the database server but the connection times out.

**Possible Causes:**
1. Neon database is paused (auto-pauses after inactivity on free tier)
2. Network/firewall issues
3. Database server is overloaded

**Solution:**
1. Check if your Neon database is active in the Neon dashboard
2. Try making a query in the Neon SQL Editor to wake it up
3. Wait a minute and try again
4. Check Neon status page for any outages

---

### Error: `password authentication failed`

**What This Means:**
The database credentials in your DATABASE_URL are incorrect.

**Solution:**
1. Go to your Neon dashboard
2. Get a fresh connection string
3. Update DATABASE_URL in Vercel with the new connection string
4. Make sure you're using the connection pooler URL (ends with `-pooler.eu-west-2.aws.neon.tech`)

---

## Octopus API Errors

### Error: `Octopus Energy API credentials not found`

**What This Means:**
The Octopus Energy API integration is disabled because one or more required environment variables are missing.

**Required Variables:**
- `OCTOPUS_API_KEY`
- `OCTOPUS_MPAN`
- `OCTOPUS_SERIAL`

**Solution:**
1. Go to Vercel → Settings → Environment Variables
2. Add all three variables with your actual values
3. Redeploy
4. The import functionality will now work

**Note:** If you don't want to use Octopus import, you can ignore this message. The app will work fine with manual entry only.

---

### Error: `401 Unauthorized` when importing from Octopus

**What This Means:**
Your Octopus API key is invalid or has expired.

**Solution:**
1. Log in to your Octopus Energy account
2. Go to: Personal Details → Developer Settings
3. Generate a new API key
4. Update `OCTOPUS_API_KEY` in Vercel
5. Redeploy

---

### Error: `404 Not Found` when importing from Octopus

**What This Means:**
The MPAN or meter serial number is incorrect.

**Solution:**
1. Check your electricity bill or Octopus account
2. Verify MPAN: Should be 13 digits starting with 1 or 2
3. Verify meter serial: Usually starts with letters and numbers
4. Update `OCTOPUS_MPAN` and/or `OCTOPUS_SERIAL` in Vercel
5. Redeploy

---

## Vercel Deployment Issues

### Deployment succeeds but app shows 500 errors

**Possible Causes:**
1. Environment variables not set correctly
2. DATABASE_URL is wrong
3. Missing required npm packages

**Solution:**
1. Check Vercel deployment logs for specific errors
2. Verify all 4 environment variables are set:
   - `DATABASE_URL`
   - `OCTOPUS_API_KEY`
   - `OCTOPUS_MPAN`
   - `OCTOPUS_SERIAL`
3. Make sure DATABASE_URL starts with `postgresql://`
4. Redeploy after fixing

---

### Error: `Module not found` in Vercel logs

**What This Means:**
A required npm package is missing from package.json.

**Solution:**
1. Check package.json includes all dependencies
2. Required packages: `express`, `pg`, `dotenv`, `axios`
3. Try redeploying (Vercel re-installs dependencies)

---

### Frontend loads but API calls fail (404)

**What This Means:**
The frontend is working but API routes aren't being found.

**Solution:**
1. Check vercel.json is present and correctly configured
2. Make sure `server.js` is in the root directory
3. Redeploy

---

## SSL/Security Warnings

### Warning: `SECURITY WARNING: The SSL modes 'prefer', 'require', and 'verify-ca' are treated as aliases for 'verify-full'`

**What This Means:**
You're using `sslmode=require` in your DATABASE_URL, which will change behavior in future versions of the PostgreSQL client library.

**Impact:**
- Currently: Works fine, no security issue
- Future: May have weaker security guarantees

**Solution:**
Change your DATABASE_URL from:
```
...?sslmode=require&channel_binding=require
```

To:
```
...?sslmode=verify-full&channel_binding=require
```

**Steps:**
1. Go to Vercel → Settings → Environment Variables
2. Edit DATABASE_URL
3. Change `sslmode=require` to `sslmode=verify-full`
4. Save (auto-redeploys)
5. Warning will disappear

**Note:** `verify-full` provides the strongest security by verifying both the certificate and the hostname.

---

## Getting More Help

If you're still experiencing issues:

1. **Check the logs:**
   - Vercel: Deployments → Click deployment → View Function Logs
   - Look for specific error messages

2. **Review documentation:**
   - [VERCEL_ENV_CHECKLIST.md](./VERCEL_ENV_CHECKLIST.md) - Environment variables
   - [VERIFY_DATABASE_URL.md](./VERIFY_DATABASE_URL.md) - DATABASE_URL validation
   - [DATABASE_URL_FIX.md](./DATABASE_URL_FIX.md) - Common DATABASE_URL mistakes

3. **Test locally:**
   ```bash
   npm install
   # Create .env file with your credentials
   npm start
   ```
   
   If it works locally but not in Vercel, it's an environment variable issue.

4. **Common checklist:**
   - [ ] All 4 environment variables set in Vercel
   - [ ] DATABASE_URL has no `psql`, no quotes, no `&amp;`
   - [ ] DATABASE_URL uses `sslmode=verify-full`
   - [ ] Octopus credentials are correct (if using import)
   - [ ] Neon database is active (not paused)
   - [ ] Latest code is deployed to Vercel

---

## Quick Reference: Correct Environment Variables

```bash
# Required for database
DATABASE_URL=postgresql://neondb_owner:npg_3gZqomRLMVh0@ep-dry-moon-abu5f8m3-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=verify-full&channel_binding=require

# Required for Octopus import (optional feature)
OCTOPUS_API_KEY=sk_live_1aBxvJiRqYrYnZoIVaF59BUS6f7pycFa
OCTOPUS_MPAN=1100010380152
OCTOPUS_SERIAL=18P0140299
```

**Remember:**
- No `psql` prefix
- No quotes
- Plain `&` not `&amp;`
- Use `sslmode=verify-full` not `sslmode=require`

---

## Success Indicators

When everything is working correctly, your Vercel logs should show:

```
Octopus Energy API client initialized
Legacy server listening...
Connected to Neon Postgres database
```

And your app should:
- Load without errors
- Show the dashboard
- Be able to add/view/delete sessions
- Import from Octopus (if credentials are set)

---

## Error: column "start_time" does not exist

### Error Message
```
Error importing sessions from Octopus: 
error: column "start_time" of relation "charging_sessions" does not exist
PostgreSQL error code: 42703
```

### What This Means
- Your database table is missing the `start_time` and `end_time` columns
- These columns are required for the Octopus Energy import feature
- This happens if you created the table with an older schema version

### Solution
Run this migration in Neon SQL Editor:

```sql
ALTER TABLE charging_sessions 
ADD COLUMN IF NOT EXISTS start_time TIME;

ALTER TABLE charging_sessions 
ADD COLUMN IF NOT EXISTS end_time TIME;
```

Takes 10 seconds - just paste and run!

### Verification
After running the migration, check your table:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'charging_sessions';
```

You should see `start_time` and `end_time` listed.

### Detailed Guide
See [FIX_OCTOPUS_IMPORT_ERROR.md](./FIX_OCTOPUS_IMPORT_ERROR.md) for complete instructions.

---

**Last Updated:** 2026-02-13
