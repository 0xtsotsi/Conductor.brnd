/**
 * Playwright Test Extensions and Fixtures
 *
 * Extends Playwright test with custom fixtures for E2E testing.
 * Provides helpers for authentication, API clients, and database operations.
 *
 * @packageDocumentation
 */

import { test as base, Page } from '@playwright/test';
import { Pool } from 'pg';
import {
  loginAs,
  logout,
  getAuthToken,
  setAuthToken,
  waitForAuthCheck,
  mockOAuthLogin,
  mockOAuthFailed,
  getCurrentUser,
  isAuthenticated,
  getUserRole,
  clearAuthState,
} from './utils/auth-helpers.js';
import {
  APIClient,
  createTestClient,
  createMultipleTestClients,
} from './utils/api-client.js';
import {
  getTestDbConnection,
  closeTestDbConnection,
  createTestTables,
  dropTestTables,
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
  executeQuery,
  executeTransaction,
} from './utils/db-helpers.js';
import {
  assertUserLoggedIn,
  assertUserLoggedOut,
  assertUserHasRole,
  assertPageAccessible,
  assertPageForbidden,
  assertAuditLogExists,
  assertAuditLogNotExists,
  assertPageContains,
  assertPageNotContains,
  assertURLMatch,
  assertCanPerformAction,
  assertCannotPerformAction,
  assertNavigationItems,
  assertUserInfoDisplayed,
  assertErrorMessage,
  assertSuccessMessage,
  assertLoading,
  assertNotLoading,
  assertPageTitle,
  assertValidationError,
  assertModalVisible,
  assertModalNotVisible,
} from './utils/assertions.js';
import type { UserRole, OAuthProvider } from './utils/oauth-mocks.js';

/**
 * Authentication helper fixture
 */
export interface AuthHelper {
  loginAs: (page: Page, role: UserRole, provider?: OAuthProvider) => Promise<void>;
  logout: (page: Page) => Promise<void>;
  getAuthToken: (page: Page) => Promise<string | null>;
  setAuthToken: (page: Page, token: string) => Promise<void>;
  waitForAuthCheck: (page: Page, timeout?: number) => Promise<void>;
  mockOAuthLogin: (page: Page, role?: UserRole, provider?: OAuthProvider) => Promise<void>;
  mockOAuthFailed: (page: Page, provider?: OAuthProvider, errorReason?: string) => Promise<void>;
  getCurrentUser: (page: Page) => Promise<any>;
  isAuthenticated: (page: Page) => Promise<boolean>;
  getUserRole: (page: Page) => Promise<UserRole | null>;
  clearAuthState: (page: Page) => Promise<void>;
}

/**
 * API client fixture
 */
export interface APIClientFixture {
  authenticatedRequest: <T = any>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
    endpoint: string,
    body?: any,
    token?: string
  ) => Promise<any>;
  getUserInfo: (token?: string) => Promise<any>;
  getUsers: (
    token?: string,
    limit?: number,
    offset?: number,
    filters?: { role?: string; search?: string }
  ) => Promise<any>;
  createTestUser: (token: string, userData: any) => Promise<any>;
  deleteTestUser: (token: string, userId: string) => Promise<any>;
  updateTestUser: (token: string, userId: string, updates: any) => Promise<any>;
  invalidateAllSessions: (token: string) => Promise<any>;
  logout: (token: string) => Promise<any>;
  refreshAccessToken: (refreshToken: string) => Promise<any>;
  getUserSessions: (token: string, userId: string, limit?: number, offset?: number) => Promise<any>;
  getAuditLogs: (token: string, userId?: string, limit?: number, offset?: number) => Promise<any>;
  loginAs: (role?: UserRole, provider?: OAuthProvider) => Promise<string>;
  setToken: (token: string) => void;
  getToken: () => string | null;
  setRefreshToken: (token: string) => void;
  getRefreshToken: () => string | null;
  clearTokens: () => void;
  generateExpiredToken: (role?: UserRole) => Promise<string>;
  createTestClient: (role?: UserRole) => Promise<APIClient>;
  createMultipleTestClients: (roles: UserRole[]) => Promise<APIClient[]>;
}

/**
 * Database helper fixture
 */
export interface DatabaseHelper {
  getTestDbConnection: (config?: any) => Promise<Pool>;
  closeTestDbConnection: () => Promise<void>;
  createTestTables: (pool: Pool) => Promise<void>;
  dropTestTables: (pool: Pool) => Promise<void>;
  seedTestUsers: (pool: Pool, users?: any[]) => Promise<any[]>;
  cleanupTestUsers: (pool: Pool, emails?: string[]) => Promise<void>;
  resetTestDatabase: (pool: Pool) => Promise<void>;
  createTestSession: (pool: Pool, userId: string, expiresAt?: Date) => Promise<any>;
  createTestRefreshToken: (pool: Pool, userId: string, expiresAt?: Date) => Promise<any>;
  getUserByEmail: (pool: Pool, email: string) => Promise<any>;
  getUserByProvider: (pool: Pool, sub: string, provider: OAuthProvider) => Promise<any>;
  getUserSessions: (pool: Pool, userId: string, limit?: number, offset?: number) => Promise<any>;
  invalidateUserSessions: (pool: Pool, userId: string) => Promise<number>;
  createAuditLog: (pool: Pool, entry: any) => Promise<any>;
  getAuditLogs: (pool: Pool, userId: string, limit?: number, offset?: number) => Promise<any[]>;
  executeQuery: (pool: Pool, query: string, params?: any[]) => Promise<any>;
  executeTransaction: (pool: Pool, callback: (client: any) => Promise<any>) => Promise<any>;
}

/**
 * Assertion helper fixture
 */
export interface AssertionHelper {
  assertUserLoggedIn: (page: Page, message?: string) => Promise<void>;
  assertUserLoggedOut: (page: Page, message?: string) => Promise<void>;
  assertUserHasRole: (page: Page, expectedRole: UserRole, message?: string) => Promise<void>;
  assertPageAccessible: (page: Page, path: string, role: UserRole, message?: string) => Promise<void>;
  assertPageForbidden: (page: Page, path: string, role: UserRole, message?: string) => Promise<void>;
  assertAuditLogExists: (pool: any, action: string, userId?: string, resource?: string, timeout?: number) => Promise<void>;
  assertAuditLogNotExists: (pool: any, action: string, userId?: string) => Promise<void>;
  assertPageContains: (page: Page, selector: string, message?: string) => Promise<void>;
  assertPageNotContains: (page: Page, selector: string, message?: string) => Promise<void>;
  assertURLMatch: (page: Page, pattern: string | RegExp, message?: string) => Promise<void>;
  assertCanPerformAction: (page: Page, action: string, resource: string, message?: string) => Promise<void>;
  assertCannotPerformAction: (page: Page, action: string, resource: string, message?: string) => Promise<void>;
  assertNavigationItems: (page: Page, role: UserRole, expectedItems: string[], forbiddenItems?: string[]) => Promise<void>;
  assertUserInfoDisplayed: (page: Page, expectedEmail: string, expectedName: string, expectedRole: UserRole) => Promise<void>;
  assertErrorMessage: (page: Page, expectedMessage: string, message?: string) => Promise<void>;
  assertSuccessMessage: (page: Page, expectedMessage: string, message?: string) => Promise<void>;
  assertLoading: (page: Page, selector?: string) => Promise<void>;
  assertNotLoading: (page: Page, selector?: string) => Promise<void>;
  assertPageTitle: (page: Page, expectedTitle: string) => Promise<void>;
  assertValidationError: (page: Page, field: string, expectedError: string) => Promise<void>;
  assertModalVisible: (page: Page, title?: string) => Promise<void>;
  assertModalNotVisible: (page: Page) => Promise<void>;
}

/**
 * Test users fixture
 */
export interface TestUsersFixture {
  admin: {
    email: string;
    name: string;
    role: 'admin';
    provider: 'github';
  };
  operator: {
    email: string;
    name: string;
    role: 'operator';
    provider: 'github';
  };
  viewer: {
    email: string;
    name: string;
    role: 'viewer';
    provider: 'github';
  };
}

/**
 * Extended test fixtures
 */
export type TestFixtures = {
  authHelper: AuthHelper;
  apiClient: APIClientFixture;
  dbHelper: DatabaseHelper;
  assertionHelper: AssertionHelper;
  testUsers: TestUsersFixture;
};

/**
 * Create auth helper fixture
 */
function createAuthHelper(): AuthHelper {
  return {
    loginAs,
    logout,
    getAuthToken,
    setAuthToken,
    waitForAuthCheck,
    mockOAuthLogin,
    mockOAuthFailed,
    getCurrentUser,
    isAuthenticated,
    getUserRole,
    clearAuthState,
  };
}

/**
 * Create API client fixture
 */
function createAPIClientFixture(): APIClientFixture {
  const client = new APIClient();

  return {
    authenticatedRequest: client.authenticatedRequest.bind(client),
    getUserInfo: client.getUserInfo.bind(client),
    getUsers: client.getUsers.bind(client),
    createTestUser: client.createTestUser.bind(client),
    deleteTestUser: client.deleteTestUser.bind(client),
    updateTestUser: client.updateTestUser.bind(client),
    invalidateAllSessions: client.invalidateAllSessions.bind(client),
    logout: client.logout.bind(client),
    refreshAccessToken: client.refreshAccessToken.bind(client),
    getUserSessions: client.getUserSessions.bind(client),
    getAuditLogs: client.getAuditLogs.bind(client),
    loginAs: client.loginAs.bind(client),
    setToken: client.setToken.bind(client),
    getToken: client.getToken.bind(client),
    setRefreshToken: client.setRefreshToken.bind(client),
    getRefreshToken: client.getRefreshToken.bind(client),
    clearTokens: client.clearTokens.bind(client),
    generateExpiredToken: client.generateExpiredToken.bind(client),
    createTestClient: async (role?: UserRole) => createTestClient(role),
    createMultipleTestClients: async (roles: UserRole[]) => createMultipleTestClients(roles),
  };
}

/**
 * Create database helper fixture
 */
function createDatabaseHelper(): DatabaseHelper {
  return {
    getTestDbConnection,
    closeTestDbConnection,
    createTestTables,
    dropTestTables,
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
    executeQuery,
    executeTransaction,
  };
}

/**
 * Create assertion helper fixture
 */
function createAssertionHelper(): AssertionHelper {
  return {
    assertUserLoggedIn,
    assertUserLoggedOut,
    assertUserHasRole,
    assertPageAccessible,
    assertPageForbidden,
    assertAuditLogExists,
    assertAuditLogNotExists,
    assertPageContains,
    assertPageNotContains,
    assertURLMatch,
    assertCanPerformAction,
    assertCannotPerformAction,
    assertNavigationItems,
    assertUserInfoDisplayed,
    assertErrorMessage,
    assertSuccessMessage,
    assertLoading,
    assertNotLoading,
    assertPageTitle,
    assertValidationError,
    assertModalVisible,
    assertModalNotVisible,
  };
}

/**
 * Create test users fixture
 */
function createTestUsersFixture(): TestUsersFixture {
  return {
    admin: {
      email: 'admin@test.com',
      name: 'Admin User',
      role: 'admin',
      provider: 'github',
    },
    operator: {
      email: 'operator@test.com',
      name: 'Operator User',
      role: 'operator',
      provider: 'github',
    },
    viewer: {
      email: 'viewer@test.com',
      name: 'Viewer User',
      role: 'viewer',
      provider: 'github',
    },
  };
}

/**
 * Extended Playwright test with custom fixtures
 *
 * @example
 * ```typescript
 * test.extend<TestFixtures>({
 *   authHelper: async ({}, use) => {
 *     await use(createAuthHelper());
 *   },
 *   apiClient: async ({}, use) => {
 *     await use(createAPIClientFixture());
 *   },
 *   dbHelper: async ({}, use) => {
 *     await use(createDatabaseHelper());
 *   },
 *   assertionHelper: async ({}, use) => {
 *     await use(createAssertionHelper());
 *   },
 *   testUsers: async ({}, use) => {
 *     await use(createTestUsersFixture());
 *   },
 * });
 * ```
 */
export const test = base.extend<TestFixtures>({
  authHelper: async ({}, use) => {
    await use(createAuthHelper());
  },
  apiClient: async ({}, use) => {
    await use(createAPIClientFixture());
  },
  dbHelper: async ({}, use) => {
    await use(createDatabaseHelper());
  },
  assertionHelper: async ({}, use) => {
    await use(createAssertionHelper());
  },
  testUsers: async ({}, use) => {
    await use(createTestUsersFixture());
  },
});

/**
 * Export test expect for convenience
 */
export { expect } from '@playwright/test';

/**
 * Export types
 */
export type { UserRole, OAuthProvider } from './utils/oauth-mocks.js';
export type { UserData, SessionData } from './utils/api-client.js';
export type { TestUser, TestSession, TestRefreshToken, TestAuditLog } from './utils/db-helpers.js';

/**
 * Export all utilities
 */
export * from './utils/oauth-mocks.js';
export * from './utils/auth-helpers.js';
export * from './utils/api-client.js';
export * from './utils/db-helpers.js';
export * from './utils/assertions.js';
