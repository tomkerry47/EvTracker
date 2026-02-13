# How to Verify Your DATABASE_URL is Correct

This guide helps you validate that your DATABASE_URL environment variable is correctly formatted for EvTracker to connect to your Neon Postgres database.

## Quick Validation Checklist

Your DATABASE_URL should match ALL these criteria:

- [ ] **Starts with:** `postgresql://`
- [ ] **Contains username:** `neondb_owner`
- [ ] **Contains password** (starts with `npg_`)
- [ ] **Contains hostname:** `ep-dry-moon-abu5f8m3-pooler.eu-west-2.aws.neon.tech`
- [ ] **Contains database name:** `/neondb`
- [ ] **Contains:** `?sslmode=verify-full`
- [ ] **Contains:** `&channel_binding=require` (with plain `&`)
- [ ] **Does NOT contain:** `psql`
- [ ] **Does NOT contain:** Any quotes (`'` or `"`)
- [ ] **Does NOT contain:** `&amp;` (HTML encoding)
- [ ] **No spaces** before or after the URL

---

## Step-by-Step Verification

### Step 1: Access Your Environment Variable

**In Vercel:**
1. Go to https://vercel.com/dashboard
2. Click your EvTracker project
3. Settings → Environment Variables
4. Find `DATABASE_URL`
5. Click the eye icon 👁️ to reveal the value

**Locally (in .env file):**
1. Open your `.env` file
2. Find the line starting with `DATABASE_URL=`

### Step 2: Check the Format

Your DATABASE_URL should look EXACTLY like this structure:

```
postgresql://USERNAME:PASSWORD@HOSTNAME/DATABASE?sslmode=verify-full&channel_binding=require
```

**For your specific Neon database:**
```
postgresql://neondb_owner:npg_3gZqomRLMVh0@ep-dry-moon-abu5f8m3-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=verify-full&channel_binding=require
```

### Step 3: Part-by-Part Validation

Let's break down each part:

#### 1. Protocol
✅ **Should be:** `postgresql://`
❌ **NOT:** `psql`, `postgres://`, or anything else

#### 2. Username
✅ **Should be:** `neondb_owner`
- This is your Neon database user

#### 3. Password
✅ **Should start with:** `npg_`
✅ **Your specific password:** `npg_3gZqomRLMVh0`
- No spaces, no quotes around it

#### 4. Separator
✅ **Should be:** `@` (between password and hostname)

#### 5. Hostname
✅ **Should be:** `ep-dry-moon-abu5f8m3-pooler.eu-west-2.aws.neon.tech`
- This is your specific Neon connection pooler endpoint
- Must include the full domain ending in `.neon.tech`
- Should include `-pooler` for best performance

#### 6. Database Name
✅ **Should be:** `/neondb`
- Starts with `/`
- Followed by database name

#### 7. SSL Mode
✅ **Should be:** `?sslmode=verify-full`
- Starts with `?` (first query parameter)
- Use `verify-full` for strongest security
- ❌ **NOT:** `require` (causes SSL warnings)

#### 8. Channel Binding
✅ **Should be:** `&channel_binding=require`
- Starts with `&` (subsequent query parameter)
- ❌ **NOT:** `&amp;` (that's HTML encoding)
- Plain ampersand `&`

---

## Common Mistakes

### Mistake 1: Has `psql` prefix

❌ **WRONG:**
```
psql 'postgresql://neondb_owner:npg_3gZqomRLMVh0@ep-dry-moon-abu5f8m3-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=verify-full&channel_binding=require'
```

✅ **CORRECT:**
```
postgresql://neondb_owner:npg_3gZqomRLMVh0@ep-dry-moon-abu5f8m3-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=verify-full&channel_binding=require
```

**Why this happens:** Neon shows a complete command `psql '...'` in their dashboard. You need ONLY the URL part (without `psql` and without quotes).

---

### Mistake 2: Has quotes

❌ **WRONG:**
```
'postgresql://...'
```

✅ **CORRECT:**
```
postgresql://...
```

**Why:** Environment variables don't need quotes. The quotes are part of the shell command syntax, not the URL itself.

---

### Mistake 3: Has `&amp;` instead of `&`

❌ **WRONG:**
```
...?sslmode=verify-full&amp;channel_binding=require
```

✅ **CORRECT:**
```
...?sslmode=verify-full&channel_binding=require
```

**Why this happens:** When you copy from HTML pages or certain browser interfaces, `&` gets HTML-encoded as `&amp;`. You need the plain ampersand.

---

### Mistake 4: Using `sslmode=require` instead of `sslmode=verify-full`

❌ **OLD (causes warning):**
```
...?sslmode=require&channel_binding=require
```

✅ **NEW (no warning):**
```
...?sslmode=verify-full&channel_binding=require
```

**Why:** `verify-full` is more secure and recommended. It prevents the SSL mode warning in logs.

---

### Mistake 5: Truncated or incomplete URL

❌ **WRONG:**
```
postgresql://neondb_owner:npg_3gZqomRLMVh0@ep-dry-moon-abu
```

✅ **CORRECT:**
```
postgresql://neondb_owner:npg_3gZqomRLMVh0@ep-dry-moon-abu5f8m3-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=verify-full&channel_binding=require
```

**Why:** Make sure you copy the ENTIRE connection string, not just part of it.

---

## How to Get the Correct DATABASE_URL

### From Neon Dashboard

1. Log in to https://console.neon.tech
2. Select your project
3. Go to "Connection Details"
4. **Important:** Select "Pooled connection" (not Direct)
5. Copy the connection string
6. **Remove** `psql '` from the beginning
7. **Remove** `'` from the end
8. **Change** `sslmode=require` to `sslmode=verify-full`
9. **Verify** it has `&` not `&amp;`

### For This Project Specifically

Use this exact value:
```
postgresql://neondb_owner:npg_3gZqomRLMVh0@ep-dry-moon-abu5f8m3-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=verify-full&channel_binding=require
```

---

## Testing Your DATABASE_URL

### Method 1: In Vercel Logs

After updating DATABASE_URL in Vercel:
1. Wait for auto-redeploy (2-3 minutes)
2. Go to Deployments → Latest deployment → View Function Logs
3. Look for: `Connected to Neon Postgres database` ✅
4. Should NOT see: `Error connecting to database` or `ENOTFOUND` ❌

### Method 2: Locally

1. Create `.env` file with:
   ```
   DATABASE_URL=postgresql://neondb_owner:npg_3gZqomRLMVh0@ep-dry-moon-abu5f8m3-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=verify-full&channel_binding=require
   ```
2. Run: `npm start`
3. Should see: `Connected to Neon Postgres database`

### Method 3: Using psql Command (if you have it installed)

```bash
psql "postgresql://neondb_owner:npg_3gZqomRLMVh0@ep-dry-moon-abu5f8m3-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=verify-full&channel_binding=require"
```

If it connects successfully, your DATABASE_URL format is correct.

---

## What Success Looks Like

**In Vercel Logs:**
```
Octopus Energy API client initialized (or "credentials not found" - that's ok)
Legacy server listening...
Connected to Neon Postgres database  ← This line is key!
```

**In Your App:**
- Dashboard loads without errors
- Can view sessions
- Can add new sessions
- Can delete sessions
- Statistics show correctly

**NOT Seeing:**
- ❌ `Error: getaddrinfo ENOTFOUND base`
- ❌ `Error connecting to database`
- ❌ 500 errors on API endpoints
- ❌ `hostname: 'base'`

---

## Still Having Issues?

If you've verified everything above and still see errors:

1. **Double-check in Vercel:**
   - Go to Settings → Environment Variables
   - Click eye icon on DATABASE_URL
   - Compare character-by-character with the correct value
   - Check for any hidden spaces

2. **Try deleting and re-adding:**
   - Delete the DATABASE_URL variable completely
   - Add it as a new variable
   - Paste the correct value
   - Select all environments
   - Save

3. **Check Neon database status:**
   - Log in to Neon console
   - Make sure database is active (not suspended)
   - Try running a query in SQL Editor to wake it up

4. **See troubleshooting guide:**
   - [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)

---

## Quick Copy-Paste: Your Correct DATABASE_URL

For Vercel environment variable:

**Name:**
```
DATABASE_URL
```

**Value:**
```
postgresql://neondb_owner:npg_3gZqomRLMVh0@ep-dry-moon-abu5f8m3-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=verify-full&channel_binding=require
```

**Environments:** Select all (Production, Preview, Development)

---

**Remember:** The DATABASE_URL must be exact. Even one wrong character will cause connection failures!
