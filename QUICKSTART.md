# Quick Setup Guide

This guide will help you get EvTracker running with Supabase and deploy it to Vercel in under 10 minutes.

## Step 1: Set Up Supabase (5 minutes)

1. **Create Account & Project**
   - Go to [supabase.com](https://supabase.com)
   - Sign up or log in
   - Click "New Project"
   - Fill in:
     - Name: `evtracker`
     - Database Password: (choose a strong password)
     - Region: (closest to you)
   - Click "Create new project"
   - Wait 2-3 minutes for setup

2. **Create Database Table**
   - Click "SQL Editor" in the left sidebar
   - Click "New Query"
   - Copy and paste the entire contents of `supabase-schema.sql`
   - Click "Run" (or press Ctrl+Enter)
   - You should see "Success. No rows returned"

3. **Get Your Credentials**
   - Click "Settings" (gear icon) in the sidebar
   - Click "API"
   - Copy these two values:
     - **Project URL** (looks like `https://xxxxx.supabase.co`)
     - **anon public** key (the long string under "Project API keys")

✅ Supabase is ready!

## Step 2: Deploy to Vercel (3 minutes)

### Option A: Deploy via GitHub (Recommended)

1. **Push to GitHub**
   ```bash
   git push origin main
   ```

2. **Connect to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Sign up or log in
   - Click "Add New" > "Project"
   - Import your GitHub repository
   - Click on the repository

3. **Configure Environment Variables**
   - Vercel will show a configuration screen
   - Expand "Environment Variables"
   - Add two variables:
     - Key: `SUPABASE_URL`, Value: (paste your Supabase URL)
     - Key: `SUPABASE_ANON_KEY`, Value: (paste your anon key)

4. **Deploy**
   - Click "Deploy"
   - Wait 1-2 minutes
   - Click "Visit" to see your app!

### Option B: Deploy via Vercel CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy (will prompt for environment variables)
vercel

# Add environment variables when prompted:
# SUPABASE_URL: https://xxxxx.supabase.co
# SUPABASE_ANON_KEY: your-anon-key

# Deploy to production
vercel --prod
```

✅ Your app is live!

## Step 3: Test Your App (2 minutes)

1. Visit your Vercel URL (e.g., `https://your-app.vercel.app`)
2. Add a test charging session:
   - Fill in the form
   - Click "Add Session"
3. Verify it appears in the list
4. Check that statistics update

✅ Everything works!

## Optional: Set Up Custom Domain

1. In Vercel dashboard, go to your project
2. Click "Settings" > "Domains"
3. Add your custom domain
4. Follow the DNS instructions
5. Wait for DNS propagation (5-60 minutes)

## Need Help?

### Common Issues

**"Missing Supabase credentials" error**
- Check that you added environment variables in Vercel
- Redeploy after adding variables

**Sessions not appearing**
- Check browser console for errors
- Verify database table was created (run schema again)
- Check Supabase logs in dashboard

**Can't deploy to Vercel**
- Make sure you pushed all files to GitHub
- Check that `vercel.json` exists in your repository
- Verify you have the latest code

### Getting Support

- Check [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions
- Check [README.md](./README.md) for API documentation
- Open an issue on GitHub
- Check Supabase docs: [supabase.com/docs](https://supabase.com/docs)
- Check Vercel docs: [vercel.com/docs](https://vercel.com/docs)

## What You Get

✅ **Production-ready app** deployed to the cloud  
✅ **PostgreSQL database** with automatic backups  
✅ **Serverless API** that scales automatically  
✅ **HTTPS by default** with Vercel  
✅ **Free hosting** (within Vercel/Supabase free tiers)  

## Cost Estimate

**Free tier (sufficient for personal use):**
- Supabase: 500MB database, 2GB bandwidth/month
- Vercel: 100GB bandwidth, 100 serverless function invocations/day

**Typical usage for one user:**
- ~100 sessions/month = ~1KB per session = 100KB storage
- ~1000 page views/month = ~5MB bandwidth
- Well within free tier! 

## Next Steps

1. **Secure your app** (optional but recommended):
   - Enable Supabase authentication
   - Update RLS policies for multi-user support

2. **Monitor usage**:
   - Check Supabase dashboard for database size
   - Check Vercel dashboard for bandwidth/function usage

3. **Customize**:
   - Update tariff rates in code
   - Add more session fields
   - Create reports and charts

Enjoy tracking your EV charging! ⚡🚗
