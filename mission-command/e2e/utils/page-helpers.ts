/**
 * Page interaction helpers for E2E tests
 *
 * These utilities provide reusable helper functions for common
 * page interactions during E2E tests.
 */

import type { Page } from '@playwright/test';

/**
 * Wait for page to be stable (no network requests for specified duration)
 */
export async function waitForStablePage(
  page: Page,
  duration: number = 500
): Promise<void> {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(duration);
}

/**
 * Fill form fields by label
 */
export async function fillFormByLabel(
  page: Page,
  fields: Record<string, string>
): Promise<void> {
  for (const [label, value] of Object.entries(fields)) {
    await page.getByLabel(label).fill(value);
  }
}

/**
 * Fill form fields by test ID
 */
export async function fillFormByTestId(
  page: Page,
  fields: Record<string, string>
): Promise<void> {
  for (const [testId, value] of Object.entries(fields)) {
    await page.getByTestId(testId).fill(value);
  }
}

/**
 * Wait for toast notification
 */
export async function waitForToast(
  page: Page,
  timeout: number = 5000
): Promise<void> {
  await page.waitForSelector('[data-testid="toast"]', { timeout });
}

/**
 * Get toast message
 */
export async function getToastMessage(page: Page): Promise<string> {
  const toast = page.getByTestId('toast');
  return await toast.textContent() || '';
}

/**
 * Wait for loading to complete
 */
export async function waitForLoading(
  page: Page,
  timeout: number = 30000
): Promise<void> {
  await page.waitForSelector('[data-testid="loading"]', { state: 'hidden', timeout });
}

/**
 * Navigate to page with timeout
 */
export async function navigateTo(
  page: Page,
  path: string,
  timeout: number = 30000
): Promise<void> {
  await page.goto(path, { timeout });
  await waitForStablePage(page);
}

/**
 * Check if element is visible
 */
export async function isElementVisible(
  page: Page,
  selector: string
): Promise<boolean> {
  try {
    await page.waitForSelector(selector, { state: 'visible', timeout: 1000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if element exists
 */
export async function elementExists(
  page: Page,
  selector: string
): Promise<boolean> {
  try {
    await page.waitForSelector(selector, { timeout: 1000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Click element with retry
 */
export async function clickWithRetry(
  page: Page,
  selector: string,
  maxRetries: number = 3
): Promise<void> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await page.click(selector);
      return;
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await page.waitForTimeout(500);
    }
  }
}

/**
 * Select option from dropdown
 */
export async function selectOption(
  page: Page,
  selector: string,
  value: string
): Promise<void> {
  await page.selectOption(selector, value);
}

/**
 * Get table data
 */
export async function getTableData(
  page: Page,
  selector: string = '[data-testid="data-table"]'
): Promise<string[][]> {
  const table = page.getByTestId(selector.replace('[data-testid="', '').replace('"]', ''));
  const rows = await table.locator('tbody tr').all();

  const data: string[][] = [];
  for (const row of rows) {
    const cells = await row.locator('td').allTextContents();
    data.push(cells);
  }

  return data;
}

/**
 * Take screenshot on failure
 */
export async function takeScreenshot(
  page: Page,
  name: string
): Promise<void> {
  await page.screenshot({
    path: `test-results/screenshots/${name}.png`,
    fullPage: true,
  });
}
