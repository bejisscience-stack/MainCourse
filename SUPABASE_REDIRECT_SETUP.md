# Supabase Email Verification Redirect Setup

After deploying your website, you need to configure Supabase to use your production URL for email verification links.

## Steps to Fix Email Verification Redirects

### 1. Add Environment Variable in Vercel

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add a new variable:
   - **Name:** `NEXT_PUBLIC_SITE_URL`
   - **Value:** Your production URL (e.g., `https://yourdomain.com` or `https://your-project.vercel.app`)
   - **Environments:** Select all (Production, Preview, Development)
4. Click **Save**
5. **Redeploy** your application

### 2. Configure Supabase Redirect URLs

1. Go to your [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Navigate to **Authentication** → **URL Configuration**
4. In the **Redirect URLs** section, add:
   ```
   https://yourdomain.com/auth/callback
   https://your-project.vercel.app/auth/callback
   ```
   (Replace with your actual domain/URL)
5. If you're still testing locally, also add:
   ```
   http://localhost:3000/auth/callback
   ```
6. Click **Save**

### 3. Update Site URL in Supabase

1. Still in **Authentication** → **URL Configuration**
2. Set the **Site URL** to your production URL:
   ```
   https://yourdomain.com
   ```
   (or `https://your-project.vercel.app` if you don't have a custom domain yet)
3. Click **Save**

### 4. Verify Email Templates (Optional)

1. Go to **Authentication** → **Email Templates**
2. Check the **Confirm signup** template
3. Make sure the redirect link uses `{{ .ConfirmationURL }}` or `{{ .SiteURL }}/auth/callback`
4. The default template should work, but you can customize it if needed

## How It Works

- When a user signs up, they receive an email with a verification link
- The link points to: `https://yourdomain.com/auth/callback?code=...`
- The callback route (`/app/auth/callback/route.ts`) handles the verification
- After verification, users are redirected based on their role:
  - Lecturers → `/lecturer/dashboard`
  - Students → `/my-courses`

## Testing

1. Sign up with a new email address
2. Check your email for the verification link
3. Click the link - it should redirect to your production site (not localhost)
4. After verification, you should be logged in and redirected appropriately

## Troubleshooting

### Still redirecting to localhost?

1. **Check Vercel environment variables:**
   - Make sure `NEXT_PUBLIC_SITE_URL` is set correctly
   - Redeploy after adding/updating the variable

2. **Check Supabase redirect URLs:**
   - Make sure your production URL is added to the allowed redirect URLs
   - The URL must match exactly (including `https://`)

3. **Clear browser cache:**
   - Sometimes old redirect URLs are cached
   - Try in an incognito/private window

4. **Check Supabase Site URL:**
   - Make sure the Site URL in Supabase matches your production domain

### Email not sending?

1. Check Supabase **Authentication** → **Providers** → **Email**
2. Make sure email provider is configured
3. Check your email spam folder
4. Verify your email domain is not blocked

## Important Notes

- **Never commit `.env.local`** with production URLs to Git
- Always use environment variables for URLs
- The callback route uses `force-dynamic` to ensure it works correctly
- Both custom domains and Vercel preview URLs should be added to Supabase redirect URLs

