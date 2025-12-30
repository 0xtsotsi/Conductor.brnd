# Phase 2: UI Integration with Mastra Auth & API - Implementation Guide

## Overview

This document describes how to integrate the Mission Command Centre UI components with Mastra authentication (RBAC) and API client. All UI components are already built and require connection to live data through proper provider setup.

## What Was Implemented

### 1. Auth Dependency Added
- Added `@mastra/auth` to `mission-command/package.json`
- Provides `MissionCommandRole` type (`admin`, `operator`, `viewer`)
- Provides `MissionCommandUser` interface with RBAC support

### 2. AuthProvider Component
**File:** `src/ui/providers/AuthProvider.tsx`

Features:
- Extracts JWT from localStorage/cookie
- Parses JWT payload to get user role and permissions
- Checks JWT expiration
- Provides `user`, `role`, `isAuthenticated` to all components
- Exports `useAuth()` hook for accessing auth context

Usage:
```tsx
import { AuthProvider, useAuth } from '@mission-command/github-tools/ui';

function App() {
  return (
    <AuthProvider apiUrl="http://localhost:4111">
      <YourRoutes />
    </AuthProvider>
  );
}

function MyComponent() {
  const { user, role, isAuthenticated, login, logout } = useAuth();
  // ...
}
```

### 3. ProtectedRoute Component
**File:** `src/ui/providers/ProtectedRoute.tsx`

Features:
- Redirects to `/login` if not authenticated
- Checks role requirements before rendering
- Shows `UnauthorizedPage` if insufficient permissions
- Supports multiple role options

Usage:
```tsx
import { ProtectedRoute } from '@mission-command/github-tools/ui';

// Any authenticated user
<ProtectedRoute>
  <CatalogView />
</ProtectedRoute>

// Admin only
<ProtectedRoute requireRole="admin">
  <AdminPanel />
</ProtectedRoute>

// Admin or Operator
<ProtectedRoute requireRole={['admin', 'operator']}>
  <ApprovalQueueView />
</ProtectedRoute>
```

### 4. LoginPage Component
**File:** `src/ui/providers/ProtectedRoute.tsx` (exported)

Features:
- OAuth login buttons (GitHub, Google)
- Redirects to `/api/auth/login` with callback URL
- Returns to previous page after login

Usage:
```tsx
import { LoginPage } from '@mission-command/github-tools/ui';

<Route path="/login" element={<LoginPage />} />
```

### 5. Example App Integration
**File:** `src/ui/providers/example-App.tsx`

Complete working example showing:
- Provider wiring order (MastraReactProvider → AuthProvider → Routes)
- React Query setup
- All UI routes with role-based access
- Header with user info and role badge
- Navigation menu

## Integration Steps

### Step 1: Install Dependencies

In your Vite app (or React app), install the required dependencies:

```bash
# Install Mission Command UI
pnpm install @mission-command/github-tools

# Install peer dependencies
pnpm install @tanstack/react-query react-router-dom
```

### Step 2: Configure Environment Variables

Create a `.env` file in your Vite app root:

```env
# Mastra API URL
VITE_MASTRA_API_URL=http://localhost:4111

# Optional: Custom auth endpoints (defaults shown)
VITE_AUTH_LOGIN_URL=/api/auth/login
VITE_AUTH_LOGOUT_URL=/api/auth/logout
```

### Step 3: Create Main App Component

Copy the pattern from `example-App.tsx` to your `App.tsx`:

```tsx
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MastraReactProvider } from '@mastra/react';
import { AuthProvider } from '@mission-command/github-tools/ui';
import { LoginPage, ProtectedRoute } from '@mission-command/github-tools/ui';
import { CatalogView } from '@mission-command/github-tools/ui';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export default function App() {
  const apiUrl = import.meta.env.VITE_MASTRA_API_URL;

  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <MastraReactProvider baseUrl={apiUrl}>
          <AuthProvider apiUrl={apiUrl}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <CatalogView
                      onWorkflowSelect={(id) => navigate(`/workflow/${id}`)}
                      onWorkflowCreate={() => navigate('/workflow/new')}
                      currentUserRole={role!}
                    />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </AuthProvider>
        </MastraReactProvider>
      </QueryClientProvider>
    </BrowserRouter>
  );
}
```

### Step 4: Update UI Components to Use Auth

Each UI component expects a `currentUserRole` prop. Use `useAuth()` to get it:

```tsx
import { useAuth } from '@mission-command/github-tools/ui';
import { CatalogView } from '@mission-command/github-tools/ui';

function CatalogPage() {
  const { role } = useAuth();

  return (
    <CatalogView
      onWorkflowSelect={(id) => console.log('Selected:', id)}
      onWorkflowCreate={() => console.log('Create')}
      currentUserRole={role!}
    />
  );
}
```

### Step 5: Set Up Mastra Server with Auth

Configure Mastra Server to use JWT authentication with role-based access control:

```typescript
// server.ts
import { Mastra } from '@mastra/core';
import { MissionCommandAuth } from '@mastra/auth';

const auth = new MissionCommandAuth({
  secret: process.env.JWT_AUTH_SECRET!,
});

export const mastra = new Mastra({
  auth: auth,
  // ... other config
});
```

### Step 6: Configure OAuth Providers

Add OAuth provider configuration (GitHub, Google, etc.):

```typescript
// This will depend on your OAuth setup
// See Mastra auth documentation for provider configuration
```

## Role-Based Access Control

### Available Roles

1. **Admin** - Full access to everything
   - Can create, update, delete workflows
   - Can approve/reject workflows
   - Can manage users and settings

2. **Operator** - Can execute and approve
   - Can execute workflows
   - Can approve/reject workflows
   - Cannot delete workflows
   - Cannot manage users

3. **Viewer** - Read-only access
   - Can view workflows and runs
   - Cannot execute or approve
   - Cannot modify anything

### Role Checking in Components

```tsx
import { useAuth } from '@mission-command/github-tools/ui';

function MyComponent() {
  const { role } = useAuth();

  const canCreate = role === 'admin' || role === 'operator';
  const canDelete = role === 'admin';

  return (
    <div>
      {canCreate && <button>Create Workflow</button>}
      {canDelete && <button>Delete</button>}
    </div>
  );
}
```

## JWT Token Structure

The JWT payload should contain:

```json
{
  "sub": "user-unique-id",
  "email": "user@example.com",
  "name": "John Doe",
  "role": "admin",
  "permissions": ["workflows:create", "workflows:approve"],
  "exp": 1234567890,
  "iat": 1234567890
}
```

**Important:** The `role` field is required. If not present, defaults to `viewer`.

## API Client Integration

The `useMastraClient()` hook (from `@mastra/react`) is used in all UI components:

```tsx
import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

function CatalogView() {
  const client = useMastraClient();

  const { data: workflows } = useQuery({
    queryKey: ['workflows'],
    queryFn: () => client.listWorkflows(),
  });

  // ...
}
```

## Component Props Reference

### CatalogView
```tsx
interface CatalogViewProps {
  onWorkflowSelect: (workflowId: string) => void;
  onWorkflowCreate: () => void;
  currentUserRole: MissionCommandRole;
}
```

### WorkflowDetailView
```tsx
interface WorkflowDetailViewProps {
  workflowId: string;
  onBack: () => void;
  currentUserRole: MissionCommandRole;
}
```

### CreateWorkflowView
```tsx
interface CreateWorkflowViewProps {
  onCancel: () => void;
  onSave: (config: WorkflowConfig) => void;
  currentUserRole: MissionCommandRole;
}
```

### ApprovalQueueView
```tsx
interface ApprovalQueueViewProps {
  currentUserRole: MissionCommandRole;
}
```

### MissionRunsView
```tsx
interface MissionRunsViewProps {
  workflowId: string;
  onRunSelect: (runId: string) => void;
  currentUserRole: MissionCommandRole;
}
```

## Testing the Integration

### 1. Start Mastra Server
```bash
cd /path/to/Conductor-brnd
pnpm build
pnpm run dev:server
# Server runs on http://localhost:4111
```

### 2. Start Vite Dev Server
```bash
cd /path/to/your/vite-app
pnpm run dev
# UI runs on http://localhost:3000
```

### 3. Test Authentication Flow
1. Navigate to `http://localhost:3000`
2. Should redirect to `/login`
3. Click login button (GitHub/Google)
4. Complete OAuth flow
5. Redirect back to app with JWT in localStorage
6. See dashboard with your role badge

### 4. Test Role-Based Access
1. Login as admin - should see all features
2. Login as operator - should see approve buttons, not delete
3. Login as viewer - should only see read-only views
4. Try accessing restricted routes - should see unauthorized page

## Known Issues & TODOs

### Missing API Endpoints (Phase 3)

These components reference API endpoints that need to be implemented:

1. **ApprovalQueueView**
   - TODO: `GET /api/approvals` - List all suspended runs (aggregated)
   - Workaround: Use `GET /api/workflows/:id/runs?status=suspended` per workflow

2. **MissionRunsView**
   - TODO: `GET /api/runs` - List all runs across workflows
   - Workaround: Use `GET /api/workflows/:id/runs` per workflow

These will be implemented in Phase 3.

## Success Criteria

- [x] User can login and see their role badge
- [x] CatalogView uses useMastraClient to fetch workflows
- [x] Protected routes redirect to login if not authenticated
- [x] Role-based buttons show/hide correctly (admin vs operator vs viewer)
- [x] No console errors about missing @mastra/auth

## Troubleshooting

### "useAuth must be used within an AuthProvider"
**Fix:** Ensure your component tree is wrapped with `<AuthProvider>`

### "useMastraClient must be used within a MastraClientProvider"
**Fix:** Ensure your app is wrapped with `<MastraReactProvider>` from `@mastra/react`

### JWT not being stored
**Fix:** Check that your OAuth callback stores the JWT in localStorage:
```javascript
localStorage.setItem('mastra_jwt', token);
```

### Role showing as null
**Fix:** Ensure JWT payload contains a `role` field:
```json
{ "role": "admin", ... }
```

### CORS errors when calling Mastra API
**Fix:** Configure CORS in Mastra Server:
```typescript
// server config
cors: {
  origin: 'http://localhost:3000',
  credentials: true,
}
```

## Next Steps

1. **Phase 3: API Endpoints** - Implement missing approval queue and monitoring endpoints
2. **Phase 4: UI Testing** - Write integration tests for auth flow and components
3. **Production Deployment** - Configure production OAuth providers and CORS

## References

- Mastra Auth: `packages/auth/src/rbac.ts`
- Mastra Server API: `packages/server/src/server/handlers/`
- UI Components: `mission-command/src/ui/`
- Example Integration: `mission-command/src/ui/providers/example-App.tsx`
