/**
 * Example E2E Test: Database Helpers
 *
 * Demonstrates how to use database helpers for test setup and verification.
 */

import { test, expect } from '../helpers';
import { Pool } from 'pg';
import {
  getTestDbConnection,
  createTestTables,
  seedTestUsers,
  cleanupTestUsers,
  resetTestDatabase,
  createTestSession,
  createTestRefreshToken,
  getUserByEmail,
  getUserByProvider,
  getUserSessions,
  invalidateUserSessions,
  createAuditLog,
  getAuditLogs,
} from '../utils/db-helpers';
import { assertAuditLogExists, assertAuditLogNotExists } from '../utils/assertions';

test.describe('Database Helpers Tests', () => {
  let pool: Pool;

  test.beforeAll(async () => {
    // Setup test database connection
    pool = await getTestDbConnection();

    // Create test tables
    await createTestTables(pool);
  });

  test.afterAll(async () => {
    // Cleanup
    await dropTestTables(pool);
    await closeTestDbConnection();
  });

  test.afterEach(async () => {
    // Reset database after each test
    await resetTestDatabase(pool);
  });

  test('should seed test users', async () => {
    const users = await seedTestUsers(pool);

    expect(users).toHaveLength(3);
    expect(users[0].email).toBe('admin@test.com');
    expect(users[1].email).toBe('operator@test.com');
    expect(users[2].email).toBe('viewer@test.com');
  });

  test('should get user by email', async () => {
    await seedTestUsers(pool);

    const user = await getUserByEmail(pool, 'admin@test.com');

    expect(user).not.toBeNull();
    expect(user?.email).toBe('admin@test.com');
    expect(user?.role).toBe('admin');
  });

  test('should get user by provider', async () => {
    await seedTestUsers(pool);

    const users = await seedTestUsers(pool);
    const adminUser = users.find(u => u.email === 'admin@test.com');

    expect(adminUser).toBeDefined();

    const user = await getUserByProvider(pool, adminUser!.sub, 'github');

    expect(user).not.toBeNull();
    expect(user?.email).toBe('admin@test.com');
  });

  test('should create test session', async () => {
    const users = await seedTestUsers(pool);
    const adminUser = users.find(u => u.email === 'admin@test.com');

    const session = await createTestSession(pool, adminUser!.id);

    expect(session).toBeDefined();
    expect(session.user_id).toBe(adminUser!.id);
    expect(session.expires_at).toBeInstanceOf(Date);
  });

  test('should get user sessions', async () => {
    const users = await seedTestUsers(pool);
    const adminUser = users.find(u => u.email === 'admin@test.com');

    // Create multiple sessions
    await createTestSession(pool, adminUser!.id);
    await createTestSession(pool, adminUser!.id);
    await createTestSession(pool, adminUser!.id);

    const { sessions, total } = await getUserSessions(pool, adminUser!.id);

    expect(total).toBe(3);
    expect(sessions).toHaveLength(3);
  });

  test('should invalidate user sessions', async () => {
    const users = await seedTestUsers(pool);
    const adminUser = users.find(u => u.email === 'admin@test.com');

    // Create sessions
    await createTestSession(pool, adminUser!.id);
    await createTestSession(pool, adminUser!.id);

    // Invalidate sessions
    const count = await invalidateUserSessions(pool, adminUser!.id);

    expect(count).toBe(2);

    // Verify sessions are gone
    const { sessions, total } = await getUserSessions(pool, adminUser!.id);

    expect(total).toBe(0);
    expect(sessions).toHaveLength(0);
  });

  test('should create refresh token', async () => {
    const users = await seedTestUsers(pool);
    const adminUser = users.find(u => u.email === 'admin@test.com');

    const refreshToken = await createTestRefreshToken(pool, adminUser!.id);

    expect(refreshToken).toBeDefined();
    expect(refreshToken.user_id).toBe(adminUser!.id);
    expect(refreshToken.family_id).toBeDefined();
  });

  test('should create audit log entry', async () => {
    const users = await seedTestUsers(pool);
    const adminUser = users.find(u => u.email === 'admin@test.com');

    const auditLog = await createAuditLog(pool, {
      user_id: adminUser!.id,
      action: 'user.login',
      resource: '/api/auth/login',
      details: {
        method: 'oauth',
        provider: 'github',
      },
      ip_address: '127.0.0.1',
    });

    expect(auditLog).toBeDefined();
    expect(auditLog.action).toBe('user.login');
    expect(auditLog.user_id).toBe(adminUser!.id);
  });

  test('should get audit logs for user', async () => {
    const users = await seedTestUsers(pool);
    const adminUser = users.find(u => u.email === 'admin@test.com');

    // Create audit logs
    await createAuditLog(pool, {
      user_id: adminUser!.id,
      action: 'user.login',
      resource: '/api/auth/login',
    });

    await createAuditLog(pool, {
      user_id: adminUser!.id,
      action: 'user.logout',
      resource: '/api/auth/logout',
    });

    const logs = await getAuditLogs(pool, adminUser!.id);

    expect(logs).toHaveLength(2);
    expect(logs[0].action).toBe('user.logout'); // Most recent first
    expect(logs[1].action).toBe('user.login');
  });

  test('should cleanup test users', async () => {
    await seedTestUsers(pool);

    // Verify users exist
    let user = await getUserByEmail(pool, 'admin@test.com');
    expect(user).not.toBeNull();

    // Cleanup
    await cleanupTestUsers(pool);

    // Verify users are gone
    user = await getUserByEmail(pool, 'admin@test.com');
    expect(user).toBeNull();
  });

  test('should reset database', async () => {
    await seedTestUsers(pool);

    const users = await seedTestUsers(pool);
    const adminUser = users.find(u => u.email === 'admin@test.com');

    // Create sessions and audit logs
    await createTestSession(pool, adminUser!.id);
    await createAuditLog(pool, {
      user_id: adminUser!.id,
      action: 'user.login',
    });

    // Reset database
    await resetTestDatabase(pool);

    // Verify everything is cleared
    const { sessions, total } = await getUserSessions(pool, adminUser!.id);
    expect(total).toBe(0);

    const logs = await getAuditLogs(pool, adminUser!.id);
    expect(logs).toHaveLength(0);
  });
});

test.describe('Audit Log Assertions', () => {
  let pool: Pool;

  test.beforeAll(async () => {
    pool = await getTestDbConnection();
    await createTestTables(pool);
  });

  test.afterAll(async () => {
    await dropTestTables(pool);
    await closeTestDbConnection();
  });

  test('should assert audit log exists', async () => {
    const users = await seedTestUsers(pool);
    const adminUser = users.find(u => u.email === 'admin@test.com');

    // Create audit log
    await createAuditLog(pool, {
      user_id: adminUser!.id,
      action: 'user.login',
      resource: '/api/auth/login',
    });

    // Assert it exists
    await assertAuditLogExists(pool, 'user.login', adminUser!.id, '/api/auth/login');
  });

  test('should assert audit log does not exist', async () => {
    const users = await seedTestUsers(pool);
    const adminUser = users.find(u => u.email === 'admin@test.com');

    // Assert log doesn't exist
    await assertAuditLogNotExists(pool, 'user.delete', adminUser!.id);
  });

  test('should wait for audit log to appear', async () => {
    const users = await seedTestUsers(pool);
    const adminUser = users.find(u => u.email === 'admin@test.com');

    // Create audit log asynchronously
    setTimeout(async () => {
      await createAuditLog(pool, {
        user_id: adminUser!.id,
        action: 'user.created',
        resource: '/api/users',
      });
    }, 1000);

    // Assert it appears (with timeout)
    await assertAuditLogExists(pool, 'user.created', adminUser!.id, '/api/users', 5000);
  });
});

test.describe('Transaction Tests', () => {
  let pool: Pool;

  test.beforeAll(async () => {
    pool = await getTestDbConnection();
    await createTestTables(pool);
  });

  test.afterAll(async () => {
    await dropTestTables(pool);
    await closeTestDbConnection();
  });

  test('should execute transaction successfully', async () => {
    const users = await seedTestUsers(pool);
    const adminUser = users.find(u => u.email === 'admin@test.com');

    await executeTransaction(pool, async (client) => {
      // Create session
      await client.query(
        'INSERT INTO mission_command_user_sessions (id, user_id, token_hash, expires_at, created_at) VALUES ($1, $2, $3, $4, $5)',
        [crypto.randomUUID(), adminUser!.id, 'hash123', new Date(), new Date()]
      );

      // Create audit log
      await client.query(
        'INSERT INTO mission_command_audit_log (id, user_id, action, created_at) VALUES ($1, $2, $3, $4)',
        [crypto.randomUUID(), adminUser!.id, 'user.login', new Date()]
      );
    });

    // Verify both operations succeeded
    const { sessions } = await getUserSessions(pool, adminUser!.id);
    expect(sessions).toHaveLength(1);

    const logs = await getAuditLogs(pool, adminUser!.id);
    expect(logs).toHaveLength(1);
  });

  test('should rollback transaction on error', async () => {
    const users = await seedTestUsers(pool);
    const adminUser = users.find(u => u.email === 'admin@test.com');

    // Get initial session count
    const initial = await getUserSessions(pool, adminUser!.id);

    // Try to execute transaction that fails
    await executeTransaction(pool, async (client) => {
      // Create session
      await client.query(
        'INSERT INTO mission_command_user_sessions (id, user_id, token_hash, expires_at, created_at) VALUES ($1, $2, $3, $4, $5)',
        [crypto.randomUUID(), adminUser!.id, 'hash456', new Date(), new Date()]
      );

      // Throw error to trigger rollback
      throw new Error('Intentional error');
    }).catch(() => {
      // Expected to fail
    });

    // Verify session was not created (rolled back)
    const final = await getUserSessions(pool, adminUser!.id);
    expect(final.total).toBe(initial.total);
  });
});
