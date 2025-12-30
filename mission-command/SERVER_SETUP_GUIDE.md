# Mission Command Centre - Server Setup Guide

## Architecture Overview

The Mission Command Centre is structured as a **library package** within the Mastra monorepo, not as a standalone application. It provides:

1. **Tools**: GitHub integration tools (`/src/tools/github-tools.ts`)
2. **Agents**: AI agents for code review (`/src/agents/`)
3. **Workflows**: Orchestration workflows (`/src/workflows/`)
4. **Server Components**: Reusable server components (`/src/server/`)
5. **UI**: React-based UI (`/ui/`)

## Current Status

### Package Structure
```
mission-command/
├── src/
│   ├── agents/          # AI agents
│   ├── auth/            # Audit service
│   ├── server/          # Server components (OAuth, API, etc.)
│   ├── tools/           # GitHub tools
│   ├── workflows/       # Workflows
│   └── index.ts         # Main exports
├── ui/                  # React UI (Vite + React)
├── package.json         # Package manifest
├── tsconfig.json        # TypeScript config
└── .env                 # Environment variables
```

### Build Status

1. **Core Dependencies**: Built and available
   - `/home/oxtsotsi/Webrnds/Conductor-brnd/packages/core/dist/` ✓
   - `/home/oxtsotsi/Webrnds/Conductor-brnd/stores/libsql/dist/` ✓
   - `/home/oxtsotsi/Webrnds/Conductor-brnd/packages/auth/dist/` ✓

2. **Mission Command**: Not built (no `dist/` directory)

## Server Options

### Option 1: Use the UI Dev Server (Recommended for Development)

The UI is a standalone Vite + React application that can run independently:

```bash
cd /home/oxtsotsi/Webrnds/Conductor-brnd
export PATH="/home/oxtsotsi/.local/share/pnpm:$PATH"
pnpm dev:mission-command
```

This starts the Vite dev server for the UI at the default port (usually 5173).

### Option 2: Use as a Library in a Mastra Application

To use Mission Command in your own Mastra application:

1. Create a Mastra config file (e.g., `src/mastra/index.ts`):

```typescript
import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/storage-libsql';
import { MissionCommandAuth } from '@mastra/auth';
import { codeReviewWorkflow } from '@mission-command/github-tools/workflows';
import { githubTools } from '@mission-command/github-tools/tools';
import { reviewAgent } from '@mission-command/github-tools/agents';

const storage = new LibSQLStore({
  url: 'file:./mission-command.db',
});

const auth = new MissionCommandAuth({
  secret: process.env.JWT_AUTH_SECRET || 'your-secret-key',
});

export const mastra = new Mastra({
  auth,
  storage,
  workflows: {
    codeReviewWorkflow,
  },
  agents: {
    reviewAgent,
  },
});
```

2. Run the Mastra dev server:

```bash
pnpm dev
```

### Option 3: Custom Server Entry Point

For full control, create a custom server using the example integration:

**Important**: This requires the workspace dependencies to be properly linked.

1. Create `/mission-command/src/mastra/index.ts`:

```typescript
import { createMissionCommandServer } from '../server/example-integration';

export const mastra = await createMissionCommandServer();
```

2. Run using Mastra CLI:

```bash
pnpm dev
```

Or manually using the deployer:

```bash
# First, build the mission-command package
pnpm build:mission-command

# Then run the dev server
PORT=4111 node /path/to/.mastra/index.mjs
```

## Environment Variables

Required environment variables (see `.env`):

```bash
# JWT Secret for token signing
JWT_AUTH_SECRET=your-super-secret-key-change-this

# Frontend URL (for OAuth redirects)
FRONTEND_URL=http://localhost:3000

# GitHub OAuth App (optional)
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

# Google OAuth App (optional)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Default role for new users
DEFAULT_ROLE=viewer

# LibSQL database URL
LIBSQL_URL=file:mission-command.db
```

## Database Setup

The Mission Command server uses LibSQL for:

1. **User Sessions**: OAuth authentication sessions
2. **Workflow Definitions**: Custom workflow configurations
3. **Audit Logs**: Security and compliance logging

Tables are automatically created on server startup via migrations:
- `CREATE_USERS_TABLE_SQL` (from `/src/server/user-storage.ts`)
- `CREATE_WORKFLOW_DEFINITIONS_TABLE_SQL` (from `/src/server/workflow-storage.ts`)

## API Endpoints

Once the server is running, the following endpoints are available:

### Authentication (`/api/auth/*`)
- `POST /api/auth/github` - GitHub OAuth flow
- `POST /api/auth/google` - Google OAuth flow
- `POST /api/auth/refresh` - Refresh JWT token
- `GET /api/auth/session` - Get current session

### User Management (`/api/users/*`)
- `GET /api/users` - List all users (admin only)
- `GET /api/users/:id` - Get user details
- `PATCH /api/users/:id` - Update user (admin only)
- `DELETE /api/users/:id` - Delete user (admin only)

### Audit Logs (`/api/audit/*`)
- `GET /api/audit/logs` - Query audit logs
- `POST /api/auth/login` - Log audit event

### Workflows (`/api/workflows/*`)
- `POST /api/workflows/:id/start-async` - Start workflow
- `GET /api/workflows/:id/runs` - List workflow runs
- `GET /api/workflows/:id/runs/:runId` - Get run status
- `POST /api/workflows/:id/runs/:runId/resume` - Resume workflow
- `GET /api/workflows/:id/runs/:runId/execution-result` - Get results

### Health Check
- `GET /health` - Server health check

## Development Workflow

### First-Time Setup

```bash
# 1. Install dependencies (from root)
cd /home/oxtsotsi/Webrnds/Conductor-brnd
pnpm install

# 2. Build core packages
pnpm build:core
pnpm build:combined-stores
pnpm build:auth

# 3. Build mission-command package
pnpm build:mission-command

# 4. Start UI dev server
pnpm dev:mission-command
```

### Ongoing Development

```bash
# UI changes
pnpm dev:mission-command

# Server changes (after modifying src/server/*)
pnpm build:mission-command
# Then restart your server
```

## Troubleshooting

### Issue: "Cannot find module '@mastra/storage-libsql'"

**Cause**: Workspace dependencies not linked properly
**Solution**: Build from the monorepo root:
```bash
cd /home/oxtsotsi/Webrnds/Conductor-brnd
pnpm build
```

### Issue: "Cannot use JSX unless the '--jsx' flag is provided"

**Cause**: TypeScript configuration issue
**Solution**: This is a pre-existing issue in `packages/tool-ui` and doesn't affect Mission Command functionality

### Issue: "Port 4111 already in use"

**Solution**: Change the port:
```bash
export PORT=4112
pnpm dev:mission-command
```

## Summary

The Mission Command Centre is a **library package**, not a standalone server. To develop:

1. **For UI work**: Use `pnpm dev:mission-command` (starts Vite dev server)
2. **For server work**: Create a Mastra app that imports from `@mission-command/github-tools`
3. **For full stack**: Use `pnpm dev` from the monorepo root with a proper `src/mastra/index.ts` config

The `example-integration.ts` file shows how to integrate the server components, but it's meant to be used as a reference for building your own Mastra application, not as a standalone executable.
