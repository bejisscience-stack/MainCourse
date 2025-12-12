#!/bin/bash

# Simple Migration Runner Script
# This script reads the combined migration file and provides instructions

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
MIGRATION_FILE="$PROJECT_DIR/supabase/migrations/run-all-migrations.sql"

echo "🚀 Database Migration Runner"
echo "=============================="
echo ""

if [ ! -f "$MIGRATION_FILE" ]; then
    echo "❌ Error: Migration file not found: $MIGRATION_FILE"
    exit 1
fi

echo "📄 Found migration file: $MIGRATION_FILE"
echo ""
echo "Choose an option:"
echo "1. Display SQL (copy and paste into Supabase SQL Editor)"
echo "2. Check if Supabase CLI is available"
echo "3. Exit"
echo ""
read -p "Enter choice [1-3]: " choice

case $choice in
    1)
        echo ""
        echo "─".repeat(80)
        cat "$MIGRATION_FILE"
        echo ""
        echo "─".repeat(80)
        echo ""
        echo "✅ Copy the SQL above and paste it into Supabase SQL Editor"
        ;;
    2)
        if command -v supabase &> /dev/null; then
            echo "✅ Supabase CLI is installed"
            echo ""
            read -p "Do you want to run migrations with Supabase CLI? (y/n): " run_cli
            if [ "$run_cli" = "y" ] || [ "$run_cli" = "Y" ]; then
                cd "$PROJECT_DIR"
                supabase db push
            fi
        else
            echo "❌ Supabase CLI is not installed"
            echo ""
            echo "Install it with:"
            echo "  npm install -g supabase"
            echo "  or"
            echo "  brew install supabase/tap/supabase"
        fi
        ;;
    3)
        echo "👋 Goodbye!"
        exit 0
        ;;
    *)
        echo "❌ Invalid choice"
        exit 1
        ;;
esac




