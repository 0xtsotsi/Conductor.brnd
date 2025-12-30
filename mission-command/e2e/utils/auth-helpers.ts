/**
 * Authentication Helpers for E2E Testing
 *
 * Provides helper functions for managing authentication state in Playwright tests.
 * Handles login, logout, token management, and OAuth mocking.
 *
 * @packageDocumentation
 */

import { Page, Locator } from '@playwright/test';
import {
  generateMockToken,
  mockGitHubCallback,
  mockGoogleCallback,
  TEST_USERS,
  type UserRole,
  type OAuthProvider,
} from './oauth-mocks.js';

/**
 * Local storage key for JWT token (must match AuthProvider)
 */
const TOKEN_KEY = 'mission_command_jwt';

/**
 * API base URL from environment or default
 */
const API_URL = process.env.VITE_MASTRA_API_URL || process.env.MASTRA_API_URL || 'http://localhost:4111';

/**
 * Frontend URL from environment or default
 */
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

/**
 * Login as a specific role by setting JWT in localStorage
 *
 * @param page - Playwright Page object
 * @param role - User role (admin, operator, viewer)
 * @param provider - OAuth provider (github, google)
 * @returns Promise that resolves when login is complete
 *
 * @example
 * ```typescript
 * await loginAs(page, 'admin');
 * await page.goto('/dashboard');
 * ```
 */
export async function loginAs(
  page: Page,
  role: UserRole = 'viewer',
  provider: OAuthProvider = 'github'
): Promise<void> {
  const profile = TEST_USERS[role];

  // Generate mock JWT token
  const token = await generateMockToken(
    {
      ...profile,
      provider,
    },
    role
  );

  // Set token in localStorage
  await page.goto(FRONTEND_URL);
  await page.evaluate(
    ({ tokenKey, jwtToken }) => {
      localStorage.setItem(tokenKey, jwtToken);
    },
    { tokenKey: TOKEN_KEY, jwtToken: token }
  );

  // Reload page to apply authentication
  await page.reload();
}

/**
 * Logout current user by clearing localStorage
 *
 * @param page - Playwright Page object
 * @returns Promise that resolves when logout is complete
 *
 * @example
 * ```typescript
 * await logout(page);
 * await page.goto('/login');
 * ```
 */
export async function logout(page: Page): Promise<void> {
  await page.goto(FRONTEND_URL);
  await page.evaluate(({ tokenKey }) => {
    localStorage.removeItem(tokenKey);
  }, { tokenKey: TOKEN_KEY });

  // Reload page to apply logout
  await page.reload();
}

/**
 * Get JWT token from localStorage
 *
 * @param page - Playwright Page object
 * @returns JWT token or null if not found
 *
 * @example
 * ```typescript
 * const token = await getAuthToken(page);
 * console.log('Token:', token);
 * ```
 */
export async function getAuthToken(page: Page): Promise<string | null> {
  const token = await page.evaluate(({ tokenKey }) => {
    return localStorage.getItem(tokenKey);
  }, { tokenKey: TOKEN_KEY });

  return token;
}

/**
 * Set JWT token in localStorage
 *
 * @param page - Playwright Page object
 * @param token - JWT token to set
 * @returns Promise that resolves when token is set
 *
 * @example
 * ```typescript
 * const token = generateMockToken(...);
 * await setAuthToken(page, token);
 * ```
 */
export async function setAuthToken(page: Page, token: string): Promise<void> {
  await page.goto(FRONTEND_URL);
  await page.evaluate(
    ({ tokenKey, jwtToken }) => {
      localStorage.setItem(tokenKey, jwtToken);
      // Dispatch storage event to trigger auth context update
      window.dispatchEvent(new Event('storage'));
    },
    { tokenKey: TOKEN_KEY, jwtToken: token }
  );
}

/**
 * Wait for authentication context to load
 *
 * @param page - Playwright Page object
 * @param timeout - Maximum time to wait in milliseconds (default: 5000)
 * @returns Promise that resolves when auth context is ready
 *
 * @example
 * ```typescript
 * await waitForAuthCheck(page);
 * const user = await page.evaluate(() => window.__MASTRA_USER__);
 * ```
 */
export async function waitForAuthCheck(page: Page, timeout: number = 5000): Promise<void> {
  // Wait for auth context to initialize (check for user object or loading state)
  await page.waitForFunction(
    () => {
      // Check if auth context has loaded (user is set or isLoading is false)
      const authElement = document.querySelector('[data-auth-loaded]') as HTMLElement;
      return authElement?.dataset.authLoaded === 'true';
    },
    undefined,
    { timeout }
  );
}

/**
 * Mock OAuth login by intercepting callback and setting mock token
 *
 * @param page - Playwright Page object
 * @param role - User role to login as
 * @param provider - OAuth provider
 * @returns Promise that resolves when OAuth flow is mocked
 *
 * @example
 * ```typescript
 * await mockOAuthLogin(page, 'admin', 'github');
 * await page.goto('/dashboard');
 * ```
 */
export async function mockOAuthLogin(
  page: Page,
  role: UserRole = 'viewer',
  provider: OAuthProvider = 'github'
): Promise<void> {
  // Generate mock callback response
  const mockResponse = provider === 'github'
    ? await mockGitHubCallback(role)
    : await mockGoogleCallback(role);

  // Intercept callback route and return mock response
  await page.route(`${API_URL}/api/auth/callback*`, (route) => {
    const url = new URL(route.request().url());

    // Check if this is a callback request with code
    if (url.searchParams.has('code')) {
      // Return redirect with mock tokens
      const tokens = Buffer.from(JSON.stringify({
        accessToken: mockResponse.accessToken,
        refreshToken: mockResponse.refreshToken,
      })).toString('base64');

      const redirectUrl = `${FRONTEND_URL}/#tokens=${tokens}`;
      route.fulfill({
        status: 302,
        headers: {
          Location: redirectUrl,
        },
      });
    } else {
      route.continue();
    }
  });

  // Intercept token exchange and return mock tokens
  await page.route('**/login/oauth/access_token', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        access_token: `mock-access-token-${role}`,
        token_type: 'bearer',
        scope: 'user:email',
      }),
    });
  });

  // Intercept user profile API calls
  if (provider === 'github') {
    await page.route('https://api.github.com/user', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: TEST_USERS[role].sub.replace('github_', ''),
          login: TEST_USERS[role].email.split('@')[0],
          email: TEST_USERS[role].email,
          name: TEST_USERS[role].name,
          avatar_url: TEST_USERS[role].avatar_url,
        }),
      });
    });
  } else if (provider === 'google') {
    await page.route('https://www.googleapis.com/oauth2/v2/userinfo', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: TEST_USERS[role].sub.replace('google_', ''),
          email: TEST_USERS[role].email,
          name: TEST_USERS[role].name,
          picture: TEST_USERS[role].avatar_url,
        }),
      });
    });
  }
}

/**
 * Mock failed OAuth login
 *
 * @param page - Playwright Page object
 * @param provider - OAuth provider
 * @param errorReason - Error reason (default: 'access_denied')
 * @returns Promise that resolves when error is mocked
 *
 * @example
 * ```typescript
 * await mockOAuthFailed(page, 'github', 'access_denied');
 * await page.goto('/login');
 * // Click login button and verify error is shown
 * ```
 */
export async function mockOAuthFailed(
  page: Page,
  provider: OAuthProvider = 'github',
  errorReason: string = 'access_denied'
): Promise<void> {
  await page.route(`${API_URL}/api/auth/callback*`, (route) => {
    // Return redirect with error
    route.fulfill({
      status: 302,
      headers: {
        Location: `${FRONTEND_URL}/login?error=${errorReason}`,
      },
    });
  });
}

/**
 * Navigate to login page and click OAuth login button
 *
 * @param page - Playwright Page object
 * @param provider - OAuth provider (github, google)
 * @returns Promise that resolves when login is initiated
 *
 * @example
 * ```typescript
 * await initiateOAuthLogin(page, 'github');
 * ```
 */
export async function initiateOAuthLogin(page: Page, provider: OAuthProvider = 'github'): Promise<void> {
  await page.goto(`${FRONTEND_URL}/login`);

  // Click the appropriate login button
  const button = page.locator(`button[data-provider="${provider}"], a[href*="provider=${provider}"]`);
  await button.click();
}

/**
 * Simulate token refresh
 *
 * @param page - Playwright Page object
 * @param role - User role for new token
 * @returns Promise that resolves when token is refreshed
 *
 * @example
 * ```typescript
 * await simulateTokenRefresh(page, 'operator');
 * ```
 */
export async function simulateTokenRefresh(page: Page, role: UserRole = 'viewer'): Promise<void> {
  const profile = TEST_USERS[role];
  const newToken = await generateMockToken(profile, role);

  // Intercept refresh endpoint
  await page.route(`${API_URL}/api/auth/refresh`, (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        accessToken: newToken,
        refreshToken: `mock-refresh-token-${role}-${Date.now()}`,
        tokenType: 'Bearer',
        expiresIn: '15m',
      }),
    });
  });

  // Set new token in localStorage
  await setAuthToken(page, newToken);
}

/**
 * Get current user information from page context
 *
 * @param page - Playwright Page object
 * @returns User object or null
 *
 * @example
 * ```typescript
 * const user = await getCurrentUser(page);
 * console.log(user.email, user.role);
 * ```
 */
export async function getCurrentUser(page: Page): Promise<any | null> {
  const user = await page.evaluate(() => {
    // Try to get user from window object (if exposed by app)
    const win = window as any;
    return win.__MASTRA_USER__ || null;
  });

  return user;
}

/**
 * Check if user is authenticated
 *
 * @param page - Playwright Page object
 * @returns True if authenticated, false otherwise
 *
 * @example
 * ```typescript
 * const isAuthenticated = await isAuthenticated(page);
 * expect(isAuthenticated).toBe(true);
 * ```
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
  const token = await getAuthToken(page);
  return token !== null;
}

/**
 * Get user role from JWT token
 *
 * @param page - Playwright Page object
 * @returns User role or null
 *
 * @example
 * ```typescript
 * const role = await getUserRole(page);
 * console.log('User role:', role);
 * ```
 */
export async function getUserRole(page: Page): Promise<UserRole | null> {
  const token = await getAuthToken(page);

  if (!token) {
    return null;
  }

  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    return payload.role as UserRole;
  } catch {
    return null;
  }
}

/**
 * Wait for user to be redirected after OAuth callback
 *
 * @param page - Playwright Page object
 * @param expectedPath - Expected path after redirect (default: '/')
 * @param timeout - Maximum time to wait in milliseconds (default: 10000)
 * @returns Promise that resolves when redirect is complete
 *
 * @example
 * ```typescript
 * await waitForOAuthRedirect(page, '/dashboard');
 * ```
 */
export async function waitForOAuthRedirect(
  page: Page,
  expectedPath: string = '/',
  timeout: number = 10000
): Promise<void> {
  await page.waitForURL(`**${expectedPath}`, { timeout });
}

/**
 * Clear all authentication state
 *
 * @param page - Playwright Page object
 * @returns Promise that resolves when state is cleared
 *
 * @example
 * ```typescript
 * await clearAuthState(page);
 * ```
 */
export async function clearAuthState(page: Page): Promise<void> {
  await page.goto(FRONTEND_URL);
  await page.evaluate(({ tokenKey }) => {
    localStorage.removeItem(tokenKey);
    sessionStorage.clear();
  }, { tokenKey: TOKEN_KEY });

  await page.reload();
}

/**
 * Setup authentication for multiple users (useful for multi-user tests)
 *
 * @param page - Playwright Page object
 * @param users - Array of user configurations
 * @returns Promise that resolves when all users are set up
 *
 * @example
 * ```typescript
 * await setupMultipleUsers(page, [
 *   { role: 'admin', context: adminContext },
 *   { role: 'operator', context: operatorContext },
 * ]);
 * ```
 */
export async function setupMultipleUsers(
  page: Page,
  users: Array<{ role: UserRole; provider?: OAuthProvider }>
): Promise<void> {
  for (const user of users) {
    const browserContext = page.context();
    const newPage = await browserContext.newPage();

    await loginAs(newPage, user.role, user.provider);
    await newPage.close();
  }
}

/**
 * Intercept and mock API requests that require authentication
 *
 * @param page - Playwright Page object
 * @param role - User role for mock responses
 * @returns Promise that resolves when interceptors are set up
 *
 * @example
 * ```typescript
 * await mockAuthenticatedAPI(page, 'admin');
 * await page.goto('/api/users');
 * ```
 */
export async function mockAuthenticatedAPI(page: Page, role: UserRole = 'viewer'): Promise<void> {
  const profile = TEST_USERS[role];

  // Intercept all API requests and add mock authorization header
  await page.route('**/api/**', async (route) => {
    const headers = route.request().headers();
    const token = await generateMockToken(profile, role);

    // Add authorization header
    headers['authorization'] = `Bearer ${token}`;

    route.continue({ headers });
  });
}
