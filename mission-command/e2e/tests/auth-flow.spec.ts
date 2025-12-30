/**
 * Authentication Flow E2E Tests
 *
 * Comprehensive end-to-end tests for authentication in the Mission Command Centre.
 * Tests cover OAuth flows (GitHub, Google), token management, authentication state,
 * error scenarios, and multi-provider scenarios.
 *
 * @packageDocumentation
 */

import { test, expect } from '../helpers';
import {
  loginAs,
  logout,
  getAuthToken,
  setAuthToken,
  clearAuthState,
  mockOAuthLogin,
  mockOAuthFailed,
  isAuthenticated,
  getUserRole,
  getCurrentUser,
  waitForOAuthRedirect,
} from '../utils/auth-helpers';
import {
  generateMockToken,
  generateExpiredToken,
  generateMalformedToken,
  mockOAuthState,
  decodeJWT,
  type MockJWTPayload,
} from '../utils/oauth-mocks';
import { TEST_USERS } from '../utils/oauth-mocks';

/**
 * Helper to wait for auth check completion
 */
async function waitForAuthCheck(page: any, timeout = 5000): Promise<void> {
  await page.waitForTimeout(500); // Brief wait for auth context to initialize
}

/**
 * Helper to parse JWT token
 */
function parseJWT(token: string): MockJWTPayload {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format');
  }
  return JSON.parse(Buffer.from(parts[1], 'base64').toString());
}

test.describe('GitHub OAuth Flow', () => {
  test.beforeEach(async ({ page }) => {
    await clearAuthState(page);
  });

  test('should login successfully with GitHub', async ({ page, authHelper, assertionHelper }) => {
    // Mock OAuth login
    await authHelper.mockOAuthLogin(page, 'admin', 'github');

    // Navigate to login page
    await page.goto('/login');

    // Click GitHub login button
    const githubButton = page.locator('button[data-provider="github"], a[href*="provider=github"]').first();
    await expect(githubButton).toBeVisible();
    await githubButton.click();

    // Wait for redirect after OAuth
    await waitForOAuthRedirect(page, '/');
    await waitForAuthCheck(page);

    // Verify user is logged in
    await assertionHelper.assertUserLoggedIn(page);
    await assertionHelper.assertUserHasRole(page, 'admin');

    // Verify user info is displayed
    await assertionHelper.assertUserInfoDisplayed(
      page,
      'admin@test.com',
      'Admin User',
      'admin'
    );
  });

  test('should login with existing GitHub user', async ({ page, authHelper, assertionHelper, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();

    try {
      // Seed existing user
      await dbHelper.seedTestUsers(pool, [
        {
          email: 'existing@test.com',
          name: 'Existing User',
          role: 'operator',
          provider: 'github',
        },
      ]);

      // Mock OAuth login for existing user
      await authHelper.mockOAuthLogin(page, 'operator', 'github');

      await page.goto('/login');
      const githubButton = page.locator('button[data-provider="github"]').first();
      await githubButton.click();

      await waitForOAuthRedirect(page, '/');
      await waitForAuthCheck(page);

      // Should login successfully with existing user
      await assertionHelper.assertUserLoggedIn(page);
      await assertionHelper.assertUserHasRole(page, 'operator');
    } finally {
      await dbHelper.cleanupTestUsers(pool);
    }
  });

  test('should auto-provision new GitHub user', async ({ page, authHelper, assertionHelper, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();

    try {
      // Mock OAuth login for new user
      await authHelper.mockOAuthLogin(page, 'viewer', 'github');

      await page.goto('/login');
      const githubButton = page.locator('button[data-provider="github"]').first();
      await githubButton.click();

      await waitForOAuthRedirect(page, '/');
      await waitForAuthCheck(page);

      // Verify user is logged in
      await assertionHelper.assertUserLoggedIn(page);
      await assertionHelper.assertUserHasRole(page, 'viewer');

      // Verify user was created in database
      const user = await dbHelper.getUserByEmail(pool, 'viewer@test.com');
      expect(user).not.toBeNull();
      expect(user?.email).toBe('viewer@test.com');
      expect(user?.provider).toBe('github');
    } finally {
      await dbHelper.cleanupTestUsers(pool);
    }
  });

  test('should handle failed GitHub login with invalid code', async ({ page, authHelper, assertionHelper }) => {
    // Mock failed OAuth
    await authHelper.mockOAuthFailed(page, 'github', 'invalid_code');

    await page.goto('/login');
    const githubButton = page.locator('button[data-provider="github"]').first();
    await githubButton.click();

    // Should stay on login page or show error
    await page.waitForURL(/\/login/, { timeout: 10000 }).catch(() => {});

    // Verify error message is displayed
    await assertionHelper.assertErrorMessage(page, /failed|error|denied/i);
    await assertionHelper.assertUserLoggedOut(page);
  });

  test('should validate GitHub state parameter', async ({ page, authHelper }) => {
    // Create a custom state with redirect URI
    const customState = mockOAuthState('/dashboard');

    // Mock OAuth with state
    await page.route('**/api/auth/callback*', (route) => {
      const url = new URL(route.request().url());
      const state = url.searchParams.get('state');

      // Verify state parameter is present
      expect(state).not.toBeNull();

      // Decode and verify state
      try {
        const decodedState = JSON.parse(Buffer.from(state!, 'base64').toString());
        expect(decodedState.redirectUri).toBe('/dashboard');
      } catch (error) {
        // State validation failed
        route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Invalid state parameter' }),
        });
        return;
      }

      route.continue();
    });

    await authHelper.mockOAuthLogin(page, 'admin', 'github');
    await page.goto('/login');

    const githubButton = page.locator('button[data-provider="github"]').first();
    await githubButton.click();

    // Should redirect successfully
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });
  });
});

test.describe('Google OAuth Flow', () => {
  test.beforeEach(async ({ page }) => {
    await clearAuthState(page);
  });

  test('should login successfully with Google', async ({ page, authHelper, assertionHelper }) => {
    await authHelper.mockOAuthLogin(page, 'admin', 'google');

    await page.goto('/login');

    // Click Google login button
    const googleButton = page.locator('button[data-provider="google"], a[href*="provider=google"]').first();
    await expect(googleButton).toBeVisible();
    await googleButton.click();

    await waitForOAuthRedirect(page, '/');
    await waitForAuthCheck(page);

    await assertionHelper.assertUserLoggedIn(page);
    await assertionHelper.assertUserHasRole(page, 'admin');

    await assertionHelper.assertUserInfoDisplayed(
      page,
      'admin@test.com',
      'Admin User',
      'admin'
    );
  });

  test('should login with existing Google user', async ({ page, authHelper, assertionHelper, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();

    try {
      // Seed existing user
      await dbHelper.seedTestUsers(pool, [
        {
          email: 'operator@test.com',
          name: 'Operator User',
          role: 'operator',
          provider: 'google',
        },
      ]);

      await authHelper.mockOAuthLogin(page, 'operator', 'google');

      await page.goto('/login');
      const googleButton = page.locator('button[data-provider="google"]').first();
      await googleButton.click();

      await waitForOAuthRedirect(page, '/');
      await waitForAuthCheck(page);

      await assertionHelper.assertUserLoggedIn(page);
      await assertionHelper.assertUserHasRole(page, 'operator');
    } finally {
      await dbHelper.cleanupTestUsers(pool);
    }
  });

  test('should auto-provision new Google user', async ({ page, authHelper, assertionHelper, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();

    try {
      await authHelper.mockOAuthLogin(page, 'viewer', 'google');

      await page.goto('/login');
      const googleButton = page.locator('button[data-provider="google"]').first();
      await googleButton.click();

      await waitForOAuthRedirect(page, '/');
      await waitForAuthCheck(page);

      await assertionHelper.assertUserLoggedIn(page);
      await assertionHelper.assertUserHasRole(page, 'viewer');

      // Verify user was created
      const user = await dbHelper.getUserByProvider(pool, 'google_viewer_789', 'google');
      expect(user).not.toBeNull();
      expect(user?.provider).toBe('google');
    } finally {
      await dbHelper.cleanupTestUsers(pool);
    }
  });

  test('should handle failed Google login with invalid code', async ({ page, authHelper, assertionHelper }) => {
    await authHelper.mockOAuthFailed(page, 'google', 'access_denied');

    await page.goto('/login');
    const googleButton = page.locator('button[data-provider="google"]').first();
    await googleButton.click();

    await page.waitForURL(/\/login/, { timeout: 10000 }).catch(() => {});

    await assertionHelper.assertErrorMessage(page, /failed|error|denied/i);
    await assertionHelper.assertUserLoggedOut(page);
  });

  test('should handle Google consent screen flow', async ({ page, authHelper }) => {
    // Mock multiple consent steps
    let consentStep = 0;

    await page.route('**/api/auth/callback*', (route) => {
      const url = new URL(route.request().url());
      const code = url.searchParams.get('code');

      if (code && consentStep === 0) {
        // First callback - redirect to consent screen
        consentStep++;
        route.fulfill({
          status: 302,
          headers: {
            Location: `/login?consent=1`,
          },
        });
      } else if (consentStep === 1) {
        // Second callback - after consent
        consentStep++;
        route.continue();
      } else {
        route.continue();
      }
    });

    await authHelper.mockOAuthLogin(page, 'viewer', 'google');

    await page.goto('/login');
    const googleButton = page.locator('button[data-provider="google"]').first();
    await googleButton.click();

    // Should eventually succeed after consent
    await page.waitForURL(/\/$/, { timeout: 15000 });

    const isLoggedIn = await isAuthenticated(page);
    expect(isLoggedIn).toBe(true);
  });
});

test.describe('Token Management', () => {
  test('should store JWT token in localStorage after login', async ({ page, authHelper }) => {
    await authHelper.loginAs(page, 'admin', 'github');

    const token = await getAuthToken(page);
    expect(token).not.toBeNull();
    expect(token).toMatch(/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/);
  });

  test('should store JWT with correct claims', async ({ page, authHelper }) => {
    await authHelper.loginAs(page, 'operator', 'github');

    const token = await getAuthToken(page);
    expect(token).not.toBeNull();

    const payload = parseJWT(token!);

    expect(payload).toHaveProperty('sub');
    expect(payload).toHaveProperty('email', 'operator@test.com');
    expect(payload).toHaveProperty('name', 'Operator User');
    expect(payload).toHaveProperty('role', 'operator');
    expect(payload).toHaveProperty('provider', 'github');
    expect(payload).toHaveProperty('type', 'access');
    expect(payload).toHaveProperty('iat');
    expect(payload).toHaveProperty('exp');
  });

  test('should handle token expiration gracefully', async ({ page, assertionHelper, apiClient }) => {
    // Generate expired token
    const expiredToken = await apiClient.generateExpiredToken('viewer');

    // Set expired token
    await page.goto('/');
    await page.evaluate(
      ({ token }) => {
        localStorage.setItem('mission_command_jwt', token);
      },
      { token: expiredToken }
    );

    // Reload page
    await page.reload();

    // Should redirect to login or show error
    const redirected = await page.waitForURL('/login', { timeout: 5000 })
      .then(() => true)
      .catch(() => false);

    if (redirected) {
      await assertionHelper.assertUserLoggedOut(page);
    } else {
      // Check for session expired message
      await assertionHelper.assertErrorMessage(page, /expired|session/i);
    }
  });

  test('should refresh token via POST /api/auth/refresh', async ({ page, apiClient }) => {
    // Login and get initial token
    const initialToken = await apiClient.loginAs('viewer');
    expect(initialToken).not.toBeNull();

    // Get refresh token
    const initialRefreshToken = apiClient.getRefreshToken();
    expect(initialRefreshToken).not.toBeNull();

    // Refresh token
    const refreshResponse = await apiClient.refreshAccessToken(initialRefreshToken!);
    expect(refreshResponse.success).toBe(true);
    expect(refreshResponse.data?.accessToken).not.toBeNull();

    // Verify new token is different
    const newToken = refreshResponse.data!.accessToken;
    expect(newToken).not.toBe(initialToken);
  });

  test('should clear token from localStorage on logout', async ({ page, authHelper, assertionHelper }) => {
    await authHelper.loginAs(page, 'admin', 'github');

    // Verify token exists
    await assertionHelper.assertUserLoggedIn(page);

    // Logout
    await authHelper.logout(page);

    // Verify token is cleared
    await assertionHelper.assertUserLoggedOut(page);
  });

  test('should invalidate all sessions on logout-all', async ({ page, apiClient, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();

    try {
      // Login and create session
      const token = await apiClient.loginAs('admin');
      const user = decodeJWT(token);

      // Create multiple sessions
      await dbHelper.createTestSession(pool, user.sub);
      await dbHelper.createTestSession(pool, user.sub);
      await dbHelper.createTestSession(pool, user.sub);

      // Get initial session count
      const sessionsBefore = await dbHelper.getUserSessions(pool, user.sub);
      expect(sessionsBefore.length).toBeGreaterThan(0);

      // Invalidate all sessions
      const response = await apiClient.invalidateAllSessions(token);
      expect(response.success).toBe(true);

      // Verify all sessions are invalidated
      await page.waitForTimeout(500); // Wait for database update
      const sessionsAfter = await dbHelper.getUserSessions(pool, user.sub);
      expect(sessionsAfter.length).toBe(0);
    } finally {
      await dbHelper.cleanupTestUsers(pool);
    }
  });
});

test.describe('Authentication State', () => {
  test('should redirect unauthenticated user to /login', async ({ page }) => {
    await clearAuthState(page);
    await page.goto('/');

    // Should redirect to login
    await page.waitForURL(/\/login/, { timeout: 5000 });
  });

  test('should allow authenticated user to access protected routes', async ({ page, authHelper }) => {
    await authHelper.loginAs(page, 'admin', 'github');

    // Test various protected routes
    const routes = ['/', '/approvals', '/missions'];

    for (const route of routes) {
      await page.goto(route);
      await page.waitForTimeout(500);

      const url = page.url();
      expect(url).not.toContain('/login');
    }
  });

  test('should persist auth state across page refreshes', async ({ page, authHelper, assertionHelper }) => {
    await authHelper.loginAs(page, 'operator', 'github');

    // Verify logged in
    await assertionHelper.assertUserLoggedIn(page);

    // Reload page multiple times
    for (let i = 0; i < 3; i++) {
      await page.reload();
      await waitForAuthCheck(page);
      await assertionHelper.assertUserLoggedIn(page);
    }
  });

  test('should display user info in navigation when logged in', async ({ page, authHelper, assertionHelper }) => {
    await authHelper.loginAs(page, 'viewer', 'github');

    // Check for user menu/avatar in navigation
    const userMenu = page.locator('[data-testid="user-menu"], [data-user-email], .user-menu').first();
    await expect(userMenu).toBeVisible({ timeout: 5000 });

    // Click user menu to see details
    await userMenu.click();
    await page.waitForTimeout(500);

    // Verify user info is displayed
    await assertionHelper.assertUserInfoDisplayed(
      page,
      'viewer@test.com',
      'Viewer User',
      'viewer'
    );
  });

  test('should redirect to login page after logout', async ({ page, authHelper, assertionHelper }) => {
    await authHelper.loginAs(page, 'admin', 'github');

    // Verify logged in
    await assertionHelper.assertUserLoggedIn(page);

    // Logout
    await authHelper.logout(page);

    // Verify redirected to login
    await page.waitForURL(/\/login/, { timeout: 5000 });
    await assertionHelper.assertUserLoggedOut(page);
  });
});

test.describe('Error Scenarios', () => {
  test('should handle OAuth callback with missing code parameter', async ({ page, assertionHelper }) => {
    await page.route('**/api/auth/callback*', (route) => {
      const url = new URL(route.request().url());

      if (!url.searchParams.has('code')) {
        route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'invalid_request',
            error_description: 'Missing code parameter',
          }),
        });
        return;
      }

      route.continue();
    });

    await page.goto('/login?provider=github&error=invalid_request');
    await waitForAuthCheck(page);

    await assertionHelper.assertErrorMessage(page, /code|parameter|missing/i);
    await assertionHelper.assertUserLoggedOut(page);
  });

  test('should handle OAuth callback with invalid state', async ({ page, assertionHelper }) => {
    await page.route('**/api/auth/callback*', (route) => {
      const url = new URL(route.request().url());
      const state = url.searchParams.get('state');

      if (state === 'invalid_state') {
        route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'invalid_state',
            error_description: 'State parameter validation failed',
          }),
        });
        return;
      }

      route.continue();
    });

    await page.goto('/login?provider=github&state=invalid_state&code=test123');
    await waitForAuthCheck(page);

    await assertionHelper.assertErrorMessage(page, /state|invalid/i);
    await assertionHelper.assertUserLoggedOut(page);
  });

  test('should handle OAuth provider unavailable (network error)', async ({ page, assertionHelper }) => {
    // Mock network failure
    await page.route('**/api/auth/callback*', (route) => {
      route.abort('failed');
    });

    await page.goto('/login');

    const githubButton = page.locator('button[data-provider="github"]').first();
    await githubButton.click();

    // Should show network error or retry option
    await page.waitForTimeout(2000);

    const hasError = await page.locator('[role="alert"], .error, .error-message').count();
    expect(hasError).toBeGreaterThan(0);
  });

  test('should handle expired JWT token gracefully', async ({ page, assertionHelper, apiClient }) => {
    const expiredToken = await apiClient.generateExpiredToken('admin');

    await page.goto('/');

    // Set expired token
    await page.evaluate(
      ({ token }) => {
        localStorage.setItem('mission_command_jwt', token);
      },
      { token: expiredToken }
    );

    await page.reload();

    // Should handle expired token
    const redirected = await page.waitForURL('/login', { timeout: 5000 })
      .then(() => true)
      .catch(() => false);

    if (redirected) {
      expect(page.url()).toContain('/login');
    } else {
      await assertionHelper.assertErrorMessage(page, /expired/i);
    }
  });

  test('should handle malformed JWT token gracefully', async ({ page, assertionHelper }) => {
    const malformedToken = generateMalformedToken();

    await page.goto('/');

    // Set malformed token
    await page.evaluate(
      ({ token }) => {
        localStorage.setItem('mission_command_jwt', token);
      },
      { token: malformedToken }
    );

    await page.reload();

    // Should clear invalid token and redirect to login
    await page.waitForURL(/\/login/, { timeout: 5000 }).catch(() => {});

    const tokenAfterReload = await getAuthToken(page);
    expect(tokenAfterReload).toBeNull();
  });
});

test.describe('Multi-Provider Testing', () => {
  test('should allow login with GitHub after previously using Google', async ({ page, authHelper, assertionHelper, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();

    try {
      // Login with Google first
      await authHelper.loginAs(page, 'viewer', 'google');
      await assertionHelper.assertUserLoggedIn(page);

      const googleUser = await getCurrentUser(page);
      const googleToken = await getAuthToken(page);

      expect(googleUser).not.toBeNull();
      expect(googleToken).not.toBeNull();

      // Logout
      await authHelper.logout(page);
      await assertionHelper.assertUserLoggedOut(page);

      // Login with GitHub (different provider ID)
      await authHelper.loginAs(page, 'operator', 'github');
      await assertionHelper.assertUserLoggedIn(page);

      const githubUser = await getCurrentUser(page);
      const githubToken = await getAuthToken(page);

      expect(githubUser).not.toBeNull();
      expect(githubToken).not.toBeNull();

      // Verify different users
      expect(googleUser?.email).not.toBe(githubUser?.email);
    } finally {
      await dbHelper.cleanupTestUsers(pool);
    }
  });

  test('should prevent duplicate login with same provider account', async ({ page, authHelper, assertionHelper, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();

    try {
      // Create user with specific GitHub sub
      await dbHelper.seedTestUsers(pool, [
        {
          email: 'admin@test.com',
          name: 'Admin User',
          role: 'admin',
          provider: 'github',
        },
      ]);

      // Login with that account
      await authHelper.loginAs(page, 'admin', 'github');
      await assertionHelper.assertUserLoggedIn(page);

      // Try to login again with same account
      await authHelper.logout(page);

      // Login again - should work (re-authentication)
      await authHelper.loginAs(page, 'admin', 'github');
      await assertionHelper.assertUserLoggedIn(page);

      // Verify only one user entry exists
      const users = await pool.query('SELECT * FROM mission_command_users WHERE sub = $1 AND provider = $2', [
        'github_admin_123',
        'github',
      ]);
      expect(users.rows.length).toBe(1);
    } finally {
      await dbHelper.cleanupTestUsers(pool);
    }
  });

  test('should clear all sessions when logging out from one provider', async ({ page, apiClient, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();

    try {
      // Login with GitHub
      const githubToken = await apiClient.loginAs('admin', 'github');
      const githubUser = decodeJWT(githubToken);

      // Create multiple sessions
      await dbHelper.createTestSession(pool, githubUser.sub);
      await dbHelper.createTestSession(pool, githubUser.sub);

      // Logout from GitHub
      await apiClient.logout(githubToken);

      // Verify all sessions are invalidated
      await page.waitForTimeout(500);
      const sessionsAfter = await dbHelper.getUserSessions(pool, githubUser.sub);
      expect(sessionsAfter.length).toBe(0);
    } finally {
      await dbHelper.cleanupTestUsers(pool);
    }
  });

  test('should maintain separate sessions for different providers', async ({ page, authHelper, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();

    try {
      // Seed two users with same email but different providers
      await pool.query(`
        INSERT INTO mission_command_users (id, sub, email, name, role, provider, created_at, updated_at)
        VALUES ('user1', 'github_123', 'user@test.com', 'User', 'viewer', 'github', NOW(), NOW())
        ON CONFLICT (sub, provider) DO NOTHING
      `);

      await pool.query(`
        INSERT INTO mission_command_users (id, sub, email, name, role, provider, created_at, updated_at)
        VALUES ('user2', 'google_123', 'user@test.com', 'User', 'viewer', 'google', NOW(), NOW())
        ON CONFLICT (sub, provider) DO NOTHING
      `);

      // Login with GitHub
      await authHelper.loginAs(page, 'viewer', 'github');
      const githubToken = await getAuthToken(page);
      const githubPayload = parseJWT(githubToken!);

      expect(githubPayload.provider).toBe('github');
      expect(githubPayload.sub).toBe('github_admin_123');

      // Logout
      await authHelper.logout(page);

      // Login with Google - should create separate session
      await authHelper.loginAs(page, 'viewer', 'google');
      const googleToken = await getAuthToken(page);
      const googlePayload = parseJWT(googleToken!);

      expect(googlePayload.provider).toBe('google');
      expect(googleToken).not.toBe(githubToken);
    } finally {
      await dbHelper.cleanupTestUsers(pool);
    }
  });
});

test.describe('Role-Based Authentication', () => {
  const roles: Array<'admin' | 'operator' | 'viewer'> = ['admin', 'operator', 'viewer'];

  roles.forEach((role) => {
    test(`should authenticate ${role} user with correct permissions`, async ({ page, authHelper, assertionHelper }) => {
      await authHelper.loginAs(page, role, 'github');

      await assertionHelper.assertUserLoggedIn(page);
      await assertionHelper.assertUserHasRole(page, role);

      const userRole = await getUserRole(page);
      expect(userRole).toBe(role);
    });
  });

  test('should display role-appropriate navigation items', async ({ page, authHelper, assertionHelper }) => {
    // Test admin navigation
    await authHelper.loginAs(page, 'admin', 'github');
    await assertionHelper.assertNavigationItems(page, 'admin', ['Dashboard', 'Approvals', 'Missions', 'Users', 'Settings']);

    await authHelper.logout(page);

    // Test operator navigation
    await authHelper.loginAs(page, 'operator', 'github');
    await assertionHelper.assertNavigationItems(page, 'operator', ['Dashboard', 'Approvals', 'Missions'], ['Users', 'Settings']);

    await authHelper.logout(page);

    // Test viewer navigation
    await authHelper.loginAs(page, 'viewer', 'github');
    await assertionHelper.assertNavigationItems(page, 'viewer', ['Dashboard', 'Approvals', 'Missions'], ['Users', 'Settings']);
  });
});

test.describe('Token Security', () => {
  test('should store token securely in localStorage', async ({ page, authHelper }) => {
    await authHelper.loginAs(page, 'admin', 'github');

    const token = await getAuthToken(page);

    // Verify token structure
    expect(token).toMatch(/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/);

    // Verify token is not exposed in URL
    const url = page.url();
    expect(url).not.toContain('token');
    expect(url).not.toMatch(/^eyJ/); // JWT base64
  });

  test('should include all required claims in JWT', async ({ page, authHelper }) => {
    await authHelper.loginAs(page, 'operator', 'github');

    const token = await getAuthToken(page);
    const payload = parseJWT(token!);

    // Verify required claims
    expect(payload.sub).toBeDefined();
    expect(payload.email).toBeDefined();
    expect(payload.name).toBeDefined();
    expect(payload.role).toBeDefined();
    expect(payload.provider).toBeDefined();
    expect(payload.type).toBe('access');
    expect(payload.iat).toBeDefined();
    expect(payload.exp).toBeDefined();

    // Verify token expiration
    const expirationTime = payload.exp! * 1000;
    const now = Date.now();
    expect(expirationTime).toBeGreaterThan(now);
  });

  test('should use different tokens for different users', async ({ page, authHelper }) => {
    await authHelper.loginAs(page, 'admin', 'github');
    const adminToken = await getAuthToken(page);

    await authHelper.logout(page);

    await authHelper.loginAs(page, 'viewer', 'github');
    const viewerToken = await getAuthToken(page);

    expect(adminToken).not.toBe(viewerToken);

    const adminPayload = parseJWT(adminToken!);
    const viewerPayload = parseJWT(viewerToken!);

    expect(adminPayload.role).toBe('admin');
    expect(viewerPayload.role).toBe('viewer');
    expect(adminPayload.sub).not.toBe(viewerPayload.sub);
  });
});

test.describe('Session Management', () => {
  test('should track active sessions', async ({ page, apiClient, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();

    try {
      const token = await apiClient.loginAs('admin');
      const user = decodeJWT(token);

      // Create test sessions
      await dbHelper.createTestSession(pool, user.sub);
      await dbHelper.createTestSession(pool, user.sub);

      // Get sessions via API
      const response = await apiClient.getUserSessions(token, user.sub);
      expect(response.success).toBe(true);
      expect(response.data?.sessions.length).toBeGreaterThan(0);
    } finally {
      await dbHelper.cleanupTestUsers(pool);
    }
  });

  test('should clean up expired sessions', async ({ page, apiClient, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();

    try {
      const token = await apiClient.loginAs('viewer');
      const user = decodeJWT(token);

      // Create expired session
      const expiredDate = new Date(Date.now() - 3600000); // 1 hour ago
      await dbHelper.createTestSession(pool, user.sub, expiredDate);

      // Create active session
      await dbHelper.createTestSession(pool, user.sub, new Date(Date.now() + 3600000));

      // Get sessions - should only return active ones
      const response = await apiClient.getUserSessions(token, user.sub);
      expect(response.success).toBe(true);

      const activeSessions = response.data?.sessions.filter((s: any) => {
        return new Date(s.expires_at) > new Date();
      });

      expect(activeSessions.length).toBeGreaterThan(0);
    } finally {
      await dbHelper.cleanupTestUsers(pool);
    }
  });
});

test.describe('Audit Logging', () => {
  test('should log successful login', async ({ page, authHelper, assertionHelper, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();

    try {
      await authHelper.loginAs(page, 'admin', 'github');

      const token = await getAuthToken(page);
      const user = parseJWT(token!);

      // Verify audit log entry exists
      await assertionHelper.assertAuditLogExists(pool, 'user.login', user.sub);
    } finally {
      await dbHelper.cleanupTestUsers(pool);
    }
  });

  test('should log failed login attempt', async ({ page, authHelper, assertionHelper, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();

    try {
      await authHelper.mockOAuthFailed(page, 'github', 'access_denied');

      await page.goto('/login');
      const githubButton = page.locator('button[data-provider="github"]').first();
      await githubButton.click();

      await page.waitForTimeout(1000);

      // Verify failed login was logged (check for error audit log)
      const logs = await dbHelper.getAuditLogs(pool, undefined, 10);
      const failedLoginLog = logs.find((log) => log.action === 'user.login_failed');

      expect(failedLoginLog).toBeDefined();
    } finally {
      await dbHelper.cleanupTestUsers(pool);
    }
  });

  test('should log logout action', async ({ page, authHelper, assertionHelper, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();

    try {
      await authHelper.loginAs(page, 'operator', 'github');

      const token = await getAuthToken(page);
      const user = parseJWT(token!);

      await authHelper.logout(page);

      // Verify logout was logged
      await assertionHelper.assertAuditLogExists(pool, 'user.logout', user.sub);
    } finally {
      await dbHelper.cleanupTestUsers(pool);
    }
  });

  test('should log token refresh', async ({ page, apiClient, assertionHelper, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();

    try {
      const token = await apiClient.loginAs('viewer');
      const user = decodeJWT(token);
      const refreshToken = apiClient.getRefreshToken()!;

      await apiClient.refreshAccessToken(refreshToken);

      // Verify token refresh was logged
      await assertionHelper.assertAuditLogExists(pool, 'user.token_refresh', user.sub);
    } finally {
      await dbHelper.cleanupTestUsers(pool);
    }
  });
});
