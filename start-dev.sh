#!/bin/bash

# MainCourse Development Server Starter
# This script ensures a clean start every time

echo "🧹 Cleaning up old processes..."
pkill -9 -f "next dev" 2>/dev/null || true
lsof -ti:3000,3001,3002,3003 2>/dev/null | xargs kill -9 2>/dev/null || true
sleep 2

echo "📦 Checking node_modules..."
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

echo "🗑️  Clearing .next cache..."
# Handle .next cleanup robustly - don't let it hang
if [ -d ".next" ]; then
  # Try quick rename first (instant)
  mv .next .next.old.$$ 2>/dev/null && echo "   Moved old cache" || {
    # If rename fails, try delete with timeout
    ( rm -rf .next & ) && sleep 2 && echo "   Deleted cache"
  }
fi
# Clean up any old .next directories from previous runs
rm -rf .next.old.* ".next "* 2>/dev/null &

echo "🚀 Starting development server..."
npm run dev
