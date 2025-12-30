# Mission Command UI - Architecture Diagram

## Provider Hierarchy

```
┌─────────────────────────────────────────────────────────────────┐
│                           App.tsx                                │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                  BrowserRouter                             │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │            QueryClientProvider                       │  │  │
│  │  │  ┌───────────────────────────────────────────────┐  │  │  │
│  │  │  │         MastraReactProvider                   │  │  │  │
│  │  │  │         (@mastra/react)                      │  │  │  │
│  │  │  │  ┌─────────────────────────────────────────┐  │  │  │  │
│  │  │  │  │         AuthProvider                    │  │  │  │  │
│  │  │  │  │    (@mission-command/ui)               │  │  │  │  │
│  │  │  │  │  ┌──────────────────────────────────┐  │  │  │  │  │
│  │  │  │  │  │            Routes                │  │  │  │  │  │
│  │  │  │  │  │  ┌────────────────────────────┐  │  │  │  │  │
│  │  │  │  │  │  │   /login                  │  │  │  │  │  │
│  │  │  │  │  │  │   (public)                │  │  │  │  │  │
│  │  │  │  │  │  └────────────────────────────┘  │  │  │  │  │
│  │  │  │  │  │  ┌────────────────────────────┐  │  │  │  │  │
│  │  │  │  │  │  │   / (CatalogView)         │  │  │  │  │  │
│  │  │  │  │  │  │   (ProtectedRoute)        │  │  │  │  │  │
│  │  │  │  │  │  └────────────────────────────┘  │  │  │  │  │
│  │  │  │  │  │  ┌────────────────────────────┐  │  │  │  │  │
│  │  │  │  │  │  │   /approvals              │  │  │  │  │  │
│  │  │  │  │  │  │   (ProtectedRoute + RBAC) │  │  │  │  │  │
│  │  │  │  │  │  └────────────────────────────┘  │  │  │  │  │
│  │  │  │  │  └──────────────────────────────────┘  │  │  │  │  │
│  │  │  │  └─────────────────────────────────────────┘  │  │  │  │
│  │  │  └───────────────────────────────────────────────┘  │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Authentication Flow

```
User navigates to app
       │
       ▼
┌─────────────────┐
│  Check for JWT  │
│  in localStorage│
└────────┬────────┘
         │
    No JWT?    Yes JWT?
       │           │
       ▼           ▼
┌──────────┐  ┌─────────────┐
│Redirect  │  │ Parse JWT   │
│to /login │  │ payload     │
└──────────┘  └──────┬──────┘
                     │
                Expired?    Valid?
                   │           │
                   ▼           ▼
              ┌─────────┐  ┌──────────────┐
              │Clear JWT│  │Set user, role│
              │Redirect │  │isAuth=true   │
              │to /login│  └──────────────┘
              └─────────┘         │
                                 ▼
                          ┌──────────────┐
                          │ Show Dashboard│
                          └──────────────┘
```

## Login Flow

```
User clicks "Login with GitHub"
       │
       ▼
┌──────────────────────────┐
│ Redirect to              │
│ /api/auth/login?         │
│  provider=github&        │
│  redirect_uri=/          │
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────┐
│ GitHub OAuth Screen      │
│ (User approves)          │
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────┐
│ OAuth Callback           │
│ Server generates JWT     │
│ with role from database  │
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────┐
│ Redirect to /            │
│ with JWT in cookie/local  │
│ storage (client-side)    │
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────┐
│ AuthProvider detects JWT │
│ Sets user, role          │
│ Shows dashboard          │
└──────────────────────────┘
```

## Protected Route Flow

```
User accesses /approvals
       │
       ▼
┌─────────────────────┐
│ ProtectedRoute      │
│ checks:             │
│ 1. isAuthenticated  │
│ 2. requireRole      │
└──────────┬──────────┘
           │
   Not Auth?    Auth?
      │            │
      ▼            ▼
 ┌────────┐  ┌─────────────┐
 │Redirect│  │ Check Role  │
 │to/login│  └──────┬──────┘
 └────────┘         │
              Has Role?   Missing Role?
                 │            │
                 ▼            ▼
          ┌──────────┐  ┌──────────────┐
          │Render    │  │Redirect to   │
          │Children  │  │/unauthorized │
          └──────────┘  └──────────────┘
```

## Component Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     CatalogView Component                   │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ useAuth() - Gets user role                            │ │
│  │  ├── user: MissionCommandUser                         │ │
│  │  ├── role: 'admin' | 'operator' | 'viewer'           │ │
│  │  └── isAuthenticated: boolean                         │ │
│  └───────────────────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ useMastraClient() - Gets API client                   │ │
│  │  └── client.listWorkflows()                           │ │
│  └───────────────────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ useQuery() - Fetches data from API                    │ │
│  │  ├── queryKey: ['workflows']                          │ │
│  │  └── queryFn: () => client.listWorkflows()            │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  Props:                                                     │
│  ├── currentUserRole: MissionCommandRole (from useAuth)    │
│  ├── onWorkflowSelect: (id: string) => void                │
│  └── onWorkflowCreate: () => void                          │
│                                                             │
│  Role-based UI:                                             │
│  ├── canCreate = role === 'admin' || role === 'operator'   │
│  └── canDelete = role === 'admin'                          │
└─────────────────────────────────────────────────────────────┘
```

## API Request Flow

```
Component calls useQuery()
       │
       ▼
┌──────────────────────┐
│ useMastraClient()    │
│ returns MastraClient │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────────────┐
│ client.listWorkflows()       │
│ ┌────────────────────────┐   │
│ │ fetch(                 │   │
│ │   `${baseUrl}/api/     │   │
│ │    workflows`,         │   │
│ │   {                    │   │
│ │     headers: {         │   │
│ │       Authorization:   │   │
│ │         `Bearer ${jwt}`│   │
│ │     }                  │   │
│ │   }                    │   │
│ │ )                      │   │
│ └────────────────────────┘   │
└──────────┬───────────────────┘
           │
           ▼
┌──────────────────────────────┐
│ Mastra Server (port 4111)    │
│ ┌────────────────────────┐   │
│ │ JWT Validation         │   │
│ │ Role Check             │   │
│ │ RBAC Authorization     │   │
│ └────────────────────────┘   │
│           │                   │
│           ▼                   │
│ ┌────────────────────────┐   │
│ │ GET /api/workflows     │   │
│ │ Handler                │   │
│ └────────────────────────┘   │
└──────────┬───────────────────┘
           │
           ▼
┌──────────────────────────────┐
│ Response: {                  │
│   workflows: {               │
│     workflowId1: {...},      │
│     workflowId2: {...}       │
│   }                          │
│ }                            │
└──────────────────────────────┘
```

## Role-Based Access Control

```
┌──────────────────────────────────────────────────────────┐
│                    Role Permissions                       │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │  ADMIN                                           │    │
│  │  ├── View workflows ✅                           │    │
│  │  ├── Create workflows ✅                         │    │
│  │  ├── Update workflows ✅                         │    │
│  │  ├── Delete workflows ✅                         │    │
│  │  ├── Execute workflows ✅                        │    │
│  │  ├── Approve workflows ✅                        │    │
│  │  ├── View runs ✅                                │    │
│  │  ├── Cancel runs ✅                              │    │
│  │  └── Manage users ✅                             │    │
│  └─────────────────────────────────────────────────┘    │
│                                                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │  OPERATOR                                        │    │
│  │  ├── View workflows ✅                           │    │
│  │  ├── Create workflows ✅                         │    │
│  │  ├── Update workflows ❌                         │    │
│  │  ├── Delete workflows ❌                         │    │
│  │  ├── Execute workflows ✅                        │    │
│  │  ├── Approve workflows ✅                        │    │
│  │  ├── View runs ✅                                │    │
│  │  ├── Cancel runs ✅                              │    │
│  │  └── Manage users ❌                             │    │
│  └─────────────────────────────────────────────────┘    │
│                                                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │  VIEWER                                          │    │
│  │  ├── View workflows ✅                           │    │
│  │  ├── Create workflows ❌                         │    │
│  │  ├── Update workflows ❌                         │    │
│  │  ├── Delete workflows ❌                         │    │
│  │  ├── Execute workflows ❌                        │    │
│  │  ├── Approve workflows ❌                        │    │
│  │  ├── View runs ✅                                │    │
│  │  ├── Cancel runs ❌                              │    │
│  │  └── Manage users ❌                             │    │
│  └─────────────────────────────────────────────────┘    │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

## Directory Structure

```
mission-command/
├── src/
│   ├── ui/
│   │   ├── providers/
│   │   │   ├── AuthProvider.tsx          ✨ NEW
│   │   │   ├── ProtectedRoute.tsx        ✨ NEW
│   │   │   └── example-App.tsx           ✨ NEW
│   │   ├── CatalogView.tsx               (existing)
│   │   ├── WorkflowDetailView.tsx        (existing)
│   │   ├── CreateWorkflowView.tsx        (existing)
│   │   ├── ApprovalQueueView.tsx         (existing)
│   │   ├── MissionRunsView.tsx           (existing)
│   │   └── index.ts                      (updated)
│   └── ...
├── package.json                          (updated)
├── PHASE_2_INTEGRATION.md                ✨ NEW
├── PHASE_2_SUMMARY.md                    ✨ NEW
└── ARCHITECTURE.md                       ✨ NEW
```

## Key Technologies

- **React** - UI framework
- **React Router** - Client-side routing
- **React Query** - Data fetching and caching
- **Mastra React SDK** - API client (`@mastra/react`)
- **Mastra Auth** - JWT authentication & RBAC (`@mastra/auth`)
- **TypeScript** - Type safety

## Environment Configuration

```env
# .env in Vite app root
VITE_MASTRA_API_URL=http://localhost:4111
VITE_AUTH_LOGIN_URL=/api/auth/login
VITE_AUTH_LOGOUT_URL=/api/auth/logout
JWT_AUTH_SECRET=your-secret-key  # Server-side only
```

## Development Workflow

```bash
# Terminal 1: Mastra Server (port 4111)
cd /path/to/Conductor-brnd
pnpm build
pnpm run dev:server

# Terminal 2: Vite App (port 3000)
cd /path/to/vite-app
pnpm install
pnpm run dev

# Browser: Navigate to http://localhost:3000
# → Redirects to /login
# → After login → Shows dashboard with role badge
```

---

**Legend:**
- ✨ NEW = Created in Phase 2
- (existing) = Already built in Phase 1
- (updated) = Modified for Phase 2
