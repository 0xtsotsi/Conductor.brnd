# Missions API - Quick Testing Guide

## Prerequisites

1. Ensure you have workflow runs in your storage
2. Have a valid JWT token for authentication (with viewer+ role)
3. Server running on `http://localhost:3000`

## Authentication Setup

The Missions API requires authentication. Set up your JWT token:

```bash
# Set your JWT token as environment variable
export JWT_TOKEN="your-jwt-token-here"

# Or pass directly in curl commands
export AUTH_HEADER="Authorization: Bearer your-jwt-token-here"
```

## Test Endpoints

### 1. List Active Missions

Get all currently running workflow runs:

```bash
curl -X GET "http://localhost:3000/api/missions/active" \
  -H "$AUTH_HEADER"
```

With pagination:

```bash
curl -X GET "http://localhost:3000/api/missions/active?limit=10&offset=0" \
  -H "$AUTH_HEADER"
```

Filter by workflow:

```bash
curl -X GET "http://localhost:3000/api/missions/active?workflowId=code-review-workflow" \
  -H "$AUTH_HEADER"
```

**Expected Response:**
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
      "duration": 45000,
      "inputData": { "prUrl": "https://github.com/..." }
    }
  ],
  "total": 1,
  "limit": 50,
  "offset": 0
}
```

### 2. List Recent Missions

Get recent workflow runs (completed, failed, or running):

```bash
curl -X GET "http://localhost:3000/api/missions/recent" \
  -H "$AUTH_HEADER"
```

Filter by status (completed):

```bash
curl -X GET "http://localhost:3000/api/missions/recent?status=completed" \
  -H "$AUTH_HEADER"
```

Filter by status (failed):

```bash
curl -X GET "http://localhost:3000/api/missions/recent?status=failed" \
  -H "$AUTH_HEADER"
```

With pagination:

```bash
curl -X GET "http://localhost:3000/api/missions/recent?limit=20&offset=0" \
  -H "$AUTH_HEADER"
```

**Expected Response:**
```json
{
  "runs": [
    {
      "runId": "run-xyz789",
      "workflowId": "code-review-workflow",
      "workflowName": "code-review-workflow",
      "status": "completed",
      "startedAt": "2024-12-30T10:00:00.000Z",
      "completedAt": "2024-12-30T10:30:00.000Z",
      "duration": 1800000,
      "outputData": { "prNumber": 123, "prUrl": "https://github.com/..." }
    }
  ],
  "total": 100,
  "limit": 20,
  "offset": 0
}
```

### 3. Get Mission Timeline

Get detailed execution timeline for a specific run:

```bash
curl -X GET "http://localhost:3000/api/missions/run-abc123/timeline" \
  -H "$AUTH_HEADER"
```

**Expected Response:**
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
      "output": {
        "branchName": "feature/test-branch",
        "commitSha": "abc123def456"
      }
    },
    {
      "stepId": "create-pr",
      "stepName": "create-pr",
      "status": "completed",
      "startedAt": "2024-12-30T12:00:30.000Z",
      "completedAt": "2024-12-30T12:01:00.000Z",
      "duration": 30000,
      "output": {
        "prNumber": 42,
        "prUrl": "https://github.com/owner/repo/pull/42"
      }
    },
    {
      "stepId": "wait-for-approval",
      "stepName": "wait-for-approval",
      "status": "suspended",
      "startedAt": "2024-12-30T12:01:00.000Z",
      "suspendData": {
        "suspendPayload": {
          "prNumber": 42,
          "prUrl": "https://github.com/owner/repo/pull/42"
        },
        "suspendedAt": "2024-12-30T12:01:00.000Z"
      }
    }
  ]
}
```

## Error Scenarios

### 401 Unauthorized

Missing or invalid JWT token:

```bash
curl -X GET "http://localhost:3000/api/missions/active"
```

**Response:**
```json
{
  "error": "Unauthorized"
}
```

### 403 Forbidden

User doesn't have viewer role:

```bash
curl -X GET "http://localhost:3000/api/missions/active" \
  -H "Authorization: Bearer invalid-token"
```

**Response:**
```json
{
  "error": "Forbidden"
}
```

### 404 Not Found

Run doesn't exist:

```bash
curl -X GET "http://localhost:3000/api/missions/nonexistent-run/timeline" \
  -H "$AUTH_HEADER"
```

**Response:**
```json
{
  "error": "Not Found",
  "message": "Workflow run 'nonexistent-run' not found"
}
```

### 400 Bad Request

Invalid query parameters:

```bash
curl -X GET "http://localhost:3000/api/missions/active?limit=invalid" \
  -H "$AUTH_HEADER"
```

**Response:**
```json
{
  "error": "Invalid query parameters",
  "details": {
    "limit": ["_error"]
  }
}
```

## Testing with Different User Roles

### Admin User (full access)

```bash
export ADMIN_TOKEN="admin-jwt-token"
curl -X GET "http://localhost:3000/api/missions/active" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Operator User (full access)

```bash
export OPERATOR_TOKEN="operator-jwt-token"
curl -X GET "http://localhost:3000/api/missions/active" \
  -H "Authorization: Bearer $OPERATOR_TOKEN"
```

### Viewer User (read-only access)

```bash
export VIEWER_TOKEN="viewer-jwt-token"
curl -X GET "http://localhost:3000/api/missions/active" \
  -H "Authorization: Bearer $VIEWER_TOKEN"
```

## Integration with UI

### Fetch Active Missions in React

```typescript
import { useState, useEffect } from 'react';

interface MissionRun {
  runId: string;
  workflowId: string;
  status: string;
  startedAt: string;
  progress?: number;
  currentStep?: string;
}

export function useActiveMissions() {
  const [missions, setMissions] = useState<MissionRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchMissions() {
      try {
        const response = await fetch('/api/missions/active', {
          headers: {
            'Authorization': `Bearer ${getAuthToken()}`
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        setMissions(data.runs);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchMissions();

    // Poll every 5 seconds for updates
    const interval = setInterval(fetchMissions, 5000);
    return () => clearInterval(interval);
  }, []);

  return { missions, loading, error };
}
```

### Fetch Timeline in React

```typescript
export function useMissionTimeline(runId: string) {
  const [timeline, setTimeline] = useState<TimelineStep[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTimeline() {
      const response = await fetch(`/api/missions/${runId}/timeline`, {
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`
        }
      });

      const data = await response.json();
      setTimeline(data.timeline);
      setLoading(false);
    }

    fetchTimeline();
  }, [runId]);

  return { timeline, loading };
}
```

## Performance Considerations

1. **Active runs endpoint** - Queries storage for running workflows only
2. **Recent runs endpoint** - Supports pagination to limit payload size
3. **Timeline endpoint** - Fetches complete run history, consider caching
4. **Recommended polling** - 5-10 seconds for active runs, 30+ seconds for recent runs

## Debug Tips

### Enable Logging

The handler logs errors to console. Check server logs:

```bash
# Check for error messages
grep "Failed to list" /path/to/server.log
grep "Failed to get mission timeline" /path/to/server.log
```

### Verify Storage Connection

Check that workflows storage is accessible:

```typescript
const storage = await mastra.getStorage();
const workflowsStorage = await storage.getStore('workflows');
console.log('Workflows storage:', workflowsStorage ? 'Available' : 'Not available');
```

### Verify RBAC Setup

Check user permissions:

```typescript
const user = c.get('user') as MissionCommandUser;
console.log('User role:', user.role);
console.log('User permissions:', user.permissions);
```

## Next Steps

After testing:
1. Verify all endpoints return expected data
2. Check RBAC enforcement works correctly
3. Test error scenarios
4. Integrate with MissionRunsView UI component
5. Add automated tests
