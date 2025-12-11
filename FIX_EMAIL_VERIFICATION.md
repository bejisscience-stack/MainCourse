# Fix Email Verification - Step by Step Guide

## Critical Issues Found:

1. ❌ **Supabase Site URL is incomplete**: Shows `https://www.bejimate` instead of `https://www.bejimates.space`
2. ⚠️ **Vercel root domain shows "Invalid Configuration"**
3. ✅ DNS records look correct but need verification

---

## Step 1: Fix Supabase Site URL (CRITICAL - DO THIS FIRST)

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to **Authentication** → **URL Configuration**
4. In the **Site URL** field, change:
   - ❌ FROM: `https://www.bejimate`
   - ✅ TO: `https://www.bejimates.space`
5. Click **"Save changes"**

**This is the main reason emails aren't working!**

---

## Step 2: Verify Supabase Redirect URLs

In the same **URL Configuration** page:

1. Make sure these URLs are in the **Redirect URLs** list:
   ```
   https://www.bejimates.space/auth/callback
   https://bejimates.space/auth/callback
   ```

2. If `https://bejimates.space/auth/callback` is missing, click **"Add URL"** and add it

3. Click **"Save changes"**

---

## Step 3: Fix Vercel Domain Configuration

Your root domain `bejimates.space` shows "Invalid Configuration". Let's fix it:

### Option A: Update DNS Record (Recommended)

1. Go to your **Bluehost DNS Manager** (where you're managing DNS)
2. Find the **A record** for `@` (root domain)
3. Make sure it points to: `216.198.79.1` (this is the new Vercel IP)
4. If it's different, update it to `216.198.79.1`
5. Set TTL to **4 Hours** (or Auto)
6. Save

### Option B: Wait for DNS Propagation

- DNS changes can take 5 minutes to 48 hours
- Check Vercel Domains page - it should show "Valid Configuration" when ready
- You can verify DNS propagation at: https://www.whatsmydns.net/#A/bejimates.space

---

## Step 4: Verify Vercel Environment Variable

1. Go to Vercel → Your Project → **Settings** → **Environment Variables**
2. Check if `NEXT_PUBLIC_SITE_URL` exists:
   - **Name:** `NEXT_PUBLIC_SITE_URL`
   - **Value:** `https://www.bejimates.space`
   - **Environments:** All (Production, Preview, Development)
3. If it's missing or wrong, add/update it
4. **Redeploy** your application after adding/updating

---

## Step 5: Check Supabase Email Settings

1. Go to Supabase Dashboard → **Authentication** → **Providers**
2. Click on **Email** provider
3. Make sure **"Enable Email Provider"** is turned ON
4. Check **"Confirm email"** is enabled (this sends verification emails)
5. Verify your email settings:
   - **SMTP Host:** (should be configured)
   - **SMTP Port:** (usually 587 or 465)
   - **SMTP User:** (your email)
   - **SMTP Password:** (your email password)

**Note:** If you haven't configured custom SMTP, Supabase uses their default email service (which has rate limits).

---

## Step 6: Check Email Template

1. Go to Supabase Dashboard → **Authentication** → **Email Templates**
2. Click on **"Confirm signup"** template
3. Check the email content - it should use `{{ .ConfirmationURL }}` or `{{ .SiteURL }}/auth/callback`
4. The default template should work, but verify it's not corrupted

---

## Step 7: Test Email Verification

After completing all steps above:

1. **Wait 5-10 minutes** for changes to propagate
2. Go to your website: `https://www.bejimates.space/signup`
3. Sign up with a **real email address** (not a test email)
4. Check your email inbox (and spam folder)
5. You should receive an email with subject like "Confirm your signup"
6. The link in the email should point to: `https://www.bejimates.space/auth/callback?code=...`

---

## Troubleshooting

### Still not receiving emails?

1. **Check spam/junk folder** - verification emails often go there
2. **Check Supabase logs:**
   - Go to Supabase Dashboard → **Logs** → **Auth Logs**
   - Look for email sending errors
3. **Verify email address:**
   - Make sure you're using a valid, accessible email
   - Some email providers block automated emails
4. **Check rate limits:**
   - Supabase free tier has email sending limits
   - If you've sent many test emails, wait a bit
5. **Try a different email provider:**
   - Gmail, Outlook, etc. usually work best
   - Some corporate emails block automated messages

### Email received but link doesn't work?

1. **Check the link URL:**
   - Should start with `https://www.bejimates.space/auth/callback`
   - NOT `localhost` or `bejimate` (incomplete)
2. **Verify redirect URL in Supabase:**
   - Must match exactly: `https://www.bejimates.space/auth/callback`
3. **Check browser console:**
   - Open browser DevTools (F12)
   - Look for errors when clicking the link

### Domain still shows "Invalid Configuration"?

1. **Wait longer** - DNS can take up to 48 hours
2. **Clear DNS cache:**
   ```bash
   # macOS
   sudo dscacheutil -flushcache
   
   # Windows
   ipconfig /flushdns
   ```
3. **Verify DNS at your registrar:**
   - A record for `@` → `216.198.79.1`
   - CNAME for `www` → `cname.vercel-dns.com` (or the Vercel-provided CNAME)
4. **Check Vercel Domains page** - it will show specific errors if DNS is wrong

---

## Quick Checklist

- [ ] Fixed Supabase Site URL to `https://www.bejimates.space` (complete URL)
- [ ] Added both redirect URLs in Supabase (`www` and root domain)
- [ ] Verified DNS A record points to `216.198.79.1`
- [ ] Added `NEXT_PUBLIC_SITE_URL=https://www.bejimates.space` in Vercel
- [ ] Redeployed Vercel after environment variable changes
- [ ] Verified email provider is enabled in Supabase
- [ ] Waited 5-10 minutes for changes to propagate
- [ ] Tested with a real email address
- [ ] Checked spam folder

---

## Most Important Fix

**The incomplete Site URL (`https://www.bejimate`) is likely preventing emails from being sent correctly. Fix this FIRST!**

After fixing the Site URL, wait a few minutes and try signing up again. The email should arrive within 1-2 minutes.

