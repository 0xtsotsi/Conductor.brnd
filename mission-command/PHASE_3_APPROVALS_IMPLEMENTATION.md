# Phase 3: Approvals API Handler Implementation

## Summary

This document describes the implementation of the Approvals API handler for Mission Command Centre Phase 3.

## Implementation Status

**COMPLETED** - The Approvals API handler has been implemented at:
`/home/oxtsotsi/Webrnds/Conductor-brnd/mission-command/src/server/handlers/approvals.ts`

## File Structure

```
mission-command/src/server/handlers/
  approvals.ts         # Approvals API handler (NEW)
  missions.ts          # Missions API handler (existing)
```

## API Endpoints Implemented

### 1. List Suspended Runs
**GET /api/approvals**

Query Parameters:
- `workflowId?: string` - Filter by workflow ID
- `status?: 'pending' | 'approved' | 'declined'` - Filter by status
- `owner?: string` - Filter by repository owner
- `repo?: string` - Filter by repository name
- `limit?: number` - Maximum entries (default: 50)
- `offset?: number` - Pagination offset (default: 0)

RBAC: Requires `viewer` role or higher

Response:
```typescript
{
  approvals: [
    {
      runId: string,
      workflowId: string,
      workflowName: string,
      suspendedAt: string,  // ISO 8601 timestamp
      suspendData: {
        reason: string,
        prUrl?: string,
        prNumber?: number,
        [key: string]: any
      },
      status: 'pending' | 'approved' | 'declined',
      priority?: 'low' | 'normal' | 'high',
      owner?: string,
      repo?: string,
      prNumber?: number
    }
  ],
  total: number,
  limit: number,
  offset: number
}
```

### 2. Get Approval Details
**GET /api/approvals/:runId**

RBAC: Requires `viewer` role or higher

Response:
```typescript
{
  runId: string,
  workflowId: string,
  workflowName: string,
  suspendedAt: string,
  suspendData: SuspendData,
  status: ApprovalStatus,
  priority?: string,
  owner?: string,
  repo?: string,
  prNumber?: number,
  history: [
    {
      action: 'suspended' | 'approved' | 'declined',
      timestamp: string,
      user?: string,
      details?: string
    }
  ]
}
```

Error Responses:
- `404` - Run not found or not suspended

### 3. Approve Suspended Run
**POST /api/approvals/:runId/approve**

Body:
```typescript
{
  feedback?: string  // Optional approval feedback
}
```

RBAC: Requires `operator` role or higher

Response:
```typescript
{
  runId: string,
  status: 'approved',
  approvedAt: string,  // ISO 8601 timestamp
  message: string
}
```

### 4. Decline Suspended Run
**POST /api/approvals/:runId/decline**

Body:
```typescript
{
  feedback: string  // Required decline reason
}
```

RBAC: Requires `operator` role or higher

Response:
```typescript
{
  runId: string,
  status: 'declined',
  declinedAt: string,  // ISO 8601 timestamp
  message: string
}
```

Error Responses:
- `400` - Invalid request body (missing feedback)
- `404` - Run not found or not suspended
- `500` - Failed to resume workflow

## Integration Example

```typescript
import { Mastra } from '@mastra/core';
import { MissionCommandAuth } from '@mastra/auth';
import { createSuspendedRunsStorage } from './suspended-runs-storage';
import { createApprovalsAPI } from './handlers/approvals';
import { createAuditService } from '../auth/audit-service';

// Create suspended runs storage (PostgreSQL)
const suspendedRunsStorage = createSuspendedRunsStorage({
  connectionString: process.env.DATABASE_URL,
  schemaName: 'public',
});

await suspendedRunsStorage.init();

// Create audit service
const auditService = createAuditService({
  storage: userStorage,
  retentionDays: 90,
});

// Create approvals API handler
const approvalsAPI = createApprovalsAPI({
  suspendedRunsStorage,
  auditService,
  resumeWorkflow: async (params) => {
    // Integrate with Mastra workflow.resume()
    const mastra = c.get('mastra');
    const workflow = await mastra.getWorkflow(params.runId);
    await workflow.resume(params.runId, {
      approved: params.resumeData.approved,
      feedback: params.resumeData.feedback,
    });
  },
});

// Mount on Hono app
const app = mastra.getServer();
app.route('/api/approvals', approvalsAPI);
```

## Features Implemented

### Core Functionality
- [x] List all suspended workflow runs with filtering
- [x] Get approval details for a specific run
- [x] Approve a suspended workflow run
- [x] Decline a suspended workflow run
- [x] Remove from suspended runs after processing

### RBAC Integration
- [x] `viewer` role can list and view approvals
- [x] `operator` role can approve/decline
- [x] `admin` role has full access

### Audit Logging
- [x] Log approval events
- [x] Log decline events
- [x] Log view events
- [x] Include IP address and user agent

### Error Handling
- [x] 400 Bad Request - Invalid parameters
- [x] 403 Forbidden - Missing permissions
- [x] 404 Not Found - Run not found
- [x] 500 Internal Server Error - Workflow resume failed

### Data Validation
- [x] Query parameter validation using Zod
- [x] Request body validation using Zod
- [x] Feedback required for decline
- [x] Optional feedback for approval

## Types Exported

```typescript
export interface SuspendData {
  reason: string;
  prUrl?: string;
  prNumber?: number;
  [key: string]: any;
}

export type ApprovalStatus = 'pending' | 'approved' | 'declined';

export interface ApprovalEntry {
  runId: string;
  workflowId: string;
  workflowName: string;
  suspendedAt: string;
  suspendData: SuspendData;
  status: ApprovalStatus;
  priority?: 'low' | 'normal' | 'high';
  owner?: string;
  repo?: string;
  prNumber?: number;
}

export interface ApprovalDetails extends ApprovalEntry {
  history: ApprovalHistoryEntry[];
}

export interface ApprovalHistoryEntry {
  action: 'suspended' | 'approved' | 'declined';
  timestamp: string;
  user?: string;
  details?: string;
}

export interface ApprovalsAPIOptions {
  suspendedRunsStorage: SuspendedRunsStorage;
  auditService?: AuditService;
  resumeWorkflow?: (params: {
    runId: string;
    resumeData: {
      approved: boolean;
      feedback?: string;
      prNumber?: number;
      prUrl?: string;
    };
  }) => Promise<void>;
}
```

## Dependencies

- `hono` - Web framework
- `zod` - Schema validation
- `@mastra/auth/rbac-middleware` - RBAC middleware (`requireRole`)
- `@mastra/auth` - MissionCommandUser type
- `../../auth/audit-service` - AuditService type
- `../suspended-runs-storage` - SuspendedRunsStorage

## Testing Recommendations

### Unit Tests
```typescript
import { describe, it, expect } from 'vitest';
import { createApprovalsAPI } from './approvals';

describe('Approvals API', () => {
  it('should list suspended runs', async () => {
    const mockStorage = {
      listSuspendedRuns: async () => [
        {
          id: '123',
          runId: 'run-123',
          prNumber: 42,
          prUrl: 'https://github.com/owner/repo/pull/42',
          owner: 'owner',
          repo: 'repo',
          createdAt: new Date(),
          expiresAt: new Date(),
        },
      ],
    };

    const api = createApprovalsAPI({
      suspendedRunsStorage: mockStorage,
    });

    // Test list endpoint
    const response = await api.request('/api/approvals');
    expect(response.status).toBe(200);
  });

  it('should approve a suspended run', async () => {
    const mockStorage = {
      findSuspendedRunByRunId: async () => ({ /* ... */ }),
      removeSuspendedRun: async () => {},
    };

    const mockResume = async (params) => {};

    const api = createApprovalsAPI({
      suspendedRunsStorage: mockStorage,
      resumeWorkflow: mockResume,
    });

    // Test approve endpoint
    const response = await api.request('/api/approvals/run-123/approve', {
      method: 'POST',
      body: JSON.stringify({ feedback: 'LGTM' }),
    });

    expect(response.status).toBe(200);
  });
});
```

### Integration Tests
```typescript
describe('Approvals API Integration', () => {
  it('should complete full approval workflow', async () => {
    // 1. List approvals
    const listResponse = await fetch('/api/approvals');
    const { approvals } = await listResponse.json();
    expect(approvals.length).toBeGreaterThan(0);

    const runId = approvals[0].runId;

    // 2. Get approval details
    const detailsResponse = await fetch(`/api/approvals/${runId}`);
    const details = await detailsResponse.json();
    expect(details.runId).toBe(runId);

    // 3. Approve the run
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

## Next Steps

1. **Server Integration**: Integrate the approvals API with the main Mastra server instance
2. **UI Integration**: Wire up ApprovalQueueView component to consume these endpoints
3. **Testing**: Write unit and integration tests
4. **Documentation**: Update API documentation with examples
5. **Monitoring**: Add metrics for approval actions

## Related Files

- `/home/oxtsotsi/Webrnds/Conductor-brnd/mission-command/src/server/handlers/approvals.ts` - Main implementation
- `/home/oxtsotsi/Webrnds/Conductor-brnd/mission-command/src/server/index.ts` - Exports the handler
- `/home/oxtsotsi/Webrnds/Conductor-brnd/mission-command/src/server/suspended-runs-storage.ts` - Storage backend
- `/home/oxtsotsi/Webrnds/Conductor-brnd/mission-command/PHASE_3_API_ENDPOINTS.md` - API specification

## Notes

- The handler uses the existing `SuspendedRunsStorage` for database operations
- The `workflowId` and `workflowName` fields are marked as 'unknown' in responses because the `SuspendedRun` type doesn't store these fields. This would require integration with workflow storage to populate.
- The `resumeWorkflow` function is optional - if not provided, the handler will skip actual workflow resumption (useful for testing)
- All approval/decline actions are logged to the audit service when provided
