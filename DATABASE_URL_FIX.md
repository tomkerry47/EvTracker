# ❌ DATABASE_URL Format is INCORRECT - How to Fix

## Your Question: "is this correct?"

**ANSWER: NO! ❌**

## What You Provided (WRONG)

```
DATABASE_URL=psql 'postgresql://neondb_owner:npg_3gZqomRLMVh0@ep-dry-moon-abu5f8m3-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&amp;channel_binding=require'
```

## What's Wrong - 3 Critical Errors

### Error #1: `psql` Prefix ❌

**Problem:** Your DATABASE_URL starts with `psql`

**Why it's wrong:** `psql` is the PostgreSQL command-line client program. It's NOT part of the connection string!

**What to do:** Remove `psql ` (including the space after it)

### Error #2: Quotes Around URL ❌

**Problem:** The URL is wrapped in quotes: `'...'`

**Why it's wrong:** Environment variables should NOT have quotes in the value

**What to do:** Remove both the opening `'` and closing `'`

### Error #3: HTML Encoded Ampersand ❌

**Problem:** Uses `&amp;` instead of `&`

**Why it's wrong:** `&amp;` is HTML encoding. In connection strings, use plain `&`

**What to do:** Replace `&amp;` with `&`

## Visual Comparison

### ❌ WRONG (Your Current Format)

```
DATABASE_URL=psql 'postgresql://...?sslmode=require&amp;channel_binding=require'
            ^^^^  ^                                ^^^^                        ^
            |     |                                |                           |
         Remove  Remove                         Change to &                 Remove
          this   quote                                                      quote
```

### ✅ CORRECT (Fixed Format)

```
DATABASE_URL=postgresql://neondb_owner:npg_3gZqomRLMVh0@ep-dry-moon-abu5f8m3-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=verify-full&channel_binding=require
```

**Note:** Also changed `sslmode=require` to `sslmode=verify-full` to avoid SSL security warnings.

## Copy-Paste Ready - Your Correct Value

**Use this EXACT value in Vercel:**

```
postgresql://neondb_owner:npg_3gZqomRLMVh0@ep-dry-moon-abu5f8m3-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=verify-full&channel_binding=require
```

## Why This Mistake Happens

### Neon Dashboard Shows This:

When you go to Neon dashboard and click "Connection String", it shows:

```bash
psql 'postgresql://user:pass@host/db?params'
```

This is a **complete terminal command** - it's designed to be run directly in your terminal.

### What You Need:

For environment variables (like in Vercel), you need **ONLY the connection URL** without the `psql` command and without quotes:

```
postgresql://user:pass@host/db?params
```

## Step-by-Step Fix in Vercel

1. **Go to Vercel Dashboard**
   - Visit https://vercel.com/dashboard
   - Click your "ev-tracker" project

2. **Open Environment Variables**
   - Click "Settings" tab
   - Click "Environment Variables" in sidebar

3. **Find DATABASE_URL**
   - Look for the `DATABASE_URL` variable
   - Click the "..." menu → "Edit"

4. **Fix the Value**
   - **Remove:** `psql ` from the beginning
   - **Remove:** Opening quote `'`
   - **Remove:** Closing quote `'`
   - **Change:** `&amp;` to `&` (plain ampersand)
   
5. **Verify Format**
   - Should start with: `postgresql://`
   - Should NOT have quotes
   - Should have `&` not `&amp;`
   - Should end with: `...require&channel_binding=require`

6. **Save**
   - Click "Save"
   - Vercel will automatically redeploy

## Quick Format Check

✅ **Correct format starts with:**
```
DATABASE_URL=postgresql://
```

❌ **WRONG if it starts with:**
```
DATABASE_URL=psql
DATABASE_URL='postgresql://
DATABASE_URL="postgresql://
```

✅ **Correct format has:**
- Plain `&` ampersands
- No quotes anywhere
- Starts immediately with `postgresql://`

❌ **WRONG if it has:**
- `&amp;` (HTML encoding)
- Quotes `'...'` or `"..."`
- `psql` command

## Common Mistakes

### Mistake 1: Copying Full Command from Neon

**What Neon shows:**
```bash
psql 'postgresql://...'
```

**What you need:**
```
postgresql://...
```

**Solution:** Only copy the part inside the quotes, without the quotes themselves

### Mistake 2: Copying from Web Browser

When you copy from a web page, `&` sometimes gets converted to `&amp;`

**Solution:** Always manually change `&amp;` to `&`

### Mistake 3: Adding Quotes in Vercel

Some people think environment variables need quotes like in shell scripts.

**Solution:** In Vercel's environment variable editor, paste the URL WITHOUT quotes

## Testing the Fix

### Before Fix (Current Error)

```
Error connecting to database: Error: getaddrinfo ENOTFOUND base
hostname: 'base'
```

This error happens because the app is trying to connect to hostname "base" - which comes from parsing the malformed URL incorrectly.

You may also see this SSL warning:
```
Warning: SECURITY WARNING: The SSL modes 'prefer', 'require', and 'verify-ca' are treated as aliases for 'verify-full'.
```

### After Fix (Should Work)

```
Octopus Energy API client initialized
Legacy server listening...
Connected to Neon Postgres database
```

No errors, app loads, data persists, no SSL warnings.

## Alternative: Get Clean URL from Neon

If you want to get the clean connection string from Neon:

1. Go to Neon Dashboard → Your Project
2. Click "Connection Details"
3. **Copy** the connection string
4. **Paste** into a text editor
5. **Remove** `psql '` from the start
6. **Remove** `'` from the end
7. **Replace** any `&amp;` with `&`
8. **Change** `sslmode=require` to `sslmode=verify-full`
9. **Copy** the cleaned result
10. **Paste** into Vercel

## Your Correct Value (Copy This!)

For quick reference, here's your correct DATABASE_URL value:

```
postgresql://neondb_owner:npg_3gZqomRLMVh0@ep-dry-moon-abu5f8m3-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require
```

**Breakdown:**
- ✅ Starts with `postgresql://`
- ✅ No `psql` prefix
- ✅ No quotes
- ✅ Plain `&` between parameters
- ✅ Proper SSL mode parameters

## After You Fix This

Once you update DATABASE_URL in Vercel with the correct format:

1. ✅ Vercel will automatically redeploy (takes 2-3 minutes)
2. ✅ Database connection will work
3. ✅ All API endpoints will function
4. ✅ No more `ENOTFOUND base` errors
5. ✅ App will load successfully
6. ✅ You can add/view charging sessions

## Still Need Help?

If you're still having issues after fixing the format:

1. Check VERCEL_ENV_CHECKLIST.md for all required variables
2. Verify all 4 environment variables are set
3. Check deployment logs in Vercel
4. Read VERCEL_SETUP.md for detailed troubleshooting

---

**Bottom Line:** Remove `psql`, remove quotes, change `&amp;` to `&`, then save in Vercel! 🚀
