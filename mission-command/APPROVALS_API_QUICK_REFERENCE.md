# Approvals API - Quick Reference Guide

## Overview

The Approvals API provides endpoints for managing suspended workflow runs that require manual approval.

## File Location

```
mission-command/src/server/handlers/approvals.ts
```

## Basic Usage

```typescript
import { createApprovalsAPI } from './server/handlers/approvals';
import { createSuspendedRunsStorage } from './server/suspended-runs-storage';
import { createAuditService } from './auth/audit-service';

// 1. Create storage
const suspendedRunsStorage = createSuspendedRunsStorage({
  connectionString: process.env.DATABASE_URL,
});
await suspendedRunsStorage.init();

// 2. Create audit service (optional)
const auditService = createAuditService({
  storage: userStorage,
});

// 3. Create the API handler
const approvalsAPI = createApprovalsAPI({
  suspendedRunsStorage,
  auditService,
  resumeWorkflow: async (params) => {
    // Your workflow resume logic here
    const workflow = await mastra.getWorkflow(params.runId);
    await workflow.resume(params.runId, params.resumeData);
  },
});

// 4. Mount on your Hono app
app.route('/api/approvals', approvalsAPI);
```

## API Endpoints

### List All Suspended Runs

```bash
GET /api/approvals?limit=10&offset=0
```

Response:
```json
{
  "approvals": [
    {
      "runId": "run-123",
      "workflowId": "unknown",
      "workflowName": "Unknown Workflow",
      "suspendedAt": "2024-12-30T09:00:00.000Z",
      "suspendData": {
        "reason": "PR approval required",
        "prUrl": "https://github.com/owner/repo/pull/42",
        "prNumber": 42
      },
      "status": "pending",
      "priority": "normal",
      "owner": "owner",
      "repo": "repo",
      "prNumber": 42
    }
  ],
  "total": 1,
  "limit": 10,
  "offset": 0
}
```

### Get Approval Details

```bash
GET /api/approvals/run-123
```

Response:
```json
{
  "runId": "run-123",
  "workflowId": "unknown",
  "workflowName": "Unknown Workflow",
  "suspendedAt": "2024-12-30T09:00:00.000Z",
  "suspendData": {
    "reason": "PR approval required",
    "prUrl": "https://github.com/owner/repo/pull/42",
    "prNumber": 42
  },
  "status": "pending",
  "priority": "normal",
  "owner": "owner",
  "repo": "repo",
  "prNumber": 42,
  "history": [
    {
      "action": "suspended",
      "timestamp": "2024-12-30T09:00:00.000Z",
      "user": "system",
      "details": "Workflow suspended awaiting PR approval for owner/repo#42"
    }
  ]
}
```

### Approve a Run

```bash
POST /api/approvals/run-123/approve
Content-Type: application/json

{
  "feedback": "Looks good to me!"
}
```

Response:
```json
{
  "runId": "run-123",
  "status": "approved",
  "approvedAt": "2024-12-30T09:05:00.000Z",
  "message": "Looks good to me!"
}
```

### Decline a Run

```bash
POST /api/approvals/run-123/decline
Content-Type: application/json

{
  "feedback": "Needs more testing"
}
```

Response:
```json
{
  "runId": "run-123",
  "status": "declined",
  "declinedAt": "2024-12-30T09:05:00.000Z",
  "message": "Workflow resumed with rejection"
}
```

## RBAC Permissions

| Role | List | View | Approve | Decline |
|------|------|------|---------|---------|
| viewer | ✅ | ✅ | ❌ | ❌ |
| operator | ✅ | ✅ | ✅ | ✅ |
| admin | ✅ | ✅ | ✅ | ✅ |

## Error Responses

### 400 Bad Request
```json
{
  "error": "Invalid request body",
  "details": {
    "fieldErrors": [
      {
        "field": "feedback",
        "message": "Feedback is required for decline"
      }
    ]
  }
}
```

### 403 Forbidden
```json
{
  "error": "Forbidden"
}
```

### 404 Not Found
```json
{
  "error": "Not Found",
  "message": "Workflow run 'run-123' not found or not suspended",
  "code": "RUN_NOT_FOUND"
}
```

### 500 Internal Server Error
```json
{
  "error": "Failed to approve workflow run",
  "message": "Workflow resume failed",
  "code": "WORKFLOW_RESUME_FAILED"
}
```

## Query Parameters

### List Endpoint

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| workflowId | string | - | Filter by workflow ID |
| status | string | - | Filter by status: pending, approved, declined |
| owner | string | - | Filter by repository owner |
| repo | string | - | Filter by repository name |
| limit | number | 50 | Maximum number of results |
| offset | number | 0 | Pagination offset |

## Integration with Mastra Workflows

```typescript
// In your workflow definition
import { suspend } from '@mastra/core/workflows';

const approvalStep = suspend({
  id: 'approval',
  output: {
    approved: boolean,
    feedback?: string,
  },
});

// When resuming:
const workflow = mastra.getWorkflow('code-review');
await workflow.resume(runId, {
  approved: true,
  feedback: 'Approved!',
});
```

## Testing with cURL

```bash
# List approvals
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/approvals

# Get details
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/approvals/run-123

# Approve
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"feedback": "LGTM"}' \
  http://localhost:3000/api/approvals/run-123/approve

# Decline
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"feedback": "Needs work"}' \
  http://localhost:3000/api/approvals/run-123/decline
```

## Types

```typescript
interface ApprovalsAPIOptions {
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

type ApprovalStatus = 'pending' | 'approved' | 'declined';

interface SuspendData {
  reason: string;
  prUrl?: string;
  prNumber?: number;
  [key: string]: any;
}
```
