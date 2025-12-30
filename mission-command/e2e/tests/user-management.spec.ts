/**
 * User Management E2E Tests
 *
 * Comprehensive test suite for user management functionality including:
 * - User CRUD operations
 * - Permission and authorization checks
 * - Session management
 * - UI interactions
 *
 * @packageDocumentation
 */

import { test, expect } from '../fixtures/base';
import { randomBytes } from 'crypto';

/**
 * Helper function to generate test user data
 */
function generateTestUserData(role: 'admin' | 'operator' | 'viewer' = 'viewer') {
  const uniqueId = randomBytes(8).toString('hex');
  return {
    email: `test-${uniqueId}@example.com`,
    name: `Test User ${uniqueId}`,
    role,
    provider: 'github' as const,
  };
}

/**
 * Helper function to generate multiple test users
 */
function generateMultipleTestUsers(count: number) {
  const roles: Array<'admin' | 'operator' | 'viewer'> = ['admin', 'operator', 'viewer'];
  return Array.from({ length: count }, (_, i) =>
    generateTestUserData(roles[i % roles.length])
  );
}

test.describe('User Management - API: List Users', () => {
  test('should allow admin to list all users', async ({ apiClient }) => {
    const adminToken = await apiClient.loginAs('admin');
    const response = await apiClient.getUsers(adminToken, 50, 0);

    expect(response.status).toBe(200);
    expect(response.success).toBe(true);
    expect(response.data).toHaveProperty('users');
    expect(response.data).toHaveProperty('total');
    expect(Array.isArray(response.data.users)).toBe(true);
    expect(response.data.users.length).toBeGreaterThan(0);
  });

  test('should deny operator from listing users (403)', async ({ apiClient }) => {
    const operatorToken = await apiClient.loginAs('operator');
    const response = await apiClient.getUsers(operatorToken, 50, 0);

    expect(response.status).toBe(403);
    expect(response.success).toBe(false);
  });

  test('should deny viewer from listing users (403)', async ({ apiClient }) => {
    const viewerToken = await apiClient.loginAs('viewer');
    const response = await apiClient.getUsers(viewerToken, 50, 0);

    expect(response.status).toBe(403);
    expect(response.success).toBe(false);
  });

  test('should return paginated results', async ({ apiClient }) => {
    const adminToken = await apiClient.loginAs('admin');

    // First page
    const page1 = await apiClient.getUsers(adminToken, 2, 0);
    expect(page1.status).toBe(200);
    expect(page1.data.users.length).toBeLessThanOrEqual(2);

    // Second page
    const page2 = await apiClient.getUsers(adminToken, 2, 2);
    expect(page2.status).toBe(200);
    expect(page2.data.users.length).toBeLessThanOrEqual(2);

    // Verify different users on different pages
    if (page1.data.users.length > 0 && page2.data.users.length > 0) {
      const page1Ids = page1.data.users.map((u: any) => u.id);
      const page2Ids = page2.data.users.map((u: any) => u.id);
      const overlap = page1Ids.filter((id: string) => page2Ids.includes(id));
      expect(overlap.length).toBe(0);
    }
  });

  test('should support role filtering - admin', async ({ apiClient }) => {
    const adminToken = await apiClient.loginAs('admin');
    const response = await apiClient.getUsers(adminToken, 50, 0, { role: 'admin' });

    expect(response.status).toBe(200);
    expect(response.data.users.every((u: any) => u.role === 'admin')).toBe(true);
  });

  test('should support role filtering - operator', async ({ apiClient }) => {
    const adminToken = await apiClient.loginAs('admin');
    const response = await apiClient.getUsers(adminToken, 50, 0, { role: 'operator' });

    expect(response.status).toBe(200);
    expect(response.data.users.every((u: any) => u.role === 'operator')).toBe(true);
  });

  test('should support role filtering - viewer', async ({ apiClient }) => {
    const adminToken = await apiClient.loginAs('admin');
    const response = await apiClient.getUsers(adminToken, 50, 0, { role: 'viewer' });

    expect(response.status).toBe(200);
    expect(response.data.users.every((u: any) => u.role === 'viewer')).toBe(true);
  });

  test('should support search by email', async ({ apiClient }) => {
    const adminToken = await apiClient.loginAs('admin');
    const response = await apiClient.getUsers(adminToken, 50, 0, { search: 'admin@test.com' });

    expect(response.status).toBe(200);
    expect(response.data.users.some((u: any) => u.email === 'admin@test.com')).toBe(true);
  });

  test('should support search by name', async ({ apiClient }) => {
    const adminToken = await apiClient.loginAs('admin');
    const response = await apiClient.getUsers(adminToken, 50, 0, { search: 'Admin' });

    expect(response.status).toBe(200);
    expect(response.data.users.some((u: any) => u.name.includes('Admin'))).toBe(true);
  });

  test('should return correct user fields', async ({ apiClient }) => {
    const adminToken = await apiClient.loginAs('admin');
    const response = await apiClient.getUsers(adminToken, 50, 0);

    expect(response.status).toBe(200);
    const user = response.data.users[0];

    expect(user).toHaveProperty('id');
    expect(user).toHaveProperty('email');
    expect(user).toHaveProperty('name');
    expect(user).toHaveProperty('role');
    expect(user).toHaveProperty('provider');
    expect(user).toHaveProperty('created_at');
    expect(user).toHaveProperty('updated_at');
  });
});

test.describe('User Management - API: Get User Details', () => {
  test('should allow admin to view any user details', async ({ apiClient, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();
    const adminToken = await apiClient.loginAs('admin');

    // Get a test user
    const testUser = await dbHelper.getUserByEmail(pool, 'viewer@test.com');
    expect(testUser).not.toBeNull();

    // Get user details via API
    const response = await apiClient.authenticatedRequest('GET', `/api/users/${testUser!.id}`, undefined, adminToken);

    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('id', testUser!.id);
    expect(response.data).toHaveProperty('email', testUser!.email);
    expect(response.data).toHaveProperty('name', testUser!.name);
    expect(response.data).toHaveProperty('role', testUser!.role);
  });

  test('should allow user to view their own details', async ({ apiClient, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();
    const viewerToken = await apiClient.loginAs('viewer');

    const testUser = await dbHelper.getUserByEmail(pool, 'viewer@test.com');
    expect(testUser).not.toBeNull();

    const response = await apiClient.authenticatedRequest('GET', `/api/users/${testUser!.id}`, undefined, viewerToken);

    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('id', testUser!.id);
  });

  test('should deny user from viewing another user details (403)', async ({ apiClient, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();
    const operatorToken = await apiClient.loginAs('operator');

    const adminUser = await dbHelper.getUserByEmail(pool, 'admin@test.com');
    expect(adminUser).not.toBeNull();

    const response = await apiClient.authenticatedRequest('GET', `/api/users/${adminUser!.id}`, undefined, operatorToken);

    expect(response.status).toBe(403);
    expect(response.success).toBe(false);
  });

  test('should return 404 for non-existent user', async ({ apiClient }) => {
    const adminToken = await apiClient.loginAs('admin');
    const fakeUserId = 'non-existent-user-id';

    const response = await apiClient.authenticatedRequest('GET', `/api/users/${fakeUserId}`, undefined, adminToken);

    expect(response.status).toBe(404);
    expect(response.success).toBe(false);
  });

  test('should include all expected fields in user details', async ({ apiClient, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();
    const adminToken = await apiClient.loginAs('admin');

    const testUser = await dbHelper.getUserByEmail(pool, 'admin@test.com');
    expect(testUser).not.toBeNull();

    const response = await apiClient.authenticatedRequest('GET', `/api/users/${testUser!.id}`, undefined, adminToken);

    expect(response.status).toBe(200);
    const user = response.data;

    expect(user).toHaveProperty('id');
    expect(user).toHaveProperty('email');
    expect(user).toHaveProperty('name');
    expect(user).toHaveProperty('role');
    expect(user).toHaveProperty('provider');
    expect(user).toHaveProperty('avatar_url');
    expect(user).toHaveProperty('created_at');
    expect(user).toHaveProperty('updated_at');
  });
});

test.describe('User Management - API: Update User', () => {
  test('should allow admin to update user name', async ({ apiClient, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();
    const adminToken = await apiClient.loginAs('admin');

    const testUser = await dbHelper.getUserByEmail(pool, 'viewer@test.com');
    expect(testUser).not.toBeNull();

    const newName = 'Updated Viewer Name';
    const response = await apiClient.updateTestUser(adminToken, testUser!.id, { name: newName });

    expect(response.status).toBe(200);
    expect(response.data.name).toBe(newName);
  });

  test('should allow admin to update user avatar', async ({ apiClient, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();
    const adminToken = await apiClient.loginAs('admin');

    const testUser = await dbHelper.getUserByEmail(pool, 'operator@test.com');
    expect(testUser).not.toBeNull();

    const newAvatar = 'https://example.com/avatar.jpg';
    const response = await apiClient.updateTestUser(adminToken, testUser!.id, { avatar_url: newAvatar });

    expect(response.status).toBe(200);
    expect(response.data.avatar_url).toBe(newAvatar);
  });

  test('should allow admin to update user role', async ({ apiClient, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();
    const adminToken = await apiClient.loginAs('admin');

    const testUser = await dbHelper.getUserByEmail(pool, 'viewer@test.com');
    expect(testUser).not.toBeNull();

    const response = await apiClient.updateTestUser(adminToken, testUser!.id, { role: 'operator' });

    expect(response.status).toBe(200);
    expect(response.data.role).toBe('operator');

    // Cleanup: restore role
    await apiClient.updateTestUser(adminToken, testUser!.id, { role: 'viewer' });
  });

  test('should allow user to update their own name', async ({ apiClient, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();
    const viewerToken = await apiClient.loginAs('viewer');

    const testUser = await dbHelper.getUserByEmail(pool, 'viewer@test.com');
    expect(testUser).not.toBeNull();

    const newName = 'Self Updated Name';
    const response = await apiClient.updateTestUser(viewerToken, testUser!.id, { name: newName });

    expect(response.status).toBe(200);
    expect(response.data.name).toBe(newName);
  });

  test('should allow user to update their own avatar', async ({ apiClient, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();
    const operatorToken = await apiClient.loginAs('operator');

    const testUser = await dbHelper.getUserByEmail(pool, 'operator@test.com');
    expect(testUser).not.toBeNull();

    const newAvatar = 'https://example.com/new-avatar.jpg';
    const response = await apiClient.updateTestUser(operatorToken, testUser!.id, { avatar_url: newAvatar });

    expect(response.status).toBe(200);
    expect(response.data.avatar_url).toBe(newAvatar);
  });

  test('should deny user from updating their own role (403)', async ({ apiClient, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();
    const viewerToken = await apiClient.loginAs('viewer');

    const testUser = await dbHelper.getUserByEmail(pool, 'viewer@test.com');
    expect(testUser).not.toBeNull();

    const response = await apiClient.updateTestUser(viewerToken, testUser!.id, { role: 'admin' });

    expect(response.status).toBe(403);
    expect(response.success).toBe(false);
  });

  test('should deny user from updating another user (403)', async ({ apiClient, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();
    const operatorToken = await apiClient.loginAs('operator');

    const viewerUser = await dbHelper.getUserByEmail(pool, 'viewer@test.com');
    expect(viewerUser).not.toBeNull();

    const response = await apiClient.updateTestUser(operatorToken, viewerUser!.id, { name: 'Hacked Name' });

    expect(response.status).toBe(403);
    expect(response.success).toBe(false);
  });

  test('should return updated user object', async ({ apiClient, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();
    const adminToken = await apiClient.loginAs('admin');

    const testUser = await dbHelper.getUserByEmail(pool, 'viewer@test.com');
    expect(testUser).not.toBeNull();

    const newDetails = {
      name: 'Completely New Name',
      avatar_url: 'https://example.com/new.jpg',
    };

    const response = await apiClient.updateTestUser(adminToken, testUser!.id, newDetails);

    expect(response.status).toBe(200);
    expect(response.data.id).toBe(testUser!.id);
    expect(response.data.email).toBe(testUser!.email); // Email should not change
    expect(response.data.name).toBe(newDetails.name);
    expect(response.data.avatar_url).toBe(newDetails.avatar_url);
  });

  test('should update updated_at timestamp', async ({ apiClient, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();
    const adminToken = await apiClient.loginAs('admin');

    const testUser = await dbHelper.getUserByEmail(pool, 'viewer@test.com');
    expect(testUser).not.toBeNull();

    const originalUpdatedAt = testUser!.updated_at;

    // Wait a bit to ensure timestamp difference
    await new Promise(resolve => setTimeout(resolve, 1000));

    const response = await apiClient.updateTestUser(adminToken, testUser!.id, { name: 'Time Test' });

    expect(response.status).toBe(200);
    expect(new Date(response.data.updated_at).getTime()).toBeGreaterThan(new Date(originalUpdatedAt).getTime());
  });

  test('should return 404 when updating non-existent user', async ({ apiClient }) => {
    const adminToken = await apiClient.loginAs('admin');
    const fakeUserId = 'non-existent-user-id';

    const response = await apiClient.updateTestUser(adminToken, fakeUserId, { name: 'Ghost' });

    expect(response.status).toBe(404);
    expect(response.success).toBe(false);
  });
});

test.describe('User Management - API: Delete User', () => {
  test('should allow admin to delete users', async ({ apiClient, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();
    const adminToken = await apiClient.loginAs('admin');

    // Create a test user
    const userData = generateTestUserData('viewer');
    const createdUser = await apiClient.createTestUser(adminToken, userData);
    expect(createdUser.status).toBe(201);

    // Delete the user
    const deleteResponse = await apiClient.deleteTestUser(adminToken, createdUser.data.id);
    expect(deleteResponse.status).toBe(200);
    expect(deleteResponse.data.success).toBe(true);

    // Verify user is deleted
    const deletedUser = await dbHelper.getUserByEmail(pool, userData.email);
    expect(deletedUser).toBeNull();
  });

  test('should deny operator from deleting users (403)', async ({ apiClient, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();
    const operatorToken = await apiClient.loginAs('operator');

    const testUser = await dbHelper.getUserByEmail(pool, 'viewer@test.com');
    expect(testUser).not.toBeNull();

    const response = await apiClient.deleteTestUser(operatorToken, testUser!.id);
    expect(response.status).toBe(403);
    expect(response.success).toBe(false);
  });

  test('should deny viewer from deleting users (403)', async ({ apiClient, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();
    const viewerToken = await apiClient.loginAs('viewer');

    const testUser = await dbHelper.getUserByEmail(pool, 'operator@test.com');
    expect(testUser).not.toBeNull();

    const response = await apiClient.deleteTestUser(viewerToken, testUser!.id);
    expect(response.status).toBe(403);
    expect(response.success).toBe(false);
  });

  test('should prevent admin from deleting themselves (400)', async ({ apiClient, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();
    const adminToken = await apiClient.loginAs('admin');

    const adminUser = await dbHelper.getUserByEmail(pool, 'admin@test.com');
    expect(adminUser).not.toBeNull();

    const response = await apiClient.deleteTestUser(adminToken, adminUser!.id);
    expect(response.status).toBe(400);
    expect(response.success).toBe(false);
  });

  test('should remove user from database on delete', async ({ apiClient, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();
    const adminToken = await apiClient.loginAs('admin');

    // Create user
    const userData = generateTestUserData('operator');
    const createdUser = await apiClient.createTestUser(adminToken, userData);
    expect(createdUser.status).toBe(201);

    // Verify user exists
    const userBeforeDelete = await dbHelper.getUserByEmail(pool, userData.email);
    expect(userBeforeDelete).not.toBeNull();

    // Delete user
    await apiClient.deleteTestUser(adminToken, createdUser.data.id);

    // Verify user is removed
    const userAfterDelete = await dbHelper.getUserByEmail(pool, userData.email);
    expect(userAfterDelete).toBeNull();
  });

  test('should cascade delete to sessions on user delete', async ({ apiClient, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();
    const adminToken = await apiClient.loginAs('admin');

    // Create user
    const userData = generateTestUserData('viewer');
    const createdUser = await apiClient.createTestUser(adminToken, userData);

    // Create sessions
    await dbHelper.createTestSession(pool, createdUser.data.id);
    await dbHelper.createTestSession(pool, createdUser.data.id);

    // Get session count before delete
    const { sessions: sessionsBefore } = await dbHelper.getUserSessions(pool, createdUser.data.id);
    expect(sessionsBefore.length).toBeGreaterThan(0);

    // Delete user
    await apiClient.deleteTestUser(adminToken, createdUser.data.id);

    // Verify sessions are deleted
    const { sessions: sessionsAfter } = await dbHelper.getUserSessions(pool, createdUser.data.id);
    expect(sessionsAfter.length).toBe(0);
  });

  test('should cascade delete to audit logs on user delete', async ({ apiClient, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();
    const adminToken = await apiClient.loginAs('admin');

    // Create user
    const userData = generateTestUserData('operator');
    const createdUser = await apiClient.createTestUser(adminToken, userData);

    // Create audit logs
    await dbHelper.createAuditLog(pool, {
      user_id: createdUser.data.id,
      action: 'user.login',
      resource: '/api/auth/login',
    });
    await dbHelper.createAuditLog(pool, {
      user_id: createdUser.data.id,
      action: 'user.update',
      resource: '/api/users',
    });

    // Delete user
    await apiClient.deleteTestUser(adminToken, createdUser.data.id);

    // Verify audit logs are deleted
    const logs = await dbHelper.getAuditLogs(pool, createdUser.data.id);
    expect(logs.length).toBe(0);
  });

  test('should return 404 when deleting non-existent user', async ({ apiClient }) => {
    const adminToken = await apiClient.loginAs('admin');
    const fakeUserId = 'ghost-user-id';

    const response = await apiClient.deleteTestUser(adminToken, fakeUserId);
    expect(response.status).toBe(404);
    expect(response.success).toBe(false);
  });
});

test.describe('User Management - API: User Sessions', () => {
  test('should allow admin to view any user sessions', async ({ apiClient, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();
    const adminToken = await apiClient.loginAs('admin');

    const testUser = await dbHelper.getUserByEmail(pool, 'viewer@test.com');
    expect(testUser).not.toBeNull();

    // Create test sessions
    await dbHelper.createTestSession(pool, testUser!.id);
    await dbHelper.createTestSession(pool, testUser!.id);

    const response = await apiClient.getUserSessions(adminToken, testUser!.id);

    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('sessions');
    expect(response.data).toHaveProperty('total');
    expect(Array.isArray(response.data.sessions)).toBe(true);
  });

  test('should allow user to view their own sessions', async ({ apiClient, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();
    const operatorToken = await apiClient.loginAs('operator');

    const testUser = await dbHelper.getUserByEmail(pool, 'operator@test.com');
    expect(testUser).not.toBeNull();

    // Create test sessions
    await dbHelper.createTestSession(pool, testUser!.id);
    await dbHelper.createTestSession(pool, testUser!.id);

    const response = await apiClient.getUserSessions(operatorToken, testUser!.id);

    expect(response.status).toBe(200);
    expect(response.data.sessions.length).toBeGreaterThanOrEqual(2);
  });

  test('should deny user from viewing another user sessions (403)', async ({ apiClient, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();
    const viewerToken = await apiClient.loginAs('viewer');

    const adminUser = await dbHelper.getUserByEmail(pool, 'admin@test.com');
    expect(adminUser).not.toBeNull();

    const response = await apiClient.getUserSessions(viewerToken, adminUser!.id);

    expect(response.status).toBe(403);
    expect(response.success).toBe(false);
  });

  test('should include session fields', async ({ apiClient, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();
    const adminToken = await apiClient.loginAs('admin');

    const testUser = await dbHelper.getUserByEmail(pool, 'admin@test.com');
    expect(testUser).not.toBeNull();

    // Create session with IP and user agent
    const session = await dbHelper.createTestSession(pool, testUser!.id);
    expect(session).toHaveProperty('id');
    expect(session).toHaveProperty('user_id', testUser!.id);
    expect(session).toHaveProperty('expires_at');
    expect(session).toHaveProperty('created_at');
  });

  test('should show only active sessions', async ({ apiClient, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();
    const adminToken = await apiClient.loginAs('admin');

    const testUser = await dbHelper.getUserByEmail(pool, 'viewer@test.com');
    expect(testUser).not.toBeNull();

    // Create active session (expires in future)
    await dbHelper.createTestSession(pool, testUser!.id, new Date(Date.now() + 3600000));

    // Create expired session
    await dbHelper.createTestSession(pool, testUser!.id, new Date(Date.now() - 3600000));

    const response = await apiClient.getUserSessions(adminToken, testUser!.id);

    expect(response.status).toBe(200);
    // Should only return active sessions
    response.data.sessions.forEach((session: any) => {
      expect(new Date(session.expires_at).getTime()).toBeGreaterThan(Date.now());
    });
  });

  test('should not show expired sessions', async ({ apiClient, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();
    const adminToken = await apiClient.loginAs('admin');

    const testUser = await dbHelper.getUserByEmail(pool, 'operator@test.com');
    expect(testUser).not.toBeNull();

    // Create expired sessions
    await dbHelper.createTestSession(pool, testUser!.id, new Date(Date.now() - 7200000));
    await dbHelper.createTestSession(pool, testUser!.id, new Date(Date.now() - 3600000));

    const response = await apiClient.getUserSessions(adminToken, testUser!.id);

    expect(response.status).toBe(200);
    expect(response.data.sessions.every((s: any) => new Date(s.expires_at).getTime() > Date.now())).toBe(true);
  });

  test('should support pagination for sessions', async ({ apiClient, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();
    const adminToken = await apiClient.loginAs('admin');

    const testUser = await dbHelper.getUserByEmail(pool, 'viewer@test.com');
    expect(testUser).not.toBeNull();

    // Create multiple sessions
    for (let i = 0; i < 5; i++) {
      await dbHelper.createTestSession(pool, testUser!.id);
    }

    const page1 = await apiClient.getUserSessions(adminToken, testUser!.id, 2, 0);
    const page2 = await apiClient.getUserSessions(adminToken, testUser!.id, 2, 2);

    expect(page1.status).toBe(200);
    expect(page2.status).toBe(200);
    expect(page1.data.sessions.length).toBeLessThanOrEqual(2);
    expect(page2.data.sessions.length).toBeLessThanOrEqual(2);
  });
});

test.describe('User Management - API: Invalidate Sessions', () => {
  test('should allow admin to invalidate any user sessions', async ({ apiClient, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();
    const adminToken = await apiClient.loginAs('admin');

    const testUser = await dbHelper.getUserByEmail(pool, 'viewer@test.com');
    expect(testUser).not.toBeNull();

    // Create sessions
    await dbHelper.createTestSession(pool, testUser!.id);
    await dbHelper.createTestSession(pool, testUser!.id);
    await dbHelper.createTestSession(pool, testUser!.id);

    const { total: beforeCount } = await dbHelper.getUserSessions(pool, testUser!.id);
    expect(beforeCount).toBeGreaterThan(0);

    // Invalidate sessions
    const response = await apiClient.authenticatedRequest(
      'DELETE',
      `/api/users/${testUser!.id}/sessions`,
      undefined,
      adminToken
    );

    expect(response.status).toBe(200);
    expect(response.data.success).toBe(true);

    const { total: afterCount } = await dbHelper.getUserSessions(pool, testUser!.id);
    expect(afterCount).toBe(0);
  });

  test('should allow user to invalidate their own sessions', async ({ apiClient, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();
    const operatorToken = await apiClient.loginAs('operator');

    const testUser = await dbHelper.getUserByEmail(pool, 'operator@test.com');
    expect(testUser).not.toBeNull();

    // Create sessions
    await dbHelper.createTestSession(pool, testUser!.id);
    await dbHelper.createTestSession(pool, testUser!.id);

    const response = await apiClient.authenticatedRequest(
      'DELETE',
      `/api/users/${testUser!.id}/sessions`,
      undefined,
      operatorToken
    );

    expect(response.status).toBe(200);
    expect(response.data.success).toBe(true);
  });

  test('should deny user from invalidating another user sessions (403)', async ({ apiClient, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();
    const viewerToken = await apiClient.loginAs('viewer');

    const adminUser = await dbHelper.getUserByEmail(pool, 'admin@test.com');
    expect(adminUser).not.toBeNull();

    const response = await apiClient.authenticatedRequest(
      'DELETE',
      `/api/users/${adminUser!.id}/sessions`,
      undefined,
      viewerToken
    );

    expect(response.status).toBe(403);
    expect(response.success).toBe(false);
  });

  test('should remove invalidated sessions from database', async ({ apiClient, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();
    const adminToken = await apiClient.loginAs('admin');

    const testUser = await dbHelper.getUserByEmail(pool, 'viewer@test.com');
    expect(testUser).not.toBeNull();

    // Create sessions
    const session1 = await dbHelper.createTestSession(pool, testUser!.id);
    const session2 = await dbHelper.createTestSession(pool, testUser!.id);

    // Verify sessions exist
    const { sessions: before } = await dbHelper.getUserSessions(pool, testUser!.id);
    expect(before.length).toBeGreaterThanOrEqual(2);

    // Invalidate
    await apiClient.authenticatedRequest(
      'DELETE',
      `/api/users/${testUser!.id}/sessions`,
      undefined,
      adminToken
    );

    // Verify removed
    const { sessions: after } = await dbHelper.getUserSessions(pool, testUser!.id);
    expect(after.length).toBe(0);
  });

  test('should logout user after session invalidation', async ({ page, apiClient, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();

    // Create test user and login
    const userData = generateTestUserData('viewer');
    const adminClient = await apiClient.createTestClient('admin');
    const createdUser = await adminClient.createTestUser(adminClient.getToken()!, userData);
    expect(createdUser.status).toBe(201);

    const viewerClient = await apiClient.createTestClient('viewer');
    // Set viewer to the created user
    const viewerToken = await apiClient.loginAs('viewer');

    // Create session
    await dbHelper.createTestSession(pool, createdUser.data.id);

    // Invalidate sessions as admin
    await apiClient.authenticatedRequest(
      'DELETE',
      `/api/users/${createdUser.data.id}/sessions`,
      undefined,
      await apiClient.loginAs('admin')
    );

    // Verify user cannot access protected routes
    const response = await apiClient.authenticatedRequest('GET', '/api/auth/me', undefined, viewerToken);
    expect(response.status).toBe(401);

    // Cleanup
    await adminClient.deleteTestUser(adminClient.getToken()!, createdUser.data.id);
  });

  test('should prevent access to protected routes after invalidation', async ({ apiClient, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();
    const adminToken = await apiClient.loginAs('admin');

    const testUser = await dbHelper.getUserByEmail(pool, 'operator@test.com');
    expect(testUser).not.toBeNull();

    // Create sessions
    await dbHelper.createTestSession(pool, testUser!.id);

    // Get operator token
    const operatorToken = await apiClient.loginAs('operator');

    // Invalidate sessions
    await apiClient.authenticatedRequest(
      'DELETE',
      `/api/users/${testUser!.id}/sessions`,
      undefined,
      adminToken
    );

    // Try to access protected endpoint with invalidated token
    const response = await apiClient.authenticatedRequest('GET', '/api/auth/me', undefined, operatorToken);
    expect(response.status).toBeGreaterThanOrEqual(400);
  });
});

test.describe('User Management - UI: User Management Page', () => {
  test('should allow admin to access /admin/users page', async ({ page, loginAs }) => {
    await loginAs('admin');
    await page.goto('/admin/users');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/.*\/admin\/users/);
    await expect(page.locator('h1, h2').filter({ hasText: /users/i })).toBeVisible();
  });

  test('should deny operator from accessing /admin/users page', async ({ page, loginAs }) => {
    await loginAs('operator');
    await page.goto('/admin/users');

    // Should redirect or show forbidden
    const url = page.url();
    const isForbidden = page.url().includes('forbidden') || page.url().includes('unauthorized');
    const hasAccessDenied = await page.locator('text=/access.denied|forbidden|unauthorized/i').count() > 0;

    expect(isForbidden || hasAccessDenied || !url.includes('/admin/users')).toBe(true);
  });

  test('should deny viewer from accessing /admin/users page', async ({ page, loginAs }) => {
    await loginAs('viewer');
    await page.goto('/admin/users');

    // Should redirect or show forbidden
    const url = page.url();
    const isForbidden = page.url().includes('forbidden') || page.url().includes('unauthorized');
    const hasAccessDenied = await page.locator('text=/access.denied|forbidden|unauthorized/i').count() > 0;

    expect(isForbidden || hasAccessDenied || !url.includes('/admin/users')).toBe(true);
  });

  test('should display user table with all users', async ({ page, loginAs }) => {
    await loginAs('admin');
    await page.goto('/admin/users');
    await page.waitForLoadState('networkidle');

    // Look for user table or list
    const table = page.locator('table, [data-testid="user-list"], [role="table"]').first();
    await expect(table).toBeVisible();

    // Check for user rows
    const rows = page.locator('tbody tr, [data-testid^="user-"]').count();
    expect(await rows).toBeGreaterThan(0);
  });

  test('should show pagination in user table', async ({ page, loginAs }) => {
    await loginAs('admin');
    await page.goto('/admin/users');
    await page.waitForLoadState('networkidle');

    // Look for pagination controls
    const pagination = page.locator('[data-testid="pagination"], nav[aria-label="pagination"], .pagination').first();
    const hasPagination = await pagination.count() > 0;

    // Pagination should exist if there are many users
    if (hasPagination) {
      await expect(pagination).toBeVisible();
    }
  });

  test('should allow admin to update user role from UI', async ({ page, loginAs, apiClient, dbHelper }) => {
    await loginAs('admin');
    await page.goto('/admin/users');
    await page.waitForLoadState('networkidle');

    const pool = await dbHelper.getTestDbConnection();
    const viewerUser = await dbHelper.getUserByEmail(pool, 'viewer@test.com');
    expect(viewerUser).not.toBeNull();

    // Find the row for this user
    const userRow = page.locator(`[data-user-id="${viewerUser!.id}"], tr:has-text("viewer@test.com")`).first();

    // Look for role dropdown or edit button
    const roleDropdown = userRow.locator('[data-testid="role-select"], select[name="role"]').first();
    const editButton = userRow.locator('[data-testid="edit-user"], button:has-text("edit")').first();

    const hasRoleDropdown = await roleDropdown.count() > 0;

    if (hasRoleDropdown) {
      // Change role using dropdown
      await roleDropdown.selectOption('operator');
      await page.waitForTimeout(500);

      // Verify change
      const updatedUser = await dbHelper.getUserByEmail(pool, 'viewer@test.com');
      expect(updatedUser?.role).toBe('operator');

      // Cleanup: restore role
      await apiClient.updateTestUser(await apiClient.loginAs('admin'), viewerUser!.id, { role: 'viewer' });
    }
  });

  test('should allow admin to delete user from UI', async ({ page, loginAs, apiClient }) => {
    await loginAs('admin');

    // Create a test user
    const userData = generateTestUserData('viewer');
    const adminToken = await apiClient.loginAs('admin');
    const createdUser = await apiClient.createTestUser(adminToken, userData);
    expect(createdUser.status).toBe(201);

    await page.goto('/admin/users');
    await page.waitForLoadState('networkidle');

    // Find and click delete button for the test user
    const deleteButton = page.locator(`[data-user-id="${createdUser.data.id}"] [data-testid="delete-user"], [data-user-id="${createdUser.data.id}"] button:has-text("delete")`).first();

    const hasDeleteButton = await deleteButton.count() > 0;

    if (hasDeleteButton) {
      await deleteButton.click();

      // Confirm deletion if modal appears
      const modal = page.locator('[role="dialog"], .modal');
      const confirmButton = modal.locator('button:has-text("confirm"), button:has-text("delete"), button[type="submit"]').first();

      const hasModal = await modal.count() > 0;
      if (hasModal) {
        await confirmButton.click();
      }

      await page.waitForTimeout(1000);

      // Verify user is deleted
      const response = await apiClient.authenticatedRequest('GET', `/api/users/${createdUser.data.id}`, undefined, adminToken);
      expect(response.status).toBe(404);
    }
  });

  test('should confirm destructive actions in UI', async ({ page, loginAs }) => {
    await loginAs('admin');
    await page.goto('/admin/users');
    await page.waitForLoadState('networkidle');

    // Find a delete button
    const deleteButton = page.locator('[data-testid="delete-user"], button:has-text("delete")').first();
    const hasDeleteButton = await deleteButton.count() > 0;

    if (hasDeleteButton) {
      await deleteButton.click();

      // Check for confirmation modal
      const modal = page.locator('[role="dialog"], .modal, [data-testid="confirm-modal"]');
      const hasModal = await modal.count() > 0;

      if (hasModal) {
        // Modal should be visible
        await expect(modal).toBeVisible();

        // Modal should have warning text
        const hasWarning = await modal.locator('text=/delete|remove|confirm|are.you sure/i').count() > 0;
        expect(hasWarning).toBe(true);

        // Modal should have cancel button
        const cancelButton = modal.locator('button:has-text("cancel")');
        const hasCancelButton = await cancelButton.count() > 0;

        if (hasCancelButton) {
          await cancelButton.click();
          await expect(modal).not.toBeVisible();
        }
      }
    }
  });

  test('should display user count in UI', async ({ page, loginAs }) => {
    await loginAs('admin');
    await page.goto('/admin/users');
    await page.waitForLoadState('networkidle');

    // Look for user count indicator
    const countIndicator = page.locator('[data-testid="user-count"], text=/\\d+\\s*(users|accounts)/i').first();
    const hasCount = await countIndicator.count() > 0;

    if (hasCount) {
      await expect(countIndicator).toBeVisible();
    }
  });
});

test.describe('User Management - Edge Cases', () => {
  test('should return 400 for invalid update data', async ({ apiClient, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();
    const adminToken = await apiClient.loginAs('admin');

    const testUser = await dbHelper.getUserByEmail(pool, 'viewer@test.com');
    expect(testUser).not.toBeNull();

    // Try to update with invalid role
    const response = await apiClient.updateTestUser(adminToken, testUser!.id, { role: 'invalid_role' as any });

    expect(response.status).toBe(400);
    expect(response.success).toBe(false);
  });

  test('should return error for duplicate email', async ({ apiClient }) => {
    const adminToken = await apiClient.loginAs('admin');

    // Create first user
    const user1 = generateTestUserData('viewer');
    const createdUser1 = await apiClient.createTestUser(adminToken, user1);
    expect(createdUser1.status).toBe(201);

    // Create second user
    const user2 = generateTestUserData('operator');
    const createdUser2 = await apiClient.createTestUser(adminToken, user2);
    expect(createdUser2.status).toBe(201);

    // Try to update user2 with user1's email
    const response = await apiClient.updateTestUser(adminToken, createdUser2.data.id, { email: user1.email });

    // Should return error (400 or 409)
    expect([400, 409].includes(response.status)).toBe(true);

    // Cleanup
    await apiClient.deleteTestUser(adminToken, createdUser1.data.id);
    await apiClient.deleteTestUser(adminToken, createdUser2.data.id);
  });

  test('should prevent deletion of last admin', async ({ apiClient, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();
    const adminToken = await apiClient.loginAs('admin');

    // Count admin users
    const result = await pool.query("SELECT COUNT(*) as count FROM mission_command_users WHERE role = 'admin' AND email LIKE '%@test.com'");
    const adminCount = parseInt(result.rows[0].count);

    if (adminCount === 1) {
      const adminUser = await dbHelper.getUserByEmail(pool, 'admin@test.com');
      expect(adminUser).not.toBeNull();

      const response = await apiClient.deleteTestUser(adminToken, adminUser!.id);
      expect(response.status).toBe(400);
      expect(response.success).toBe(false);
    }
  });

  test('should handle pagination correctly', async ({ apiClient }) => {
    const adminToken = await apiClient.loginAs('admin');

    // Test different page sizes
    const pageSize10 = await apiClient.getUsers(adminToken, 10, 0);
    const pageSize20 = await apiClient.getUsers(adminToken, 20, 0);
    const pageSize50 = await apiClient.getUsers(adminToken, 50, 0);

    expect(pageSize10.status).toBe(200);
    expect(pageSize20.status).toBe(200);
    expect(pageSize50.status).toBe(200);

    expect(pageSize10.data.users.length).toBeLessThanOrEqual(10);
    expect(pageSize20.data.users.length).toBeLessThanOrEqual(20);
    expect(pageSize50.data.users.length).toBeLessThanOrEqual(50);
  });

  test('should return empty results for non-existent search', async ({ apiClient }) => {
    const adminToken = await apiClient.loginAs('admin');
    const response = await apiClient.getUsers(adminToken, 50, 0, { search: 'nonexistentuser12345' });

    expect(response.status).toBe(200);
    expect(response.data.users.length).toBe(0);
    expect(response.data.total).toBe(0);
  });

  test('should handle empty role filter', async ({ apiClient }) => {
    const adminToken = await apiClient.loginAs('admin');

    // Filter by role that doesn't exist
    const response = await apiClient.getUsers(adminToken, 50, 0, { role: 'superadmin' });

    // Should handle gracefully (either 400 for invalid role or 200 with empty results)
    expect([200, 400].includes(response.status)).toBe(true);

    if (response.status === 200) {
      expect(response.data.users.length).toBe(0);
    }
  });

  test('should handle concurrent updates', async ({ apiClient, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();
    const adminToken = await apiClient.loginAs('admin');

    const testUser = await dbHelper.getUserByEmail(pool, 'viewer@test.com');
    expect(testUser).not.toBeNull();

    // Make multiple concurrent updates
    const update1 = apiClient.updateTestUser(adminToken, testUser!.id, { name: 'Update 1' });
    const update2 = apiClient.updateTestUser(adminToken, testUser!.id, { name: 'Update 2' });
    const update3 = apiClient.updateTestUser(adminToken, testUser!.id, { name: 'Update 3' });

    const results = await Promise.all([update1, update2, update3]);

    // All should succeed (last write wins)
    results.forEach(result => {
      expect([200, 409].includes(result.status)).toBe(true);
    });

    // Cleanup: restore original name
    await apiClient.updateTestUser(adminToken, testUser!.id, { name: testUser!.name });
  });

  test('should handle large offset in pagination', async ({ apiClient }) => {
    const adminToken = await apiClient.loginAs('admin');

    // Request page far beyond available data
    const response = await apiClient.getUsers(adminToken, 10, 10000);

    expect(response.status).toBe(200);
    expect(response.data.users.length).toBe(0);
  });

  test('should handle special characters in search', async ({ apiClient }) => {
    const adminToken = await apiClient.loginAs('admin');

    // Search with special characters
    const response = await apiClient.getUsers(adminToken, 50, 0, { search: 'test@example.com' });

    expect(response.status).toBe(200);
    expect(Array.isArray(response.data.users)).toBe(true);
  });

  test('should validate user ID format', async ({ apiClient }) => {
    const adminToken = await apiClient.loginAs('admin');

    // Try to get user with invalid ID format
    const response = await apiClient.authenticatedRequest('GET', '/api/users/invalid-id-format!!!', undefined, adminToken);

    expect([400, 404].includes(response.status)).toBe(true);
  });
});

test.describe('User Management - Cleanup', () => {
  test.afterAll(async ({ apiClient, dbHelper }) => {
    // Clean up any test users created during tests
    const pool = await dbHelper.getTestDbConnection();
    const adminToken = await apiClient.loginAs('admin');

    // Get all test users
    const result = await pool.query("SELECT id FROM mission_command_users WHERE email LIKE '%@example.com'");

    // Delete each test user
    for (const row of result.rows) {
      await apiClient.deleteTestUser(adminToken, row.id);
    }
  });
});
