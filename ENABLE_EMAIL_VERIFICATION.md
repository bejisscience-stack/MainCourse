# Enable Email Verification - Complete Guide

## ✅ Code Changes Completed

I've updated your code to properly handle email verification:
1. ✅ Signup page now checks if email confirmation is required
2. ✅ Shows a clear message telling users to check their email
3. ✅ Improved error messages for unconfirmed email attempts

## 🔧 Required: Supabase Dashboard Configuration

The code is ready, but you need to enable email verification in your Supabase dashboard. Follow these steps:

### Step 1: Enable Email Confirmations in Supabase

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Navigate to **Authentication** → **Providers**
4. Click on **Email** provider
5. **Enable "Confirm email"** - This is the critical setting!
   - When enabled, users must verify their email before they can sign in
   - Verification emails will be sent automatically on signup

### Step 2: Verify Site URL Configuration

1. In Supabase Dashboard, go to **Authentication** → **URL Configuration**
2. Set **Site URL** to your Vercel domain:
   ```
   https://main-course-wbul.vercel.app
   ```
   (Make sure it's complete and includes `https://`)

3. Add these **Redirect URLs**:
   ```
   https://main-course-wbul.vercel.app/auth/callback
   http://localhost:3000/auth/callback  (for local development)
   ```

### Step 3: Check Email Template

1. Go to **Authentication** → **Email Templates**
2. Click on **"Confirm signup"** template
3. Verify the template includes:
   - `{{ .ConfirmationURL }}` or `{{ .SiteURL }}/auth/callback`
   - The default template should work, but verify it's not corrupted

### Step 4: Configure SMTP (Optional but Recommended)

Supabase's default email service has rate limits. For production, configure custom SMTP:

1. Go to **Authentication** → **Providers** → **Email**
2. Scroll down to **SMTP Settings**
3. Configure with your email provider:
   - **SMTP Host:** (e.g., `smtp.sendgrid.net`, `smtp.gmail.com`)
   - **SMTP Port:** (usually 587 or 465)
   - **SMTP User:** Your email/API key
   - **SMTP Password:** Your email password/API secret
   - **Sender email:** The email address that will send verification emails
   - **Sender name:** Your app name

**Popular SMTP Providers:**
- **SendGrid** (recommended for production)
- **Mailgun**
- **Amazon SES**
- **Gmail** (for testing only, not recommended for production)

### Step 5: Verify Environment Variables

Make sure these are set in your Vercel project:

1. Go to Vercel → Your Project → **Settings** → **Environment Variables**
2. Verify these exist:
   - `NEXT_PUBLIC_SITE_URL` = `https://main-course-wbul.vercel.app`
   - `NEXT_PUBLIC_SUPABASE_URL` = Your Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = Your Supabase anon key

3. **Redeploy** your application after adding/updating environment variables

## 🧪 Testing Email Verification

After completing the above steps:

1. **Wait 5-10 minutes** for changes to propagate
2. Go to your signup page: `https://main-course-wbul.vercel.app/signup`
3. Sign up with a **real email address** (not a test email)
4. You should see: "Check your email!" message
5. Check your email inbox (and spam folder)
6. Click the verification link in the email
7. You should be redirected to your app and logged in

## 🔍 Troubleshooting

### Still not receiving emails?

1. **Check spam/junk folder** - Verification emails often go there initially
2. **Check Supabase logs:**
   - Go to Supabase Dashboard → **Logs** → **Auth Logs**
   - Look for email sending errors or rate limit warnings
3. **Verify email address:**
   - Make sure you're using a valid, accessible email
   - Some email providers block automated emails
4. **Check rate limits:**
   - Supabase free tier has email sending limits (30 emails/hour)
   - If you've sent many test emails, wait a bit
5. **Try a different email provider:**
   - Gmail, Outlook, etc. usually work best
   - Some corporate emails block automated messages

### Email received but link doesn't work?

1. **Check the link URL:**
   - Should start with `https://main-course-wbul.vercel.app/auth/callback`
   - NOT `localhost` or incomplete URLs
2. **Verify redirect URL in Supabase:**
   - Must match exactly: `https://main-course-wbul.vercel.app/auth/callback`
3. **Check browser console:**
   - Open browser DevTools (F12)
   - Look for errors when clicking the link

### "Email not confirmed" error when trying to login?

- This means email verification is enabled (good!)
- User needs to click the verification link in their email
- Check spam folder if they didn't receive it
- You can resend verification email from Supabase dashboard if needed

## 📋 Quick Checklist

- [ ] Enabled "Confirm email" in Supabase Email provider settings
- [ ] Set Site URL to `https://main-course-wbul.vercel.app` (complete URL)
- [ ] Added redirect URL (`https://main-course-wbul.vercel.app/auth/callback`)
- [ ] Verified email template is correct
- [ ] Configured SMTP (optional but recommended for production)
- [ ] Set `NEXT_PUBLIC_SITE_URL` in Vercel environment variables
- [ ] Redeployed application after environment variable changes
- [ ] Tested signup flow with real email address
- [ ] Checked spam folder for verification email

## 🎯 Most Important Steps

**Priority 1 (Critical):**
1. Enable "Confirm email" in Supabase → Authentication → Providers → Email
2. Set Site URL to `https://main-course-wbul.vercel.app` in Supabase → Authentication → URL Configuration

**Priority 2 (Important):**
3. Add redirect URLs
4. Set `NEXT_PUBLIC_SITE_URL` in Vercel

**Priority 3 (Recommended):**
5. Configure custom SMTP for production use

---

**Note:** The code changes are already complete. You just need to enable email confirmations in the Supabase dashboard and verify your URL configurations.

