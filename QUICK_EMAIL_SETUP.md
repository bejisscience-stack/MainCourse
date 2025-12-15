# Quick Email Verification Setup for Vercel Domain

Your domain: **`https://main-course-wbul.vercel.app`**

## 🚀 Quick Setup Steps

### Step 1: Add Environment Variables in Vercel

Go to your Vercel project → **Settings** → **Environment Variables** and add:

1. **`NEXT_PUBLIC_SUPABASE_URL`**
   - Value: `https://nbecbsbuerdtakxkrduw.supabase.co`

2. **`NEXT_PUBLIC_SUPABASE_ANON_KEY`**
   - Value: Get from Supabase Dashboard → Settings → API → anon/public key

3. **`NEXT_PUBLIC_SITE_URL`** ⭐ **IMPORTANT**
   - Value: `https://main-course-wbul.vercel.app`
   - This is critical for email verification!

**After adding, redeploy your app!**

---

### Step 2: Configure Supabase (5 minutes)

1. **Enable Email Confirmations:**
   - Go to [Supabase Dashboard](https://app.supabase.com)
   - **Authentication** → **Providers** → **Email**
   - ✅ **Enable "Confirm email"** (toggle it ON)

2. **Set Site URL:**
   - Go to **Authentication** → **URL Configuration**
   - **Site URL:** `https://main-course-wbul.vercel.app`

3. **Add Redirect URL:**
   - In the same **URL Configuration** page
   - **Redirect URLs:** Add `https://main-course-wbul.vercel.app/auth/callback`
   - Click **"Add URL"** and save

---

### Step 3: Test It!

1. Wait 2-3 minutes for changes to take effect
2. Go to: `https://main-course-wbul.vercel.app/signup`
3. Sign up with a real email address
4. Check your email inbox (and spam folder)
5. Click the verification link
6. You should be logged in! ✅

---

## ✅ Checklist

- [ ] Added `NEXT_PUBLIC_SITE_URL=https://main-course-wbul.vercel.app` in Vercel
- [ ] Added `NEXT_PUBLIC_SUPABASE_URL` in Vercel
- [ ] Added `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Vercel
- [ ] Redeployed Vercel app after adding variables
- [ ] Enabled "Confirm email" in Supabase
- [ ] Set Site URL in Supabase to `https://main-course-wbul.vercel.app`
- [ ] Added redirect URL `https://main-course-wbul.vercel.app/auth/callback` in Supabase
- [ ] Tested signup with real email

---

## 🔍 Troubleshooting

**Not receiving emails?**
- Check spam/junk folder
- Wait 5-10 minutes (Supabase may have rate limits)
- Check Supabase Dashboard → Logs → Auth Logs for errors
- Try a Gmail or Outlook email (they work best)

**Email link doesn't work?**
- Make sure Site URL in Supabase matches exactly: `https://main-course-wbul.vercel.app`
- Make sure redirect URL is: `https://main-course-wbul.vercel.app/auth/callback`
- Check that `NEXT_PUBLIC_SITE_URL` is set correctly in Vercel

---

That's it! Once you complete these steps, email verification will work! 🎉






