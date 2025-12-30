import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Test Configuration for Mission Command Centre
 *
 * Environment Variables:
 * - BASE_URL: The base URL of the application (default: http://localhost:4111)
 * - HEADED: Run tests in headed mode (default: false)
 * - CI: Run in CI mode (default: false)
 *
 * Usage:
 * - Local development: `pnpm test:e2e`
 * - With UI: `pnpm test:e2e:ui`
 * - Debug: `pnpm test:e2e:debug`
 * - CI: Automatically detected via CI environment variable
 */
export default defineConfig({
  testDir: './e2e',

  // Timeout per test
  timeout: 30 * 1000,

  // Expect timeout for assertions
  expect: {
    timeout: 5 * 1000,
  },

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Limit parallel workers on CI to avoid resource exhaustion
  workers: process.env.CI ? 2 : 4,

  // Reporter configuration
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
  ],

  // Shared settings for all tests
  use: {
    // Base URL for all tests
    baseURL: process.env.BASE_URL || 'http://localhost:4111',

    // Collect trace when retrying the failed test
    trace: 'retain-on-failure',

    // Screenshot configuration
    screenshot: 'only-on-failure',

    // Video configuration
    video: 'retain-on-failure',

    // Action timeout
    actionTimeout: 10 * 1000,

    // Navigation timeout
    navigationTimeout: 30 * 1000,

    // Locale
    locale: 'en-US',

    // Timezone
    timezoneId: 'America/New_York',

    // User agent
    userAgent: 'Mission Command Centre E2E Tests [Playwright]',
  },

  // Define different projects for different browsers and devices
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    /* Test against mobile viewports */
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],

  // Run your local dev server before starting the tests
  webServer: {
    command: 'pnpm start',
    url: 'http://localhost:4111',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
