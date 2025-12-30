# Mission Command Contributing Guide

Guide for contributing to Mission Command Centre development.

---

## Getting Started

### Prerequisites

- **Node.js** v18+ or v20+
- **pnpm** v9.7.0+
- **Docker** (for integration tests)
- **Git** for version control

### Development Environment Setup

1. **Fork and Clone Repository**

   ```bash
   # Fork https://github.com/mastra-ai/mastra
   git clone https://github.com/YOUR_USERNAME/mastra.git
   cd mastra/packages/mission-command
   ```

2. **Install Dependencies**

   ```bash
   # From monorepo root
   cd /path/to/mastra
   corepack enable
   pnpm install

   # Build from monorepo root
   pnpm build
   ```

3. **Setup Environment Variables**

   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start Development Server**

   ```bash
   # Terminal 1: Backend server
   cd packages/mission-command
   pnpm run dev:server

   # Terminal 2: UI development
   cd ui
   pnpm run dev
   ```

---

## Codebase Architecture

### Directory Structure

```
mission-command/
├── src/
│   ├── agents/           # AI agent definitions
│   │   ├── code-agent.ts
│   │   └── index.ts
│   ├── auth/             # Authentication services
│   │   ├── audit-service.ts
│   │   └── types.ts
│   ├── server/           # API server
│   │   ├── handlers/     # API route handlers
│   │   │   ├── workflows.ts
│   │   │   ├── missions.ts
│   │   │   ├── approvals.ts
│   │   │   └── users-api.ts
│   │   ├── oauth-handler.ts
│   │   ├── jwt-middleware.ts
│   │   ├── rate-limit.ts
│   │   └── mastra-server.ts
│   ├── tools/            # Agent tools
│   │   └── github-tools.ts
│   ├── workflows/        # Mastra workflows
│   │   ├── code-review-workflow.ts
│   │   └── index.ts
│   └── ui/               # React UI components
├── ui/                   # Vite React app
│   └── src/
│       ├── pages/
│       ├── providers/
│       └── components/
├── docs/                 # Documentation
├── e2e/                  # E2E tests
└── package.json
```

### Key Components

- **Mastra Server** (`src/server/mastra-server.ts`): Main API server with Hono
- **OAuth Handler** (`src/server/oauth-handler.ts`): GitHub/Google OAuth flows
- **Workflow Handlers** (`src/server/handlers/`): API endpoints for workflows/missions/approvals
- **RBAC Middleware** (`src/server/rbac-middleware.ts`): Role-based access control
- **React UI** (`ui/src/`): Frontend with Vite, Tanstack Query, React Router

---

## Development Workflow

### 1. Create Feature Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

### Branch Naming Conventions

- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation updates
- `refactor/` - Code refactoring
- `test/` - Test additions/changes

### 2. Make Changes

**Code Style Guidelines:**

- Use TypeScript strict mode
- Follow existing code patterns
- Add JSDoc comments for public APIs
- Use functional programming patterns where applicable
- Prefer composition over inheritance

**Example Code Structure:**

```typescript
/**
 * Mission Command API Handler
 *
 * Provides endpoints for managing workflows
 */

import { Hono } from 'hono';
import { z } from 'zod';

// Define types/interfaces
interface MyData {
  id: string;
  name: string;
}

// Define validation schemas
const mySchema = z.object({
  name: z.string().min(1)
});

// Create handler
export function createMyAPI() {
  const app = new Hono();

  app.get('/api/endpoint', async (c) => {
    // Implementation
    return c.json({ success: true, data: result });
  });

  return app;
}
```

### 3. Write Tests

**Unit Tests:**

```typescript
// src/server/my-handler.test.ts
import { describe, it, expect } from 'vitest';
import { createMyAPI } from './my-handler';

describe('MyAPI', () => {
  it('should return data', async () => {
    const api = createMyAPI();
    const res = await api.request('/api/endpoint');
    expect(res.status).toBe(200);
  });
});
```

**Integration Tests:**

```typescript
// e2e/my-feature.spec.ts
import { test, expect } from '@playwright/test';

test('my feature works', async ({ page }) => {
  await page.goto('/');
  await page.click('text=Start');
  await expect(page.locator('.result')).toBeVisible();
});
```

### 4. Run Tests

```bash
# From mission-command root
cd packages/mission-command

# Unit tests
pnpm test

# Watch mode
pnpm test:watch

# E2E tests (requires Docker services)
pnpm dev:services:up
pnpm test:e2e

# Type checking
pnpm typecheck

# Linting
pnpm lint
```

### 5. Build and Verify

```bash
# Build package
pnpm build

# Run locally
pnpm run dev:server

# Test with UI
cd ui && pnpm run dev
```

### 6. Commit Changes

**Commit Message Format:**

```
type(scope): subject

body (optional)

footer (optional)
```

**Types:** feat, fix, docs, style, refactor, test, chore

**Examples:**

```
feat(workflows): add workflow pause/resume functionality

Implement ability to pause running workflows and resume
from saved state. Uses new storage backend for state
persistence.

Closes #123
```

```
fix(auth): resolve OAuth callback URL mismatch

The callback URL was missing /api prefix, causing
GitHub OAuth to fail with 404 error.

Fixes #456
```

### 7. Push and Create PR

```bash
git push origin feature/your-feature-name
```

**Pull Request Checklist:**

- [ ] Title follows commit message format
- [ ] Description explains **why** not **what**
- [ ] Links to related issues
- [ ] All tests pass
- [ ] No linting errors
- [ ] Documentation updated (if needed)
- [ ] Breaking changes documented

---

## Coding Standards

### TypeScript Configuration

- **strict mode enabled**: No implicit any, strict null checks
- **ES2022 target**: Modern JavaScript features
- **No unused variables**: Clean code

### Code Formatting

```bash
# Format code
pnpm prettier:format

# Check formatting
pnpm prettier:check
```

### Import Order

```typescript
// 1. Node.js built-ins
import { createHash } from 'crypto';

// 2. External dependencies
import { Hono } from 'hono';
import { z } from 'zod';

// 3. Internal modules (relative imports)
import { requireAuth } from './jwt-middleware';
import { type User } from './types';
```

### Naming Conventions

- **Files**: kebab-case (`my-handler.ts`)
- **Components**: PascalCase (`MyComponent.tsx`)
- **Functions**: camelCase (`createUser`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_RETRIES`)
- **Interfaces/Types**: PascalCase (`UserData`, `RequestOptions`)

### Error Handling

```typescript
// Good: Specific error handling
try {
  const result = await workflow.execute();
  return c.json({ success: true, data: result });
} catch (error) {
  console.error('Workflow execution failed:', error);
  return c.json({
    success: false,
    error: error instanceof Error ? error.message : 'Unknown error'
  }, 500);
}

// Bad: Silent errors
try {
  await workflow.execute();
} catch (error) {
  // Do nothing
}
```

### Logging

```typescript
// Use appropriate log levels
console.debug('Detailed debug info');  // Development only
console.log('Info message');           // General information
console.warn('Warning condition');     // Warning
console.error('Error occurred');       // Error
```

---

## Testing Guidelines

### Test Principles

1. **Unit Tests**: Test individual functions/components
2. **Integration Tests**: Test API endpoints
3. **E2E Tests**: Test full user workflows

### Writing Good Tests

```typescript
describe('User Authentication', () => {
  it('should authenticate user with valid credentials', async () => {
    const result = await authenticateUser('user@example.com', 'password');
    expect(result.success).toBe(true);
    expect(result.token).toBeDefined();
  });

  it('should reject invalid credentials', async () => {
    const result = await authenticateUser('user@example.com', 'wrong');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid credentials');
  });

  it('should handle missing email', async () => {
    await expect(
      authenticateUser('', 'password')
    ).rejects.toThrow('Email is required');
  });
});
```

### Test Coverage

Aim for:
- **80%+** coverage for core logic
- **60%+** coverage for API handlers
- **40%+** coverage for UI components

Check coverage:
```bash
pnpm test:coverage
```

---

## Documentation

### Code Documentation

Add JSDoc comments to public APIs:

```typescript
/**
 * Creates a new workflow execution
 *
 * @param workflowId - The workflow identifier
 * @param input - Input data for the workflow
 * @returns Promise resolving to the execution result
 * @throws {Error} If workflow not found
 *
 * @example
 * ```typescript
 * const result = await executeWorkflow('review-code', {
 *   repositoryUrl: 'https://github.com/user/repo'
 * });
 * ```
 */
async function executeWorkflow(
  workflowId: string,
  input: Record<string, unknown>
): Promise<WorkflowResult> {
  // Implementation
}
```

### README Updates

When adding features:
1. Update feature list in main README
2. Add usage examples
3. Document new environment variables
4. Update architecture diagrams if needed

### API Documentation

Update `docs/API_REFERENCE.md` when adding/modifying endpoints:

```markdown
### New Endpoint

**Description:** Brief description

**Authentication:** Required (Role: `admin`)

**Request:**
```http
POST /api/new-endpoint
```

**Response:**
```json
{
  "success": true,
  "data": { ... }
}
```
```

---

## Common Development Tasks

### Adding a New API Endpoint

1. Create handler in `src/server/handlers/`
2. Add validation schemas with Zod
3. Register route in `src/server/index.ts`
4. Add authentication/authorization middleware
5. Write unit tests
6. Update API documentation

### Adding a New Agent Tool

1. Create tool in `src/tools/my-tool.ts`
2. Implement tool interface
3. Register with agent in `src/agents/`
4. Add tests for tool logic
5. Document tool usage

### Creating a New Workflow

1. Create workflow in `src/workflows/my-workflow.ts`
2. Define steps with input/output schemas
3. Register workflow with Mastra instance
4. Add workflow execution tests
5. Document workflow purpose and usage

### Adding UI Components

1. Create component in `ui/src/components/`
2. Use TypeScript for props
3. Add tests if complex logic
4. Export from `ui/src/components/index.ts`

---

## Debugging Tips

### Enable Verbose Logging

```bash
LOG_LEVEL=debug pnpm run dev:server
```

### Debug Server with Inspector

```bash
node --inspect --trace-warnings src/server/index.ts
# Open chrome://inspect in Chrome
```

### Debug Workflows

```typescript
// Add logging to workflow steps
const workflow = new Workflow({
  id: 'my-workflow',
  steps: [
    {
      id: 'step-1',
      execute: async (input) => {
        console.log('[WORKFLOW] Step 1 input:', input);
        const result = await processData(input);
        console.log('[WORKFLOW] Step 1 output:', result);
        return result;
      }
    }
  ]
});
```

### Database Queries

```bash
# Connect to database
psql $DATABASE_URL

# Check tables
\dt

# Run query
SELECT * FROM mission_command_users LIMIT 10;
```

---

## Release Process

Maintainers follow this process for releases:

1. Update version in `package.json`
2. Generate changelog from commits
3. Create release branch
4. Run full test suite
5. Tag release
6. Deploy to production
7. Announce release

---

## Getting Help

### Resources

- **Documentation**: `docs/` directory
- **Examples**: `examples/` directory
- **Issues**: https://github.com/mastra-ai/mastra/issues
- **Discussions**: https://github.com/mastra-ai/mastra/discussions

### Asking Questions

1. Search existing issues/discussions first
2. Include code examples and error messages
3. Specify your environment (OS, Node version, etc.)
4. Be patient and respectful

---

## Code Review Guidelines

### For Contributors

- Keep PRs focused and atomic
- Respond to review feedback
- Update tests as requested
- Squash commits before merging (if requested)

### For Reviewers

- Be constructive and respectful
- Explain the "why" behind suggestions
- Approve if feedback is addressed
- Test changes locally if possible

---

## License

By contributing, you agree that your contributions will be licensed under the same license as the project (MIT).
