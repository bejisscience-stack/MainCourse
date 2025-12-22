# Adding a Custom Domain to Vercel

This guide will walk you through adding your custom domain to your Vercel deployment.

## Prerequisites

- ✅ Your project must be deployed on Vercel first
- ✅ You need to own a domain name (purchased from a registrar like Namecheap, GoDaddy, Google Domains, etc.)

---

## Step-by-Step Instructions

### Method 1: Add Domain After Deployment (Recommended)

1. **Go to your Vercel project**
   - Navigate to [vercel.com/dashboard](https://vercel.com/dashboard)
   - Click on your project (e.g., "main-course")

2. **Open Settings**
   - Click on the **"Settings"** tab at the top
   - Click on **"Domains"** in the left sidebar

3. **Add your domain**
   - In the "Domains" section, you'll see an input field
   - Enter your domain (e.g., `example.com` or `www.example.com`)
   - Click **"Add"**

4. **Configure DNS Records**
   - Vercel will show you the DNS records you need to add
   - You'll see something like:
     ```
     Type: A
     Name: @
     Value: 76.76.21.21
     
     Type: CNAME
     Name: www
     Value: cname.vercel-dns.com
     ```

5. **Update DNS at your domain registrar**
   - Log into your domain registrar (where you bought the domain)
   - Go to DNS management settings
   - Add the DNS records Vercel provided
   - Save changes

6. **Wait for DNS propagation**
   - DNS changes can take 5 minutes to 48 hours (usually 1-2 hours)
   - Vercel will automatically detect when DNS is configured correctly
   - You'll see a green checkmark ✅ when it's ready

7. **Automatic SSL Certificate**
   - Vercel automatically provisions SSL certificates via Let's Encrypt
   - Your site will be accessible via HTTPS automatically
   - This usually happens within minutes after DNS is configured

---

## DNS Configuration Examples

### For Root Domain (example.com)

**Option A: A Record (Recommended)**
```
Type: A
Name: @ (or leave blank)
Value: 76.76.21.21
TTL: Auto (or 3600)
```

**Option B: CNAME Record (if your registrar supports it)**
```
Type: CNAME
Name: @ (or leave blank)
Value: cname.vercel-dns.com
TTL: Auto (or 3600)
```

### For WWW Subdomain (www.example.com)

```
Type: CNAME
Name: www
Value: cname.vercel-dns.com
TTL: Auto (or 3600)
```

### For Both Root and WWW

Add both records:
1. A record for `@` → `76.76.21.21`
2. CNAME record for `www` → `cname.vercel-dns.com`

---

## Popular Domain Registrar Instructions

### Namecheap

1. Log in to Namecheap
2. Go to **Domain List** → Click **"Manage"** next to your domain
3. Go to **"Advanced DNS"** tab
4. Add the DNS records Vercel provided
5. Click **"Save All Changes"**

### GoDaddy

1. Log in to GoDaddy
2. Go to **My Products** → Click **"DNS"** next to your domain
3. Scroll to **"Records"** section
4. Add the DNS records Vercel provided
5. Click **"Save"**

### Google Domains / Google Workspace

1. Log in to Google Domains
2. Click on your domain
3. Go to **"DNS"** section
4. Scroll to **"Custom resource records"**
5. Add the DNS records Vercel provided
6. Click **"Save"**

### Cloudflare

1. Log in to Cloudflare
2. Select your domain
3. Go to **"DNS"** section
4. Add the DNS records Vercel provided
5. Make sure proxy status is set to **"DNS only"** (gray cloud) initially
6. After DNS propagates, you can enable Cloudflare proxy if desired

### Domain.com

1. Log in to Domain.com
2. Go to **"My Domains"** → Click your domain
3. Go to **"DNS & Nameservers"** tab
4. Add the DNS records Vercel provided
5. Click **"Save DNS Changes"**

---

## Verifying DNS Configuration

### Check DNS Propagation

You can verify your DNS records are correct using these tools:

1. **Vercel Dashboard**
   - Check the Domains section - it will show status
   - Green checkmark = configured correctly
   - Red X = needs configuration

2. **Online DNS Checkers**
   - [whatsmydns.net](https://www.whatsmydns.net)
   - [dnschecker.org](https://dnschecker.org)
   - Enter your domain and check A/CNAME records

3. **Command Line**
   ```bash
   # Check A record
   dig example.com A
   
   # Check CNAME record
   dig www.example.com CNAME
   
   # Or use nslookup
   nslookup example.com
   ```

---

## Common Issues & Solutions

### Issue: "Invalid Configuration" Error

**Solution:**
- Double-check DNS records match exactly what Vercel shows
- Ensure TTL is set correctly
- Wait a few minutes for DNS to propagate

### Issue: Domain Not Resolving

**Solution:**
- Verify DNS records are saved at your registrar
- Check for typos in DNS values
- Clear your browser cache and DNS cache:
  ```bash
  # macOS/Linux
  sudo dscacheutil -flushcache
  
  # Windows
  ipconfig /flushdns
  ```

### Issue: SSL Certificate Not Issuing

**Solution:**
- Wait up to 24 hours (usually happens within minutes)
- Ensure DNS is fully propagated
- Check that your domain is correctly added in Vercel
- Try removing and re-adding the domain

### Issue: WWW Redirect Not Working

**Solution:**
- Make sure you've added both root domain and www subdomain
- Configure redirects in Vercel Settings → Domains
- Vercel can automatically redirect www to root or vice versa

---

## Redirecting WWW to Root (or Vice Versa)

Vercel can automatically handle redirects:

1. Go to **Settings** → **Domains**
2. Add both `example.com` and `www.example.com`
3. Click the **"..."** menu next to one domain
4. Select **"Set as Primary"** for the domain you want as main
5. Vercel will automatically redirect the other

---

## Multiple Domains

You can add multiple domains to the same project:

1. Go to **Settings** → **Domains**
2. Click **"Add"** for each domain
3. Configure DNS for each domain
4. All domains will point to the same deployment

---

## Subdomains

To add a subdomain (e.g., `app.example.com`):

1. Go to **Settings** → **Domains**
2. Enter `app.example.com`
3. Add a CNAME record at your registrar:
   ```
   Type: CNAME
   Name: app
   Value: cname.vercel-dns.com
   ```

---

## Domain Status Indicators

In Vercel's Domains section, you'll see:

- ✅ **Valid Configuration** - Domain is working correctly
- ⏳ **Pending** - Waiting for DNS propagation
- ❌ **Invalid Configuration** - DNS records need to be fixed
- 🔒 **SSL Pending** - SSL certificate is being issued

---

## Quick Checklist

- [ ] Domain purchased and active
- [ ] Project deployed on Vercel
- [ ] Domain added in Vercel Settings → Domains
- [ ] DNS records added at domain registrar
- [ ] DNS records match Vercel's requirements exactly
- [ ] Waited for DNS propagation (check with DNS checker)
- [ ] Verified domain shows ✅ in Vercel dashboard
- [ ] SSL certificate issued (automatic)
- [ ] Tested website loads on custom domain

---

## Need Help?

If you're stuck:
1. Check Vercel's official docs: [vercel.com/docs/concepts/projects/domains](https://vercel.com/docs/concepts/projects/domains)
2. Verify DNS records match exactly
3. Use DNS checker tools to verify propagation
4. Contact your domain registrar's support if DNS issues persist

---

## Pro Tips

1. **Use both root and www**: Add both `example.com` and `www.example.com` for maximum compatibility
2. **Set primary domain**: Choose one as primary and let Vercel handle redirects
3. **DNS propagation time**: Be patient - it can take up to 48 hours (but usually much faster)
4. **SSL is automatic**: Don't worry about SSL certificates - Vercel handles this automatically
5. **Test before going live**: Use Vercel's preview URLs to test everything before configuring DNS












