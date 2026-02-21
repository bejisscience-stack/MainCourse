#!/usr/bin/env node

/**
 * Migration Runner Script
 * 
 * This script displays the combined migration SQL for easy copying.
 * 
 * Usage:
 *   node scripts/run-migrations.js
 *   npm run migrate
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');
const combinedFile = path.join(migrationsDir, 'run-all-migrations.sql');

function checkSupabaseCLI() {
  try {
    execSync('supabase --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function displaySQL() {
  if (!fs.existsSync(combinedFile)) {
    console.error('❌ Migration file not found:', combinedFile);
    process.exit(1);
  }

  const sql = fs.readFileSync(combinedFile, 'utf8');
  
  console.log('\n' + '═'.repeat(80));
  console.log('📋 DATABASE MIGRATION SQL');
  console.log('═'.repeat(80));
  console.log('\n' + sql);
  console.log('\n' + '═'.repeat(80));
  console.log('\n✅ Copy the SQL above and paste it into Supabase SQL Editor');
  console.log('   (Supabase Dashboard > SQL Editor > New Query)\n');
}

function runWithSupabaseCLI() {
  try {
    console.log('🚀 Running migrations with Supabase CLI...\n');
    
    // Check if we're in a linked project
    try {
      execSync('supabase status', { stdio: 'ignore' });
    } catch {
      console.log('⚠️  Project not linked. Attempting to use local migrations...');
    }
    
    // Try to push migrations
    execSync('supabase db push', { 
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit' 
    });
    
    console.log('\n✅ Migrations completed successfully!');
  } catch (error) {
    console.error('\n❌ Supabase CLI error occurred');
    console.error('💡 Make sure you have:');
    console.error('   1. Supabase CLI installed: npm install -g supabase');
    console.error('   2. Project linked: supabase link --project-ref your-ref');
    console.error('\n📝 Falling back to manual method...\n');
    displaySQL();
  }
}

function main() {
  console.log('🚀 Database Migration Runner\n');
  
  if (checkSupabaseCLI()) {
    console.log('✅ Supabase CLI detected\n');
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    readline.question('Do you want to run with Supabase CLI? (y/n, default: n): ', (answer) => {
      readline.close();
      if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
        runWithSupabaseCLI();
      } else {
        displaySQL();
      }
    });
  } else {
    console.log('ℹ️  Supabase CLI not found\n');
    displaySQL();
    console.log('\n💡 Tip: Install Supabase CLI for automated migrations:');
    console.log('   macOS: brew install supabase/tap/supabase');
    console.log('   See: https://github.com/supabase/cli#install-the-cli\n');
  }
}

main();

