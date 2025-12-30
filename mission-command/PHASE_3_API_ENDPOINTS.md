# Phase 3: Mastra Server API Endpoints - Implementation Plan

## Overview

Phase 3 implements the missing API endpoints in Mastra Server to support the Approval Queue and Mission Runs Monitoring UIs.

## Status: Design Complete (Ready for Implementation)

### 📋 What's Documented

1. **API Specifications** - Complete endpoint definitions
2. **Handler Implementations** - Code templates for approvals and missions handlers
3. **Route Registration** - How to register new routes in Mastra Server
4. **RBAC Integration** - Permission-based access control
5. **Error Handling** - Comprehensive error responses
6. **Testing Strategy** - Unit and integration test approaches

## API Endpoints

### Approvals API

#### List Suspended Runs

```typescript
GET /api/approvals

Query Parameters:
  - workflowId?: string  // Filter by workflow
  - status?: 'pending' | 'approved' | 'declined'
  - limit?: number      // Default: 50
  - offset?: number     // Default: 0

Response:
{
  "approvals": [
    {
      "runId": "run-123",
      "workflowId": "code-review-workflow",
      "workflowName": "Code Review",
      "suspendedAt": "2024-12-29T12:00:00Z",
      "suspendData": {
        "reason": "PR requires approval",
        "prUrl": "https://github.com/owner/repo/pull/42",
        "prNumber": 42
      },
      "status": "pending",
      "priority": "high"
    }
  ],
  "total": 10,
  "limit": 50,
  "offset": 0
}
```

#### Approve Suspended Run

```typescript
POST /api/approvals/:runId/approve

Body:
{
  "feedback?: string"  // Optional approval feedback
}

Response:
{
  "runId": "run-123",
  "status": "approved",
  "approvedAt": "2024-12-29T12:05:00Z",
  "message": "Workflow resumed successfully"
}
```

#### Decline Suspended Run

```typescript
POST /api/approvals/:runId/decline

Body:
{
  "feedback": string  // Required decline reason
}

Response:
{
  "runId": "run-123",
  "status": "declined",
  "declinedAt": "2024-12-29T12:05:00Z",
  "message": "Workflow resumed with rejection"
}
```

#### Get Approval Details

```typescript
GET /api/approvals/:runId

Response:
{
  "runId": "run-123",
  "workflowId": "code-review-workflow",
  "workflowName": "Code Review",
  "suspendedAt": "2024-12-29T12:00:00Z",
  "suspendData": { ... },
  "status": "pending",
  "history": [
    {
      "action": "suspended",
      "timestamp": "2024-12-29T12:00:00Z",
      "user": "system"
    }
  ]
}
```

### Missions API

#### List Active Runs

```typescript
GET /api/missions/active

Query Parameters:
  - workflowId?: string
  - limit?: number      // Default: 50
  - offset?: number     // Default: 0

Response:
{
  "runs": [
    {
      "runId": "run-456",
      "workflowId": "code-review-workflow",
      "workflowName": "Code Review",
      "status": "running",
      "startedAt": "2024-12-29T11:00:00Z",
      "currentStep": "create-pr",
      "progress": 0.6,
      "inputData": { ... }
    }
  ],
  "total": 5,
  "limit": 50,
  "offset": 0
}
```

#### List Recent Runs

```typescript
GET /api/missions/recent

Query Parameters:
  - status?: 'completed' | 'failed' | 'running'
  - limit?: number      // Default: 20
  - offset?: number     // Default: 0

Response:
{
  "runs": [
    {
      "runId": "run-789",
      "workflowId": "code-review-workflow",
      "workflowName": "Code Review",
      "status": "completed",
      "startedAt": "2024-12-29T10:00:00Z",
      "completedAt": "2024-12-29T10:30:00Z",
      "duration": 1800000,
      "outputData": { ... }
    }
  ],
  "total": 100,
  "limit": 20,
  "offset": 0
}
```

#### Get Execution Timeline

```typescript
GET /api/missions/:runId/timeline

Response:
{
  "runId": "run-123",
  "workflowId": "code-review-workflow",
  "timeline": [
    {
      "stepId": "create-branch",
      "stepName": "Create Branch",
      "status": "completed",
      "startedAt": "2024-12-29T12:00:00Z",
      "completedAt": "2024-12-29T12:01:00Z",
      "duration": 60000,
      "output": { "branchName": "feature/test" }
    },
    {
      "stepId": "approval",
      "stepName": "Approval",
      "status": "suspended",
      "startedAt": "2024-12-29T12:02:00Z",
      "suspendData": { ... }
    }
  ]
}
```

## Handler Implementation

### Approvals Handler Template

```typescript
// packages/server/src/server/handlers/approvals.ts

import { z } from 'zod';

/**
 * GET /api/approvals
 * List all suspended workflow runs
 */
export const listApprovalsHandler = async (c: Context) => {
  const { workflowId, status, limit = 50, offset = 0 } = c.req.query();

  // Get suspended runs from storage
  const storage = c.get('storage');
  const suspendedRuns = await storage.getSuspendedRuns({
    workflowId,
    status,
    limit: Number(limit),
    offset: Number(offset),
  });

  // Format response
  const approvals = suspendedRuns.map(run => ({
    runId: run.runId,
    workflowId: run.workflowId,
    workflowName: run.workflowName,
    suspendedAt: run.suspendedAt,
    suspendData: run.suspendData,
    status: run.status,
    priority: run.priority || 'normal',
  }));

  return c.json({
    approvals,
    total: approvals.length,
    limit: Number(limit),
    offset: Number(offset),
  });
};

/**
 * POST /api/approvals/:runId/approve
 * Approve a suspended workflow run
 */
export const approveApprovalHandler = async (c: Context) => {
  const { runId } = c.req.param();
  const { feedback } = await c.req.json();

  // Get workflow run
  const mastra = c.get('mastra');
  const workflow = await mastra.getWorkflow(runId);

  if (!workflow) {
    return c.json({ error: 'Run not found' }, 404);
  }

  // Resume workflow with approval
  await workflow.resume(runId, {
    approved: true,
    feedback,
  });

  return c.json({
    runId,
    status: 'approved',
    approvedAt: new Date().toISOString(),
    message: 'Workflow resumed successfully',
  });
};

/**
 * POST /api/approvals/:runId/decline
 * Decline a suspended workflow run
 */
export const declineApprovalHandler = async (c: Context) => {
  const { runId } = c.req.param();
  const { feedback } = await c.req.json();

  if (!feedback) {
    return c.json({ error: 'Feedback is required for decline' }, 400);
  }

  // Get workflow run
  const mastra = c.get('mastra');
  const workflow = await mastra.getWorkflow(runId);

  if (!workflow) {
    return c.json({ error: 'Run not found' }, 404);
  }

  // Resume workflow with rejection
  await workflow.resume(runId, {
    approved: false,
    feedback,
  });

  return c.json({
    runId,
    status: 'declined',
    declinedAt: new Date().toISOString(),
    message: 'Workflow resumed with rejection',
  });
};
```

### Missions Handler Template

```typescript
// packages/server/src/server/handlers/missions.ts

/**
 * GET /api/missions/active
 * List all active workflow runs
 */
export const listActiveRunsHandler = async (c: Context) => {
  const { workflowId, limit = 50, offset = 0 } = c.req.query();

  // Get active runs from storage
  const storage = c.get('storage');
  const activeRuns = await storage.getActiveRuns({
    workflowId,
    status: 'running',
    limit: Number(limit),
    offset: Number(offset),
  });

  return c.json({
    runs: activeRuns,
    total: activeRuns.length,
    limit: Number(limit),
    offset: Number(offset),
  });
};

/**
 * GET /api/missions/recent
 * List recent workflow runs
 */
export const listRecentRunsHandler = async (c: Context) => {
  const { status, limit = 20, offset = 0 } = c.req.query();

  // Get recent runs from storage
  const storage = c.get('storage');
  const recentRuns = await storage.getRuns({
    status,
    limit: Number(limit),
    offset: Number(offset),
    orderBy: 'startedAt',
    order: 'DESC',
  });

  return c.json({
    runs: recentRuns,
    total: recentRuns.length,
    limit: Number(limit),
    offset: Number(offset),
  });
};

/**
 * GET /api/missions/:runId/timeline
 * Get execution timeline for a run
 */
export const getRunTimelineHandler = async (c: Context) => {
  const { runId } = c.req.param();

  // Get run from storage
  const storage = c.get('storage');
  const run = await storage.getRun(runId);

  if (!run) {
    return c.json({ error: 'Run not found' }, 404);
  }

  // Get timeline events
  const timeline = await storage.getTimeline(runId);

  return c.json({
    runId,
    workflowId: run.workflowId,
    timeline,
  });
};
```

## Route Registration

```typescript
// packages/server/src/server/server-adapter/routes/approvals.ts

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

import {
  listApprovalsHandler,
  approveApprovalHandler,
  declineApprovalHandler,
  getApprovalHandler,
} from '../../handlers/approvals';

export const approvalsRoute = new Hono();

// List all suspended runs
approvalsRoute.get('/', listApprovalsHandler);

// Approve a suspended run
approvalsRoute.post('/:runId/approve',
  zValidator('json', z.object({
    feedback: z.string().optional(),
  })),
  approveApprovalHandler
);

// Decline a suspended run
approvalsRoute.post('/:runId/decline',
  zValidator('json', z.object({
    feedback: z.string().min(1, 'Feedback is required'),
  })),
  declineApprovalHandler
);

// Get approval details
approvalsRoute.get('/:runId', getApprovalHandler);
```

```typescript
// packages/server/src/server/server-adapter/routes/missions.ts

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

import {
  listActiveRunsHandler,
  listRecentRunsHandler,
  getRunTimelineHandler,
} from '../../handlers/missions';

export const missionsRoute = new Hono();

// List active runs
missionsRoute.get('/active', listActiveRunsHandler);

// List recent runs
missionsRoute.get('/recent', listRecentRunsHandler);

// Get execution timeline
missionsRoute.get('/:runId/timeline', getRunTimelineHandler);
```

```typescript
// packages/server/src/server/server-adapter/routes/index.ts

import { approvalsRoute } from './approvals';
import { missionsRoute } from './missions';

export function registerRoutes(app: Hono) {
  // Register approvals routes
  app.route('/api/approvals', approvalsRoute);

  // Register missions routes
  app.route('/api/missions', missionsRoute);
}
```

## RBAC Integration

### Permission Definitions

```typescript
// Permission strings
export const PERMISSIONS = {
  // Approvals
  APPROVALS_READ: 'approvals:read',
  APPROVALS_APPROVE: 'approvals:approve',

  // Missions
  MISSIONS_READ: 'missions:read',
  MISSIONS_MONITOR: 'missions:monitor',
} as const;

// Role to permissions mapping
export const ROLE_PERMISSIONS = {
  admin: [
    PERMISSIONS.APPROVALS_READ,
    PERMISSIONS.APPROVALS_APPROVE,
    PERMISSIONS.MISSIONS_READ,
    PERMISSIONS.MISSIONS_MONITOR,
  ],
  operator: [
    PERMISSIONS.APPROVALS_READ,
    PERMISSIONS.APPROVALS_APPROVE,
    PERMISSIONS.MISSIONS_READ,
    PERMISSIONS.MISSIONS_MONITOR,
  ],
  viewer: [
    PERMISSIONS.APPROVALS_READ,
    PERMISSIONS.MISSIONS_READ,
  ],
} as const;
```

### RBAC Middleware

```typescript
// Middleware to check permissions
export const requirePermission = (permission: string) => {
  return async (c: Context, next: Next) => {
    const user = c.get('user'); // From JWT

    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const hasPermission = user.permissions?.includes(permission);

    if (!hasPermission) {
      return c.json({
        error: 'Forbidden',
        message: `Missing required permission: ${permission}`,
      }, 403);
    }

    await next();
  };
};

// Apply to routes
approvalsRoute.get('/',
  requirePermission(PERMISSIONS.APPROVALS_READ),
  listApprovalsHandler
);

approvalsRoute.post('/:runId/approve',
  requirePermission(PERMISSIONS.APPROVALS_APPROVE),
  approveApprovalHandler
);
```

## Error Handling

### Error Responses

```typescript
// 404 - Run not found
{
  "error": "Not Found",
  "message": "Workflow run 'run-123' not found",
  "code": "RUN_NOT_FOUND"
}

// 400 - Invalid request
{
  "error": "Bad Request",
  "message": "Feedback is required for decline",
  "code": "INVALID_INPUT"
}

// 403 - Forbidden
{
  "error": "Forbidden",
  "message": "Missing required permission: approvals:approve",
  "code": "PERMISSION_DENIED"
}

// 500 - Internal server error
{
  "error": "Internal Server Error",
  "message": "Failed to resume workflow",
  "code": "WORKFLOW_RESUME_FAILED"
}
```

### Error Handler Middleware

```typescript
export const errorHandler = (err: Error, c: Context) => {
  console.error('API Error:', err);

  // Handle known errors
  if (err.name === 'ValidationError') {
    return c.json({
      error: 'Validation Error',
      message: err.message,
      code: 'VALIDATION_ERROR',
    }, 400);
  }

  if (err.name === 'NotFoundError') {
    return c.json({
      error: 'Not Found',
      message: err.message,
      code: 'NOT_FOUND',
    }, 404);
  }

  // Generic error
  return c.json({
    error: 'Internal Server Error',
    message: 'An unexpected error occurred',
    code: 'INTERNAL_ERROR',
  }, 500);
};
```

## Testing Strategy

### Unit Tests

```typescript
// packages/server/src/server/handlers/__tests__/approvals.test.ts

import { describe, it, expect } from 'vitest';
import { listApprovalsHandler } from '../approvals';

describe('Approvals Handler', () => {
  it('should list suspended runs', async () => {
    const c = new MockContext({
      req: { query: { limit: 10 } },
      get: (key) => mockStorage,
    });

    const response = await listApprovalsHandler(c);

    expect(response.status).toBe(200);
    expect(response.body.approvals).toBeDefined();
  });

  it('should approve suspended run', async () => {
    const c = new MockContext({
      req: { param: { runId: 'run-123' } },
      json: async () => ({ feedback: 'LGTM' }),
      get: (key) => mockMastra,
    });

    const response = await approveApprovalHandler(c);

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('approved');
  });
});
```

### Integration Tests

```typescript
// packages/server/src/server/handlers/__tests__/approvals.integration.test.ts

describe('Approvals API Integration', () => {
  it('should complete full approval flow', async () => {
    // 1. List approvals
    const listResponse = await fetch('/api/approvals');
    const { approvals } = await listResponse.json();
    const runId = approvals[0].runId;

    // 2. Approve run
    const approveResponse = await fetch(`/api/approvals/${runId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feedback: 'Approved' }),
    });

    expect(approveResponse.status).toBe(200);
    const result = await approveResponse.json();
    expect(result.status).toBe('approved');
  });
});
```

## Success Criteria

- ✅ API specifications documented
- ✅ Handler implementation templates provided
- ✅ Route registration defined
- ✅ RBAC integration designed
- ✅ Error handling specified
- ✅ Testing strategy outlined

## Implementation Steps

1. **Create Handlers**
   - Copy handler templates to `packages/server/src/server/handlers/`
   - Implement business logic
   - Add error handling

2. **Register Routes**
   - Create route files
   - Register in main server adapter
   - Test endpoints

3. **Add RBAC**
   - Define permissions
   - Implement middleware
   - Apply to routes

4. **Write Tests**
   - Unit tests for handlers
   - Integration tests for API
   - Test RBAC rules

5. **Update UI**
   - Wire ApprovalQueueView to `/api/approvals`
   - Wire MissionRunsView to `/api/missions`
   - Remove TODO comments

## Dependencies

- Requires: Phase 1 ✅ COMPLETE
- Requires: Phase 2 ✅ COMPLETE
- Blocked by: None (ready to implement)

## Estimate

- Handlers: 2-3 hours
- Routes: 1 hour
- RBAC: 1-2 hours
- Tests: 2-3 hours
- UI integration: 1 hour

**Total: 7-10 hours for complete implementation**

---

**Status:** Design Complete, Ready for Implementation
**Next:** Create handlers in `packages/server/src/server/handlers/`
