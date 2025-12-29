# Mission Command Centre - Research Summary

## Project Context
- **Name**: Mission Command Centre (NOT "DevFlow Orchestrator")
- **Base**: Mastra fork at `/home/oxtsotsi/Webrnds/Conductor-brnd`
- **Package**: `@mission-command`
- **Ports**: UI (3000), Mastra Server (4111)

## Key Mastra Components Discovered

### 1. Core Workflow System
- **File**: `packages/core/src/workflows/workflow.ts`
- **Key Functions**: 
  - `createWorkflow()` - Define workflows with `.then()`, `.branch()`, `.parallel()`
  - `createStep()` - Define individual steps with input/output schemas
  - `suspend()` / `resume()` - Human-in-the-loop mechanism
- **Execution Engine**: `DefaultExecutionEngine` in `packages/core/src/workflows/default.ts`

### 2. Agent System
- **File**: `packages/core/src/agent/agent.ts`
- **Key Class**: `Agent` - Native agents (not polling workers)
- **Features**: Tools, memory, workflows, processors, voice

### 3. REST API Endpoints (Mastra Server)
- **File**: `packages/server/src/server/handlers/workflows.ts`
- **Routes**:
  - `GET /workflows` - List workflows
  - `GET /workflows/:workflowId` - Get workflow details
  - `POST /workflows/:workflowId/runs` - Start workflow
  - `POST /workflows/:workflowId/runs/:runId/resume` - Resume suspended workflow
  - `GET /workflows/:workflowId/runs` - List workflow runs
  - `GET /workflows/:workflowId/runs/:runId` - Get run details
  - `GET /workflows/:workflowId/runs/:runId/stream` - Stream execution events

### 4. Agent Routes
- **File**: `packages/server/src/server/handlers/agents.ts`
- **Routes**:
  - `GET /agents` - List agents
  - `GET /agents/:agentId` - Get agent details
  - `POST /agents/:agentId/generate` - Generate agent response
  - `POST /agents/:agentId/stream` - Stream agent response

### 5. UI Components Available
- **Package**: `@mastra/playground-ui` (v7.0.0-beta.18)
- **Domains**:
  - `domains/workflows` - Workflow components (WorkflowCard, WorkflowGraph, WorkflowStatus)
  - `domains/agents` - Agent components
  - `domains/tools` - Tool components
  - `domains/memory` - Memory components

### 6. Storage Layer
- **Base**: `packages/core/src/storage/base.ts`
- **Backends Available**:
  - `stores/libsql` - LibSQL for development
  - `stores/pg` - PostgreSQL for production (Supabase)
- **Tables**: `mastra_workflow_snapshot`, `mastra_threads`, `mastra_messages`, `mastra_resources`

### 7. Auth System
- **Files**: `packages/core/src/server/auth.ts`, `packages/core/src/server/simple-auth.ts`
- **Providers Available**: Clerk, Supabase, Firebase, Auth0, WorkOS (in `auth/` directory)
- **RBAC**: Not implemented - needs to be built

## Known Gaps

### GitHub Integration
- **Status**: No existing GitHub integration
- **Need**: Agent tools for GitHub operations
- **Approach**: Build as MCP server or direct integration

### RBAC
- **Status**: Auth providers exist, no RBAC layer
- **Need**: Admin/Operator/Viewer roles
- **Implementation**: Middleware-based authorization

### Webhook Handler
- **Status**: Not implemented
- **Need**: GitHub webhook → resume flow
- **Implementation**: New route + workflow trigger

## Build/Test Commands
- `pnpm install` - Install dependencies
- `pnpm build` - Build all packages
- `pnpm build:core` - Build core only
- `pnpm build:playground-ui` - Build UI components
- `pnpm test` - Run tests (use sparingly)
- `pnpm typecheck` - Type checking

## Key Patterns

### Workflow Definition
```typescript
const workflow = createWorkflow({
  id: 'my-workflow',
  inputSchema: z.object({...}),
  outputSchema: z.object({...}),
})
  .then(createStep({...}))
  .branch([
    [condition, step],
  ])
  .commit();
```

### Suspend/Resume Pattern
```typescript
const approvalStep = createStep({
  id: 'approval',
  suspendSchema: z.object({ reason: z.string() }),
  resumeSchema: z.object({ approved: z.boolean() }),
  execute: async ({ inputData, suspend, resumeData }) => {
    if (resumeData) return resumeData;
    return await suspend({ reason: 'Needs approval' });
  },
});
```

## TODOs Found
- 181 TODO/FIXME/HACK comments across packages
- Session management incomplete in Gemini Live API
- Vector store cleanup incomplete in multiple adapters
- Tracing context not passed in client-js SDK
