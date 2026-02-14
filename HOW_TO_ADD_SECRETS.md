# How to View the Workflow and Add GitHub Secrets

## Quick Answer

### Where is the Workflow?

**In Your Repository:**
- **File Location**: `.github/workflows/daily-charge-check.yml`
- **View in GitHub**: Go to your repository → Click the "Actions" tab → You'll see "Daily Charge Check" workflow

### Where to Add Secrets?

**Step-by-Step:**
1. Go to your GitHub repository: `https://github.com/tomkerry47/EvTracker`
2. Click **"Settings"** (top right, next to "Insights")
3. In the left sidebar, scroll down and click **"Secrets and variables"**
4. Click **"Actions"** (under "Secrets and variables")
5. Click the green **"New repository secret"** button
6. Add each secret one at a time

---

## Detailed Step-by-Step Guide

### Part 1: View the Workflow File

#### Option A: In Your Code Editor
The workflow file is located at:
```
.github/workflows/daily-charge-check.yml
```

You can open it in any text editor to see what it does.

#### Option B: On GitHub.com
1. Go to `https://github.com/tomkerry47/EvTracker`
2. Click on the `.github` folder
3. Click on the `workflows` folder
4. Click on `daily-charge-check.yml`
5. You'll see the complete workflow configuration

#### Option C: In the Actions Tab
1. Go to your repository on GitHub
2. Click the **"Actions"** tab (top menu)
3. You'll see "Daily Charge Check" in the list of workflows
4. Click on it to see runs and configuration
5. Click the three dots (...) → "View workflow file" to see the code

---

### Part 2: Add the Required Secrets

You need to add **4 secrets** for the workflow to function.

#### Navigation Path:
```
Repository Home
  → Settings (top menu)
    → Secrets and variables (left sidebar)
      → Actions
        → New repository secret (green button)
```

#### Detailed Steps:

1. **Go to Settings**
   - Navigate to: `https://github.com/tomkerry47/EvTracker/settings`
   - Or: Click "Settings" in the top menu of your repository

2. **Find Secrets Section**
   - Look in the left sidebar
   - Scroll down to the "Security" section
   - Click **"Secrets and variables"**
   - Then click **"Actions"** (it will expand)

3. **Add Each Secret**
   - Click the green **"New repository secret"** button
   - Fill in the form for each secret:

#### Secret 1: DATABASE_URL
```
Name: DATABASE_URL
Secret: postgresql://neondb_owner:npg_3gZqomRLMVh0@ep-dry-moon-abu5f8m3-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=verify-full&channel_binding=require
```
- Click **"Add secret"**

#### Secret 2: OCTOPUS_API_KEY
```
Name: OCTOPUS_API_KEY
Secret: sk_live_1aBxvJiRqYrYnZoIVaF59BUS6f7pycFa
```
- Click **"Add secret"**

#### Secret 3: OCTOPUS_MPAN
```
Name: OCTOPUS_MPAN
Secret: 1100010380152
```
- Click **"Add secret"**

#### Secret 4: OCTOPUS_SERIAL
```
Name: OCTOPUS_SERIAL
Secret: 18P0140299
```
- Click **"Add secret"**

4. **Verify All Secrets Are Added**
   - After adding all 4, you should see them listed
   - Names will be visible, but values are hidden (for security)
   - You should see:
     - DATABASE_URL
     - OCTOPUS_API_KEY
     - OCTOPUS_MPAN
     - OCTOPUS_SERIAL

---

### Part 3: Test the Workflow

Once secrets are added, you can test the workflow:

#### Option A: Manual Trigger
1. Go to the **"Actions"** tab
2. Click on **"Daily Charge Check"** in the left sidebar
3. Click the blue **"Run workflow"** dropdown on the right
4. Select the branch (probably "copilot/create-charge-tracking-dashboard" or "main")
5. Click **"Run workflow"** button
6. Wait a few seconds, then refresh the page
7. You'll see a new workflow run appear
8. Click on it to view logs and results

#### Option B: Wait for Automatic Run
- The workflow is scheduled to run at **06:00 AM UTC** every day
- It will run automatically
- Check the Actions tab the next morning to see results

---

## What Each Secret Is For

| Secret Name | Purpose | Where to Get It |
|------------|---------|----------------|
| `DATABASE_URL` | Connection to your Neon Postgres database | From Neon dashboard connection string |
| `OCTOPUS_API_KEY` | Authenticates with Octopus Energy API | From Octopus Energy account → Developer settings |
| `OCTOPUS_MPAN` | Your electricity meter point number | From Octopus account or electricity bill |
| `OCTOPUS_SERIAL` | Your meter serial number | From Octopus account or electricity bill |

---

## Common Issues and Solutions

### Issue: Can't find "Settings" tab
**Solution**: You need to be the repository owner or have admin access. If you forked the repo, make sure you're viewing YOUR fork, not the original.

### Issue: Don't see "Secrets and variables"
**Solution**: Make sure you're in the repository Settings (not your personal account settings). The URL should be `github.com/YOUR_USERNAME/EvTracker/settings`.

### Issue: Workflow fails with "Error: Secret not found"
**Solution**: 
1. Check the secret name is EXACTLY as shown (case-sensitive)
2. No extra spaces in the name
3. Make sure all 4 secrets are added

### Issue: Workflow runs but no sessions imported
**Solution**:
1. Check the workflow logs for errors
2. Verify your OCTOPUS_API_KEY is correct
3. Verify your MPAN and SERIAL numbers are correct
4. Make sure there's charging data in the last 2 days

### Issue: Can't trigger workflow manually
**Solution**: Make sure GitHub Actions are enabled for your repository (Settings → Actions → General → Allow all actions).

---

## Quick Reference

### URLs
- **Your Repository**: `https://github.com/tomkerry47/EvTracker`
- **Settings**: `https://github.com/tomkerry47/EvTracker/settings`
- **Secrets**: `https://github.com/tomkerry47/EvTracker/settings/secrets/actions`
- **Actions**: `https://github.com/tomkerry47/EvTracker/actions`
- **Workflow File**: `https://github.com/tomkerry47/EvTracker/blob/copilot/create-charge-tracking-dashboard/.github/workflows/daily-charge-check.yml`

### Secrets Checklist
- [ ] DATABASE_URL added
- [ ] OCTOPUS_API_KEY added
- [ ] OCTOPUS_MPAN added
- [ ] OCTOPUS_SERIAL added
- [ ] Workflow triggered manually (optional test)
- [ ] Workflow run completed successfully

---

## Need More Help?

If you're still having trouble:
1. Check the Actions tab logs for specific error messages
2. Verify each secret value is correct (no extra spaces, correct format)
3. Make sure GitHub Actions are enabled for your repository
4. Try triggering the workflow manually first before waiting for the scheduled run

The workflow will import the last 2 days of charging data from Octopus Energy and store it in your database automatically every morning at 06:00 AM!
