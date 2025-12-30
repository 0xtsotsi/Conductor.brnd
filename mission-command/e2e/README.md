# E2E Testing with Playwright

This directory contains end-to-end tests for the Mission Command Centre using Playwright.

## Table of Contents

- [Setup](#setup)
- [Running Tests](#running-tests)
- [Writing Tests](#writing-tests)
- [Test Structure](#test-structure)
- [Fixtures and Utilities](#fixtures-and-utilities)
- [Environment Variables](#environment-variables)
- [CI/CD Integration](#cicd-integration)
- [Troubleshooting](#troubleshooting)

## Setup

### Prerequisites

- Node.js >= 18.0.0
- pnpm (package manager)
- Docker (for local services)

### Initial Installation

1. Install dependencies:
```bash
cd mission-command
pnpm install
```

2. Install Playwright browsers:
```bash
pnpm test:e2e:install
```

3. Set up environment variables:
```bash
cp .env.e2e.example .env.e2e
# Edit .env.e2e with your configuration
```

4. Start local services (database, etc.):
```bash
docker-compose up -d
```

## Running Tests

### Local Development

Run all E2E tests:
```bash
pnpm test:e2e
```

Run with Playwright UI (interactive mode):
```bash
pnpm test:e2e:ui
```

Run in debug mode (with inspector):
```bash
pnpm test:e2e:debug
```

Run specific test file:
```bash
pnpm test:e2e e2e/tests/auth.spec.ts
```

Run tests matching a pattern:
```bash
pnpm test:e2e --grep "authentication"
```

### Headed Mode

To see the browser during test execution:
```bash
HEADED=true pnpm test:e2e
```

### Viewing Test Reports

After running tests, view the HTML report:
```bash
pnpm test:e2e:report
```

## Writing Tests

### Basic Test Structure

```typescript
import { test, expect } from '../fixtures/base';

test.describe('Feature Name', () => {
  test('should do something', async ({ page, loginAs }) => {
    // Login as a specific role
    await loginAs('viewer');

    // Navigate to page
    await page.goto('/missions');

    // Assert something
    await expect(page.getByTestId('mission-list')).toBeVisible();
  });
});
```

### Using Test Fixtures

The `base` fixture provides:
- `page` - Playwright page object
- `authenticatedPage` - Pre-authenticated page (viewer role)
- `testUser` - Current test user object
- `loginAs(role)` - Login as admin, operator, or viewer
- `logout()` - Logout current user

Example:
```typescript
test('admin can access admin panel', async ({ page, loginAs }) => {
  await loginAs('admin');
  await page.goto('/admin');
  await expect(page.getByTestId('admin-panel')).toBeVisible();
});
```

### Using Page Helpers

Import helpers from `../utils/page-helpers`:
```typescript
import { waitForStablePage, fillFormByLabel, isElementVisible } from '../utils/page-helpers';

test('should use helpers', async ({ page }) => {
  await page.goto('/form');
  await waitForStablePage(page);

  await fillFormByLabel(page, {
    'Name': 'Test Mission',
    'Description': 'Test Description',
  });

  const isVisible = await isElementVisible(page, '[data-testid="success-message"]');
  expect(isVisible).toBe(true);
});
```

### Generating Test Data

Use data generators from `../utils/test-data-generator`:
```typescript
import { generateTestMission, resetRandomSeed } from '../utils/test-data-generator';

test('should create mission', async ({ page }) => {
  resetRandomSeed();
  const mission = generateTestMission();

  await page.goto('/missions/create');
  await page.fill('[name="title"]', mission.title);
  await page.fill('[name="description"]', mission.description);

  // ... submit form
});
```

## Test Structure

```
e2e/
├── fixtures/
│   ├── base.ts              # Extended test fixtures
│   ├── test-options.ts      # TypeScript interfaces
│   └── test-users.ts        # Test user fixtures
├── utils/
│   ├── api-helpers.ts       # API request helpers
│   ├── page-helpers.ts      # Page interaction helpers
│   └── test-data-generator.ts  # Random data generators
├── tests/
│   ├── example.spec.ts      # Example tests
│   ├── auth.spec.ts         # Authentication tests
│   ├── missions.spec.ts     # Mission feature tests
│   └── approvals.spec.ts    # Approval queue tests
├── README.md                # This file
└── .gitkeep
```

## Fixtures and Utilities

### Base Fixture

Located in `fixtures/base.ts`, extends Playwright test with:
- Authentication helpers
- User role management
- Pre-configured page objects

### Test Users

Three user roles are available:
- `admin` - Full access including admin panel
- `operator` - Can manage missions and approvals
- `viewer` - Read-only access

Credentials follow the pattern:
```
Email: {role}@test.local
Password: test-password-{role}
```

### Page Helpers

Common helpers in `utils/page-helpers.ts`:
- `waitForStablePage(page, duration)` - Wait for network idle
- `fillFormByLabel(page, fields)` - Fill form by labels
- `fillFormByTestId(page, fields)` - Fill form by test IDs
- `waitForToast(page)` - Wait for toast notification
- `isElementVisible(page, selector)` - Check element visibility
- `getTableData(page, selector)` - Extract table data

### API Helpers

Make authenticated API requests in `utils/api-helpers.ts`:
- `apiGet(baseUrl, token, endpoint)` - GET request
- `apiPost(baseUrl, token, endpoint, body)` - POST request
- `apiPut(baseUrl, token, endpoint, body)` - PUT request
- `apiDelete(baseUrl, token, endpoint)` - DELETE request

### Data Generators

Generate test data in `utils/test-data-generator.ts`:
- `randomString(length)` - Random string
- `randomEmail()` - Random email address
- `randomMissionTitle()` - Random mission title
- `generateTestMission(overrides)` - Complete test mission object
- `generateTestApprovalQueues(count)` - Array of approval queues

All generators are deterministic based on a random seed for reproducibility.

## Environment Variables

Create a `.env.e2e` file from `.env.e2e.example`:

```bash
# Application URL
BASE_URL=http://localhost:4111

# Browser mode
HEADED=false

# CI detection
CI=false

# Test user credentials
E2E_ADMIN_EMAIL=admin@test.local
E2E_ADMIN_PASSWORD=test-password-admin

# GitHub token for testing
GITHUB_TOKEN=ghp_test_token

# Test database
DATABASE_URL=postgresql://test_user:test_password@localhost:5432/mission_command_test

# Screenshot and video on failure
SCREENSHOT=on-failure
VIDEO=on-failure
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  e2e:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - uses: pnpm/action-setup@v2
        with:
          version: 8

      - uses: actions/setup-node@v3
        with:
          node-version: 18
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Install Playwright browsers
        run: pnpm test:e2e:install

      - name: Start services
        run: docker-compose up -d

      - name: Run E2E tests
        run: pnpm test:e2e
        env:
          CI: true
          BASE_URL: http://localhost:4111

      - uses: actions/upload-artifact@v3
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7
```

## Troubleshooting

### Tests Timeout

Increase timeout in `playwright.config.ts`:
```typescript
timeout: 60 * 1000, // 60 seconds
```

### Browser Not Found

Reinstall Playwright browsers:
```bash
pnpm test:e2e:install
```

### Tests Fail in CI but Pass Locally

Check:
1. Environment variables are set correctly
2. Database is running and accessible
3. BASE_URL points to correct environment
4. Test data is properly seeded

### Flaky Tests

Add retries in `playwright.config.ts`:
```typescript
retries: process.env.CI ? 3 : 1,
```

Use explicit waits:
```typescript
await page.waitForSelector('[data-testid="element"]');
await waitForStablePage(page);
```

### Debugging Tests

Run with Playwright Inspector:
```bash
pnpm test:e2e:debug
```

Add `page.pause()` to pause execution:
```typescript
test('debug test', async ({ page }) => {
  await page.goto('/');
  page.pause(); // Execution pauses here
  // Inspect page state
});
```

### Video Recordings

Videos are saved to `test-results/videos/` on test failures only. To keep videos for all tests, change in `playwright.config.ts`:
```typescript
video: 'retain-on-failure', // or 'on' for all tests
```

## Best Practices

1. **Use Test IDs**: Add `data-testid` attributes to elements for reliable selection
2. **Wait for Stability**: Use `waitForStablePage()` after navigation
3. **Check Roles**: Test all three user roles (admin, operator, viewer)
4. **Clean Up Data**: Clean up test data after tests if needed
5. **Use Generators**: Use data generators for consistent, random test data
6. **Avoid Hard-coded Waits**: Prefer `waitForSelector` over `waitForTimeout`
7. **Group Tests**: Use `test.describe()` to organize related tests
8. **Before Each**: Use `test.beforeEach()` for common setup

## Additional Resources

- [Playwright Documentation](https://playwright.dev/)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Mission Command Centre Documentation](../README.md)
