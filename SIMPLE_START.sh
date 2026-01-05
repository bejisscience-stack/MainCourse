#!/bin/bash
# Ultra-simple server starter - no fancy cleanup that can hang

echo "🚀 Starting server..."

# Kill old processes quickly
pkill -9 -f "next dev" 2>/dev/null
sleep 1

# Start server
npm run dev
