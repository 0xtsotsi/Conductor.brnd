/**
 * Example E2E Test: Authentication Flow
 *
 * Demonstrates how to test authentication with the provided utilities.
 */

import { test, expect } from '../helpers';
import { loginAs, logout, mockOAuthLogin } from '../utils/auth-helpers';
import {
  assertUserLoggedIn,
  assertUserLoggedOut,
  assertUserHasRole,
  assertPageAccessible,
  assertPageForbidden,
} from '../utils/assertions';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to app
    await page.goto('/');
  });

  test('should login as admin and access admin pages', async ({ page, authHelper, assertionHelper }) => {
    // Login as admin
    await authHelper.loginAs(page, 'admin');

    // Verify user is logged in
    await assertionHelper.assertUserLoggedIn(page);

    // Verify user has admin role
    await assertionHelper.assertUserHasRole(page, 'admin');

    // Verify admin can access admin pages
    await assertionHelper.assertPageAccessible(page, '/api/users', 'admin');
  });

  test('should login as operator and access operator pages', async ({ page, authHelper, assertionHelper }) => {
    // Login as operator
    await authHelper.loginAs(page, 'operator');

    // Verify user is logged in
    await assertionHelper.assertUserLoggedIn(page);

    // Verify user has operator role
    await assertionHelper.assertUserHasRole(page, 'operator');

    // Verify operator can access approvals
    await assertionHelper.assertPageAccessible(page, '/api/approvals', 'operator');

    // Verify operator cannot access user management
    await assertionHelper.assertPageForbidden(page, '/api/users', 'operator');
  });

  test('should login as viewer with restricted access', async ({ page, authHelper, assertionHelper }) => {
    // Login as viewer
    await authHelper.loginAs(page, 'viewer');

    // Verify user is logged in
    await assertionHelper.assertUserLoggedIn(page);

    // Verify user has viewer role
    await assertionHelper.assertUserHasRole(page, 'viewer');

    // Verify viewer can view approvals (read-only)
    await assertionHelper.assertPageAccessible(page, '/api/approvals', 'viewer');

    // Verify viewer cannot access user management
    await assertionHelper.assertPageForbidden(page, '/api/users', 'viewer');
  });

  test('should logout and clear session', async ({ page, authHelper, assertionHelper }) => {
    // Login first
    await authHelper.loginAs(page, 'admin');
    await assertionHelper.assertUserLoggedIn(page);

    // Logout
    await authHelper.logout(page);

    // Verify user is logged out
    await assertionHelper.assertUserLoggedOut(page);

    // Verify protected pages are forbidden
    await assertionHelper.assertPageForbidden(page, '/api/users', 'viewer');
  });

  test('should handle OAuth login flow', async ({ page, authHelper, assertionHelper }) => {
    // Mock OAuth flow
    await authHelper.mockOAuthLogin(page, 'admin', 'github');

    // Navigate to login page
    await page.goto('/login');

    // Click login button (mocked)
    await page.click('button[data-provider="github"]');

    // Wait for redirect after OAuth
    await page.waitForURL('/');

    // Verify user is logged in
    await assertionHelper.assertUserLoggedIn(page);
    await assertionHelper.assertUserHasRole(page, 'admin');
  });

  test('should handle failed OAuth login', async ({ page, authHelper, assertionHelper }) => {
    // Mock failed OAuth
    await authHelper.mockOAuthFailed(page, 'github', 'access_denied');

    // Navigate to login page
    await page.goto('/login');

    // Click login button
    await page.click('button[data-provider="github"]');

    // Verify error message is shown
    await assertionHelper.assertErrorMessage(page, 'OAuth failed');
  });

  test('should maintain auth state across page navigation', async ({ page, authHelper, assertionHelper }) => {
    // Login
    await authHelper.loginAs(page, 'operator');

    // Navigate to different pages
    await page.goto('/dashboard');
    await assertionHelper.assertUserLoggedIn(page);

    await page.goto('/approvals');
    await assertionHelper.assertUserLoggedIn(page);

    await page.goto('/missions');
    await assertionHelper.assertUserLoggedIn(page);

    // Reload page
    await page.reload();
    await assertionHelper.assertUserLoggedIn(page);
  });

  test('should handle token expiration gracefully', async ({ page, apiClient, assertionHelper }) => {
    // Generate expired token
    const expiredToken = await apiClient.generateExpiredToken('viewer');

    // Set expired token
    await page.goto('/');
    await page.evaluate(({ token }) => {
      localStorage.setItem('mission_command_jwt', token);
    }, { token: expiredToken });

    // Reload page
    await page.reload();

    // Should redirect to login or show error
    await page.waitForURL('/login', { timeout: 5000 }).catch(() => {
      // If not redirected, check for error message
      return assertionHelper.assertErrorMessage(page, 'Session expired');
    });
  });
});

test.describe('Role-Based Access Control', () => {
  test('admin should have full access', async ({ page, authHelper, assertionHelper }) => {
    await authHelper.loginAs(page, 'admin');

    // Test access to various resources
    const resources = [
      '/api/users',
      '/api/approvals',
      '/api/missions',
      '/api/audit-logs',
    ];

    for (const resource of resources) {
      await assertionHelper.assertPageAccessible(page, resource, 'admin');
    }
  });

  test('operator should have limited access', async ({ page, authHelper, assertionHelper }) => {
    await authHelper.loginAs(page, 'operator');

    // Should have access to
    await assertionHelper.assertPageAccessible(page, '/api/approvals', 'operator');
    await assertionHelper.assertPageAccessible(page, '/api/missions', 'operator');

    // Should NOT have access to
    await assertionHelper.assertPageForbidden(page, '/api/users', 'operator');
  });

  test('viewer should have read-only access', async ({ page, authHelper, assertionHelper }) => {
    await authHelper.loginAs(page, 'viewer');

    // Should have read-only access to
    await assertionHelper.assertPageAccessible(page, '/api/approvals', 'viewer');
    await assertionHelper.assertPageAccessible(page, '/api/missions', 'viewer');

    // Should NOT have access to
    await assertionHelper.assertPageForbidden(page, '/api/users', 'viewer');
  });
});
