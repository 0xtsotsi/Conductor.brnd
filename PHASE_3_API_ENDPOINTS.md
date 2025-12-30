# Phase 3: Mastra Server API Endpoints

## Overview

This document describes the API endpoints implemented for the Mission Command Centre. These endpoints provide the backend API for the Approval Queue and Mission Runs monitoring UI components.

**Status:** ✅ Implementation Complete

## Implementation Summary

### Files Created

1. **Schemas** (`packages/server/src/server/schemas/`)
   - `approvals.ts` - Zod schemas for approval requests
   - `missions.ts` - Zod schemas for mission runs

2. **Handlers** (`packages/server/src/server/handlers/`)
   - `approvals.ts` - Handlers for approval operations
   - `missions.ts` - Handlers for mission monitoring

3. **Routes** (`packages/server/src/server/server-adapter/routes/`)
   - `approvals.ts` - Route definitions for approvals
   - `missions.ts` - Route definitions for missions

4. **Updated Files**
   - `routes/index.ts` - Registered new routes with SERVER_ROUTES

## API Endpoints

### Approvals API

#### GET /api/approvals

List all suspended workflow runs that require approval.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| page | number | No | Page number (default: 0) |
| perPage | number | No | Items per page (default: 50) |
| status | 'pending' \| 'approved' \| 'declined' | No | Filter by approval status |
| workflowId | string | No | Filter by workflow ID |
| fromDate | Date | No | Filter by suspension date (from) |
| toDate | Date | No | Filter by suspension date (to) |

**Response:**
```typescript
{
  approvals: Array<{
    runId: string;
    workflowId: string;
    workflowName?: string;
    suspendedAt: Date;
    suspendReason?: string;
    stepId?: string;
    resourceName?: string;
    status: 'pending' | 'approved' | 'declined';
    createdAt: Date;
    updatedAt: Date;
  }>;
  total: number;
}
```

---

#### POST /api/approvals/:runId/approve

Approve a suspended workflow run and resume execution.

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| runId | string | Yes | Workflow run ID |

**Body:**
```typescript
{
  resumeData?: unknown;
  requestContext?: Record<string, unknown>;
  tracingOptions?: {
    isEnabled?: boolean;
    tracingId?: string;
  };
}
```

**Response:**
```typescript
{
  message: string;
  runId: string;
  action: 'approved';
}
```

---

#### POST /api/approvals/:runId/decline

Decline a suspended workflow run.

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| runId | string | Yes | Workflow run ID |

**Body:**
```typescript
{
  reason?: string;
  requestContext?: Record<string, unknown>;
}
```

**Response:**
```typescript
{
  message: string;
  runId: string;
  action: 'declined';
}
```

---

#### GET /api/approvals/:runId

Get details for a specific approval request.

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| runId | string | Yes | Workflow run ID |

**Response:**
```typescript
{
  runId: string;
  workflowId: string;
  workflowName?: string;
  suspendedAt: Date;
  suspendReason?: string;
  stepId?: string;
  resourceName?: string;
  status: 'pending';
  createdAt: Date;
  updatedAt: Date;
  suspendPayload?: unknown;
  timeline?: Array<{
    timestamp: Date;
    type: 'created' | 'suspended' | 'approved' | 'declined' | 'resumed' | 'failed';
    message: string;
    details?: unknown;
  }>;
}
```

---

### Missions API

#### GET /api/missions/active

List all active workflow runs (running, waiting, suspended, or paused).

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| page | number | No | Page number (default: 0) |
| perPage | number | No | Items per page (default: 50) |
| workflowId | string | No | Filter by workflow ID |
| status | 'running' \| 'waiting' \| 'suspended' \| 'paused' | No | Filter by specific status |
| resourceName | string | No | Filter by resource name |

**Response:**
```typescript
{
  missions: Array<{
    runId: string;
    workflowId: string;
    workflowName?: string;
    status: 'running' | 'waiting' | 'suspended' | 'success' | 'failed' | 'canceled' | 'pending' | 'bailed' | 'tripwire' | 'paused';
    resourceName?: string;
    createdAt: Date;
    updatedAt: Date;
    startedAt?: Date;
    completedAt?: Date;
    suspendedAt?: Date;
    suspendReason?: string;
    error?: string;
    currentStep?: string;
    stepCount?: number;
    completedSteps?: number;
    inputSummary?: unknown;
    result?: unknown;
  }>;
  total: number;
}
```

---

#### GET /api/missions/recent

List recently updated workflow runs.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| page | number | No | Page number (default: 0) |
| perPage | number | No | Items per page (default: 50) |
| workflowId | string | No | Filter by workflow ID |
| status | string | No | Filter by status |
| resourceName | string | No | Filter by resource name |
| hours | number | No | Hours to look back (default: 24) |

**Response:** Same as GET /api/missions/active

---

#### GET /api/missions/:runId/timeline

Get timeline events for a specific mission run.

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| runId | string | Yes | Mission run ID |

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| includeSteps | string | No | Comma-separated step IDs to include |
| excludeSteps | string | No | Comma-separated step IDs to exclude |
| eventType | string | No | Comma-separated event types to filter |

**Response:**
```typescript
{
  runId: string;
  workflowId: string;
  status: string;
  timeline: Array<{
    timestamp: Date;
    type: 'created' | 'started' | 'step_started' | 'step_completed' | 'step_failed' | 'suspended' | 'resumed' | 'completed' | 'failed' | 'canceled' | 'paused';
    stepId?: string;
    message: string;
    details?: unknown;
    duration?: number;
  }>;
  summary: {
    totalEvents: number;
    duration?: number;
    stepCounts: Record<string, number>;
  };
}
```

---

## Usage Examples

### Fetching Pending Approvals

```typescript
const response = await fetch('/api/approvals?status=pending&page=0&perPage=20');
const data = await response.json();
console.log(data.approvals); // Array of pending approvals
```

### Approving a Workflow Run

```typescript
const response = await fetch(`/api/approvals/${runId}/approve`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    resumeData: { approved: true },
  }),
});
const data = await response.json();
console.log(data.message); // "Workflow run approved and resumed"
```

### Listing Active Missions

```typescript
const response = await fetch('/api/missions/active?page=0&perPage=50');
const data = await response.json();
console.log(data.missions); // Array of active missions
```

### Getting Mission Timeline

```typescript
const response = await fetch(`/api/missions/${runId}/timeline`);
const data = await response.json();
console.log(data.timeline); // Array of timeline events
console.log(data.summary);  // Summary statistics
```

---

## Architecture Notes

### Workflow Discovery

The handlers search for workflows across:
1. Directly registered workflows (via `mastra.getWorkflowById()`)
2. Agent workflows (via `agent.listWorkflows()`)

This allows the API to work with workflows defined at the Mastra instance level and those scoped to specific agents.

### Suspension Detection

A workflow run is considered "suspended" when its snapshot contains steps with `status: 'suspended'`. The suspend payload includes the reason and metadata about the suspension.

### Timeline Construction

Timeline events are reconstructed from the workflow snapshot:
- Created/Suspended timestamps from the run metadata
- Step events from individual step results (createdAt, completedAt, status)
- Completion events from the workflow's final status

---

## Testing

To test these endpoints, you'll need:

1. A Mastra instance with a configured storage backend
2. Workflows with `suspend()` capability defined
3. Suspended workflow runs in storage

Example test workflow:

```typescript
import { createWorkflow, createStep, suspend } from '@mastra/core/workflows';

const approvalWorkflow = createWorkflow({
  id: 'approval-example',
  inputSchema: z.object({ data: z.string() }),
})
  .then(
    createStep({
      id: 'request-approval',
      suspendSchema: z.object({ reason: z.string() }),
      execute: async ({ suspend }) => {
        return await suspend({ reason: 'Requires human approval' });
      },
    }),
  )
  .commit();
```

---

## Integration with UI

The frontend components should consume these APIs:

| UI Component | API Endpoint |
|--------------|--------------|
| ApprovalQueueView | GET /api/approvals |
| Approve Button | POST /api/approvals/:runId/approve |
| Decline Button | POST /api/approvals/:runId/decline |
| MissionRunsView | GET /api/missions/active |
| Recent Missions | GET /api/missions/recent |
| Mission Timeline | GET /api/missions/:runId/timeline |

---

## Future Enhancements

1. **Approval State Tracking**: Currently, decline status is not persisted. A separate approval tracking table would enable full audit trails.

2. **RBAC Integration**: Add permission checks for approve/decline operations:
   - `approvals:approve` - Permission to approve runs
   - `approvals:decline` - Permission to decline runs
   - `missions:view` - Permission to view missions

3. **Webhook Support**: Notify external systems when approvals are requested/granted.

4. **Batch Operations**: Approve/decline multiple runs at once.

5. **Filtering Enhancements**: More advanced filtering options (tags, custom metadata).

---

## Error Handling

All endpoints return standard error responses:

```typescript
{
  message: string;
  // Additional error details may be included
}
```

Common HTTP status codes:
- `400` - Bad Request (invalid parameters)
- `404` - Not Found (run or workflow doesn't exist)
- `500` - Internal Server Error (storage or execution errors)

---

**Document Version:** 1.0
**Last Updated:** 2024-12-30
**Implementation Status:** ✅ Complete
