import { test as base, expect } from '@playwright/test';
import { TestUser } from './test-options';

/**
 * Extended test fixture with Mission Command Centre specific functionality
 *
 * This fixture extends the base Playwright test with:
 * - Authentication helpers
 * - User role management
 * - Test data utilities
 */
export const test = base.extend<{
  authenticatedPage: typeof base.prototype['page'];
  testUser: TestUser;
  loginAs: (role: 'admin' | 'operator' | 'viewer') => Promise<void>;
  logout: () => Promise<void>;
}>({
  authenticatedPage: async ({ page }, use) => {
    // Default authenticated page (viewer role)
    await page.goto('/auth/login');
    await page.fill('input[name="email"]', 'viewer@test.local');
    await page.fill('input[name="password"]', 'test-password-viewer');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');
    await use(page);
  },

  testUser: async ({}, use) => {
    const user: TestUser = {
      id: 'test-user-1',
      email: 'viewer@test.local',
      name: 'Test Viewer',
      role: 'viewer',
    };
    await use(user);
  },

  loginAs: async ({ page }, use) => {
    const loginAsRole = async (role: 'admin' | 'operator' | 'viewer') => {
      const credentials = {
        admin: {
          email: 'admin@test.local',
          password: 'test-password-admin',
        },
        operator: {
          email: 'operator@test.local',
          password: 'test-password-operator',
        },
        viewer: {
          email: 'viewer@test.local',
          password: 'test-password-viewer',
        },
      };

      const cred = credentials[role];

      await page.goto('/auth/login');
      await page.fill('input[name="email"]', cred.email);
      await page.fill('input[name="password"]', cred.password);
      await page.click('button[type="submit"]');
      await page.waitForURL('/');
    };

    await use(loginAsRole);
  },

  logout: async ({ page }, use) => {
    const logout = async () => {
      await page.click('[data-testid="user-menu"]');
      await page.click('[data-testid="logout-button"]');
      await page.waitForURL('/auth/login');
    };

    await use(logout);
  },
});

export { expect } from '@playwright/test';
