/**
 * Database Helpers for E2E Testing
 *
 * Provides helper functions for managing test database state.
 * Handles user seeding, cleanup, and session management.
 *
 * @packageDocumentation
 */

import { Pool, PoolClient, QueryResult } from 'pg';
import { createHash, randomBytes } from 'crypto';
import type { UserRole, OAuthProvider } from './oauth-mocks.js';

/**
 * Database configuration
 */
export interface DatabaseConfig {
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
}

/**
 * Test user data
 */
export interface TestUser {
  id: string;
  sub: string;
  email: string;
  name: string;
  avatar_url?: string;
  provider: OAuthProvider;
  role: UserRole;
  created_at: Date;
  updated_at: Date;
}

/**
 * Test session data
 */
export interface TestSession {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  created_at: Date;
  ip_address?: string;
  user_agent?: string;
}

/**
 * Test refresh token data
 */
export interface TestRefreshToken {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  ip_address?: string;
  user_agent?: string;
  family_id?: string;
  created_at: Date;
}

/**
 * Test audit log entry
 */
export interface TestAuditLog {
  id: string;
  user_id?: string;
  action: string;
  resource?: string;
  details?: Record<string, any>;
  ip_address?: string;
  created_at: Date;
}

/**
 * Default test users
 */
export const DEFAULT_TEST_USERS: Array<{
  email: string;
  name: string;
  role: UserRole;
  provider: OAuthProvider;
}> = [
  {
    email: 'admin@test.com',
    name: 'Admin User',
    role: 'admin',
    provider: 'github',
  },
  {
    email: 'operator@test.com',
    name: 'Operator User',
    role: 'operator',
    provider: 'github',
  },
  {
    email: 'viewer@test.com',
    name: 'Viewer User',
    role: 'viewer',
    provider: 'github',
  },
];

/**
 * Database connection pool (singleton)
 */
let pool: Pool | null = null;

/**
 * Get database connection pool
 *
 * @param config - Database configuration (optional)
 * @returns PostgreSQL pool
 *
 * @example
 * ```typescript
 * const pool = await getTestDbConnection();
 * ```
 */
export async function getTestDbConnection(config?: DatabaseConfig): Promise<Pool> {
  if (pool) {
    return pool;
  }

  const dbConfig: DatabaseConfig = config || {
    host: process.env.TEST_DB_HOST || 'localhost',
    port: parseInt(process.env.TEST_DB_PORT || '5432'),
    database: process.env.TEST_DB_NAME || 'mission_command_test',
    user: process.env.TEST_DB_USER || 'postgres',
    password: process.env.TEST_DB_PASSWORD || 'postgres',
  };

  pool = new Pool(dbConfig);

  // Test connection
  const client = await pool.connect();
  client.release();

  return pool;
}

/**
 * Close database connection pool
 *
 * @returns Promise that resolves when pool is closed
 *
 * @example
 * ```typescript
 * await closeTestDbConnection();
 * ```
 */
export async function closeTestDbConnection(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

/**
 * Create database tables for testing
 *
 * @param pool - Database pool
 * @returns Promise that resolves when tables are created
 *
 * @example
 * ```typescript
 * await createTestTables(pool);
 * ```
 */
export async function createTestTables(pool: Pool): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS mission_command_users (
        id TEXT PRIMARY KEY,
        sub TEXT NOT NULL,
        email TEXT NOT NULL,
        name TEXT,
        avatar_url TEXT,
        provider TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('admin', 'operator', 'viewer')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(sub, provider)
      );
    `);

    // Create sessions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS mission_command_user_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token_hash TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        ip_address TEXT,
        user_agent TEXT,
        FOREIGN KEY (user_id) REFERENCES mission_command_users(id) ON DELETE CASCADE
      );
    `);

    // Create refresh tokens table
    await client.query(`
      CREATE TABLE IF NOT EXISTS mission_command_refresh_tokens (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token_hash TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        ip_address TEXT,
        user_agent TEXT,
        family_id TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES mission_command_users(id) ON DELETE CASCADE
      );
    `);

    // Create audit log table
    await client.query(`
      CREATE TABLE IF NOT EXISTS mission_command_audit_log (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        action TEXT NOT NULL,
        resource TEXT,
        details TEXT,
        ip_address TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES mission_command_users(id) ON DELETE SET NULL
      );
    `);

    // Create indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_sub_provider
      ON mission_command_users(sub, provider);
      CREATE INDEX IF NOT EXISTS idx_users_email
      ON mission_command_users(email);
      CREATE INDEX IF NOT EXISTS idx_users_role
      ON mission_command_users(role);
    `);

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Drop database tables
 *
 * @param pool - Database pool
 * @returns Promise that resolves when tables are dropped
 *
 * @example
 * ```typescript
 * await dropTestTables(pool);
 * ```
 */
export async function dropTestTables(pool: Pool): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await client.query('DROP TABLE IF EXISTS mission_command_audit_log CASCADE');
    await client.query('DROP TABLE IF EXISTS mission_command_refresh_tokens CASCADE');
    await client.query('DROP TABLE IF EXISTS mission_command_user_sessions CASCADE');
    await client.query('DROP TABLE IF EXISTS mission_command_users CASCADE');

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Seed test users into database
 *
 * @param pool - Database pool
 * @param users - Array of user data (optional, uses defaults if not provided)
 * @returns Promise that resolves when users are seeded
 *
 * @example
 * ```typescript
 * await seedTestUsers(pool);
 * ```
 */
export async function seedTestUsers(
  pool: Pool,
  users: Array<{ email: string; name: string; role: UserRole; provider: OAuthProvider }> = DEFAULT_TEST_USERS
): Promise<TestUser[]> {
  const client = await pool.connect();
  const createdUsers: TestUser[] = [];

  try {
    await client.query('BEGIN');

    for (const userData of users) {
      const id = randomBytes(16).toString('hex');
      const sub = `${userData.provider}_${randomBytes(16).toString('hex')}`;
      const now = new Date();

      const result = await client.query<TestUser>(
        `INSERT INTO mission_command_users (id, sub, email, name, avatar_url, provider, role, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (sub, provider) DO UPDATE
         SET email = EXCLUDED.email, name = EXCLUDED.name, updated_at = EXCLUDED.updated_at
         RETURNING *`,
        [
          id,
          sub,
          userData.email,
          userData.name,
          null, // avatar_url
          userData.provider,
          userData.role,
          now.toISOString(),
          now.toISOString(),
        ]
      );

      createdUsers.push(result.rows[0]);
    }

    await client.query('COMMIT');
    return createdUsers;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Cleanup test users from database
 *
 * @param pool - Database pool
 * @param emails - Array of email addresses to delete (optional, deletes all test users if not provided)
 * @returns Promise that resolves when users are cleaned up
 *
 * @example
 * ```typescript
 * await cleanupTestUsers(pool);
 * ```
 */
export async function cleanupTestUsers(pool: Pool, emails?: string[]): Promise<void> {
  const client = await pool.connect();

  try {
    if (emails && emails.length > 0) {
      await client.query(
        'DELETE FROM mission_command_users WHERE email = ANY($1::text[])',
        [emails]
      );
    } else {
      // Delete all test users
      await client.query("DELETE FROM mission_command_users WHERE email LIKE '%@test.com'");
    }
  } finally {
    client.release();
  }
}

/**
 * Reset test database (clean all tables)
 *
 * @param pool - Database pool
 * @returns Promise that resolves when database is reset
 *
 * @example
 * ```typescript
 * await resetTestDatabase(pool);
 * ```
 */
export async function resetTestDatabase(pool: Pool): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Delete all audit logs
    await client.query('DELETE FROM mission_command_audit_log');

    // Delete all refresh tokens
    await client.query('DELETE FROM mission_command_refresh_tokens');

    // Delete all sessions
    await client.query('DELETE FROM mission_command_user_sessions');

    // Delete all users
    await client.query('DELETE FROM mission_command_users');

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Create a test session in database
 *
 * @param pool - Database pool
 * @param userId - User ID
 * @param expiresAt - Session expiration date (optional, defaults to 24 hours)
 * @returns Created session
 *
 * @example
 * ```typescript
 * const session = await createTestSession(pool, userId);
 * ```
 */
export async function createTestSession(
  pool: Pool,
  userId: string,
  expiresAt: Date = new Date(Date.now() + 24 * 60 * 60 * 1000)
): Promise<TestSession> {
  const client = await pool.connect();

  try {
    const id = randomBytes(16).toString('hex');
    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const now = new Date();

    const result = await client.query<TestSession>(
      `INSERT INTO mission_command_user_sessions (id, user_id, token_hash, expires_at, created_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [id, userId, tokenHash, expiresAt.toISOString(), now.toISOString()]
    );

    return result.rows[0];
  } finally {
    client.release();
  }
}

/**
 * Create a test refresh token in database
 *
 * @param pool - Database pool
 * @param userId - User ID
 * @param expiresAt - Token expiration date (optional, defaults to 30 days)
 * @returns Created refresh token
 *
 * @example
 * ```typescript
 * const refreshToken = await createTestRefreshToken(pool, userId);
 * ```
 */
export async function createTestRefreshToken(
  pool: Pool,
  userId: string,
  expiresAt: Date = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
): Promise<TestRefreshToken> {
  const client = await pool.connect();

  try {
    const id = randomBytes(16).toString('hex');
    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const familyId = randomBytes(16).toString('hex');
    const now = new Date();

    const result = await client.query<TestRefreshToken>(
      `INSERT INTO mission_command_refresh_tokens (id, user_id, token_hash, expires_at, family_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [id, userId, tokenHash, expiresAt.toISOString(), familyId, now.toISOString()]
    );

    return result.rows[0];
  } finally {
    client.release();
  }
}

/**
 * Get user by email
 *
 * @param pool - Database pool
 * @param email - User email
 * @returns User or null
 *
 * @example
 * ```typescript
 * const user = await getUserByEmail(pool, 'admin@test.com');
 * ```
 */
export async function getUserByEmail(pool: Pool, email: string): Promise<TestUser | null> {
  const client = await pool.connect();

  try {
    const result = await client.query<TestUser>(
      'SELECT * FROM mission_command_users WHERE email = $1',
      [email]
    );

    return result.rows[0] || null;
  } finally {
    client.release();
  }
}

/**
 * Get user by provider ID
 *
 * @param pool - Database pool
 * @param sub - Provider user ID
 * @param provider - OAuth provider
 * @returns User or null
 *
 * @example
 * ```typescript
 * const user = await getUserByProvider(pool, 'github_123', 'github');
 * ```
 */
export async function getUserByProvider(
  pool: Pool,
  sub: string,
  provider: OAuthProvider
): Promise<TestUser | null> {
  const client = await pool.connect();

  try {
    const result = await client.query<TestUser>(
      'SELECT * FROM mission_command_users WHERE sub = $1 AND provider = $2',
      [sub, provider]
    );

    return result.rows[0] || null;
  } finally {
    client.release();
  }
}

/**
 * Get user sessions
 *
 * @param pool - Database pool
 * @param userId - User ID
 * @param limit - Maximum sessions (default: 50)
 * @param offset - Pagination offset (default: 0)
 * @returns Sessions and total count
 *
 * @example
 * ```typescript
 * const { sessions, total } = await getUserSessions(pool, userId);
 * ```
 */
export async function getUserSessions(
  pool: Pool,
  userId: string,
  limit: number = 50,
  offset: number = 0
): Promise<{ sessions: TestSession[]; total: number }> {
  const client = await pool.connect();

  try {
    // Get total count
    const countResult = await client.query(
      'SELECT COUNT(*) as count FROM mission_command_user_sessions WHERE user_id = $1',
      [userId]
    );
    const total = parseInt(countResult.rows[0].count);

    // Get sessions
    const result = await client.query<TestSession>(
      `SELECT * FROM mission_command_user_sessions
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return {
      sessions: result.rows,
      total,
    };
  } finally {
    client.release();
  }
}

/**
 * Invalidate all user sessions
 *
 * @param pool - Database pool
 * @param userId - User ID
 * @returns Number of sessions invalidated
 *
 * @example
 * ```typescript
 * const count = await invalidateUserSessions(pool, userId);
 * ```
 */
export async function invalidateUserSessions(pool: Pool, userId: string): Promise<number> {
  const client = await pool.connect();

  try {
    const result = await client.query(
      'DELETE FROM mission_command_user_sessions WHERE user_id = $1 RETURNING id',
      [userId]
    );

    return result.rowCount || 0;
  } finally {
    client.release();
  }
}

/**
 * Create audit log entry
 *
 * @param pool - Database pool
 * @param entry - Audit log entry
 * @returns Created audit log
 *
 * @example
 * ```typescript
 * await createAuditLog(pool, {
 *   userId: 'user123',
 *   action: 'user.login',
 *   resource: '/api/auth/login',
 * });
 * ```
 */
export async function createAuditLog(
  pool: Pool,
  entry: Omit<TestAuditLog, 'id' | 'created_at'>
): Promise<TestAuditLog> {
  const client = await pool.connect();

  try {
    const id = randomBytes(16).toString('hex');
    const now = new Date();

    const result = await client.query<TestAuditLog>(
      `INSERT INTO mission_command_audit_log (id, user_id, action, resource, details, ip_address, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        id,
        entry.user_id || null,
        entry.action,
        entry.resource || null,
        entry.details ? JSON.stringify(entry.details) : null,
        entry.ip_address || null,
        now.toISOString(),
      ]
    );

    return result.rows[0];
  } finally {
    client.release();
  }
}

/**
 * Get audit logs for a user
 *
 * @param pool - Database pool
 * @param userId - User ID
 * @param limit - Maximum logs (default: 100)
 * @param offset - Pagination offset (default: 0)
 * @returns Audit logs
 *
 * @example
 * ```typescript
 * const logs = await getAuditLogs(pool, userId);
 * ```
 */
export async function getAuditLogs(
  pool: Pool,
  userId: string,
  limit: number = 100,
  offset: number = 0
): Promise<TestAuditLog[]> {
  const client = await pool.connect();

  try {
    const result = await client.query<TestAuditLog>(
      `SELECT * FROM mission_command_audit_log
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return result.rows.map(row => ({
      ...row,
      details: row.details ? JSON.parse(row.details) : undefined,
    }));
  } finally {
    client.release();
  }
}

/**
 * Execute a raw SQL query
 *
 * @param pool - Database pool
 * @param query - SQL query
 * @param params - Query parameters
 * @returns Query result
 *
 * @example
 * ```typescript
 * const result = await executeQuery(pool, 'SELECT * FROM mission_command_users WHERE role = $1', ['admin']);
 * ```
 */
export async function executeQuery<T = any>(
  pool: Pool,
  query: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const client = await pool.connect();

  try {
    return await client.query<T>(query, params);
  } finally {
    client.release();
  }
}

/**
 * Execute a transaction
 *
 * @param pool - Database pool
 * @param callback - Transaction callback
 * @returns Result from callback
 *
 * @example
 * ```typescript
 * await executeTransaction(pool, async (client) => {
 *   await client.query('INSERT INTO ...');
 *   await client.query('UPDATE ...');
 * });
 * ```
 */
export async function executeTransaction<T>(
  pool: Pool,
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
