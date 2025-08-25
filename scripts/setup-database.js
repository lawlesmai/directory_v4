#!/usr/bin/env node

/**
 * Database Setup Script for Lawless Directory
 * 
 * This script helps set up the Supabase database with all necessary
 * schemas, indexes, RLS policies, and seed data.
 * 
 * Usage:
 *   node scripts/setup-database.js
 *   npm run db:setup
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function execCommand(command, description) {
  try {
    log(`\n🔄 ${description}...`, 'yellow');
    const output = execSync(command, { stdio: 'pipe', encoding: 'utf8' });
    log(`✅ ${description} completed`, 'green');
    return output;
  } catch (error) {
    log(`❌ Error: ${description} failed`, 'red');
    log(error.message, 'red');
    throw error;
  }
}

function checkSupabaseInstalled() {
  try {
    execSync('npx supabase --version', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function checkEnvironmentFile() {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) {
    log('⚠️  .env.local file not found!', 'yellow');
    log('Please copy .env.example to .env.local and configure your Supabase credentials', 'yellow');
    return false;
  }
  return true;
}

async function main() {
  log('🚀 Setting up Lawless Directory Database', 'cyan');
  log('=' .repeat(50), 'cyan');

  // Check prerequisites
  if (!checkSupabaseInstalled()) {
    log('❌ Supabase CLI not found. Installing...', 'red');
    execCommand('npm install supabase --save-dev', 'Install Supabase CLI');
  }

  if (!checkEnvironmentFile()) {
    process.exit(1);
  }

  try {
    // Initialize Supabase (if not already initialized)
    log('🔧 Checking Supabase initialization...', 'blue');
    try {
      execSync('npx supabase status', { stdio: 'pipe' });
      log('✅ Supabase already initialized', 'green');
    } catch {
      log('🔄 Initializing Supabase...', 'yellow');
      execCommand('npx supabase init', 'Initialize Supabase project');
    }

    // Start Supabase local development
    log('🔄 Starting Supabase services...', 'blue');
    try {
      execCommand('npx supabase start', 'Start Supabase local services');
    } catch (error) {
      if (error.message.includes('already running')) {
        log('✅ Supabase services already running', 'green');
      } else {
        throw error;
      }
    }

    // Apply migrations
    log('🔄 Applying database migrations...', 'blue');
    execCommand('npx supabase db reset', 'Reset and apply migrations');

    // Generate TypeScript types
    log('🔄 Generating TypeScript types...', 'blue');
    execCommand('npm run supabase:types', 'Generate TypeScript types');

    // Show status
    log('\n📊 Database Status:', 'magenta');
    const status = execCommand('npx supabase status', 'Get Supabase status');
    console.log(status);

    log('\n🎉 Database setup completed successfully!', 'green');
    log('=' .repeat(50), 'green');
    
    log('\n📝 Next steps:', 'cyan');
    log('1. Update your .env.local with the local Supabase credentials shown above', 'white');
    log('2. Start your Next.js development server: npm run dev', 'white');
    log('3. Visit http://localhost:54323 for Supabase Studio', 'white');
    log('4. Visit http://localhost:3000 for your application', 'white');

    log('\n🔗 Useful commands:', 'cyan');
    log('• npm run supabase:start  - Start Supabase services', 'white');
    log('• npm run supabase:stop   - Stop Supabase services', 'white');
    log('• npm run supabase:reset  - Reset database with fresh data', 'white');
    log('• npm run supabase:types  - Regenerate TypeScript types', 'white');

  } catch (error) {
    log('\n💥 Setup failed!', 'red');
    log('Please check the error messages above and try again.', 'red');
    process.exit(1);
  }
}

// Run the setup
main().catch(console.error);