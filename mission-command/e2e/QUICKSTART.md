# E2E Testing Quick Start Guide

## Installation

```bash
# From mission-command directory
pnpm install
pnpm test:e2e:install
```

## Setup Environment

```bash
cp .env.e2e.example .env.e2e
# Edit .env.e2e with your configuration
```

## Run Tests

```bash
# Run all tests
pnpm test:e2e

# Run with UI
pnpm test:e2e:ui

# Debug mode
pnpm test:e2e:debug

# View report
pnpm test:e2e:report
```

## Write a Test

```typescript
// e2e/tests/my-feature.spec.ts
import { test, expect } from '../fixtures/base';

test.describe('My Feature', () => {
  test('should work correctly', async ({ page, loginAs }) => {
    await loginAs('viewer');
    await page.goto('/my-page');

    await expect(page.getByTestId('my-element')).toBeVisible();
  });
});
```

## Test Users

- **admin**: admin@test.local / test-password-admin
- **operator**: operator@test.local / test-password-operator
- **viewer**: viewer@test.local / test-password-viewer

## Fixtures Available

- `page` - Playwright page object
- `authenticatedPage` - Pre-authenticated page (viewer)
- `loginAs(role)` - Login as admin/operator/viewer
- `logout()` - Logout current user

## Utilities

```typescript
// Page helpers
import { waitForStablePage, fillFormByLabel } from '../utils/page-helpers';

// Data generators
import { generateTestMission } from '../utils/test-data-generator';

// API helpers
import { apiGet, apiPost } from '../utils/api-helpers';
```

## More Information

See `/home/oxtsotsi/Webrnds/Conductor-brnd/mission-command/e2e/README.md` for complete documentation.
