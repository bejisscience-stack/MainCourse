# ✅ SOLUTION TO YOUR npm run dev ISSUE

## THE PROBLEM
Your issue had multiple layers:
1. **Corrupted node_modules** - Package files were invalid
2. **Zombie processes** - Multiple dev servers running on different ports simultaneously
3. **Missing .next build artifacts** - Next.js couldn't create required manifest files

## THE FIX

I've created a helper script that ensures a clean start every time.

### How to Start Your Dev Server (RECOMMENDED):

```bash
./start-dev.sh
```

This script automatically:
- Kills any zombie processes
- Frees up ports 3000-3003
- Clears the .next cache  
- Starts a fresh dev server

### Manual Method (if script doesn't work):

```bash
# Step 1: Kill all Next.js processes
pkill -9 -f "next dev"
lsof -ti:3000 | xargs kill -9

# Step 2: Clear cache
rm -rf .next

# Step 3: Start server
npm run dev
```

### If You Still Have Issues:

Run the complete fix:
```bash
npm run fix
```

This will:
1. Remove node_modules and package-lock.json
2. Clear npm cache
3. Reinstall all dependencies
4. Clear .next
5. Start the server

## IMPORTANT NOTES

- **Always use ./start-dev.sh** to start your server
- **Never interrupt npm install** with Ctrl+C
- **Deactivate conda** before running npm commands: `conda deactivate`
- If the server starts on port 3001 or 3002 instead of 3000, that means something is still using port 3000

## YOUR SERVER SHOULD BE AT:

http://localhost:3000

(Or http://localhost:3001 if port 3000 was busy)

## PREVENTION

To prevent this from happening again:
1. Always let npm install complete fully
2. Use `./start-dev.sh` instead of `npm run dev` directly
3. Don't run multiple terminal sessions with npm commands simultaneously
4. Keep your Node.js and npm updated

