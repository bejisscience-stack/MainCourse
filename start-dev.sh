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

echo "🗑️  Clearing .next cache and corrupted files..."
rm -rf .next
# Also clean any macOS file system cruft
find . -name "._*" -delete 2>/dev/null || true
find . -name ".DS_Store" -delete 2>/dev/null || true

echo "🚀 Starting development server..."
npm run dev
