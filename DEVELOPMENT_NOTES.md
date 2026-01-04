# Development Notes

## Common Issues and Solutions

### Issue: `npm run dev` hangs, fails to start, or shows module errors

**Root Causes (in order of likelihood):**

1. **Corrupted `node_modules`** (most common)
2. **Corrupted `.next` cache**
3. **Port conflicts**

**Solutions:**

#### Quick Fix (try first):
```bash
npm run dev:clean
```

#### If that doesn't work - Full Reinstall:
```bash
npm run fix
```

#### Manual troubleshooting:
```bash
# Step 1: Check for port conflicts
lsof -ti:3000 | xargs kill -9

# Step 2: Clear Next.js cache
rm -rf .next

# Step 3: If still failing, reinstall dependencies
rm -rf node_modules package-lock.json
npm cache clean --force
npm install

# Step 4: Start server
npm run dev
```

**Why `node_modules` gets corrupted:**
- Interrupted `npm install` (Ctrl+C during installation)
- File system errors or disk issues
- Network interruptions during package downloads
- Running multiple npm installs simultaneously
- macOS file system case-sensitivity issues

**Prevention:**
- Always let `npm install` complete fully
- Don't interrupt npm operations
- Use `npm ci` in production/CI environments
- Keep Node.js and npm updated

### Available Scripts

- `npm run dev` - Start development server
- `npm run dev:clean` - Clear .next cache and start dev server
- `npm run clean` - Remove all build artifacts (.next, out, dist)
- `npm run reinstall` - Complete dependency reinstall (fixes corrupted node_modules)
- `npm run fix` - Complete fix: reinstall dependencies + clear cache + start server
- `npm run build` - Create production build
- `npm run start` - Start production server

### Environment Variables

The project uses `.env.local` for environment configuration. Required variables:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

The Next.js dev server automatically loads these variables on startup.

## Troubleshooting Decision Tree

```
Server won't start?
│
├─→ Try: npm run dev:clean
│   ├─→ Works? ✓ Done!
│   └─→ Still fails?
│       │
│       ├─→ Try: npm run fix
│       │   ├─→ Works? ✓ Done!
│       │   └─→ Still fails?
│       │       │
│       │       └─→ Check:
│       │           1. Is port 3000 in use? (lsof -ti:3000)
│       │           2. Is Node.js working? (node --version)
│       │           3. Check disk space (df -h)
│       │           4. Review error messages carefully
```

## Performance Notes

- **First startup after install:** 5-10 seconds (normal)
- **Subsequent startups:** 1-3 seconds
- **First page compilation:** 20-40 seconds (normal for development)
- **Hot reload:** < 1 second

If you see significantly slower times, something is wrong.
