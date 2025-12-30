# Mission Catalog UI - Implementation

**Status:** API-INTEGRATED COMPONENTS
**Completion:** ~80% (components connected to Mastra API, pending React app setup)

## Overview

The Mission Catalog UI provides the main interface for browsing, viewing, and managing workflow definitions in the Mission Command Centre.

## What's Been Implemented

### ✅ Core UI Components (3 files - API Integrated)

1. **CatalogView.tsx** (72 lines)
   - ✅ Connected to Mastra API via `useMastraClient`
   - ✅ Uses `useQuery` for data fetching
   - ✅ Integrated with Mastra's `WorkflowTable` component
   - ✅ Role-based action buttons (create) using `MissionCommandRole` from RBAC
   - ✅ Built-in search/filter from WorkflowTable component

2. **WorkflowDetailView.tsx** (110 lines)
   - ✅ Connected to Mastra API via `useMastraClient`
   - ✅ Integrated with `WorkflowGraph`, `WorkflowInformation`, `WorkflowLayout`
   - ✅ Workflow step visualization
   - ✅ Role-based edit/delete permissions
   - ✅ Loading states and error handling

3. **CreateWorkflowView.tsx** (292 lines)
   - Form-based workflow creation/editing interface
   - JSON schema builders for input/output
   - Step composition interface
   - Support for multiple step types (execute, branch, parallel, suspend)
   - Real-time JSON validation
   - ⚠️  Pending: API integration (workflows are typically code-defined in Mastra)

4. **index.ts** - Clean component and type exports

## What Still Needs Implementation

### 🔄 React App Setup (Critical)

1. **Vite + React app** in `mission-command/ui/`
   ```bash
   cd mission-command
   npm create vite@latest ui -- --template react-ts
   cd ui
   npm install
   ```

2. **Dependencies**
   ```bash
   npm install @mastra/core @mastra/react @mastra/playground-ui
   npm install @mastra/auth
   npm install react-router-dom
   npm install tailwindcss postcss autoprefixer
   ```

3. **Routing** (`src/App.tsx`)
   ```typescript
   import { BrowserRouter, Routes, Route } from 'react-router-dom';
   import { CatalogView } from '@/ui/CatalogView';
   import { WorkflowDetailView } from '@/ui/WorkflowDetailView';

   export function App() {
     return (
       <BrowserRouter>
         <Routes>
           <Route path="/" element={<CatalogView {...props} />} />
           <Route path="/workflow/:id" element={<WorkflowDetailView {...props} />} />
         </Routes>
       </BrowserRouter>
     );
   }
   ```

### 🔄 Authentication Integration

4. **Auth Provider** - Integrate with RBAC system
   ```typescript
   // Get user role from JWT context
   const { user } = useAuth();
   const currentUserRole: MissionCommandRole = user?.role || 'viewer';
   ```

## Changes Made (Latest Update)

- **CatalogView**: Now uses `useMastraClient()` and `useQuery` to fetch workflows from Mastra API
- **WorkflowDetailView**: Now uses `useMastraClient()` and `useQuery` to fetch workflow details
- Both components use `MissionCommandRole` type from `@mastra/auth` for RBAC

## API Integration Already Done

```typescript
import { useQuery } from '@tanstack/react-query';
import { useMastraClient } from '@mastra/react';
import { MissionCommandRole } from '@mastra/auth';

// In components:
const client = useMastraClient();
const { data: workflows, isLoading } = useQuery({
  queryKey: ['workflows'],
  queryFn: () => client.listWorkflows(),
});
```

## Files Modified

```
mission-command/src/ui/
├── CatalogView.tsx           (72 lines) ✅ API integrated
├── WorkflowDetailView.tsx    (110 lines) ✅ API integrated
├── CreateWorkflowView.tsx    (292 lines) ⚠️  Form UI only
└── index.ts                  (exports)
```

## Deployment Checklist

- [x] Components use `useMastraClient` for API calls
- [x] Components use `MissionCommandRole` from RBAC
- [x] Integrated with `@mastra/playground-ui` components
- [x] TypeScript types exported
- [ ] Vite app created
- [ ] Routing configured
- [ ] Auth provider integrated
- [ ] Environment variables set up
- [ ] Build tested

## Notes

Components are **ready for React app integration**. They already use the correct Mastra APIs and types. The remaining work is primarily setting up the Vite build pipeline and connecting routing.
