# Mission Command Centre UI

Vite + React + TypeScript application for the Mission Command Centre.

## Development

### Start Dev Server

From the monorepo root:
```bash
pnpm dev:mission-command
```

Or directly from the `ui/` directory:
```bash
cd mission-command/ui
pnpm dev
```

The dev server will start on `http://localhost:3000` and proxy API requests to the Mastra Server on port 4111.

### Build

```bash
pnpm build:mission-command-ui
```

Build output will be in `mission-command/ui/dist/`.

### Type Checking

```bash
pnpm typecheck
```

## Architecture

### Routes

- `/` - Mission Catalog (browse workflows)
- `/workflow/:id` - Workflow Detail View
- `/workflow/new` - Create New Workflow
- `/approvals` - Approval Queue (admin/operator only)
- `/runs` - Mission Runs monitoring

### Key Components

- **Navigation**: Top navigation bar with role-based access control
- **Views**: Import from `@mission-command/github-tools`
  - `CatalogView` - Workflow list with search/filter
  - `WorkflowDetailView` - Workflow details and execution
  - `CreateWorkflowView` - Workflow creation form
  - `ApprovalQueueView` - Suspended workflow approvals
  - `MissionRunsView` - Workflow run monitoring

### Styling

Uses Tailwind CSS with Mastra theme colors:
- Dark mode by default
- Custom Mastra color palette (mastra-bg-1 through mastra-el-connected)
- Responsive design

### State Management

- **TanStack Query** for server state and API caching
- **React Router** for client-side routing
- **Mastra React Client** for API communication

## Dependencies

- `@mastra/core` - Core Mastra framework
- `@mastra/react` - React integration and hooks
- `@mastra/playground-ui` - UI component library
- `@mastra/auth` - Authentication and role management
- `@mission-command/github-tools` - GitHub tools and workflows
- `@tanstack/react-query` - Server state management
- `react-router-dom` - Routing
- `vite` - Build tool and dev server

## Configuration

### Vite Config

- Path aliases: `@/` → `./src`
- Proxy: `/api` → `http://localhost:4111`
- React plugin with Fast Refresh

### Tailwind Config

- Dark mode: `['class']`
- Mastra theme colors
- Content paths include playground-ui components

## Integration with Mastra Server

The UI proxies API requests to the Mastra Server:

```typescript
// vite.config.ts
server: {
  port: 3000,
  proxy: {
    '/api': {
      target: 'http://localhost:4111',
      changeOrigin: true,
    },
  },
}
```

The `useMastraClient` hook from `@mastra/react` provides typed API access.
