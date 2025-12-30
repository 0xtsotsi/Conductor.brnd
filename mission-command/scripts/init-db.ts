#!/usr/bin/env node
/**
 * Database Initialization Script for Mission Command Centre
 *
 * This script initializes all required database tables:
 * - Mastra core tables (threads, messages, resources, workflows, etc.)
 * - Mission Command tables (users, sessions, audit logs, refresh tokens)
 *
 * Usage:
 *   node scripts/init-db.ts
 *
 * Environment variables (from .env):
 *   DATABASE_URL - PostgreSQL connection string
 */

import { PostgresStore } from '@mastra/pg';
import { PgUserStorage } from '../src/server/user-storage.js';

async function main() {
  console.log('🚀 Initializing Mission Command Centre database...\n');

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

    // Initialize Mission Command user storage
    console.log('👥 Initializing Mission Command user storage...');
    const userStorage = new PgUserStorage({
      connectionString: databaseUrl,
    });

    await userStorage.init();
    console.log('✅ Mission Command tables created successfully\n');

    // Verify tables were created
    console.log('🔍 Verifying tables...');
    const tables = await userStorage.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    console.log(`✅ Found ${tables.length} tables in database:\n`);
    tables.forEach((row: any, index: number) => {
      console.log(`   ${index + 1}. ${row.table_name}`);
    });
    console.log();

    console.log('🎉 Database initialization completed successfully!\n');
    console.log('Next steps:');
    console.log('   1. Start the Mission Command server: pnpm start');
    console.log('   2. Access the application at: http://localhost:4111\n');

    process.exit(0);
  } catch (error: any) {
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
