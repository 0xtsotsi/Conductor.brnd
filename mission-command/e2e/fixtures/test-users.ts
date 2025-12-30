import { TestUser, UserRole } from './test-options';

/**
 * Test user fixtures for different roles
 *
 * These users are created during test setup and can be used across tests.
 * Passwords follow the pattern: test-password-{role}
 */
export const testUsers: Record<UserRole, TestUser> = {
  admin: {
    id: 'test-admin-1',
    email: 'admin@test.local',
    name: 'Test Admin',
    role: 'admin',
  },
  operator: {
    id: 'test-operator-1',
    email: 'operator@test.local',
    name: 'Test Operator',
    role: 'operator',
  },
  viewer: {
    id: 'test-viewer-1',
    email: 'viewer@test.local',
    name: 'Test Viewer',
    role: 'viewer',
  },
};

/**
 * Get a test user by role
 */
export function getTestUser(role: UserRole): TestUser {
  return testUsers[role];
}

/**
 * Get password for a test user
 */
export function getTestUserPassword(role: UserRole): string {
  return `test-password-${role}`;
}

/**
 * Get all test users
 */
export function getAllTestUsers(): TestUser[] {
  return Object.values(testUsers);
}
