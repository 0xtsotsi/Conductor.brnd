#!/usr/bin/env node
/**
 * Database Verification Script
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
  console.log('🔍 Verifying Mission Command Centre database...\n');

  loadEnv();

  const databaseUrl = process.env.DATABASE_URL || 'postgresql://unicorn_user:magical_password@localhost:5432/mission_command';

  console.log('📡 Database URL:', databaseUrl.replace(/:[^:@]+@/, ':****@'), '\n');

  try {
    // Test connection
    const pgp = await import('../../node_modules/.pnpm/pg-promise@11.15.0_pg-query-stream@4.10.3_pg@8.16.3_/node_modules/pg-promise/lib/index.js');
    const pgInstance = pgp.default();
    const db = pgInstance(databaseUrl);

    const result = await db.one('SELECT NOW() as server_time, current_database() as database, current_user as user');
    console.log('✅ Database connection successful!\n');
    console.log('   Server Time:', result.server_time);
    console.log('   Database:', result.database);
    console.log('   User:', result.user);
    console.log();

    // Count tables
    const tableCount = await db.one('SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = \'public\'');
    console.log('✅ Total tables:', tableCount.count);
    console.log();

    // Test Mission Command tables
    const mcTables = await db.any(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name LIKE 'mission_command_%'
      ORDER BY table_name
    `);

    console.log('✅ Mission Command tables (' + mcTables.length + '):');
    mcTables.forEach((row, index) => {
      console.log(`   ${index + 1}. ${row.table_name}`);
    });
    console.log();

    // Test Mastra tables
    const mastraTables = await db.any(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name LIKE 'mastra_%'
      ORDER BY table_name
    `);

    console.log('✅ Mastra tables (' + mastraTables.length + '):');
    mastraTables.forEach((row, index) => {
      console.log(`   ${index + 1}. ${row.table_name}`);
    });
    console.log();

    // Check indexes on users table
    const indexes = await db.any(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'mission_command_users'
      ORDER BY indexname
    `);

    console.log('✅ Indexes on mission_command_users (' + indexes.length + '):');
    indexes.forEach((row, index) => {
      console.log(`   ${index + 1}. ${row.indexname}`);
    });
    console.log();

    console.log('🎉 Database verification completed successfully!\n');
    console.log('The database is ready for use with Mission Command Centre.\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Database verification failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

main();
