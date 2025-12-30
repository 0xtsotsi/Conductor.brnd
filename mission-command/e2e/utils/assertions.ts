/**
 * Test Assertions for E2E Testing
 *
 * Provides assertion helpers for verifying authentication state,
 * page access, user roles, and audit logs in Playwright tests.
 *
 * @packageDocumentation
 */

import { Page, expect } from '@playwright/test';
import type { UserRole } from './oauth-mocks.js';

/**
 * Local storage key for JWT token
 */
const TOKEN_KEY = 'mission_command_jwt';

/**
 * Assert that a user is logged in
 *
 * @param page - Playwright Page object
 * @param message - Optional assertion message
 *
 * @example
 * ```typescript
 * await assertUserLoggedIn(page);
 * ```
 */
export async function assertUserLoggedIn(page: Page, message?: string): Promise<void> {
  const token = await page.evaluate(({ tokenKey }) => {
    return localStorage.getItem(tokenKey);
  }, { tokenKey: TOKEN_KEY });

  expect(token, message || 'User should be logged in').not.toBeNull();
}

/**
 * Assert that a user is logged out
 *
 * @param page - Playwright Page object
 * @param message - Optional assertion message
 *
 * @example
 * ```typescript
 * await assertUserLoggedOut(page);
 * ```
 */
export async function assertUserLoggedOut(page: Page, message?: string): Promise<void> {
  const token = await page.evaluate(({ tokenKey }) => {
    return localStorage.getItem(tokenKey);
  }, { tokenKey: TOKEN_KEY });

  expect(token, message || 'User should be logged out').toBeNull();
}

/**
 * Assert that current user has a specific role
 *
 * @param page - Playwright Page object
 * @param expectedRole - Expected user role
 * @param message - Optional assertion message
 *
 * @example
 * ```typescript
 * await assertUserHasRole(page, 'admin');
 * ```
 */
export async function assertUserHasRole(
  page: Page,
  expectedRole: UserRole,
  message?: string
): Promise<void> {
  const token = await page.evaluate(({ tokenKey }) => {
    return localStorage.getItem(tokenKey);
  }, { tokenKey: TOKEN_KEY });

  expect(token, 'User should be logged in').not.toBeNull();

  // Decode JWT to get role
  const parts = token!.split('.');
  expect(parts.length, 'Token should have 3 parts').toBe(3);

  const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
  const actualRole = payload.role;

  expect(actualRole, message || `User should have role: ${expectedRole}`).toBe(expectedRole);
}

/**
 * Assert that a page is accessible for the current user's role
 *
 * @param page - Playwright Page object
 * @param path - Page path to test
 * @param role - User role
 * @param message - Optional assertion message
 *
 * @example
 * ```typescript
 * await assertPageAccessible(page, '/api/users', 'admin');
 * ```
 */
export async function assertPageAccessible(
  page: Page,
  path: string,
  role: UserRole,
  message?: string
): Promise<void> {
  const response = await page.goto(path);

  expect(response, 'Should receive a response').not.toBeNull();

  const status = response!.status();

  // Admin should have access to everything
  // Operator and viewer may have restricted access
  const shouldHaveAccess = role === 'admin' ||
    (role === 'operator' && !path.includes('/users')) ||
    (role === 'viewer' && path.startsWith('/api/approvals') && !path.includes('/timeline'));

  if (shouldHaveAccess) {
    expect(
      status,
      message || `Page ${path} should be accessible for ${role}`
    ).toBeLessThan(400);
  } else {
    expect(
      status,
      message || `Page ${path} should be forbidden for ${role}`
    ).toBeGreaterThanOrEqual(400);
  }
}

/**
 * Assert that a page is forbidden for the current user's role
 *
 * @param page - Playwright Page object
 * @param path - Page path to test
 * @param role - User role
 * @param message - Optional assertion message
 *
 * @example
 * ```typescript
 * await assertPageForbidden(page, '/api/users', 'viewer');
 * ```
 */
export async function assertPageForbidden(
  page: Page,
  path: string,
  role: UserRole,
  message?: string
): Promise<void> {
  const response = await page.goto(path);

  expect(response, 'Should receive a response').not.toBeNull();

  const status = response!.status();

  expect(
    status,
    message || `Page ${path} should be forbidden for ${role}`
  ).toBeGreaterThanOrEqual(400);
}

/**
 * Assert that an audit log entry exists
 *
 * @param pool - Database pool
 * @param action - Action to search for
 * @param userId - User ID (optional)
 * @param resource - Resource (optional)
 * @param timeout - Maximum time to wait in ms (default: 5000)
 *
 * @example
 * ```typescript
 * await assertAuditLogExists(pool, 'user.login', userId);
 * ```
 */
export async function assertAuditLogExists(
  pool: any,
  action: string,
  userId?: string,
  resource?: string,
  timeout: number = 5000
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    let query = 'SELECT * FROM mission_command_audit_log WHERE action = $1';
    const params: any[] = [action];

    if (userId) {
      query += ' AND user_id = $2';
      params.push(userId);
    }

    if (resource) {
      const paramIndex = userId ? 3 : 2;
      query += ` AND resource = $${paramIndex}`;
      params.push(resource);
    }

    const result = await pool.query(query, params);

    if (result.rows.length > 0) {
      expect(result.rows.length).toBeGreaterThan(0);
      return;
    }

    // Wait before retrying
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  throw new Error(`Audit log entry not found within ${timeout}ms: action=${action}, userId=${userId}, resource=${resource}`);
}

/**
 * Assert that audit log entry does NOT exist
 *
 * @param pool - Database pool
 * @param action - Action to search for
 * @param userId - User ID (optional)
 *
 * @example
 * ```typescript
 * await assertAuditLogNotExists(pool, 'user.delete', userId);
 * ```
 */
export async function assertAuditLogNotExists(
  pool: any,
  action: string,
  userId?: string
): Promise<void> {
  let query = 'SELECT * FROM mission_command_audit_log WHERE action = $1';
  const params: any[] = [action];

  if (userId) {
    query += ' AND user_id = $2';
    params.push(userId);
  }

  const result = await pool.query(query, params);

  expect(result.rows.length).toBe(0);
}

/**
 * Assert that page contains specific content
 *
 * @param page - Playwright Page object
 * @param selector - CSS selector or text
 * @param message - Optional assertion message
 *
 * @example
 * ```typescript
 * await assertPageContains(page, 'Welcome, Admin User');
 * ```
 */
export async function assertPageContains(
  page: Page,
  selector: string,
  message?: string
): Promise<void> {
  const element = page.locator(selector).first();

  await expect(element, message || `Page should contain: ${selector}`).toBeVisible();
}

/**
 * Assert that page does NOT contain specific content
 *
 * @param page - Playwright Page object
 * @param selector - CSS selector or text
 * @param message - Optional assertion message
 *
 * @example
 * ```typescript
 * await assertPageNotContains(page, 'Delete User');
 * ```
 */
export async function assertPageNotContains(
  page: Page,
  selector: string,
  message?: string
): Promise<void> {
  const element = page.locator(selector).first();

  await expect(element, message || `Page should not contain: ${selector}`).not.toBeVisible();
}

/**
 * Assert that URL matches expected pattern
 *
 * @param page - Playwright Page object
 * @param pattern - URL pattern or regex
 * @param message - Optional assertion message
 *
 * @example
 * ```typescript
 * await assertURLMatch(page, /\/dashboard/);
 * ```
 */
export async function assertURLMatch(
  page: Page,
  pattern: string | RegExp,
  message?: string
): Promise<void> {
  await page.waitForURL(pattern, { timeout: 5000 });

  const url = page.url();

  if (typeof pattern === 'string') {
    expect(url, message || `URL should match: ${pattern}`).toContain(pattern);
  } else {
    expect(url, message || `URL should match pattern: ${pattern}`).toMatch(pattern);
  }
}

/**
 * Assert that current user can perform a specific action
 *
 * @param page - Playwright Page object
 * @param action - Action to test (e.g., 'create', 'delete', 'approve')
 * @param resource - Resource type (e.g., 'user', 'workflow')
 * @param message - Optional assertion message
 *
 * @example
 * ```typescript
 * await assertCanPerformAction(page, 'delete', 'user');
 * ```
 */
export async function assertCanPerformAction(
  page: Page,
  action: string,
  resource: string,
  message?: string
): Promise<void> {
  const token = await page.evaluate(({ tokenKey }) => {
    return localStorage.getItem(tokenKey);
  }, { tokenKey: TOKEN_KEY });

  expect(token, 'User should be logged in').not.toBeNull();

  const parts = token!.split('.');
  const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
  const role = payload.role as UserRole;

  // Define permissions by role
  const permissions: Record<UserRole, string[]> = {
    admin: ['*'], // Admin can do everything
    operator: ['view', 'approve', 'create'],
    viewer: ['view'],
  };

  const rolePermissions = permissions[role];

  const hasPermission = rolePermissions.includes('*') || rolePermissions.includes(action);

  expect(
    hasPermission,
    message || `${role} should be able to ${action} ${resource}`
  ).toBe(true);
}

/**
 * Assert that current user CANNOT perform a specific action
 *
 * @param page - Playwright Page object
 * @param action - Action to test
 * @param resource - Resource type
 * @param message - Optional assertion message
 *
 * @example
 * ```typescript
 * await assertCannotPerformAction(page, 'delete', 'user');
 * ```
 */
export async function assertCannotPerformAction(
  page: Page,
  action: string,
  resource: string,
  message?: string
): Promise<void> {
  const token = await page.evaluate(({ tokenKey }) => {
    return localStorage.getItem(tokenKey);
  }, { tokenKey: TOKEN_KEY });

  expect(token, 'User should be logged in').not.toBeNull();

  const parts = token!.split('.');
  const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
  const role = payload.role as UserRole;

  // Define permissions by role
  const permissions: Record<UserRole, string[]> = {
    admin: ['*'],
    operator: ['view', 'approve', 'create'],
    viewer: ['view'],
  };

  const rolePermissions = permissions[role];

  const hasPermission = rolePermissions.includes('*') || rolePermissions.includes(action);

  expect(
    hasPermission,
    message || `${role} should NOT be able to ${action} ${resource}`
  ).toBe(false);
}

/**
 * Assert that navigation contains specific items based on role
 *
 * @param page - Playwright Page object
 * @param role - User role
 * @param expectedItems - Array of navigation items that should be visible
 * @param forbiddenItems - Array of navigation items that should NOT be visible
 *
 * @example
 * ```typescript
 * await assertNavigationItems(page, 'viewer', ['Dashboard', 'Approvals'], ['Users', 'Settings']);
 * ```
 */
export async function assertNavigationItems(
  page: Page,
  role: UserRole,
  expectedItems: string[],
  forbiddenItems?: string[]
): Promise<void> {
  // Check expected items are visible
  for (const item of expectedItems) {
    const element = page.locator(`nav:has-text("${item}")`).or(
      page.locator(`[role="navigation"]:has-text("${item}")`)
    );

    await expect(element.first(), `Navigation should contain: ${item}`).toBeVisible();
  }

  // Check forbidden items are not visible
  if (forbiddenItems) {
    for (const item of forbiddenItems) {
      const element = page.locator(`nav:has-text("${item}")`).or(
        page.locator(`[role="navigation"]:has-text("${item}")`)
      );

      await expect(element.first(), `Navigation should NOT contain: ${item}`).not.toBeVisible();
    }
  }
}

/**
 * Assert that user info is displayed correctly
 *
 * @param page - Playwright Page object
 * @param expectedEmail - Expected user email
 * @param expectedName - Expected user name
 * @param expectedRole - Expected user role
 *
 * @example
 * ```typescript
 * await assertUserInfoDisplayed(page, 'admin@test.com', 'Admin User', 'admin');
 * ```
 */
export async function assertUserInfoDisplayed(
  page: Page,
  expectedEmail: string,
  expectedName: string,
  expectedRole: UserRole
): Promise<void> {
  // Check email
  const emailElement = page.locator(`text=${expectedEmail}`).or(
    page.locator('[data-user-email]')
  );

  await expect(emailElement.first(), `Email should be displayed: ${expectedEmail}`).toBeVisible();

  // Check name
  const nameElement = page.locator(`text=${expectedName}`).or(
    page.locator('[data-user-name]')
  );

  await expect(nameElement.first(), `Name should be displayed: ${expectedName}`).toBeVisible();

  // Check role
  const roleElement = page.locator(`text=${expectedRole}`).or(
    page.locator('[data-user-role]')
  );

  await expect(roleElement.first(), `Role should be displayed: ${expectedRole}`).toBeVisible();
}

/**
 * Assert that error message is displayed
 *
 * @param page - Playwright Page object
 * @param expectedMessage - Expected error message
 * @param message - Optional assertion message
 *
 * @example
 * ```typescript
 * await assertErrorMessage(page, 'Invalid credentials');
 * ```
 */
export async function assertErrorMessage(
  page: Page,
  expectedMessage: string,
  message?: string
): Promise<void> {
  const errorElement = page.locator('[role="alert"], .error, .error-message').filter({
    hasText: expectedMessage,
  });

  await expect(errorElement.first(), message || `Error message should be displayed: ${expectedMessage}`).toBeVisible();
}

/**
 * Assert that success message is displayed
 *
 * @param page - Playwright Page object
 * @param expectedMessage - Expected success message
 * @param message - Optional assertion message
 *
 * @example
 * ```typescript
 * await assertSuccessMessage(page, 'User created successfully');
 * ```
 */
export async function assertSuccessMessage(
  page: Page,
  expectedMessage: string,
  message?: string
): Promise<void> {
  const successElement = page.locator('[role="status"], .success, .success-message').filter({
    hasText: expectedMessage,
  });

  await expect(successElement.first(), message || `Success message should be displayed: ${expectedMessage}`).toBeVisible();
}

/**
 * Assert that loading indicator is shown
 *
 * @param page - Playwright Page object
 * @param selector - Loading element selector (default: '[data-loading], .loading, .spinner')
 *
 * @example
 * ```typescript
 * await assertLoading(page);
 * ```
 */
export async function assertLoading(
  page: Page,
  selector: string = '[data-loading], .loading, .spinner'
): Promise<void> {
  const loadingElement = page.locator(selector).first();

  await expect(loadingElement, 'Loading indicator should be visible').toBeVisible();
}

/**
 * Assert that loading indicator is hidden
 *
 * @param page - Playwright Page object
 * @param selector - Loading element selector (default: '[data-loading], .loading, .spinner')
 *
 * @example
 * ```typescript
 * await assertNotLoading(page);
 * ```
 */
export async function assertNotLoading(
  page: Page,
  selector: string = '[data-loading], .loading, .spinner'
): Promise<void> {
  const loadingElement = page.locator(selector).first();

  await expect(loadingElement, 'Loading indicator should not be visible').not.toBeVisible({
    timeout: 10000,
  });
}

/**
 * Assert that page title matches expected value
 *
 * @param page - Playwright Page object
 * @param expectedTitle - Expected page title
 *
 * @example
 * ```typescript
 * await assertPageTitle(page, 'Mission Command - Dashboard');
 * ```
 */
export async function assertPageTitle(page: Page, expectedTitle: string): Promise<void> {
  await expect(page).toHaveTitle(new RegExp(expectedTitle));
}

/**
 * Assert that form validation error is displayed
 *
 * @param page - Playwright Page object
 * @param field - Field name or label
 * @param expectedError - Expected error message
 *
 * @example
 * ```typescript
 * await assertValidationError(page, 'Email', 'Email is required');
 * ```
 */
export async function assertValidationError(
  page: Page,
  field: string,
  expectedError: string
): Promise<void> {
  const fieldElement = page.locator(`[name="${field}"], [id="${field}"], label:has-text("${field}")`);

  const errorElement = fieldElement.locator('~ .error, + .error, .. > .error').filter({
    hasText: expectedError,
  });

  await expect(errorElement.first(), `Validation error should be shown for ${field}: ${expectedError}`).toBeVisible();
}

/**
 * Assert that modal/dialog is visible
 *
 * @param page - Playwright Page object
 * @param title - Modal title (optional)
 *
 * @example
 * ```typescript
 * await assertModalVisible(page, 'Delete User');
 * ```
 */
export async function assertModalVisible(page: Page, title?: string): Promise<void> {
  const modal = page.locator('[role="dialog"], .modal, .dialog');

  await expect(modal.first(), 'Modal should be visible').toBeVisible();

  if (title) {
    const titleElement = modal.locator(`h1, h2, h3, [role="dialog"] > div:first-child`).filter({
      hasText: title,
    });

    await expect(titleElement.first(), `Modal should have title: ${title}`).toBeVisible();
  }
}

/**
 * Assert that modal/dialog is NOT visible
 *
 * @param page - Playwright Page object
 *
 * @example
 * ```typescript
 * await assertModalNotVisible(page);
 * ```
 */
export async function assertModalNotVisible(page: Page): Promise<void> {
  const modal = page.locator('[role="dialog"], .modal, .dialog');

  await expect(modal.first(), 'Modal should not be visible').not.toBeVisible();
}
