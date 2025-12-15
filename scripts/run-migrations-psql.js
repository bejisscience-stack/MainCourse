#!/usr/bin/env node

/**
 * Migration Runner using psql or Supabase connection string
 * 
 * This script can run migrations if you have a direct database connection.
 * 
 * Usage:
 *   node scripts/run-migrations-psql.js
 *   DATABASE_URL=postgresql://... node scripts/run-migrations-psql.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');

// Get database URL from environment
const DATABASE_URL = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

const migrationFiles = [
  '001_enable_extensions.sql',
  '002_create_profiles_table.sql',
  '003_create_profile_functions.sql',
  '004_create_updated_at_function.sql',
  '005_create_courses_table.sql',
  '006_create_courses_indexes.sql',
];

function runMigrations() {
  if (!DATABASE_URL) {
    console.error('❌ Error: DATABASE_URL not found in environment');
    console.error('\nSet it in .env.local:');
    console.error('DATABASE_URL=postgresql://postgres:[PASSWORD]@[HOST]:[PORT]/postgres');
    console.error('\nOr get it from Supabase Dashboard > Settings > Database > Connection string');
    process.exit(1);
  }

  console.log('🚀 Running database migrations...\n');

  // Check if psql is available
  try {
    execSync('psql --version', { stdio: 'ignore' });
  } catch (error) {
    console.error('❌ psql command not found');
    console.error('Install PostgreSQL client tools to use this script');
    console.error('\nAlternatively, use the Supabase SQL Editor or Supabase CLI');
    process.exit(1);
  }

  for (const file of migrationFiles) {
    const filePath = path.join(migrationsDir, file);
    
    if (!fs.existsSync(filePath)) {
      console.error(`❌ Migration file not found: ${file}`);
      process.exit(1);
    }

    try {
      console.log(`📄 Running: ${file}...`);
      execSync(`psql "${DATABASE_URL}" -f "${filePath}"`, { 
        stdio: 'inherit',
        env: { ...process.env, PGPASSWORD: DATABASE_URL.match(/:(.+?)@/)?.[1] || '' }
      });
      console.log(`✅ Completed: ${file}\n`);
    } catch (error) {
      console.error(`❌ Failed: ${file}`);
      process.exit(1);
    }
  }

  console.log('✅ All migrations completed successfully!');
}

runMigrations();







