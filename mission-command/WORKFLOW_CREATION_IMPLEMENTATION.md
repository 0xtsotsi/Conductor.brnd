# Workflow Creation Flow Implementation

## Summary

This document describes the implementation of the workflow creation flow in the Mission Command Centre UI. The implementation enables users to create workflow definitions through the UI interface and store them in the database.

## Implementation Overview

### Files Created

#### 1. Backend API Handler
**File:** `/home/oxtsotsi/Webrnds/Conductor-brnd/mission-command/src/server/handlers/workflows.ts`

Provides REST API endpoints for managing workflow definitions:
- `POST /api/workflows/definitions` - Create a new workflow definition (admin only)
- `GET /api/workflows/definitions` - List all workflow definitions (viewer+)
- `GET /api/workflows/definitions/:id` - Get a specific workflow definition (viewer+)
- `PUT /api/workflows/definitions/:id` - Update a workflow definition (admin only)
- `DELETE /api/workflows/definitions/:id` - Delete a workflow definition (admin only)

Features:
- Role-based access control (RBAC)
- Input validation using Zod schemas
- In-memory storage (for development) with pluggable storage interface
- Comprehensive error handling

#### 2. PostgreSQL Storage Implementation
**File:** `/home/oxtsotsi/Webrnds/Conductor-brnd/mission-command/src/server/workflow-storage.ts`

Provides a PostgreSQL-based storage implementation for workflow definitions:
- `PgWorkflowStorage` class implementing `WorkflowDefinitionStorage` interface
- Database table schema with migrations
- Full CRUD operations with JSONB support for schemas and steps

#### 3. Example Integration
**File:** `/home/oxtsotsi/Webrnds/Conductor-brnd/mission-command/src/server/example-workflows-integration.ts`

Demonstrates how to integrate the workflows API into a Mission Command server:
- Complete server setup example
- Database configuration
- API routing
- Authentication and authorization

### Files Modified

#### 1. UI App Component
**File:** `/home/oxtsotsi/Webrnds/Conductor-brnd/mission-command/ui/src/App.tsx`

Changes:
- Added `useMastraClient` import for API communication
- Implemented `handleSaveWorkflow` function that:
  - Retrieves authentication token from localStorage
  - Calls the backend API endpoint
  - Handles success/error responses
  - Navigates to workflow detail page on success
- Updated CreateWorkflowView route with proper `mode` prop

#### 2. CreateWorkflowView Component
**File:** `/home/oxtsotsi/Webrnds/Conductor-brnd/mission-command/src/ui/CreateWorkflowView.tsx`

Changes:
- Made `mode` prop optional (defaults to 'create')
- Added `currentUserRole` prop
- Enhanced validation with separate error states for:
  - General form errors
  - Input schema JSON errors
  - Output schema JSON errors
- Improved visual feedback with error borders on invalid fields

#### 3. Server Index Exports
**File:** `/home/oxtsotsi/Webrnds/Conductor-brnd/mission-command/src/server/index.ts`

Added exports for:
- `createWorkflowsAPI` function
- `WorkflowDefinition` type
- `WorkflowStepConfig` type
- `WorkflowDefinitionStorage` type
- `WorkflowsAPIOptions` type
- `PgWorkflowStorage` class
- `runWorkflowDefinitionsMigration` function
- `CREATE_WORKFLOW_DEFINITIONS_TABLE_SQL` constant

#### 4. Example Integration
**File:** `/home/oxtsotsi/Webrnds/Conductor-brnd/mission-command/src/server/example-integration.ts`

Updated to include:
- Workflow definitions migration
- Workflow storage initialization
- Workflows API mounting

## Data Structures

### WorkflowDefinition
```typescript
interface WorkflowDefinition {
  id: string;
  name: string;
  description?: string;
  inputSchema: any;  // JSON Schema
  outputSchema: any; // JSON Schema
  steps: WorkflowStepConfig[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
```

### WorkflowStepConfig
```typescript
interface WorkflowStepConfig {
  id: string;
  name: string;
  type: 'execute' | 'branch' | 'parallel' | 'suspend';
  inputSchema: any;
  outputSchema: any;
  condition?: string; // For branch steps
}
```

### WorkflowConfig (UI)
```typescript
interface WorkflowConfig {
  name: string;
  description?: string;
  inputSchema: any;
  outputSchema: any;
  steps: WorkflowStepConfig[];
}
```

## API Endpoints

### POST /api/workflows/definitions
**Role Required:** Admin

**Request Body:**
```json
{
  "name": "My Workflow",
  "description": "A sample workflow",
  "inputSchema": { "type": "object" },
  "outputSchema": { "type": "object" },
  "steps": [
    {
      "id": "step-1",
      "name": "First Step",
      "type": "execute",
      "inputSchema": { "type": "object" },
      "outputSchema": { "type": "object" }
    }
  ]
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "workflow-1234567890-abc123",
    "name": "My Workflow",
    "description": "A sample workflow",
    "inputSchema": { "type": "object" },
    "outputSchema": { "type": "object" },
    "steps": [...],
    "createdBy": "user-123",
    "createdAt": "2025-12-30T12:00:00.000Z",
    "updatedAt": "2025-12-30T12:00:00.000Z"
  }
}
```

### GET /api/workflows/definitions
**Role Required:** Viewer+

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    { /* WorkflowDefinition 1 */ },
    { /* WorkflowDefinition 2 */ }
  ]
}
```

### GET /api/workflows/definitions/:id
**Role Required:** Viewer+

**Response (200 OK):**
```json
{
  "success": true,
  "data": { /* WorkflowDefinition */ }
}
```

### PUT /api/workflows/definitions/:id
**Role Required:** Admin

**Request Body:** Same as POST (all fields optional)

**Response (200 OK):**
```json
{
  "success": true,
  "data": { /* Updated WorkflowDefinition */ }
}
```

### DELETE /api/workflows/definitions/:id
**Role Required:** Admin

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Workflow definition deleted successfully"
}
```

## Database Schema

```sql
CREATE TABLE IF NOT EXISTS workflow_definitions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  input_schema JSONB NOT NULL DEFAULT '{"type":"object"}',
  output_schema JSONB NOT NULL DEFAULT '{"type":"object"}',
  steps JSONB NOT NULL DEFAULT '[]',
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workflow_definitions_created_by
  ON workflow_definitions(created_by);

CREATE INDEX IF NOT EXISTS idx_workflow_definitions_created_at
  ON workflow_definitions(created_at DESC);
```

## Usage Example

### Server Setup

```typescript
import { Hono } from 'hono';
import {
  createWorkflowsAPI,
  PgWorkflowStorage,
  runWorkflowDefinitionsMigration,
  createOAuthHandler,
  createJwtMiddleware,
} from '@mission-command/server';

const app = new Hono();

// Get database connection
const db = getDatabase();

// Run migrations
await runWorkflowDefinitionsMigration(db);

// Create storage
const workflowStorage = new PgWorkflowStorage(db);

// Create JWT middleware
const jwtMiddleware = createJwtMiddleware({
  secret: process.env.JWT_SECRET,
});

// Apply middleware
app.use('/api/*', jwtMiddleware);

// Create and mount workflows API
const workflowsAPI = createWorkflowsAPI({
  storage: workflowStorage,
});
app.route('/', workflowsAPI);
```

### Client Usage

The UI automatically handles workflow creation through the CreateWorkflowView component:

1. User navigates to `/workflow/new`
2. Fills out the form (name, description, input/output schemas, steps)
3. Clicks "Create" button
4. Form validation occurs
5. On success, API is called and user is redirected to workflow detail page

## Error Handling

The implementation includes comprehensive error handling:

### Server Side
- Input validation with Zod schemas
- Role-based access control enforcement
- Database error handling
- HTTP status codes (200, 201, 400, 403, 404, 500)

### Client Side
- Form field validation (required fields)
- JSON schema validation with real-time feedback
- API error handling with user-friendly messages
- Loading states during API calls

## Security Considerations

1. **Authentication Required:** All endpoints require valid JWT authentication
2. **Role-Based Access Control:**
   - Viewer: Can list and view workflow definitions
   - Admin: Can create, update, and delete workflow definitions
3. **Input Validation:** All inputs are validated using Zod schemas
4. **SQL Injection Protection:** Parameterized queries used throughout
5. **Audit Trail:** All API calls are logged through audit middleware (when configured)

## Future Enhancements

Potential improvements for the workflow creation system:

1. **Workflow Execution:** Execute stored workflow definitions
2. **Versioning:** Track and manage workflow versions
3. **Import/Export:** Allow users to import/export workflow definitions
4. **Templates:** Provide pre-built workflow templates
5. **Visual Editor:** Build workflows using a drag-and-drop interface
6. **Validation:** Advanced workflow schema validation
7. **Testing:** Test workflows before deployment
8. **Permissions:** Fine-grained permissions per workflow

## Related Files

- `/home/oxtsotsi/Webrnds/Conductor-brnd/mission-command/src/server/handlers/workflows.ts` - API handler
- `/home/oxtsotsi/Webrnds/Conductor-brnd/mission-command/src/server/workflow-storage.ts` - Storage implementation
- `/home/oxtsotsi/Webrnds/Conductor-brnd/mission-command/src/server/example-workflows-integration.ts` - Integration example
- `/home/oxtsotsi/Webrnds/Conductor-brnd/mission-command/ui/src/App.tsx` - UI route handler
- `/home/oxtsotsi/Webrnds/Conductor-brnd/mission-command/src/ui/CreateWorkflowView.tsx` - Form component
