# Vercel Environment Variables Setup

## 🚨 Quick Answer: YES, You Need Environment Variables!

If you're seeing deployment errors like:
- `Error: getaddrinfo ENOTFOUND base`
- `Octopus Energy API credentials not found`

**You need to add environment variables in Vercel!** See [VERCEL_ENV_CHECKLIST.md](./VERCEL_ENV_CHECKLIST.md) for a quick copy-paste guide.

## ⚠️ Important: Fixed Deployment Error

**Previously**, the `vercel.json` file contained a reference to a non-existent secret that caused deployment failures:
```
Environment Variable "DATABASE_URL" references Secret "database-url", which does not exist.
```

**This has been fixed!** The secret reference has been removed from `vercel.json`. You now need to add the environment variables directly in Vercel's dashboard or CLI.

## Required Environment Variables

When creating or deploying your EvTracker project on Vercel, you need to add **FOUR** environment variables for full functionality:

### 1. DATABASE_URL (REQUIRED)

Your Neon Postgres connection string. **Without this, the app cannot store or retrieve any data.**

- **Name**: `DATABASE_URL`
- **Value**: Your full Neon Postgres connection string
- **Format**: `postgresql://username:password@host.neon.tech/dbname?sslmode=require&channel_binding=require`
- **Example**: `postgresql://neondb_owner:npg_xxx@ep-xxx.neon.tech/neondb?sslmode=require`

**⚠️ IMPORTANT: DATABASE_URL Format**

❌ **WRONG - Don't copy the psql command:**
```
psql 'postgresql://...'
```

✅ **CORRECT - Only the URL without psql or quotes:**
```
postgresql://...
```

**Common mistakes to avoid:**
- ❌ Including `psql` at the start
- ❌ Wrapping in quotes `'...'`
- ❌ Using `&amp;` instead of `&`

**See [DATABASE_URL_FIX.md](./DATABASE_URL_FIX.md) for detailed format help!**

**Where to get it:**
- Go to [Neon dashboard](https://console.neon.tech/)
- Select your project
- Click "Connection Details" or "Connection String"
- **Copy ONLY the URL part** (starts with `postgresql://`)
- Do NOT copy `psql '...'` if shown

### 2. OCTOPUS_API_KEY (REQUIRED for import feature)

Your Octopus Energy API key for automatic session import.

- **Name**: `OCTOPUS_API_KEY`
- **Value**: Your API key starting with `sk_live_`
- **Example**: `sk_live_1aBxvJiRqYrYnZoIVaF59BUS6f7pycFa`

**Where to get it:**
- Log in to [Octopus Energy](https://octopus.energy/dashboard/)
- Go to Personal Details → API Access → Developer Settings
- Copy your API key

### 3. OCTOPUS_MPAN (REQUIRED for import feature)

Your electricity Meter Point Administration Number.

- **Name**: `OCTOPUS_MPAN`
- **Value**: Your 13-digit MPAN
- **Example**: `1100010380152`

**Where to find it:**
- Your electricity bill
- Octopus Energy dashboard
- It's a 13-digit number unique to your property

### 4. OCTOPUS_SERIAL (REQUIRED for import feature)

Your electricity meter serial number.

- **Name**: `OCTOPUS_SERIAL`
- **Value**: Your meter serial number
- **Example**: `18P0140299`

**Where to find it:**
- Your electricity bill
- Octopus Energy dashboard
- On the physical meter itself

## Optional Environment Variables

### PORT
- **Name**: `PORT`
- **Value**: `3000` (or any port you prefer)
- **Note**: Usually NOT needed for Vercel (it auto-assigns ports). Only for local development.

## Step-by-Step Instructions

### Adding Variables in Vercel Dashboard

1. **Navigate to your project** on [vercel.com](https://vercel.com)
2. **Go to Settings** tab
3. **Click "Environment Variables"** in the sidebar
4. **Add EACH variable** (repeat for all 4):
   - Click "Add New"
   - **For DATABASE_URL:**
     - Key: `DATABASE_URL`
     - Value: `[paste your full Neon connection string]`
     - Environments: ✅ Production ✅ Preview ✅ Development
   - **For OCTOPUS_API_KEY:**
     - Key: `OCTOPUS_API_KEY`
     - Value: `sk_live_[your API key]`
     - Environments: ✅ Production ✅ Preview ✅ Development
   - **For OCTOPUS_MPAN:**
     - Key: `OCTOPUS_MPAN`
     - Value: `[your 13-digit MPAN]`
     - Environments: ✅ Production ✅ Preview ✅ Development
   - **For OCTOPUS_SERIAL:**
     - Key: `OCTOPUS_SERIAL`
     - Value: `[your meter serial]`
     - Environments: ✅ Production ✅ Preview ✅ Development
5. **Click "Save"** after each variable
6. **Redeploy** your project for changes to take effect

💡 **Quick Reference**: See [VERCEL_ENV_CHECKLIST.md](./VERCEL_ENV_CHECKLIST.md) for exact copy-paste values.

### Adding Variables via Vercel CLI

If deploying via command line:

```bash
# Set all environment variables
vercel env add DATABASE_URL production preview development
# When prompted, paste your Neon connection string

vercel env add OCTOPUS_API_KEY production preview development
# When prompted, paste your Octopus API key (sk_live_...)

vercel env add OCTOPUS_MPAN production preview development
# When prompted, paste your MPAN (e.g., 1100010380152)

vercel env add OCTOPUS_SERIAL production preview development
# When prompted, paste your meter serial (e.g., 18P0140299)

# Deploy
vercel --prod
```

## Verification

After adding the environment variables and deploying:

1. Check the deployment logs in Vercel
2. Look for success messages:
   - "Connected to Neon Postgres database"
   - "Octopus Energy API configured successfully"
3. Verify no error messages about missing credentials
4. Test the application:
   - Visit your deployed URL
   - Try adding a manual session (tests database)
   - Try importing from Octopus (tests API integration)

## Troubleshooting

### "Error: getaddrinfo ENOTFOUND base"
**Symptoms**: Database connection fails, app crashes  
**Cause**: DATABASE_URL is not set or is malformed  
**Fix**:
- Add `DATABASE_URL` in Vercel environment variables
- Ensure the value is the complete connection string
- Check for typos or missing parts
- Verify it includes `?sslmode=require`
- Redeploy after adding

### "Octopus Energy API credentials not found"
**Symptoms**: Import feature shows error or is disabled  
**Cause**: Octopus API credentials are not set  
**Fix**:
- Add `OCTOPUS_API_KEY` in Vercel environment variables
- Add `OCTOPUS_MPAN` in Vercel environment variables
- Add `OCTOPUS_SERIAL` in Vercel environment variables
- Ensure API key starts with `sk_live_`
- Redeploy after adding

### "Missing database connection string" error:
- Make sure you added `DATABASE_URL` in Vercel environment variables
- Check that the value doesn't have extra spaces or quotes
- Verify you selected the correct environments (Production/Preview/Development)
- Redeploy after adding the variable

### Connection errors:
- Verify your Neon connection string is correct
- Ensure the connection string includes `?sslmode=require`
- Check that your Neon project is active (not suspended)
- Test the connection string locally first

### Import not working:
- Verify all 4 environment variables are set
- Check API key is valid (log in to Octopus dashboard)
- Ensure MPAN and serial number match your account
- Check Vercel logs for specific error messages

## Security Note

⚠️ **Never commit your DATABASE_URL to Git!** 
- The `.gitignore` file ensures `.env` is not tracked
- Always add sensitive credentials through Vercel's dashboard or CLI
- Vercel encrypts environment variables

## Summary

**You need FOUR environment variables for Vercel:**

### Required for Basic Functionality:
```
DATABASE_URL = [Your Neon Postgres connection string]
```

### Required for Octopus Import Feature:
```
OCTOPUS_API_KEY = sk_live_[your API key]
OCTOPUS_MPAN = [your 13-digit MPAN]
OCTOPUS_SERIAL = [your meter serial number]
```

### Without these variables:
- ❌ App will crash with database errors
- ❌ Import feature will be disabled
- ❌ You'll see "credentials not found" errors

### With these variables:
- ✅ Database connection works
- ✅ Manual session logging works
- ✅ Automatic import from Octopus works
- ✅ Full functionality enabled

**See [VERCEL_ENV_CHECKLIST.md](./VERCEL_ENV_CHECKLIST.md) for a quick copy-paste guide with your exact values!**

That's it! 🎉
