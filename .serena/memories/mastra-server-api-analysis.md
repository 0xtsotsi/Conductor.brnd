# Mastra Server API Analysis for Mission Command Centre

## Analysis Date: 2025-12-29

## Executive Summary

The Mastra Server provides a comprehensive REST API for workflows, agents, observability, and other core functionality. For Mission Command Centre, most core endpoints exist, but specialized endpoints for approval queues, monitoring dashboards, and GitHub integration need to be added.

## Existing API Endpoints

### Workflow Endpoints (27 total)

**Listing & Discovery:**
- `GET /api/workflows` - List all workflows (supports `?partial=true` for lightweight listing)
- `GET /api/workflows/:workflowId` - Get workflow details by ID

**Run Management:**
- `GET /api/workflows/:workflowId/runs` - List workflow runs (supports pagination, status filter, date range, resourceId filter)
- `GET /api/workflows/:workflowId/runs/:runId` - Get specific run details
- `DELETE /api/workflows/:workflowId/runs/:runId` - Delete a workflow run

**Execution:**
- `POST /api/workflows/:workflowId/create-run` - Create a new run instance (returns runId)
- `POST /api/workflows/:workflowId/start` - Start a specific run by runId
- `POST /api/workflows/:workflowId/start-async` - Start workflow asynchronously (returns execution result)

**Streaming:**
- `POST /api/workflows/:workflowId/stream` - Stream workflow execution results
- `POST /api/workflows/:workflowId/streamVNext` - Stream with v2 API
- `POST /api/workflows/:workflowId/observe` - Observe already-running workflow (includes cached chunks + live stream)
- `POST /api/workflows/:workflowId/observe-streamVNext` - Observe with v2 API

**Resuming Suspended Workflows:**
- `POST /api/workflows/:workflowId/resume` - Resume suspended workflow (fire-and-forget)
- `POST /api/workflows/:workflowId/resume-async` - Resume asynchronously (returns execution result)
- `POST /api/workflows/:workflowId/resume-stream` - Resume and stream results

**Results:**
- `GET /api/workflows/:workflowId/runs/:runId/execution-result` - Get final execution result (supports `?fields` param to reduce payload)

**Control:**
- `POST /api/workflows/:workflowId/runs/:runId/cancel` - Cancel in-progress run
- `POST /api/workflows/:workflowId/restart` - Restart a run
- `POST /api/workflows/:workflowId/restart-async` - Restart asynchronously
- `POST /api/workflows/:workflowId/restart-all-active-workflow-runs` - Restart all active runs
- `POST /api/workflows/:workflowId/restart-all-active-workflow-runs-async` - Restart all asynchronously

**Time Travel (Debugging):**
- `POST /api/workflows/:workflowId/time-travel` - Restart from a specific step
- `POST /api/workflows/:workflowId/time-travel-async` - Time travel asynchronously
- `POST /api/workflows/:workflowId/time-travel-stream` - Time travel with streaming

**Legacy (Deprecated):**
- `POST /api/workflows/:workflowId/stream-legacy` - Legacy streaming format
- `POST /api/workflows/:workflowId/observe-stream-legacy` - Legacy observe format

### Agent Endpoints (20+ total)

**Listing:**
- `GET /api/agents` - List all agents (supports `?partial=true`)
- `GET /api/agents/:agentId` - Get agent details
- `GET /api/agents/providers` - List AI model providers

**Generation:**
- `POST /api/agents/:agentId/generate` - Generate response
- `POST /api/agents/:agentId/stream` - Stream response
- `POST /api/agents/:agentId/network` - Stream multi-agent network

**Tool Approval:**
- `POST /api/agents/:agentId/approve-tool-call` - Approve pending tool call
- `POST /api/agents/:agentId/decline-tool-call` - Decline pending tool call

**Model Management:**
- `POST /api/agents/:agentId/model` - Update agent model
- `POST /api/agents/:agentId/model/reset` - Reset to original model
- `POST /api/agents/:agentId/models/reorder` - Reorder model list
- `POST /api/agents/:agentId/models/:modelConfigId` - Update model in list

**Prompt Enhancement:**
- `POST /api/agents/:agentId/instructions/enhance` - AI-enhanced instructions

### Observability Endpoints (4 total)

- `GET /api/observability/traces` - List traces with filtering
- `GET /api/observability/traces/:traceId` - Get trace details
- `POST /api/observability/traces/score` - Score traces with evaluator
- `GET /api/observability/traces/:traceId/:spanId/scores` - List span scores

### Other Endpoints

**Memory:**
- `GET /api/threads` - List threads
- `POST /api/threads` - Create thread
- `GET /api/threads/:threadId` - Get thread
- `DELETE /api/threads/:threadId` - Delete thread
- `GET /api/threads/:threadId/messages` - Get messages

**Tools:**
- `GET /api/tools` - List available tools

**Scores (Evaluators):**
- `GET /api/scores` - List scorers

**Logs:**
- `GET /api/logs` - Query logs

**System:**
- `GET /api/health` - Health check

## Workflow Run Status Types

From `packages/core/src/workflows/types.ts`:
```typescript
export type WorkflowRunStatus =
  | 'running'    // Currently executing
  | 'success'    // Completed successfully
  | 'failed'     // Failed with error
  | 'tripwire'   // Hit tripwire (safety mechanism)
  | 'suspended'; // Waiting for human input
```

## Filtering Capabilities

The `LIST_WORKFLOW_RUNS_ROUTE` endpoint supports:
- `status` - Filter by WorkflowRunStatus (e.g., `?status=suspended`)
- `fromDate` - Filter by start date
- `toDate` - Filter by end date
- `resourceId` - Filter by resource ID
- `page` / `perPage` - Pagination
- `limit` / `offset` - Alternative pagination (legacy)

This means we **CAN** query for suspended runs using:
```
GET /api/workflows/:workflowId/runs?status=suspended
```

## Authentication & Authorization

**Current Implementation:**
- Framework: Pluggable auth via `MastraAuthConfig`
- Default protection: All `/api/*` routes are protected
- Default public: `/api` root is public
- Rules engine: Function-based authorization (supports role-based checks)
- Providers: Clerk, Supabase, Firebase, Auth0, WorkOS (in `auth/` directory)

**Authorization Pattern:**
```typescript
rules: [
  {
    condition: (user) => user.role === 'admin',
    allow: true,
  },
]
```

**Missing:** Role-based middleware (Admin/Operator/Viewer)

## Mission Command Centre - Missing Endpoints

### 1. Approval Queue Endpoints

**Required By:** `ApprovalQueueUI` component

**Missing Endpoints:**
- `GET /api/approvals` - List all suspended workflow runs (aggregated across workflows)
  - Purpose: Show pending approvals in dashboard
  - Priority: **HIGH**
  - Query params: `?status=pending&workflowId=xxx&page=0&perPage=10`
  - Response: `{ runs: [], total: 0 }`

- `POST /api/approvals/:runId/approve` - Approve suspended run
  - Purpose: Quick approve from dashboard
  - Priority: **HIGH**
  - Body: `{ resumeData: {...} }`
  - Response: `{ message: 'Run approved' }`

- `POST /api/approvals/:runId/decline` - Decline suspended run
  - Purpose: Quick decline from dashboard
  - Priority: **HIGH**
  - Body: `{ reason: string }`
  - Response: `{ message: 'Run declined' }`

- `GET /api/approvals/:runId` - Get approval details
  - Purpose: Show suspend reason, metadata
  - Priority: **MEDIUM**

**Workaround:** Can use existing endpoints:
- `GET /api/workflows/:workflowId/runs?status=suspended` (per workflow)
- `POST /api/workflows/:workflowId/resume` (with resumeData)

### 2. Mission Monitoring Endpoints

**Required By:** `MissionRunsMonitoringUI` component

**Missing Endpoints:**
- `GET /api/missions/active` - List all active/running workflow runs
  - Purpose: Show in-progress missions in dashboard
  - Priority: **HIGH**
  - Response: `{ runs: [], total: 0 }`

- `GET /api/missions/recent` - List recent completed/failed runs
  - Purpose: Show mission history
  - Priority: **MEDIUM**
  - Query params: `?limit=10&status=success,failed`

- `GET /api/missions/:runId/timeline` - Get mission execution timeline
  - Purpose: Visual execution graph
  - Priority: **LOW** (can use observability traces)

**Workaround:** Can use:
- `GET /api/workflows/:workflowId/runs?status=running` (per workflow)
- `GET /api/observability/traces?workflowRunId=xxx` (for timeline)

### 3. GitHub Webhook Endpoints

**Required By:** GitHub integration for auto-resume

**Current Status:** ✅ **Implemented in mission-command package**

**Existing Endpoints:**
- `POST /webhooks/github` - Receive GitHub webhooks
- `GET /webhooks/github/health` - Health check
- `GET /webhooks/github/suspended` - List suspended runs (debugging)

**Note:** These are implemented in `mission-command/src/server/github-webhook-handler.ts` and need to be mounted separately from Mastra Server.

### 4. Batch Operations Endpoints

**Required By:** Bulk approval actions

**Missing Endpoints:**
- `POST /api/approvals/bulk-approve` - Approve multiple runs
  - Priority: **LOW**
  - Body: `{ runIds: string[], resumeData: {...} }`

- `POST /api/approvals/bulk-decline` - Decline multiple runs
  - Priority: **LOW**
  - Body: `{ runIds: string[], reason: string }`

### 5. Statistics & Metrics Endpoints

**Required By:** Dashboard overview

**Missing Endpoints:**
- `GET /api/stats/overview` - Get mission statistics
  - Priority: **MEDIUM**
  - Response: `{ active: 0, pending: 0, completed: 0, failed: 0 }`

- `GET /api/stats/by-workflow` - Get stats per workflow
  - Priority: **LOW**
  - Response: `{ workflowId: { success: 0, failed: 0, suspended: 0 } }`

## Implementation Strategy

### Option 1: Use Existing Endpoints (Minimal)

**Pros:**
- No new server code needed
- Client-side aggregation of per-workflow queries
- Faster to implement

**Cons:**
- Multiple API calls (one per workflow)
- No unified approval queue
- Slower UI performance

**Implementation:**
```typescript
// Client-side aggregation
const allWorkflows = await fetch('/api/workflows');
const suspendedRuns = [];
for (const workflowId of Object.keys(allWorkflows)) {
  const response = await fetch(`/api/workflows/${workflowId}/runs?status=suspended`);
  suspendedRuns.push(...response.runs);
}
```

### Option 2: Add New Endpoints to Mastra Server (Recommended)

**Pros:**
- Single API call for approval queue
- Better performance
- Consistent API design
- Can leverage existing storage layer

**Cons:**
- Requires modifying core server code
- Need to export and install in mission-command

**Implementation:**

**File:** `packages/server/src/server/handlers/approvals.ts` (new)
```typescript
export const LIST_APPROVALS_ROUTE = createRoute({
  method: 'GET',
  path: '/api/approvals',
  handler: async ({ mastra, status = 'suspended', page, perPage }) => {
    const workflows = mastra.listWorkflows();
    const allRuns = await Promise.all(
      Object.entries(workflows).map(async ([id, workflow]) => {
        return await workflow.listWorkflowRuns({ status, page, perPage });
      })
    );
    return aggregateRuns(allRuns);
  }
});
```

**File:** `packages/server/src/server/server-adapter/routes/approvals.ts` (new)
```typescript
export const APPROVALS_ROUTES: ServerRoute<any, any, any>[] = [
  LIST_APPROVALS_ROUTE,
  APPROVE_RUN_ROUTE,
  DECLINE_RUN_ROUTE,
  GET_APPROVAL_ROUTE,
];
```

**Update:** `packages/server/src/server/server-adapter/routes/index.ts`
```typescript
import { APPROVALS_ROUTES } from './approvals';

export const SERVER_ROUTES = [
  ...AGENTS_ROUTES,
  ...WORKFLOWS_ROUTES,
  ...APPROVALS_ROUTES,  // Add this
  ...
];
```

### Option 3: Extend Mission Command Server

**Pros:**
- Don't modify core Mastra
- Faster iteration
- Custom endpoints for specific needs

**Cons:**
- Forked server code
- Maintenance burden
- Can't contribute back easily

**Implementation:**
Add to `mission-command/src/server/index.ts`:
```typescript
app.get('/api/approvals', async (c) => {
  const workflows = mastra.listWorkflows();
  // Aggregate suspended runs
  return c.json({ runs: suspendedRuns });
});
```

## Recommendation

**Go with Option 2** (Add to Mastra Server):

1. **Create new handler file:** `packages/server/src/server/handlers/approvals.ts`
2. **Create new route file:** `packages/server/src/server/server-adapter/routes/approvals.ts`
3. **Register routes:** Update `packages/server/src/server/server-adapter/routes/index.ts`
4. **Export types:** Update `@mastra/server` package exports
5. **Add authentication:** Add RBAC rules for approval endpoints

This keeps code in core, allows contribution, and maintains consistency with existing API design.

## Key Files Reference

**Server Structure:**
- `/packages/server/src/server/handlers/` - Route handlers (workflows.ts, agents.ts, etc.)
- `/packages/server/src/server/server-adapter/routes/` - Route registration
- `/packages/server/src/server/auth/` - Authentication configuration
- `/packages/core/src/storage/` - Storage layer (workflow run queries)

**Route Pattern:**
```typescript
export const ROUTE_NAME_ROUTE = createRoute({
  method: 'GET' | 'POST' | 'DELETE',
  path: '/api/endpoint',
  responseType: 'json' | 'stream',
  pathParamSchema: z.object({...}),
  queryParamSchema: z.object({...}),
  bodySchema: z.object({...}),
  responseSchema: z.object({...}),
  summary: 'Human readable description',
  description: 'Detailed description',
  tags: ['Category'],
  handler: async ({ mastra, ...params }) => {
    // Handler logic
  }
});
```

**Authentication Pattern:**
```typescript
// In server adapter (Hono/Express)
registerAuthMiddleware() {
  app.use('*', async (c, next) => {
    const isProtected = isProtectedPath(path, method, authConfig);
    const isPublic = canAccessPublicly(path, method, authConfig);
    
    if (isProtected && !isPublic) {
      // Check auth
      const user = await getUser(c.req.header('Authorization'));
      const allowed = await checkRules(authConfig.rules, path, method, user);
      if (!allowed) return c.text('Unauthorized', 401);
    }
    await next();
  });
}
```

## Storage Query Patterns

**List Suspended Runs (Existing):**
```typescript
const workflowRuns = await workflow.listWorkflowRuns({
  status: 'suspended',
  page: 0,
  perPage: 10
});
```

**Get Run State (Existing):**
```typescript
const run = await workflow.getWorkflowRunById(runId);
const snapshot = run.snapshot; // Contains suspendedPaths, status, etc.
```

**Resume Workflow (Existing):**
```typescript
const run = await workflow.createRun({ runId });
await run.resume({ resumeData: {...} });
```
