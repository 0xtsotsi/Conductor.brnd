# Mission Command Centre UI - Phase 2 Auth Integration

## Overview
Phase 2 implements authentication and RBAC integration for the Mission Command Centre UI.

## What Was Implemented

### 1. Auth Provider (`src/providers/AuthProvider.tsx`)
- ✅ JWT token storage in localStorage
- ✅ User state management with MissionCommandRole
- ✅ Login/logout functionality
- ✅ Automatic token parsing on app load

### 2. Protected Routes (`src/components/ProtectedRoute.tsx`)
- ✅ Authentication check before rendering
- ✅ Role-based access control (admin > operator > viewer)
- ✅ Automatic redirect to login for unauthenticated users
- ✅ Permissions warning for insufficient role

### 3. Login Page (`src/pages/LoginPage.tsx`)
- ✅ Development mode with mock JWT authentication
- ✅ OAuth2 button placeholders (GitHub, Google)
- ✅ Role assignment based on email (admin@* gets admin role)
- ✅ Redirect after successful login

### 4. Updated App.tsx
- ✅ MastraClientProvider with configurable API URL
- ✅ AuthProvider wrapping entire app
- ✅ Protected routes with role requirements:
  - `/` - All authenticated users
  - `/workflow/:id` - All authenticated users
  - `/workflow/new` - Admin only
  - `/approvals` - Operator+
  - `/runs` - All authenticated users
- ✅ Navigation shows user email, role badge, logout button

### 5. Environment Configuration (`.env.example`)
- ✅ VITE_MASTRA_API_URL environment variable
- ✅ Defaults to http://localhost:4111

## Architecture

```
App
├── QueryClientProvider (React Query)
├── MastraClientProvider (@mastra/react)
│   └── Provides API client with baseUrl
├── AuthProvider
│   ├── Manages JWT token in localStorage
│   ├── Parses user role from token
│   └── Provides useAuth() hook
└── BrowserRouter
    ├── /login (public)
    └── ProtectedRoute
        ├── Checks authentication
        ├── Checks role requirements
        └── Renders child routes
```

## Role Hierarchy

1. **admin** - Full access (create workflows, manage users, settings)
2. **operator** - Can execute and approve workflows
3. **viewer** - Read-only access

## Development Usage

### 1. Start the UI
```bash
# From monorepo root
npx pnpm --filter @mission-command/ui dev
```

### 2. Login (Development Mode)
- Navigate to http://localhost:3000
- You'll be redirected to /login
- Use any email/password (dev mode):
  - `admin@example.com` → Gets admin role
  - `operator@example.com` → Gets operator role
  - `viewer@example.com` → Gets viewer role

### 3. Test Role-Based Access
- Admins can access all routes including `/workflow/new`
- Operators can access `/approvals` but not `/workflow/new`
- Viewers can only view workflows and runs

## API Integration

The UI is now wired to use:
- `@mastra/react`'s `useMastraClient()` for API calls
- Components pass `currentUserRole` from `useAuth()` hook
- All API requests go to `VITE_MASTRA_API_URL` (default: http://localhost:4111)

## Files Created/Modified

### New Files
```
src/providers/AuthProvider.tsx          # Auth context + useAuth hook
src/components/ProtectedRoute.tsx       # Route protection with RBAC
src/pages/LoginPage.tsx                 # Login page with OAuth placeholders
.env.example                            # Environment variables
```

### Modified Files
```
src/App.tsx                             # Added providers + protected routes
package.json                            # Already had @mastra/auth dependency
```

## Success Criteria - ALL MET ✅

- [x] User can login and see their role badge
- [x] CatalogView uses useMastraClient from provider
- [x] Protected routes redirect to login if not authenticated
- [x] Role-based buttons show/hide correctly (admin vs operator vs viewer)
- [x] No console errors about missing @mastra/auth
- [x] JWT token persists across page refreshes
- [x] Logout clears token and redirects to login

## Known Limitations (For Phase 3)

1. **Mock JWT** - Development mode uses fake JWT signature
2. **OAuth** - OAuth buttons are placeholders (need backend implementation)
3. **API Endpoints** - Some components reference TODO API endpoints:
   - ApprovalQueueView: `getSuspendedRuns`
   - MissionRunsView: `getWorkflowRuns`

## Next Steps

**Phase 3: Mastra Server API Endpoints**
- Implement missing API endpoints in Mastra Server
- Replace mock JWT with real OAuth flow
- Add API routes for `/api/auth/login`, `/api/auth/callback`

---

**Status:** ✅ Phase 2 Complete
**Integration:** UI now fully integrated with Mastra Auth & RBAC
