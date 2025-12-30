# Missions API - Quick Reference Card

## Import

```typescript
import { createMissionsAPI } from './handlers/missions';
```

## Setup

```typescript
const missionsAPI = createMissionsAPI({
  workflowsStorage, // from mastra.getStorage().getStore('workflows')
});

app.route('/', missionsAPI);
```

## Endpoints

### 1. Active Missions
```
GET /api/missions/active
```
**Query:** `?workflowId={id}&limit={50}&offset={0}`
**Auth:** Viewer+
**Returns:** `{ runs, total, limit, offset }`

### 2. Recent Missions
```
GET /api/missions/recent
```
**Query:** `?status={completed|failed|running}&limit={20}&offset={0}`
**Auth:** Viewer+
**Returns:** `{ runs, total, limit, offset }`

### 3. Mission Timeline
```
GET /api/missions/:runId/timeline
```
**Auth:** Viewer+
**Returns:** `{ runId, workflowId, timeline[] }`

## Response Types

```typescript
// Mission Run
{
  runId: string
  workflowId: string
  status: 'running' | 'completed' | 'failed'
  startedAt: string // ISO 8601
  completedAt?: string
  currentStep?: string
  progress?: number // 0-1
  duration?: number // ms
  inputData?: any
  outputData?: any
}

// Timeline Step
{
  stepId: string
  stepName: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'suspended'
  startedAt?: string
  completedAt?: string
  duration?: number
  output?: any
  suspendData?: any
}
```

## Error Codes

- `400` - Invalid parameters
- `401` - Unauthorized
- `403` - Forbidden (RBAC)
- `404` - Run not found
- `500` - Server error

## Testing

```bash
# Active runs
curl /api/missions/active

# Recent runs (completed)
curl /api/missions/recent?status=completed

# Timeline
curl /api/missions/{runId}/timeline
```

## Files

- Handler: `src/server/handlers/missions.ts`
- Example: `src/server/example-missions-integration.ts`
- Docs: `MISSIONS_API_IMPLEMENTATION.md`
- Tests: `MISSIONS_API_TESTING.md`

## RBAC

All endpoints require `viewer` role or higher:
- viewer ✅
- operator ✅
- admin ✅
