#!/usr/bin/env node
/**
 * Database Initialization Script for Mission Command Centre
 *
 * This script initializes all required database tables:
 * - Mastra core tables (threads, messages, resources, workflows, etc.)
 * - Mission Command tables (users, sessions, audit logs, refresh tokens)
 *
 * Usage:
 *   node scripts/init-db.mjs
 *
 * Environment variables (from .env):
 *   DATABASE_URL - PostgreSQL connection string
 */

import { PostgresStore } from '../../stores/pg/dist/index.js';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load environment variables from .env file
function loadEnv() {
  try {
    const envPath = join(__dirname, '..', '.env');
    const envContent = readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const [key, ...valueParts] = trimmed.split('=');
        const value = valueParts.join('=').trim();
        if (value && !process.env[key]) {
          process.env[key] = value;
        }
      }
    });
  } catch (error) {
    console.warn('Warning: Could not load .env file:', error.message);
  }
}

async function main() {
  console.log('🚀 Initializing Mission Command Centre database...\n');

  // Load environment variables
  loadEnv();

  // Get database URL from environment
  const databaseUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/mission_command';

  console.log('📡 Database URL:', databaseUrl.replace(/:[^:@]+@/, ':****@'), '\n');

  try {
    // Initialize Mastra PostgreSQL storage
    console.log('📦 Initializing Mastra PostgreSQL storage...');
    const mastraStorage = new PostgresStore({
      id: 'mission-command-mastra',
      connectionString: databaseUrl,
    });

    await mastraStorage.init();
    console.log('✅ Mastra core tables created successfully\n');

    // Now create Mission Command tables directly using SQL
    console.log('👥 Initializing Mission Command user tables...');

    // Get pg-promise from the stores/pg package's dependencies
    const pgPromiseModule = await import('../../node_modules/.pnpm/pg-promise@11.15.0_pg-query-stream@4.10.3_pg@8.16.3_/node_modules/pg-promise/lib/index.js');
    const pgInstance = pgPromiseModule.default();
    const db = pgInstance(databaseUrl);

    // Create users table
    await db.none(`
      CREATE TABLE IF NOT EXISTS mission_command_users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        sub TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        name TEXT,
        avatar_url TEXT,
        provider TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('admin', 'operator', 'viewer')),
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        UNIQUE(sub, provider)
      );
    `);

    // Create indexes for users table
    await db.none('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_sub_provider_pg ON mission_command_users(sub, provider);');
    await db.none('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_pg ON mission_command_users(email);');
    await db.none('CREATE INDEX IF NOT EXISTS idx_users_role_pg ON mission_command_users(role);');

    // Create user sessions table
    await db.none(`
      CREATE TABLE IF NOT EXISTS mission_command_user_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES mission_command_users(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        ip_address TEXT,
        user_agent TEXT
      );
    `);

    // Create indexes for sessions table
    await db.none('CREATE INDEX IF NOT EXISTS idx_sessions_user_id_pg ON mission_command_user_sessions(user_id);');
    await db.none('CREATE INDEX IF NOT EXISTS idx_sessions_expires_at_pg ON mission_command_user_sessions(expires_at);');
    await db.none('CREATE INDEX IF NOT EXISTS idx_sessions_token_hash_pg ON mission_command_user_sessions(token_hash);');

    // Create audit log table
    await db.none(`
      CREATE TABLE IF NOT EXISTS mission_command_audit_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES mission_command_users(id) ON DELETE SET NULL,
        action TEXT NOT NULL,
        resource TEXT,
        details JSONB,
        ip_address TEXT,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
    `);

    // Create indexes for audit log table
    await db.none('CREATE INDEX IF NOT EXISTS idx_audit_user_id_pg ON mission_command_audit_log(user_id);');
    await db.none('CREATE INDEX IF NOT EXISTS idx_audit_created_at_pg ON mission_command_audit_log(created_at);');
    await db.none('CREATE INDEX IF NOT EXISTS idx_audit_action_pg ON mission_command_audit_log(action);');

    // Create refresh tokens table
    await db.none(`
      CREATE TABLE IF NOT EXISTS mission_command_refresh_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES mission_command_users(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        ip_address TEXT,
        user_agent TEXT,
        family_id TEXT,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
    `);

    // Create indexes for refresh tokens table
    await db.none('CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id_pg ON mission_command_refresh_tokens(user_id);');
    await db.none('CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash_pg ON mission_command_refresh_tokens(token_hash);');
    await db.none('CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at_pg ON mission_command_refresh_tokens(expires_at);');
    await db.none('CREATE INDEX IF NOT EXISTS idx_refresh_tokens_family_id_pg ON mission_command_refresh_tokens(family_id);');

    console.log('✅ Mission Command tables created successfully\n');

    // Verify tables were created
    console.log('🔍 Verifying tables...');
    const tables = await db.any(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    console.log(`✅ Found ${tables.length} tables in database:\n`);
    tables.forEach((row, index) => {
      console.log(`   ${index + 1}. ${row.table_name}`);
    });
    console.log();

    console.log('🎉 Database initialization completed successfully!\n');
    console.log('Next steps:');
    console.log('   1. Start the Mission Command server: pnpm start');
    console.log('   2. Access the application at: http://localhost:4111\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    console.error(error);

    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Make sure PostgreSQL is running:');
      console.error('   docker ps | grep postgres');
      console.error('   docker compose up -d');
    }

    process.exit(1);
  }
}

// Run the script
main();
