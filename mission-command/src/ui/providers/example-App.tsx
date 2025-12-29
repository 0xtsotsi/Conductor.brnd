/**
 * Example App.tsx for Mission Command Centre UI
 *
 * This file demonstrates how to integrate all the Mission Command UI components
 * with the MastraClient and Auth providers.
 *
 * Copy this pattern to your Vite app's main App.tsx file.
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MastraReactProvider } from '@mastra/react';
import { AuthProvider, useAuth } from './providers/AuthProvider';
import { ProtectedRoute, UnauthorizedPage, LoginPage } from './providers/ProtectedRoute';

// Import Mission Command UI components
import {
  CatalogView,
  WorkflowDetailView,
  CreateWorkflowView,
  ApprovalQueueView,
  MissionRunsView,
} from './index';

/**
 * Create React Query client
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

/**
 * Dashboard Layout Component
 */
function DashboardLayout() {
  const { user, role, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Mission Command Centre
              </h1>
              <p className="text-sm text-gray-600">Workflow Orchestration & Monitoring</p>
            </div>

            <div className="flex items-center gap-4">
              {/* Role Badge */}
              {role && (
                <span
                  className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                    role === 'admin'
                      ? 'bg-red-100 text-red-800'
                      : role === 'operator'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {role.toUpperCase()}
                </span>
              )}

              {/* User Info */}
              <div className="text-right text-sm">
                <p className="font-medium text-gray-900">{user?.name || user?.email}</p>
                <p className="text-xs text-gray-600">{user?.email}</p>
              </div>

              {/* Logout Button */}
              <button
                onClick={logout}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Logout
              </button>
            </div>
          </div>

          {/* Navigation */}
          <nav className="mt-4 flex gap-4 border-t pt-4">
            <a
              href="/"
              className="text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              Catalog
            </a>
            <a
              href="/approvals"
              className="text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              Approval Queue
            </a>
            <a
              href="/runs"
              className="text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              Mission Runs
            </a>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-6">
        <Routes>
          {/* Catalog Route - Public to all authenticated users */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <CatalogView
                  onWorkflowSelect={(id) => console.log('Selected:', id)}
                  onWorkflowCreate={() => console.log('Create workflow')}
                  currentUserRole={role!}
                />
              </ProtectedRoute>
            }
          />

          {/* Workflow Detail Route */}
          <Route
            path="/workflow/:workflowId"
            element={
              <ProtectedRoute>
                <WorkflowDetailView
                  workflowId="placeholder"
                  onBack={() => console.log('Back to catalog')}
                  currentUserRole={role!}
                />
              </ProtectedRoute>
            }
          />

          {/* Create Workflow Route - Admin/Operator only */}
          <Route
            path="/workflow/new"
            element={
              <ProtectedRoute requireRole={['admin', 'operator']}>
                <CreateWorkflowView
                  onCancel={() => console.log('Cancel')}
                  onSave={(config) => console.log('Save:', config)}
                  currentUserRole={role!}
                />
              </ProtectedRoute>
            }
          />

          {/* Approval Queue Route - Admin/Operator only */}
          <Route
            path="/approvals"
            element={
              <ProtectedRoute requireRole={['admin', 'operator']}>
                <ApprovalQueueView currentUserRole={role!} />
              </ProtectedRoute>
            }
          />

          {/* Mission Runs Route - Public to all authenticated users */}
          <Route
            path="/runs"
            element={
              <ProtectedRoute>
                <MissionRunsView
                  workflowId="placeholder"
                  onRunSelect={(runId) => console.log('Selected run:', runId)}
                  currentUserRole={role!}
                />
              </ProtectedRoute>
            }
          />

          {/* Unauthorized Page */}
          <Route path="/unauthorized" element={<UnauthorizedPage />} />

          {/* Catch-all - redirect to home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

/**
 * Main App Component
 *
 * Wraps the application with all necessary providers:
 * 1. MastraReactProvider - Provides MastraClient for API calls
 * 2. AuthProvider - Provides authentication and RBAC context
 * 3. QueryClientProvider - Provides React Query for data fetching
 * 4. BrowserRouter - Provides routing
 */
export default function App() {
  // Get API URL from environment variable
  const apiUrl = import.meta.env.VITE_MASTRA_API_URL || 'http://localhost:4111';

  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <MastraReactProvider baseUrl={apiUrl}>
          <AuthProvider apiUrl={apiUrl}>
            <Routes>
              {/* Public Login Route */}
              <Route path="/login" element={<LoginPage />} />

              {/* Protected Routes */}
              <Route path="/*" element={<DashboardLayout />} />
            </Routes>
          </AuthProvider>
        </MastraReactProvider>
      </QueryClientProvider>
    </BrowserRouter>
  );
}

/**
 * Environment Variables (.env)
 *
 * Create a .env file in your Vite app root:
 *
 * # Mastra API URL (default: http://localhost:4111)
 * VITE_MASTRA_API_URL=http://localhost:4111
 *
 * # Optional: Custom auth endpoints
 * # VITE_AUTH_LOGIN_URL=/api/auth/login
 * # VITE_AUTH_LOGOUT_URL=/api/auth/logout
 */

/**
 * Installation Instructions
 *
 * 1. Install dependencies:
 *    pnpm install
 *
 * 2. Start Mastra Server (port 4111):
 *    pnpm run dev:server
 *
 * 3. Start Vite dev server (port 3000):
 *    pnpm run dev
 *
 * 4. Open http://localhost:3000
 *
 * You will be redirected to login. After authentication, you'll see the dashboard.
 */
