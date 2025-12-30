# Missions API Implementation - Phase 3

## Overview

This document describes the Missions API handler implementation for Mission Command Centre. The implementation provides endpoints for monitoring and viewing workflow runs.

## Location

- **Handler File**: `/mission-command/src/server/handlers/missions.ts`
- **Example Integration**: `/mission-command/src/server/example-missions-integration.ts`

## Implementation Summary

### Endpoints Implemented

#### 1. GET /api/missions/active
Lists all active (running) workflow runs.

**Query Parameters:**
- `workflowId?: string` - Filter by workflow ID
- `limit?: number` - Maximum results (default: 50)
- `offset?: number` - Pagination offset (default: 0)

**Response:**
```typescript
{
  runs: MissionRun[],
  total: number,
  limit: number,
  offset: number
}
```

**RBAC:** Requires `viewer` role or higher

#### 2. GET /api/missions/recent
Lists recent workflow runs with optional status filtering.

**Query Parameters:**
- `status?: 'completed' | 'failed' | 'running'` - Filter by status
- `limit?: number` - Maximum results (default: 20)
- `offset?: number` - Pagination offset (default: 0)

**Response:**
```typescript
{
  runs: MissionRun[],
  total: number,
  limit: number,
  offset: number
}
```

**RBAC:** Requires `viewer` role or higher

#### 3. GET /api/missions/:runId/timeline
Gets detailed execution timeline for a specific workflow run.

**Response:**
```typescript
{
  runId: string,
  workflowId: string,
  timeline: TimelineStep[]
}
```

**RBAC:** Requires `viewer` role or higher

## Data Structures

### MissionRun
```typescript
interface MissionRun {
  runId: string;                  // Unique run identifier
  workflowId: string;             // Workflow identifier
  workflowName: string;           // Display name
  status: 'running' | 'completed' | 'failed';
  startedAt: string;              // ISO 8601 timestamp
  completedAt?: string;           // ISO 8601 timestamp (if completed)
  currentStep?: string;           // Currently executing step
  progress?: number;              // Progress ratio (0-1)
  duration?: number;              // Duration in milliseconds
  inputData?: any;                // Input data for the run
  outputData?: any;               // Output data (if completed)
}
```

### TimelineStep
```typescript
interface TimelineStep {
  stepId: string;                 // Step identifier
  stepName: string;               // Display name
  status: 'pending' | 'running' | 'completed' | 'failed' | 'suspended';
  startedAt?: string;             // ISO 8601 timestamp
  completedAt?: string;           // ISO 8601 timestamp
  duration?: number;              // Duration in milliseconds
  output?: any;                   // Step output (for completed steps)
  suspendData?: any;              // Suspension data (for suspended steps)
}
```

## Integration Guide

### 1. Basic Setup

```typescript
import { Hono } from 'hono';
import { createMissionsAPI } from './handlers/missions';
import { WorkflowsStorage } from '@mastra/core/storage';

// Create Hono app
const app = new Hono();

// Get workflows storage (from Mastra)
const workflowsStorage: WorkflowsStorage = await getWorkflowsStorage();

// Create and register missions API
const missionsAPI = createMissionsAPI({ workflowsStorage });
app.route('/', missionsAPI);
```

### 2. With Authentication

```typescript
import { requireAuth } from './auth-middleware';

// Apply authentication before missions routes
app.use('/api/missions/*', requireAuth);
app.route('/', missionsAPI);

// Note: Each endpoint also has RBAC checks (requireRole('viewer'))
```

### 3. Example Request/Response

**List Active Missions:**
```bash
curl http://localhost:3000/api/missions/active?limit=10
```

**Response:**
```json
{
  "runs": [
    {
      "runId": "run-abc123",
      "workflowId": "code-review-workflow",
      "workflowName": "code-review-workflow",
      "status": "running",
      "startedAt": "2024-12-30T12:00:00.000Z",
      "currentStep": "create-pr",
      "progress": 0.6,
      "duration": 45000
    }
  ],
  "total": 1,
  "limit": 10,
  "offset": 0
}
```

**Get Timeline:**
```bash
curl http://localhost:3000/api/missions/run-abc123/timeline
```

**Response:**
```json
{
  "runId": "run-abc123",
  "workflowId": "code-review-workflow",
  "timeline": [
    {
      "stepId": "create-branch",
      "stepName": "create-branch",
      "status": "completed",
      "startedAt": "2024-12-30T12:00:00.000Z",
      "completedAt": "2024-12-30T12:00:30.000Z",
      "duration": 30000,
      "output": { "branchName": "feature/test" }
    },
    {
      "stepId": "create-pr",
      "stepName": "create-pr",
      "status": "running",
      "startedAt": "2024-12-30T12:00:30.000Z"
    }
  ]
}
```

## Implementation Details

### Format Functions

#### `formatMissionRun(run: any): MissionRun`
Converts raw workflow run storage data into the MissionRun format:
- Extracts status from snapshot
- Calculates duration from start/end times
- Calculates progress from completed steps
- Determines current step from active paths

#### `buildTimeline(run: any): TimelineStep[]`
Constructs chronological timeline from workflow snapshot:
- Processes each step in the snapshot context
- Adds timestamps, duration, and status
- Includes output for successful steps
- Includes suspend data for suspended steps
- Includes error info for failed steps
- Sorts by start time (most recent first)

### Error Handling

All endpoints include comprehensive error handling:
- **400 Bad Request**: Invalid query parameters
- **401 Unauthorized**: Missing authentication
- **403 Forbidden**: Insufficient permissions (handled by RBAC middleware)
- **404 Not Found**: Run not found (timeline endpoint)
- **500 Internal Server Error**: Storage or processing errors

### RBAC Integration

The implementation uses `@mastra/auth/rbac-middleware`:
- All endpoints require `viewer` role or higher
- Middleware automatically checks user role from context
- Returns 403 if user lacks required role

### Storage Integration

The handler integrates with Mastra's workflow storage through:
- `WorkflowsStorage.listWorkflowRuns()` - List runs with filters
- `WorkflowsStorage.getWorkflowRunById()` - Get specific run

Supports all Mastra storage backends:
- LibSQL
- PostgreSQL
- In-memory
- MongoDB
- DynamoDB
- etc.

## Testing

### Manual Testing

```bash
# Start server
npm run dev

# Test endpoints
curl http://localhost:3000/api/missions/active
curl http://localhost:3000/api/missions/recent?status=completed
curl http://localhost:3000/api/missions/{runId}/timeline
```

### Unit Testing (TODO)

```typescript
describe('Missions API', () => {
  it('should list active runs', async () => {
    // Test implementation
  });

  it('should list recent runs with status filter', async () => {
    // Test implementation
  });

  it('should get timeline for run', async () => {
    // Test implementation
  });

  it('should enforce RBAC', async () => {
    // Test viewer role requirement
  });
});
```

## Next Steps

1. **Add unit tests** for format functions and endpoints
2. **Add integration tests** with real storage backend
3. **Wire up to UI** - Connect MissionRunsView component
4. **Add caching** - Cache active runs list for performance
5. **Add WebSocket support** - Real-time updates for running workflows
6. **Add filtering** - More filter options (date range, workflow type, etc.)

## Dependencies

- `hono` - Web framework
- `zod` - Schema validation
- `@mastra/auth/rbac-middleware` - RBAC middleware
- `@mastra/core/storage` - Workflow storage interface
- `@mastra/auth` - User types

## Related Files

- `/mission-command/src/server/handlers/missions.ts` - Main handler
- `/mission-command/src/server/example-missions-integration.ts` - Integration example
- `/mission-command/PHASE_3_API_ENDPOINTS.md` - API specification
- `/mission-command/src/ui/MissionRunsView.tsx` - UI component (TODO: wire up)

## Status

✅ Implementation Complete
- All 3 endpoints implemented
- RBAC integration complete
- Error handling complete
- Type definitions complete
- Example integration provided

⏳ Pending
- Unit tests
- Integration tests
- UI integration
- Production deployment
