# Deployment Guide for EvTracker

This guide covers deploying EvTracker with Supabase backend and Vercel frontend.

## Prerequisites

- A [Supabase](https://supabase.com/) account
- A [Vercel](https://vercel.com/) account
- Git repository (GitHub, GitLab, or Bitbucket)

## Part 1: Setting Up Supabase

### 1. Create a Supabase Project

1. Go to [Supabase Dashboard](https://app.supabase.com/)
2. Click "New Project"
3. Fill in your project details:
   - Name: `evtracker` (or your preferred name)
   - Database Password: Choose a strong password (save it!)
   - Region: Select closest to your users
4. Click "Create new project" and wait for setup to complete

### 2. Create the Database Table

1. In your Supabase project, go to the **SQL Editor**
2. Copy the contents of `supabase-schema.sql` from this repository
3. Paste it into the SQL Editor
4. Click "Run" to create the table and indexes

Alternatively, you can run this command if you have Supabase CLI:
```bash
supabase db push
```

### 3. Get Your Supabase Credentials

1. Go to **Settings** > **API** in your Supabase project
2. Copy the following values:
   - **Project URL** (looks like: `https://xxxxx.supabase.co`)
   - **anon/public key** (the `anon` key under "Project API keys")

Keep these values handy - you'll need them for deployment.

### 4. Configure Row Level Security (Optional but Recommended)

The schema includes basic RLS policies that allow all operations. For production:

1. Go to **Authentication** in Supabase
2. Enable your preferred authentication provider
3. Update the RLS policies in SQL Editor to restrict access:

```sql
-- Example: Users can only access their own sessions
ALTER TABLE charging_sessions ADD COLUMN user_id UUID REFERENCES auth.users(id);

DROP POLICY IF EXISTS "Enable all operations for all users" ON charging_sessions;

CREATE POLICY "Users can view their own sessions" ON charging_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sessions" ON charging_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sessions" ON charging_sessions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sessions" ON charging_sessions
  FOR DELETE USING (auth.uid() = user_id);
```

## Part 2: Deploying to Vercel

### Option A: Deploy via Vercel Dashboard (Recommended)

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Add New" > "Project"
3. Import your Git repository
4. Configure the project:
   - **Framework Preset**: Other
   - **Root Directory**: `./` (default)
   - **Build Command**: Leave empty (we're using serverless functions)
   - **Output Directory**: Leave empty

5. Add Environment Variables:
   - Click "Environment Variables"
   - Add the following:
     - `SUPABASE_URL`: Your Supabase Project URL
     - `SUPABASE_ANON_KEY`: Your Supabase anon key
   
6. Click "Deploy"

Your app will be deployed at a URL like: `https://your-project.vercel.app`

### Option B: Deploy via Vercel CLI

1. Install Vercel CLI:
```bash
npm install -g vercel
```

2. Login to Vercel:
```bash
vercel login
```

3. Deploy from your project directory:
```bash
cd /path/to/EvTracker
vercel
```

4. Follow the prompts and add environment variables when asked

5. For production deployment:
```bash
vercel --prod
```

### Setting Environment Variables in Vercel

After deployment, you can manage environment variables:

1. Go to your project in Vercel Dashboard
2. Click **Settings** > **Environment Variables**
3. Add or update:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
4. Redeploy if needed

## Part 3: Local Development

### 1. Clone the Repository

```bash
git clone https://github.com/tomkerry47/EvTracker.git
cd EvTracker
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Edit `.env` and add your Supabase credentials:

```env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
PORT=3000
```

### 4. Run the Development Server

```bash
npm start
```

The app will be available at `http://localhost:3000`

## Troubleshooting

### "Missing Supabase credentials" Error

- Ensure your `.env` file exists and contains valid credentials
- Check that `SUPABASE_URL` and `SUPABASE_ANON_KEY` are set correctly
- Restart the server after changing environment variables

### Database Connection Issues

- Verify your Supabase project is active
- Check that the `charging_sessions` table exists (run the schema SQL)
- Confirm your anon key has the necessary permissions

### Vercel Deployment Fails

- Check build logs in Vercel dashboard
- Ensure all environment variables are set in Vercel
- Verify `vercel.json` configuration is correct

### API Requests Return 500 Errors

- Check Vercel function logs for error messages
- Verify Supabase credentials in Vercel environment variables
- Ensure the database table schema matches the application code

## Testing Your Deployment

After deployment, test the following:

1. **Visit the app URL** - The dashboard should load
2. **Add a session** - Fill in the form and submit
3. **View sessions** - Check that the session appears in the list
4. **Delete a session** - Test the delete functionality
5. **Check stats** - Verify statistics are calculated correctly

## Database Backup

To backup your Supabase database:

1. Go to **Database** > **Backups** in Supabase Dashboard
2. Enable automatic backups (recommended)
3. Manual backup via SQL:

```bash
# Using Supabase CLI
supabase db dump -f backup.sql

# Or using pg_dump
pg_dump -h db.xxxxx.supabase.co -U postgres -d postgres > backup.sql
```

## Monitoring

### Supabase

- View API usage: **Settings** > **API**
- Monitor database: **Database** > **Logs**
- Check performance: **Reports**

### Vercel

- View function logs: Project > **Functions** tab
- Monitor analytics: Project > **Analytics**
- Check bandwidth: Project > **Usage**

## Custom Domain (Optional)

To use a custom domain with Vercel:

1. Go to your project in Vercel
2. Click **Settings** > **Domains**
3. Add your domain and follow DNS configuration steps
4. Update Supabase allowed URLs if using authentication

## Next Steps

- Enable authentication in Supabase for multi-user support
- Set up proper RLS policies
- Configure email notifications (optional)
- Add monitoring and alerts
- Set up CI/CD for automatic deployments

## Support

For issues:
- Supabase: [docs.supabase.com](https://supabase.com/docs)
- Vercel: [vercel.com/docs](https://vercel.com/docs)
- GitHub Issues: [Create an issue](https://github.com/tomkerry47/EvTracker/issues)
