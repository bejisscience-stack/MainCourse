# Troubleshooting Email Verification - Step by Step

If you're not receiving email notifications, follow these steps **in order**:

## 🔍 Step 1: Verify Supabase Email Settings

### Check if Email Confirmations are Enabled

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Navigate to **Authentication** → **Providers**
4. Click on **Email** provider
5. **CRITICAL:** Make sure **"Confirm email"** is **ENABLED** (toggle should be ON)
   - If it's OFF, turn it ON and save
   - This is the #1 reason emails don't send!

### Verify Site URL

1. Go to **Authentication** → **URL Configuration**
2. **Site URL** should be: `https://main-course-wbul.vercel.app`
3. **Redirect URLs** should include: `https://main-course-wbul.vercel.app/auth/callback`

---

## 🔍 Step 2: Check Supabase Logs

This will tell you if emails are actually being sent:

1. Go to Supabase Dashboard → **Logs** → **Auth Logs**
2. Look for entries when you sign up
3. Check for errors like:
   - "Rate limit exceeded"
   - "SMTP error"
   - "Email sending failed"

**What to look for:**
- ✅ If you see "Email sent successfully" → Email is being sent, check spam folder
- ❌ If you see errors → Follow the error message to fix it

---

## 🔍 Step 3: Check Email Provider Issues

### Supabase Default Email Service (Free Tier)

Supabase's default email service has **strict rate limits**:
- **30 emails per hour** on free tier
- Emails may be delayed
- Some email providers may mark them as spam

### Common Issues:

1. **Rate Limiting:**
   - If you've sent many test emails, wait 1 hour
   - Check Supabase logs for "rate limit" errors

2. **Spam Folder:**
   - Check spam/junk folder
   - Mark as "Not Spam" if found
   - Add Supabase sender to contacts

3. **Email Provider Blocking:**
   - Some email providers (corporate emails, some ISPs) block automated emails
   - Try with Gmail, Outlook, or Yahoo instead

---

## 🔍 Step 4: Verify Vercel Environment Variables

1. Go to Vercel Dashboard → Your Project → **Settings** → **Environment Variables**
2. Verify these are set correctly:
   - `NEXT_PUBLIC_SITE_URL` = `https://main-course-wbul.vercel.app`
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://nbecbsbuerdtakxkrduw.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = (your key)

3. **Redeploy** after checking/updating variables

---

## 🔍 Step 5: Test with Browser Console

1. Go to your signup page: `https://main-course-wbul.vercel.app/signup`
2. Open browser DevTools (F12)
3. Go to **Console** tab
4. Sign up with a test email
5. Look for console logs:
   - `Signup redirect URL:` - Should show your Vercel URL
   - `Signup response:` - Shows if email confirmation is needed
   - Any error messages

---

## 🔍 Step 6: Check Email Template

1. Go to Supabase Dashboard → **Authentication** → **Email Templates**
2. Click on **"Confirm signup"** template
3. Verify it contains:
   - `{{ .ConfirmationURL }}` or `{{ .SiteURL }}`
   - The default template should work, but check if it's been modified

---

## 🔍 Step 7: Configure Custom SMTP (Recommended for Production)

Supabase's default email service is limited. For reliable email delivery, configure custom SMTP:

### Option A: SendGrid (Recommended)

1. Sign up for [SendGrid](https://sendgrid.com) (free tier: 100 emails/day)
2. Create an API key
3. In Supabase Dashboard → **Authentication** → **Providers** → **Email**
4. Scroll to **SMTP Settings**
5. Configure:
   - **SMTP Host:** `smtp.sendgrid.net`
   - **SMTP Port:** `587`
   - **SMTP User:** `apikey`
   - **SMTP Password:** Your SendGrid API key
   - **Sender email:** Your verified sender email
   - **Sender name:** Your app name

### Option B: Gmail (Testing Only)

⚠️ **Not recommended for production** - Use only for testing

1. Enable "Less secure app access" or use App Password
2. Configure SMTP:
   - **SMTP Host:** `smtp.gmail.com`
   - **SMTP Port:** `587`
   - **SMTP User:** Your Gmail address
   - **SMTP Password:** App password (not regular password)

### Option C: Mailgun

1. Sign up for [Mailgun](https://www.mailgun.com) (free tier available)
2. Get SMTP credentials
3. Configure in Supabase SMTP settings

---

## 🔍 Step 8: Manual Email Resend

If email wasn't received, you can resend it:

1. Go to Supabase Dashboard → **Authentication** → **Users**
2. Find the user by email
3. Click on the user
4. Click **"Resend confirmation email"**

Or use the "Resend" button on the signup success page.

---

## 🔍 Step 9: Verify User Was Created

1. Go to Supabase Dashboard → **Authentication** → **Users**
2. Search for the email you used to sign up
3. Check:
   - ✅ User exists → Account was created
   - ✅ `email_confirmed_at` is NULL → Email not confirmed (expected)
   - ✅ `confirmation_sent_at` has a timestamp → Email was sent

---

## ✅ Quick Diagnostic Checklist

Run through this checklist:

- [ ] "Confirm email" is **ENABLED** in Supabase → Authentication → Providers → Email
- [ ] Site URL in Supabase is `https://main-course-wbul.vercel.app`
- [ ] Redirect URL `https://main-course-wbul.vercel.app/auth/callback` is added
- [ ] `NEXT_PUBLIC_SITE_URL` is set in Vercel environment variables
- [ ] Checked Supabase Auth Logs for errors
- [ ] Checked spam/junk folder
- [ ] Tried with Gmail or Outlook email (not corporate email)
- [ ] Waited 5-10 minutes after signup
- [ ] Not hit rate limit (30 emails/hour on free tier)
- [ ] User appears in Supabase → Authentication → Users

---

## 🚨 Most Common Issues & Solutions

### Issue 1: "Confirm email" is disabled
**Solution:** Enable it in Supabase → Authentication → Providers → Email

### Issue 2: Rate limit exceeded
**Solution:** Wait 1 hour or configure custom SMTP

### Issue 3: Email in spam folder
**Solution:** Check spam folder, mark as not spam, add sender to contacts

### Issue 4: Wrong Site URL
**Solution:** Set Site URL to `https://main-course-wbul.vercel.app` in Supabase

### Issue 5: Missing redirect URL
**Solution:** Add `https://main-course-wbul.vercel.app/auth/callback` in Supabase redirect URLs

### Issue 6: Corporate email blocking
**Solution:** Use Gmail, Outlook, or Yahoo for testing

---

## 📞 Still Not Working?

If you've tried everything above:

1. **Check Supabase Status:** https://status.supabase.com
2. **Check Supabase Logs:** Dashboard → Logs → Auth Logs (look for specific errors)
3. **Try a different email provider:** Gmail usually works best
4. **Configure custom SMTP:** This is the most reliable solution for production

---

## 💡 Pro Tip

For production use, **always configure custom SMTP**. Supabase's default email service is fine for development, but custom SMTP (like SendGrid) gives you:
- ✅ Better deliverability
- ✅ Higher rate limits
- ✅ Email analytics
- ✅ More control

The free tier of SendGrid (100 emails/day) is usually enough for most small applications.




