import { test, expect } from '../fixtures/base';

/**
 * Example E2E Test for Mission Command Centre
 *
 * This test demonstrates how to use the test fixtures and utilities.
 * Remove this file when writing actual tests.
 */

test.describe('Authentication', () => {
  test('should redirect to login page when not authenticated', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/.*\/auth\/login/);
  });

  test('should display login form', async ({ page }) => {
    await page.goto('/auth/login');
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: /submit|login|sign in/i })).toBeVisible();
  });

  test('should login with valid credentials', async ({ loginAs }) => {
    await loginAs('viewer');
    // After login, we should be redirected to dashboard
    // Add assertions based on your actual application routes
  });

  test('should show error with invalid credentials', async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('input[name="email"]', 'invalid@test.local');
    await page.fill('input[name="password"]', 'wrong-password');
    await page.click('button[type="submit"]');

    // Expect error message to be shown
    await expect(page.getByTestId('error-message')).toBeVisible();
  });
});

test.describe('User Roles', () => {
  test('admin should have access to admin panel', async ({ page, loginAs }) => {
    await loginAs('admin');
    await page.goto('/admin');

    // Admin should see admin panel
    await expect(page.getByTestId('admin-panel')).toBeVisible();
  });

  test('operator should not have access to admin panel', async ({ page, loginAs }) => {
    await loginAs('operator');
    await page.goto('/admin');

    // Operator should see access denied or be redirected
    await expect(page.getByTestId('access-denied')).toBeVisible();
  });

  test('viewer should have read-only access', async ({ page, loginAs }) => {
    await loginAs('viewer');
    await page.goto('/missions');

    // Viewer should see missions but not have edit buttons
    await expect(page.getByTestId('mission-list')).toBeVisible();
    await expect(page.getByTestId('edit-mission-button')).not.toBeVisible();
  });
});

test.describe('Navigation', () => {
  test('should navigate between pages', async ({ authenticatedPage }) => {
    // Start at dashboard
    await expect(authenticatedPage).toHaveURL('/');

    // Navigate to missions
    await authenticatedPage.click('[data-testid="nav-missions"]');
    await expect(authenticatedPage).toHaveURL(/.*\/missions/);

    // Navigate to approvals
    await authenticatedPage.click('[data-testid="nav-approvals"]');
    await expect(authenticatedPage).toHaveURL(/.*\/approvals/);
  });
});

test.describe('Page Helpers Example', async () => {
  test('should use page helpers', async ({ page, loginAs }) => {
    await loginAs('viewer');

    // Wait for stable page
    const { waitForStablePage } = await import('../utils/page-helpers');
    await waitForStablePage(page);

    // Check if element exists
    const { elementExists } = await import('../utils/page-helpers');
    const hasMissionList = await elementExists(page, '[data-testid="mission-list"]');
    expect(hasMissionList).toBe(true);
  });
});

test.describe('Data Generation Example', () => {
  test('should generate test data', async () => {
    const {
      generateTestMission,
      generateTestApprovalQueues,
      resetRandomSeed,
    } = await import('../utils/test-data-generator');

    // Reset seed for reproducibility
    resetRandomSeed();

    // Generate test missions
    const missions = generateTestMissions(5);
    expect(missions).toHaveLength(5);
    expect(missions[0]).toHaveProperty('id');
    expect(missions[0]).toHaveProperty('title');

    // Generate test approval queues
    const approvals = generateTestApprovalQueues(3);
    expect(approvals).toHaveLength(3);
    expect(approvals[0]).toHaveProperty('missionId');
    expect(approvals[0]).toHaveProperty('status');
  });
});
