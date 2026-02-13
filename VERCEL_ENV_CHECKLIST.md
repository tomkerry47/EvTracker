# Vercel Environment Variables - Quick Checklist ✅

## 🚨 YES - You MUST Add Environment Variables in Vercel!

Your deployment is failing because these environment variables are missing. Follow this checklist to fix it.

---

## Required Environment Variables (4 Total)

Add these **exactly as shown** in your Vercel project:

### 1. DATABASE_URL (Required)
```
Name: DATABASE_URL
Value: postgresql://neondb_owner:npg_3gZqomRLMVh0@ep-dry-moon-abu5f8m3-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require
Environments: ✅ Production ✅ Preview ✅ Development
```

### 2. OCTOPUS_API_KEY (Required for Import)
```
Name: OCTOPUS_API_KEY
Value: sk_live_1aBxvJiRqYrYnZoIVaF59BUS6f7pycFa
Environments: ✅ Production ✅ Preview ✅ Development
```

### 3. OCTOPUS_MPAN (Required for Import)
```
Name: OCTOPUS_MPAN
Value: 1100010380152
Environments: ✅ Production ✅ Preview ✅ Development
```

### 4. OCTOPUS_SERIAL (Required for Import)
```
Name: OCTOPUS_SERIAL
Value: 18P0140299
Environments: ✅ Production ✅ Preview ✅ Development
```

---

## How to Add These in Vercel Dashboard

### Step-by-Step Instructions:

1. **Go to your Vercel project**
   - Visit: https://vercel.com/dashboard
   - Click on your `ev-tracker` project

2. **Navigate to Settings**
   - Click the "Settings" tab at the top

3. **Open Environment Variables**
   - Click "Environment Variables" in the left sidebar

4. **Add each variable (repeat 4 times)**
   - Click "Add New" button
   - Copy the **Name** from above (e.g., `DATABASE_URL`)
   - Copy the **Value** from above (the full string)
   - Check all three boxes: ✅ Production ✅ Preview ✅ Development
   - Click "Save"

5. **Redeploy**
   - Go to "Deployments" tab
   - Click the three dots ⋯ on the latest deployment
   - Click "Redeploy"
   - Wait for deployment to complete

---

## Alternative: Add via Vercel CLI

If you prefer using the command line:

```bash
# Install Vercel CLI if you haven't
npm i -g vercel

# Login to Vercel
vercel login

# Link your project
cd /path/to/EvTracker
vercel link

# Add environment variables
vercel env add DATABASE_URL production preview development
# When prompted, paste: postgresql://neondb_owner:npg_3gZqomRLMVh0@ep-dry-moon-abu5f8m3-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require

vercel env add OCTOPUS_API_KEY production preview development
# When prompted, paste: sk_live_1aBxvJiRqYrYnZoIVaF59BUS6f7pycFa

vercel env add OCTOPUS_MPAN production preview development
# When prompted, paste: 1100010380152

vercel env add OCTOPUS_SERIAL production preview development
# When prompted, paste: 18P0140299

# Redeploy
vercel --prod
```

---

## Verification Checklist

After adding variables and redeploying, verify:

- [ ] Go to Settings → Environment Variables
- [ ] See all 4 variables listed:
  - [ ] DATABASE_URL
  - [ ] OCTOPUS_API_KEY
  - [ ] OCTOPUS_MPAN
  - [ ] OCTOPUS_SERIAL
- [ ] Each variable is set for Production, Preview, and Development
- [ ] Redeploy has completed successfully
- [ ] Visit your app URL (e.g., ev-tracker-xxx.vercel.app)
- [ ] Check logs - should NOT see "database connection" errors
- [ ] Check logs - should NOT see "Octopus Energy API credentials not found"
- [ ] Test the import feature by clicking "Import from Octopus"

---

## What These Errors Mean

### "Error: getaddrinfo ENOTFOUND base"
❌ **Problem**: DATABASE_URL is not set  
✅ **Solution**: Add DATABASE_URL environment variable

### "Octopus Energy API credentials not found"
❌ **Problem**: Octopus credentials are not set  
✅ **Solution**: Add OCTOPUS_API_KEY, OCTOPUS_MPAN, OCTOPUS_SERIAL

---

## Security Note

🔒 These credentials are stored securely in Vercel:
- Encrypted at rest and in transit
- Not visible in logs
- Not exposed to client-side code
- Only accessible to your serverless functions

⚠️ **Never commit these to Git** - they should only be in Vercel's environment variables.

---

## Summary

**You need to add 4 environment variables in Vercel:**
1. DATABASE_URL - For database connection
2. OCTOPUS_API_KEY - For Octopus Energy API
3. OCTOPUS_MPAN - Your meter point number
4. OCTOPUS_SERIAL - Your meter serial number

**After adding these and redeploying, your app will work! 🎉**

---

## Need More Help?

- See [VERCEL_SETUP.md](./VERCEL_SETUP.md) for detailed explanations
- See [DEPLOYMENT.md](./DEPLOYMENT.md) for full deployment guide
- Check Vercel logs at: https://vercel.com/dashboard → Your Project → Logs
