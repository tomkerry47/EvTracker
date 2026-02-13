# Vercel Environment Variables Setup

## ⚠️ Important: Fixed Deployment Error

**Previously**, the `vercel.json` file contained a reference to a non-existent secret that caused deployment failures:
```
Environment Variable "DATABASE_URL" references Secret "database-url", which does not exist.
```

**This has been fixed!** The secret reference has been removed from `vercel.json`. You now need to add the environment variable directly in Vercel's dashboard or CLI.

## Required Environment Variable

When creating or deploying your EvTracker project on Vercel, you need to add **ONE** environment variable:

### DATABASE_URL

This is your Neon Postgres connection string.

**How to add it:**

1. Go to your Vercel project dashboard
2. Click on **Settings**
3. Click on **Environment Variables** in the left sidebar
4. Add a new variable:
   - **Name**: `DATABASE_URL`
   - **Value**: Your Neon Postgres connection string (looks like this):
     ```
     postgresql://username:password@host.neon.tech/dbname?sslmode=require
     ```

**Where to get your connection string:**
- Go to your [Neon dashboard](https://console.neon.tech/)
- Select your project
- Click on "Connection Details" or "Connection String"
- Copy the connection string

**Example format:**
```
postgresql://neondb_owner:npg_3gZqomRLMVh0@ep-dry-moon-abu5f8m3-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require
```

## Optional Environment Variable

### PORT
- **Name**: `PORT`
- **Value**: `3000` (or any port you prefer)
- **Note**: This is usually NOT needed for Vercel as it automatically assigns ports. Only needed for local development.

## Step-by-Step Instructions

### Adding Variables in Vercel Dashboard

1. **Navigate to your project** on [vercel.com](https://vercel.com)
2. **Go to Settings** tab
3. **Click "Environment Variables"** in the sidebar
4. **Add the variable:**
   - Click "Add New"
   - Key: `DATABASE_URL`
   - Value: `[paste your Neon connection string]`
   - Environments: Select all (Production, Preview, Development)
5. **Click "Save"**
6. **Redeploy** your project for changes to take effect

### Adding Variables via Vercel CLI

If deploying via command line:

```bash
# Set environment variable
vercel env add DATABASE_URL

# When prompted, paste your Neon connection string
# Select which environments (production/preview/development)

# Deploy
vercel --prod
```

## Verification

After adding the environment variable and deploying:

1. Check the deployment logs in Vercel
2. Look for "Connected to Neon Postgres database" message
3. If you see an error about missing DATABASE_URL, the variable wasn't set correctly

## Troubleshooting

**"Missing database connection string" error:**
- Make sure you added `DATABASE_URL` in Vercel environment variables
- Check that the value doesn't have extra spaces or quotes
- Verify you selected the correct environments (Production/Preview)
- Redeploy after adding the variable

**Connection errors:**
- Verify your Neon connection string is correct
- Ensure the connection string includes `?sslmode=require`
- Check that your Neon project is active (not suspended)

## Security Note

⚠️ **Never commit your DATABASE_URL to Git!** 
- The `.gitignore` file ensures `.env` is not tracked
- Always add sensitive credentials through Vercel's dashboard or CLI
- Vercel encrypts environment variables

## Summary

**You only need ONE environment variable for Vercel:**

```
DATABASE_URL = [Your Neon Postgres connection string]
```

That's it! 🎉
