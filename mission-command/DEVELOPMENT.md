# Development Guide - Mission Command Centre

This guide is for developers who want to contribute to or extend the Mission Command Centre.

## 📋 Prerequisites

- **Node.js** 18+
- **pnpm** 9.7.0+
- **PostgreSQL** 14+ (for production testing) or **LibSQL** (for development)
- **Git** for version control
- **TypeScript** knowledge
- **React** knowledge (for UI development)

## 🏗️ Development Setup

### 1. Fork and Clone

```bash
# Fork the repository on GitHub
# Clone your fork
git clone https://github.com/YOUR_USERNAME/mastra.git
cd mastra
```

### 2. Install Dependencies

```bash
# From monorepo root
pnpm install

# Build all packages
pnpm build
```

### 3. Set Up Environment

```bash
cd packages/mission-command
cp .env.example .env

# Edit .env with your local configuration
nano .env
```

Required variables:
```bash
# Database
DATABASE_URL=postgresql://localhost:5432/mission_command_dev

# GitHub
GITHUB_TOKEN=ghp_your_token_here
GITHUB_WEBHOOK_SECRET=your_secret_here
```

### 4. Initialize Database

```bash
# Run migrations
pnpm db:migrate

# Or use the example server to auto-init
cd packages/mission-command
bun run src/server/example.ts
```

## 🧪 Running Tests

### Unit Tests

```bash
# Run all tests
pnpm test

# Run specific test file
pnpm test -- github-tools.test.ts

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage
```

### Integration Tests

```bash
# Start Docker services (if needed)
pnpm dev:services:up

# Run integration tests
pnpm test:integration

# Stop services
pnpm dev:services:down
```

### E2E Tests (Coming Soon)

```bash
# Install Playwright
pnpm install -D @playwright/test

# Run E2E tests
pnpm test:e2e

# Run E2E tests with UI
pnpm test:e2e:ui
```

## 🔨 Building

### Build Commands

```bash
# Build from monorepo root
pnpm build

# Build specific package
cd packages/mission-command
pnpm build

# Build with increased memory (if needed)
NODE_OPTIONS="--max-old-space-size=4096" pnpm build
```

### Build Artifacts

```
packages/mission-command/
├── dist/                   # Compiled TypeScript
│   ├── server/
│   ├── tools/
│   ├── workflows/
│   └── ui/
├── ui/dist/                # Vite build output
└── package.json
```

## 🚀 Running Locally

### Start the UI

```bash
cd packages/mission-command/ui
pnpm install
pnpm dev
```

UI runs on http://localhost:3000

### Start the Mastra Server

```bash
cd packages/mission-command

# Option 1: Use the example server
bun run src/server/example.ts

# Option 2: Use your own server
bun run src/server/my-server.ts
```

Server runs on http://localhost:4111

### Development Workflow

```bash
# Terminal 1: UI
cd packages/mission-command/ui
pnpm dev

# Terminal 2: Server
cd packages/mission-command
bun run --watch src/server/example.ts
```

## 📝 Code Style

### TypeScript

We use **strict TypeScript**:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true
  }
}
```

### Formatting

We use **Prettier**:

```bash
# Format all code
pnpm prettier:format

# Check formatting
pnpm prettier:check
```

### Linting

```bash
# Run linter
pnpm format

# Run with auto-fix
pnpm format --fix
```

## 🏛️ Architecture

### Package Structure

```
mission-command/
├── src/
│   ├── server/              # Webhook handlers & middleware
│   │   ├── github-webhook.ts           # Main webhook handler
│   │   ├── suspended-runs-storage.ts   # PostgreSQL storage
│   │   ├── rate-limit.ts               # Rate limiting
│   │   └── cleanup.ts                  # Auto-cleanup job
│   ├── tools/               # Mastra agent tools
│   │   ├── github-tools.ts             # GitHub API tools
│   │   └── github-tools.test.ts        # Tool tests
│   ├── workflows/           # Mastra workflows
│   │   ├── code-review-workflow.ts     # Code review workflow
│   │   └── index.ts                    # Workflow exports
│   └── ui/                  # React UI components
│       ├── CatalogView.tsx
│       ├── MissionRunsView.tsx
│       └── ApprovalQueueView.tsx
├── ui/                      # Vite React app
│   ├── src/
│   │   ├── components/
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── index.html
│   └── vite.config.ts
└── package.json
```

### Key Patterns

#### 1. Creating a New Workflow

```typescript
// src/workflows/my-workflow.ts
import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';

const myStep = createStep({
  id: 'my-step',
  inputSchema: z.object({
    input: z.string(),
  }),
  outputSchema: z.object({
    output: z.string(),
  }),
  execute: async ({ inputData }) => {
    // Your logic here
    return { output: 'result' };
  },
});

export const myWorkflow = createWorkflow({
  id: 'my-workflow',
  inputSchema: z.object({
    // Input schema
  }),
  outputSchema: z.object({
    // Output schema
  }),
})
  .then(myStep)
  .commit();
```

#### 2. Creating a New Tool

```typescript
// src/tools/my-tool.ts
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const myTool = createTool({
  id: 'my-tool',
  description: 'Does something useful',
  inputSchema: z.object({
    param: z.string(),
  }),
  outputSchema: z.object({
    result: z.string(),
  }),
  execute: async ({ inputData }) => {
    // Your logic here
    return { result: 'success' };
  },
});
```

#### 3. Adding a Webhook Endpoint

```typescript
// src/server/github-webhook.ts
router.get('/webhooks/github/my-endpoint', async (c) => {
  // Your logic here
  return c.json({ message: 'Success' });
});
```

#### 4. Creating a UI Component

```tsx
// ui/src/components/MyComponent.tsx
import React from 'react';

export function MyComponent({ prop }: { prop: string }) {
  return (
    <div className="p-4 border rounded">
      <h2>{prop}</h2>
    </div>
  );
}
```

## 🔄 Testing Strategy

### Unit Tests

Test individual functions and components in isolation:

```typescript
// src/tools/github-tools.test.ts
import { describe, it, expect } from 'vitest';
import { githubCreateBranch } from './github-tools';

describe('githubCreateBranch', () => {
  it('should create a branch', async () => {
    const result = await githubCreateBranch.execute({
      inputData: {
        owner: 'test',
        repo: 'test-repo',
        branchName: 'feature/test',
        baseBranch: 'main',
      },
    });

    expect(result.success).toBe(true);
  });
});
```

### Integration Tests

Test multiple components together:

```typescript
// tests/integration/workflow.test.ts
import { describe, it, expect } from 'vitest';
import { Mastra } from '@mastra/core';
import { codeReviewWorkflow } from '@mission-command/workflows';

describe('Code Review Workflow', () => {
  it('should execute the full workflow', async () => {
    const mastra = new Mastra({
      workflows: {
        codeReview: codeReviewWorkflow,
      },
    });

    const run = await mastra.workflows.codeReview.createRun({
      inputData: {
        featureId: 'test',
        repoUrl: 'https://github.com/test/test',
        owner: 'test',
        repo: 'test',
        baseBranch: 'main',
        featureDescription: 'Test feature',
      },
    });

    const result = await run.start();

    expect(result).toBeDefined();
  });
});
```

### E2E Tests

Test the full user journey:

```typescript
// tests/e2e/approval-flow.spec.ts
import { test, expect } from '@playwright/test';

test('approval flow', async ({ page }) => {
  // Navigate to approval queue
  await page.goto('/approvals');

  // Approve a workflow
  await page.click('button[data-testid="approve-button"]');

  // Verify success message
  await expect(page.locator('.success-message')).toBeVisible();
});
```

## 🐛 Debugging

### Server-Side

```bash
# Enable debug logging
DEBUG=* bun run src/server/example.ts

# Or use VS Code debugger
# Set breakpoints in your code and press F5
```

### Client-Side

```bash
# Enable Vite debug mode
pnpm dev --debug
```

### Database Queries

```bash
# Enable PostgreSQL query logging
# Add to DATABASE_URL:
# ?pg_query_log=true
```

## 📚 Useful Commands

```bash
# Type checking
pnpm typecheck

# List all scripts
pnpm run

# Clean build artifacts
pnpm clean

# Update dependencies
pnpm update

# Check for outdated packages
pnpm outdated
```

## 🔐 Security Best Practices

1. **Never commit secrets** - Use `.env` files
2. **Validate all inputs** - Use Zod schemas
3. **Sanitize outputs** - Don't expose internal state
4. **Use prepared statements** - Prevent SQL injection
5. **Implement rate limiting** - Prevent abuse
6. **Verify webhooks** - Check signatures

## 🚀 Deploying

### Build for Production

```bash
# Build all packages
pnpm build

# Build Docker image
docker build -t mission-command:latest .
```

### Environment Variables

Production requires:

```bash
DATABASE_URL=postgresql://...
GITHUB_TOKEN=ghp_...
GITHUB_WEBHOOK_SECRET=...
NODE_ENV=production
```

### Docker Deployment

```bash
# Run with Docker Compose
docker-compose up -d

# Check logs
docker-compose logs -f

# Scale services
docker-compose up -d --scale server=3
```

## 🤝 Contributing

### Workflow

1. **Fork** the repository
2. **Branch** from `main` (`git checkout -b feature/amazing-feature`)
3. **Code** your changes
4. **Test** thoroughly
5. **Commit** with clear messages
6. **Push** to your fork
7. **PR** to the main repo

### Commit Messages

Follow conventional commits:

```
feat: add new workflow for automated testing
fix: resolve webhook signature verification bug
docs: update README with quick start guide
refactor: simplify storage layer
test: add integration tests for GitHub tools
```

### Pull Requests

- Include description of changes
- Reference related issues
- Add tests for new features
- Update documentation
- Ensure CI passes

## 📖 Resources

- [Mastra Documentation](https://mastra.ai/docs)
- [Mastra GitHub](https://github.com/mastra-ai/mastra)
- [React Documentation](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Vite Guide](https://vitejs.dev/guide/)
- [Hono Documentation](https://hono.dev)

## ❓ Getting Help

- **Issues**: [GitHub Issues](https://github.com/mastra-ai/mastra/issues)
- **Discussions**: [GitHub Discussions](https://github.com/mastra-ai/mastra/discussions)
- **Discord**: [Mastra Discord](https://discord.gg/mastra-ai)

---

Happy coding! 🚀
