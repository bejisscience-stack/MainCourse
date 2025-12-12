# Vercel Deployment Setup Guide

## Required Environment Variables

You need to add **3 environment variables** in the Vercel setup screen:

### 1. `NEXT_PUBLIC_SUPABASE_URL`
**Value:** `https://nbecbsbuerdtakxkrduw.supabase.co`

This is your Supabase project URL. You can also find it in:
- Supabase Dashboard → Settings → API → Project URL

### 2. `NEXT_PUBLIC_SUPABASE_ANON_KEY`
**Value:** Your Supabase anonymous/public key

To find this:
1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to **Settings** → **API**
4. Copy the **anon/public** key (it's a long string starting with `eyJ...`)

### 3. `NEXT_PUBLIC_SITE_URL`
**Value:** `https://main-course-wbul.vercel.app`

This is critical for email verification to work properly. It tells the app where to redirect users after they click the verification link in their email.

---

## Step-by-Step Instructions

### In the Vercel Setup Screen:

1. **Remove the example variable** (if present):
   - Click the "X" next to `EXAMPLE_NAME` to remove it

2. **Add `NEXT_PUBLIC_SUPABASE_URL`**:
   - Click **"+ Add More"** button
   - **Key:** `NEXT_PUBLIC_SUPABASE_URL`
   - **Value:** `https://nbecbsbuerdtakxkrduw.supabase.co`
   - Make sure to select **all environments** (Production, Preview, Development)

3. **Add `NEXT_PUBLIC_SUPABASE_ANON_KEY`**:
   - Click **"+ Add More"** button again
   - **Key:** `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **Value:** Paste your anon key from Supabase Dashboard
   - Select **all environments**

4. **Add `NEXT_PUBLIC_SITE_URL`**:
   - Click **"+ Add More"** button again
   - **Key:** `NEXT_PUBLIC_SITE_URL`
   - **Value:** `https://main-course-wbul.vercel.app`
   - Select **all environments**

### Final Environment Variables Table Should Look Like:

| Key | Value | Environments |
|-----|-------|--------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://nbecbsbuerdtakxkrduw.supabase.co` | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` (your long key) | Production, Preview, Development |
| `NEXT_PUBLIC_SITE_URL` | `https://main-course-wbul.vercel.app` | Production, Preview, Development |

---

## Alternative: Import from .env File

If you have a `.env.local` file locally, you can:

1. Click the **"Import .env"** button
2. Paste the contents of your `.env.local` file
3. Make sure it includes all three variables above
4. Verify the values are correct

**Note:** Make sure your `.env.local` has:
```env
NEXT_PUBLIC_SUPABASE_URL=https://nbecbsbuerdtakxkrduw.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
NEXT_PUBLIC_SITE_URL=https://main-course-wbul.vercel.app
```

---

## After Adding Variables

1. **Verify all 3 variables are added** and have correct values
2. **Check that all environments are selected** (Production, Preview, Development)
3. Click **"Deploy"** button

---

## Important Notes

- ✅ All variables must start with `NEXT_PUBLIC_` to be accessible in the browser
- ✅ Make sure there are no extra spaces or quotes in the values
- ✅ The `NEXT_PUBLIC_SITE_URL` must match your actual domain
- ✅ You can add/update these later in Vercel → Settings → Environment Variables

---

## After Deployment

Once deployed, you can verify the environment variables are set correctly:

1. Go to Vercel Dashboard → Your Project → **Settings** → **Environment Variables**
2. You should see all three variables listed
3. If you need to update them later, you can do so here and redeploy

---

## Troubleshooting

### Can't find Supabase keys?
- Go to [Supabase Dashboard](https://app.supabase.com)
- Select your project
- Settings → API
- Copy the **Project URL** and **anon public** key

### Variables not working after deployment?
- Make sure variables start with `NEXT_PUBLIC_`
- Check for typos in variable names
- Redeploy after adding/updating variables
- Clear browser cache and hard refresh

### Email verification still not working?
- Verify `NEXT_PUBLIC_SITE_URL` is set to `https://main-course-wbul.vercel.app`
- Check Supabase Dashboard → Authentication → URL Configuration
- See `ENABLE_EMAIL_VERIFICATION.md` for complete email setup guide



