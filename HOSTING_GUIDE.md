# Hosting Guide for Course Website

This guide will help you deploy your Next.js course website to various hosting platforms.

## Prerequisites

Before hosting, make sure you have:
- ✅ Your Supabase project set up and running
- ✅ Database migrations applied
- ✅ Environment variables ready

## Option 1: Vercel (Recommended for Next.js) ⚡

Vercel is the easiest and most optimized platform for Next.js applications.

### Steps:

1. **Create a Vercel account**
   - Go to [vercel.com](https://vercel.com)
   - Sign up with GitHub, GitLab, or Bitbucket

2. **Connect your repository**
   - Click "New Project"
   - Import your Git repository
   - Vercel will auto-detect Next.js

3. **Configure environment variables**
   - In project settings, go to "Environment Variables"
   - Add these variables:
     ```
     NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
     NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
     ```
   - Make sure to add them for Production, Preview, and Development environments

4. **Deploy**
   - Click "Deploy"
   - Your site will be live in minutes!

5. **Custom domain (optional)**
   - After deployment, go to Settings → Domains
   - Add your custom domain (e.g., `example.com`)
   - Vercel will show you DNS records to add
   - Add those records at your domain registrar
   - Wait for DNS propagation (usually 1-2 hours)
   - Vercel automatically provisions SSL certificates
   - 📖 **See `CUSTOM_DOMAIN_GUIDE.md` for detailed instructions**

### Benefits:
- ✅ Zero configuration needed
- ✅ Automatic HTTPS
- ✅ Global CDN
- ✅ Preview deployments for every PR
- ✅ Free tier available

---

## Option 2: Netlify 🌐

Another excellent option for Next.js applications.

### Steps:

1. **Create a Netlify account**
   - Go to [netlify.com](https://netlify.com)
   - Sign up with GitHub

2. **Deploy via Git**
   - Click "New site from Git"
   - Connect your repository
   - Configure build settings:
     - **Build command:** `npm run build`
     - **Publish directory:** `.next`
     - **Node version:** 18.x or higher

3. **Add environment variables**
   - Go to Site settings → Environment variables
   - Add:
     ```
     NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
     NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
     ```

4. **Deploy**
   - Click "Deploy site"
   - Your site will be live!

### Benefits:
- ✅ Easy Git integration
- ✅ Free tier available
- ✅ Form handling
- ✅ Serverless functions support

---

## Option 3: Railway 🚂

Great for full-stack applications with more control.

### Steps:

1. **Create a Railway account**
   - Go to [railway.app](https://railway.app)
   - Sign up with GitHub

2. **Create a new project**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your repository

3. **Configure the service**
   - Railway will auto-detect Next.js
   - Add environment variables:
     ```
     NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
     NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
     ```

4. **Deploy**
   - Railway will automatically build and deploy
   - Get your live URL

### Benefits:
- ✅ Simple deployment
- ✅ Database support
- ✅ Free tier with $5 credit monthly

---

## Option 4: Render 🎨

Modern platform with good Next.js support.

### Steps:

1. **Create a Render account**
   - Go to [render.com](https://render.com)
   - Sign up with GitHub

2. **Create a new Web Service**
   - Click "New" → "Web Service"
   - Connect your repository

3. **Configure settings**
   - **Name:** course-website (or your choice)
   - **Environment:** Node
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Node Version:** 18 or higher

4. **Add environment variables**
   - In the Environment section, add:
     ```
     NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
     NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
     ```

5. **Deploy**
   - Click "Create Web Service"
   - Wait for deployment to complete

### Benefits:
- ✅ Free tier available
- ✅ Automatic SSL
- ✅ Auto-deploy from Git

---

## Option 5: Traditional VPS (DigitalOcean, AWS, etc.) 🖥️

For more control and custom configurations.

### Steps:

1. **Set up a VPS**
   - Create a droplet/server (Ubuntu 22.04 recommended)
   - SSH into your server

2. **Install Node.js**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

3. **Install PM2 (Process Manager)**
   ```bash
   sudo npm install -g pm2
   ```

4. **Clone your repository**
   ```bash
   git clone your-repo-url
   cd CouseWebsite
   ```

5. **Install dependencies and build**
   ```bash
   npm install
   npm run build
   ```

6. **Set environment variables**
   ```bash
   nano .env.local
   # Add your Supabase variables
   ```

7. **Start with PM2**
   ```bash
   pm2 start npm --name "course-website" -- start
   pm2 save
   pm2 startup
   ```

8. **Set up Nginx reverse proxy**
   ```bash
   sudo apt install nginx
   # Configure Nginx to proxy to localhost:3000
   ```

9. **Set up SSL with Let's Encrypt**
   ```bash
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d yourdomain.com
   ```

### Benefits:
- ✅ Full control
- ✅ Can host multiple projects
- ✅ More cost-effective at scale

---

## Environment Variables Setup

Regardless of which platform you choose, you'll need these environment variables:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
NEXT_PUBLIC_SITE_URL=https://yourdomain.com  # Your production URL (required for email verification)
```

**Where to find these:**
1. Go to your Supabase project dashboard
2. Navigate to Settings → API
3. Copy the "Project URL" and "anon public" key
4. Set `NEXT_PUBLIC_SITE_URL` to your production URL (e.g., `https://your-project.vercel.app` or your custom domain)

**Important:** The `NEXT_PUBLIC_SITE_URL` is used for email verification redirects. Without it, users will be redirected to localhost after clicking verification links.

---

## Post-Deployment Checklist

After deploying, make sure to:

- [ ] Test all pages and functionality
- [ ] Verify Supabase connection is working
- [ ] Check that database migrations are applied
- [ ] Test authentication flows
- [ ] **Configure email verification redirects** (see `SUPABASE_REDIRECT_SETUP.md`)
  - Add `NEXT_PUBLIC_SITE_URL` environment variable in Vercel
  - Add redirect URLs in Supabase dashboard
- [ ] Verify file uploads (if using Supabase Storage)
- [ ] Set up custom domain (optional)
- [ ] Configure CORS in Supabase if needed
- [ ] Set up monitoring/analytics (optional)

---

## Troubleshooting

### Build fails
- Check Node.js version (needs 18+)
- Verify all dependencies are in package.json
- Check build logs for specific errors

### Environment variables not working
- Make sure variables start with `NEXT_PUBLIC_` for client-side access
- Restart deployment after adding variables
- Check variable names match exactly

### Database connection issues
- Verify Supabase URL and keys are correct
- Check Supabase project is active
- Ensure RLS policies allow access

### 404 errors on routes
- Verify Next.js routing is configured correctly
- Check that all pages are in the `app/` directory
- Ensure build completed successfully

---

## Recommended: Vercel

For this Next.js application, **Vercel is the recommended choice** because:
- Built by the creators of Next.js
- Zero configuration needed
- Best performance optimizations
- Free tier is generous
- Easiest deployment process

---

## Need Help?

If you encounter issues:
1. Check the platform's documentation
2. Review build logs
3. Verify environment variables
4. Test locally first with `npm run build && npm start`





