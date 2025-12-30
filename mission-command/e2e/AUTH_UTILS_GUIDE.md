# Authentication Utilities for E2E Testing

Comprehensive authentication utilities for testing Mission Command Centre with Playwright.

## Overview

The authentication utilities provide everything needed to test OAuth flows, JWT tokens, role-based access control, and session management in E2E tests.

## Quick Reference

| Utility File | Purpose | Key Functions |
|-------------|---------|---------------|
| `utils/oauth-mocks.ts` | Mock OAuth providers | `generateMockToken()`, `mockGitHubCallback()` |
| `utils/auth-helpers.ts` | Manage auth state | `loginAs()`, `logout()`, `getAuthToken()` |
| `utils/api-client.ts` | API requests | `APIClient`, `createTestClient()` |
| `utils/db-helpers.ts` | Database operations | `seedTestUsers()`, `createAuditLog()` |
| `utils/assertions.ts` | Verify behavior | `assertUserLoggedIn()`, `assertPageAccessible()` |
| `helpers.ts` | Test fixtures | `test.extend()`, custom fixtures |

## Usage Examples

### 1. Basic Authentication Test

```typescript
import { test } from '../helpers';

test('user can login and access dashboard', async ({ page, authHelper }) => {
  // Login as admin
  await authHelper.loginAs(page, 'admin');

  // Navigate to dashboard
  await page.goto('/dashboard');

  // Verify authentication
  await authHelper.assertUserLoggedIn(page);
  await authHelper.assertUserHasRole(page, 'admin');
});
```

### 2. Role-Based Access Control

```typescript
test('viewer cannot access admin pages', async ({ page, authHelper, assertionHelper }) => {
  // Login as viewer
  await authHelper.loginAs(page, 'viewer');

  // Try to access admin page
  await assertionHelper.assertPageForbidden(page, '/api/users', 'viewer');

  // Verify error message
  await assertionHelper.assertErrorMessage(page, 'Access denied');
});
```

### 3. OAuth Flow Testing

```typescript
test('OAuth login flow works', async ({ page, authHelper }) => {
  // Mock OAuth provider
  await authHelper.mockOAuthLogin(page, 'operator', 'github');

  // Navigate to login
  await page.goto('/login');
  await page.click('button[data-provider="github"]');

  // Wait for redirect
  await page.waitForURL('/');

  // Verify logged in
  await authHelper.assertUserLoggedIn(page);
  await authHelper.assertUserHasRole(page, 'operator');
});
```

### 4. API Client Usage

```typescript
test('API requests work with auth', async ({ apiClient }) => {
  // Login as admin
  await apiClient.loginAs('admin');

  // List users
  const response = await apiClient.getUsers();
  expect(response.success).toBe(true);

  // Create user
  await apiClient.createTestUser(apiClient.getToken()!, {
    email: 'test@example.com',
    name: 'Test User',
    role: 'operator',
  });
});
```

### 5. Database Setup

```typescript
test.beforeAll(async ({ dbHelper }) => {
  const pool = await dbHelper.getTestDbConnection();
  await dbHelper.createTestTables(pool);
  await dbHelper.seedTestUsers(pool);
});

test.afterAll(async ({ dbHelper }) => {
  const pool = await dbHelper.getTestDbConnection();
  await dbHelper.resetTestDatabase(pool);
  await dbHelper.closeTestDbConnection();
});
```

## Test Users

Three predefined test users are available:

```typescript
const TEST_USERS = {
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
```

## JWT Token Structure

```typescript
interface JWTPayload {
  sub: string;           // Provider user ID
  email: string;         // User email
  name: string;          // User name
  role: 'admin' | 'operator' | 'viewer';
  provider: 'github' | 'google';
  type: 'access';
  iat: number;           // Issued at
  exp: number;           // Expiration
}
```

## Environment Variables

```bash
# Database
TEST_DB_HOST=localhost
TEST_DB_PORT=5432
TEST_DB_NAME=mission_command_test
TEST_DB_USER=postgres
TEST_DB_PASSWORD=postgres

# API
VITE_MASTRA_API_URL=http://localhost:4111
MASTRA_API_URL=http://localhost:4111

# Frontend
FRONTEND_URL=http://localhost:5173
```

## Fixtures Reference

### authHelper

```typescript
interface AuthHelper {
  loginAs(page, role, provider?): Promise<void>;
  logout(page): Promise<void>;
  getAuthToken(page): Promise<string | null>;
  setAuthToken(page, token): Promise<void>;
  waitForAuthCheck(page, timeout?): Promise<void>;
  mockOAuthLogin(page, role?, provider?): Promise<void>;
  mockOAuthFailed(page, provider?, errorReason?): Promise<void>;
  getCurrentUser(page): Promise<any>;
  isAuthenticated(page): Promise<boolean>;
  getUserRole(page): Promise<UserRole | null>;
  clearAuthState(page): Promise<void>;
}
```

### apiClient

```typescript
interface APIClientFixture {
  authenticatedRequest<T>(method, endpoint, body?, token?): Promise<APIResponse<T>>;
  getUserInfo(token?): Promise<UserData>;
  getUsers(token?, limit?, offset?, filters?): Promise<PaginatedUsers>;
  createTestUser(token, userData): Promise<UserData>;
  deleteTestUser(token, userId): Promise<void>;
  updateTestUser(token, userId, updates): Promise<UserData>;
  invalidateAllSessions(token): Promise<void>;
  logout(token): Promise<void>;
  refreshAccessToken(refreshToken): Promise<Tokens>;
  getUserSessions(token, userId, limit?, offset?): Promise<Sessions>;
  getAuditLogs(token, userId?, limit?, offset?): Promise<AuditLog[]>;
  loginAs(role?, provider?): Promise<string>;
  setToken(token): void;
  getToken(): string | null>;
  setRefreshToken(token): void;
  getRefreshToken(): string | null>;
  clearTokens(): void;
  generateExpiredToken(role?): Promise<string>;
}
```

### dbHelper

```typescript
interface DatabaseHelper {
  getTestDbConnection(config?): Promise<Pool>;
  closeTestDbConnection(): Promise<void>;
  createTestTables(pool): Promise<void>;
  dropTestTables(pool): Promise<void>;
  seedTestUsers(pool, users?): Promise<TestUser[]>;
  cleanupTestUsers(pool, emails?): Promise<void>;
  resetTestDatabase(pool): Promise<void>;
  createTestSession(pool, userId, expiresAt?): Promise<TestSession>;
  createTestRefreshToken(pool, userId, expiresAt?): Promise<TestRefreshToken>;
  getUserByEmail(pool, email): Promise<TestUser | null>;
  getUserByProvider(pool, sub, provider): Promise<TestUser | null>;
  getUserSessions(pool, userId, limit?, offset?): Promise<Sessions>;
  invalidateUserSessions(pool, userId): Promise<number>;
  createAuditLog(pool, entry): Promise<TestAuditLog>;
  getAuditLogs(pool, userId, limit?, offset?): Promise<TestAuditLog[]>;
  executeQuery(pool, query, params?): Promise<QueryResult>;
  executeTransaction(pool, callback): Promise<any>;
}
```

### assertionHelper

```typescript
interface AssertionHelper {
  assertUserLoggedIn(page, message?): Promise<void>;
  assertUserLoggedOut(page, message?): Promise<void>;
  assertUserHasRole(page, expectedRole, message?): Promise<void>;
  assertPageAccessible(page, path, role, message?): Promise<void>;
  assertPageForbidden(page, path, role, message?): Promise<void>;
  assertAuditLogExists(pool, action, userId?, resource?, timeout?): Promise<void>;
  assertAuditLogNotExists(pool, action, userId?): Promise<void>;
  assertPageContains(page, selector, message?): Promise<void>;
  assertPageNotContains(page, selector, message?): Promise<void>;
  assertURLMatch(page, pattern, message?): Promise<void>;
  assertCanPerformAction(page, action, resource, message?): Promise<void>;
  assertCannotPerformAction(page, action, resource, message?): Promise<void>;
  assertNavigationItems(page, role, expectedItems, forbiddenItems?): Promise<void>;
  assertUserInfoDisplayed(page, email, name, role): Promise<void>;
  assertErrorMessage(page, expectedMessage, message?): Promise<void>;
  assertSuccessMessage(page, expectedMessage, message?): Promise<void>;
  assertLoading(page, selector?): Promise<void>;
  assertNotLoading(page, selector?): Promise<void>;
  assertPageTitle(page, expectedTitle): Promise<void>;
  assertValidationError(page, field, expectedError): Promise<void>;
  assertModalVisible(page, title?): Promise<void>;
  assertModalNotVisible(page): Promise<void>;
}
```

## Common Patterns

### Test Isolation

```typescript
test.beforeEach(async ({ dbHelper }) => {
  const pool = await dbHelper.getTestDbConnection();
  await dbHelper.resetTestDatabase(pool);
  await dbHelper.seedTestUsers(pool);
});

test.afterEach(async ({ page }) => {
  await logout(page);
});
```

### Multi-Role Testing

```typescript
const roles = ['admin', 'operator', 'viewer'] as const;

for (const role of roles) {
  test(`${role} can view approvals`, async ({ page, authHelper }) => {
    await authHelper.loginAs(page, role);
    await page.goto('/approvals');

    // All roles can view
    await expect(page.locator('[data-testid="approval-list"]')).toBeVisible();
  });
}
```

### Permission Matrix

```typescript
test('permission matrix', async ({ page, authHelper, assertionHelper }) => {
  const permissions = {
    admin: ['/api/users', '/api/approvals', '/api/missions'],
    operator: ['/api/approvals', '/api/missions'],
    viewer: ['/api/approvals'],
  };

  for (const [role, endpoints] of Object.entries(permissions)) {
    await authHelper.loginAs(page, role as UserRole);

    for (const endpoint of endpoints) {
      await assertionHelper.assertPageAccessible(page, endpoint, role as UserRole);
    }
  }
});
```

### Token Expiration

```typescript
test('handles expired token', async ({ page, apiClient, assertionHelper }) => {
  // Generate expired token
  const expiredToken = await apiClient.generateExpiredToken('viewer');

  // Set expired token
  await page.goto('/');
  await page.evaluate(({ token }) => {
    localStorage.setItem('mission_command_jwt', token);
  }, { token: expiredToken });

  // Reload and verify error
  await page.reload();
  await assertionHelper.assertErrorMessage(page, 'Session expired');
});
```

### Audit Log Verification

```typescript
test('actions are logged', async ({ page, authHelper, dbHelper, assertionHelper }) => {
  const pool = await dbHelper.getTestDbConnection();
  const users = await dbHelper.seedTestUsers(pool);
  const adminUser = users.find(u => u.email === 'admin@test.com');

  // Perform action
  await authHelper.loginAs(page, 'admin');
  await page.goto('/api/users');

  // Verify audit log
  await assertionHelper.assertAuditLogExists(
    pool,
    'api.users.list',
    adminUser!.id
  );
});
```

## Best Practices

1. **Always cleanup test data** between tests
2. **Use fixtures** instead of direct imports
3. **Test all roles** for permission checks
4. **Mock OAuth** in E2E tests (don't use real providers)
5. **Use assertions** from `assertions.ts` for consistency
6. **Set appropriate timeouts** for auth operations
7. **Verify both success and failure** scenarios
8. **Check audit logs** for important actions

## Troubleshooting

### "No access token available"

Ensure you call `loginAs()` before making authenticated requests:

```typescript
await authHelper.loginAs(page, 'admin');
const response = await apiClient.getUsers(); // Now works
```

### "User should be logged in" assertion fails

Check that AuthProvider is wrapping your app and token key matches:

```typescript
// In AuthProvider.tsx
const TOKEN_KEY = 'mission_command_jwt';

// In auth-helpers.ts
const TOKEN_KEY = 'mission_command_jwt'; // Must match
```

### Database connection errors

Verify environment variables and database is running:

```bash
# Check database
docker ps | grep postgres

# Test connection
psql $DATABASE_URL -c "SELECT 1"
```

### OAuth mock not working

Ensure routes are mocked before navigation:

```typescript
// ✅ Correct order
await authHelper.mockOAuthLogin(page, 'admin');
await page.goto('/login');

// ❌ Wrong order
await page.goto('/login');
await authHelper.mockOAuthLogin(page, 'admin'); // Too late
```

## Additional Resources

- See `examples/` directory for complete test examples
- Check inline JSDoc comments for detailed function documentation
- Refer to Playwright docs for testing best practices
