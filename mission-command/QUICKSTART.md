# Mission Command Centre - Quick Start Guide

## Overview

Mission Command Centre is a comprehensive workflow management system built on Mastra, featuring:
- GitHub integration tools and webhooks
- Code review workflows
- Role-based access control
- Real-time workflow monitoring
- Approval queue management

## Architecture

```
mission-command/
├── src/
│   ├── tools/           # GitHub agent tools
│   ├── workflows/       # Code review workflow definitions
│   ├── server/          # GitHub webhook handlers
│   └── ui/              # React UI components (library)
└── ui/                  # Vite + React web application
```

## Package Structure

This monorepo contains two packages:

1. **@mission-command/github-tools** - Core library package
   - GitHub tools and workflows
   - Server-side webhook handlers
   - React UI components (exported via `/ui`)

2. **@mission-command/ui** - Web application
   - Vite + React + TypeScript
   - Standalone deployable app
   - Uses components from `@mission-command/github-tools`

## Getting Started

### 1. Install Dependencies

From the monorepo root:
```bash
pnpm install
```

### 2. Build Required Packages

The UI depends on several Mastra packages:
```bash
# Build core packages
pnpm build:core
pnpm build:playground-ui

# Or build everything
pnpm build:packages
```

### 3. Start the UI Development Server

```bash
# From root
pnpm dev:mission-command

# Or from ui directory
cd mission-command/ui
pnpm dev
```

The UI will be available at `http://localhost:3000`

### 4. Configure Environment Variables

Create a `.env` file in the mission-command directory:
```env
# GitHub Integration
GITHUB_TOKEN=your_github_token
GITHUB_WEBHOOK_SECRET=your_webhook_secret

# Mastra Server (if running separately)
MASTRA_SERVER_URL=http://localhost:4111
```

See `.env.example` for all available options.

## Development

### Running Tests

```bash
# Test github-tools package
pnpm --filter @mission-command/github-tools test

# Test in watch mode
pnpm --filter @mission-command/github-tools test:watch

# Test with UI
pnpm --filter @mission-command/github-tools test:ui
```

### Type Checking

```bash
# Check github-tools
pnpm --filter @mission-command/github-tools typecheck

# Check UI
pnpm --filter @mission-command/ui typecheck
```

### Building

```bash
# Build all mission-command packages
pnpm build:mission-command

# Build only the UI
pnpm build:mission-command-ui

# Build only the library
pnpm --filter @mission-command/github-tools build
```

## API Integration

The UI communicates with the Mastra Server through:

1. **@mastra/react** - Provides `useMastraClient` hook
2. **Vite proxy** - Proxies `/api` requests to Mastra Server (port 4111)
3. **TanStack Query** - Caches and manages server state

### Available Endpoints

The UI expects these Mastra Server endpoints:
- `GET /api/workflows` - List all workflows
- `GET /api/workflows/:id` - Get workflow details
- `POST /api/workflows` - Create workflow
- `PUT /api/workflows/:id` - Update workflow
- `DELETE /api/workflows/:id` - Delete workflow
- `GET /api/workflows/:id/runs` - List workflow runs
- `POST /api/workflows/:id/run` - Execute workflow
- `GET /api/approvals` - List approval queue items
- `POST /api/approvals/:id/approve` - Approve workflow
- `POST /api/approvals/:id/reject` - Reject workflow

## Webhook Integration

The GitHub webhook handler is available at:
```typescript
import { githubWebhookHandler } from '@mission-command/github-tools/server';

// In your Hono/Express app
app.post('/api/webhooks/github', githubWebhookHandler);
```

## Role-Based Access Control

The UI supports three roles:

- **admin** - Full access (create, edit, delete, approve)
- **operator** - Execute workflows, view and approve
- **viewer** - Read-only access

Roles are checked in each component and affect UI visibility.

## UI Routes

- `/` - Mission Catalog (workflow browser)
- `/workflow/:id` - Workflow Detail View
- `/workflow/new` - Create Workflow
- `/approvals` - Approval Queue (admin/operator)
- `/runs` - Mission Runs monitoring

## Styling

The UI uses:
- **Tailwind CSS** - Utility-first CSS
- **Mastra Theme** - Custom color palette (dark mode by default)
- **@mastra/playground-ui** - Reusable UI components

Theme colors are defined in `ui/tailwind.config.js`.

## Troubleshooting

### Build Errors

If you see import errors:
```bash
# Rebuild dependencies
pnpm build:packages
pnpm build:playground-ui
```

### Dev Server Won't Start

Check that port 3000 is available:
```bash
# Kill existing process
lsof -ti:3000 | xargs kill

# Or use different port
cd mission-command/ui
pnpm dev --port 3001
```

### Type Errors

Ensure TypeScript versions match:
```bash
# Check types
pnpm typecheck

# Rebuild with clean
rm -rf node_modules dist
pnpm install
pnpm build
```

## Next Steps

1. **Phase 2**: Integrate Mastra Server API endpoints
2. **Phase 3**: Implement authentication context
3. **Phase 4**: Add error handling and loading states
4. **Phase 5**: Deploy to production

## Documentation

- `README.md` - Package overview
- `UI_README.md` - UI component documentation
- `CODE_REVIEW_WORKFLOW.md` - Workflow implementation details
- `ui/README.md` - Vite app documentation
- `ui/SETUP_SUMMARY.md` - Phase 1 completion details

## License

MIT
