# ⚠️ IMPORTANT: HOW TO START YOUR SERVER

## ✅ YOUR SERVER IS CURRENTLY RUNNING!

**Access it at: http://localhost:3000**

---

## 🚀 TO START THE SERVER (Choose One Method):

### Method 1: Direct Command (RECOMMENDED - Most Reliable)
```bash
npm run dev
```

**This is the simplest and most reliable way!**

### Method 2: If you need to kill old processes first
```bash
pkill -9 -f "next dev"
npm run dev
```

### Method 3: Use the simple script
```bash
./SIMPLE_START.sh
```

---

## 🛑 TO STOP THE SERVER

Press `Ctrl+C` in the terminal

---

## ⚠️ IF YOU GET "CORRUPTED PACKAGE" ERRORS

This means `node_modules` got corrupted. Here's the **FAST FIX**:

```bash
# 1. Move old node_modules (instant!)
mv node_modules node_modules.old

# 2. Fresh install (1-2 minutes)
npm install

# 3. Start server
npm run dev

# 4. (Optional) Delete old in background
rm -rf node_modules.old &
```

---

## 🔧 TROUBLESHOOTING

### Server won't start?
```bash
# Kill zombie processes
pkill -9 -f "next dev"

# Clear port
lsof -ti:3000 | xargs kill -9

# Try again
npm run dev
```

### Port 3000 in use?
The server will automatically try port 3001, 3002, etc.
Check the terminal output for which port it's using.

---

## 📝 CURRENT STATUS

✅ Dependencies: Installed (120 packages)
✅ Server: Running on port 3000
✅ URL: http://localhost:3000

---

## 💡 PRO TIP

**Keep it simple!** Just use:
```bash
npm run dev
```

The fancy cleanup scripts (`start-dev.sh`) were causing hangs. The direct command works best!

---

**That's it! Just run `npm run dev` every time.** 🎉
