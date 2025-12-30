import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Navigation } from './components/Navigation';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { AuthCallbackPage } from './pages/AuthCallbackPage';
import { AuditLogPage } from './pages/AuditLogPage';
import { UsersManagementPage } from './pages/UsersManagementPage';
import { ProfilePage } from './pages/ProfilePage';
import { useAuth } from './providers/AuthProvider';
import { MissionCommandRole } from '@mastra/auth';
import { useMastraClient } from '@mastra/react';

// Import UI views from the parent package
import {
  CatalogView,
  WorkflowDetailView,
  CreateWorkflowView,
  ApprovalQueueView,
  MissionRunsView,
} from '@mission-command/github-tools';

// Import workflow types
import type { WorkflowConfig } from '@mission-command/github-tools';

function AppContent() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const client = useMastraClient();
  const currentUserRole = user?.role ?? 'viewer';

  const handleWorkflowSelect = (workflowId: string) => {
    navigate(`/workflow/${workflowId}`);
  };

  const handleWorkflowCreate = () => {
    navigate('/workflow/new');
  };

  /**
   * Handle workflow creation
   * Calls the backend API to create a new workflow definition
   */
  const handleSaveWorkflow = async (workflow: WorkflowConfig): Promise<void> => {
    try {
      // Get auth token from localStorage
      const token = localStorage.getItem('auth_token');

      if (!token) {
        throw new Error('Authentication required');
      }

      // Call the backend API
      const response = await fetch('/api/workflows/definitions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(workflow),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to create workflow');
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to create workflow');
      }

      // Navigate to the workflow detail page
      navigate(`/workflow/${result.data.id}`);
    } catch (error) {
      console.error('Error creating workflow:', error);
      throw error;
    }
  };

  return (
    <div className="min-h-screen bg-mastra-bg-1 text-mastra-el-text">
      <Navigation currentUserRole={currentUserRole} />

      <main className="min-h-[calc(100vh-64px)]">
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />

          {/* Protected Routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <CatalogView
                  onWorkflowSelect={handleWorkflowSelect}
                  onWorkflowCreate={handleWorkflowCreate}
                  currentUserRole={currentUserRole}
                />
              </ProtectedRoute>
            }
          />

          {/* Workflow Detail - requires viewer role */}
          <Route
            path="/workflow/:id"
            element={
              <ProtectedRoute requiredRole="viewer">
                <WorkflowDetailView
                  workflowId="" // Will be extracted from route params
                  onBack={() => navigate('/')}
                  onEdit={() => {
                    // Feature: Workflow editing
                    // Tracked separately in project backlog
                    console.info('Workflow edit not yet implemented');
                  }}
                  onDelete={() => {
                    // Feature: Workflow deletion
                    // Tracked separately in project backlog
                    console.info('Workflow delete not yet implemented');
                  }}
                  currentUserRole={currentUserRole}
                />
              </ProtectedRoute>
            }
          />

          {/* Create New Workflow - requires admin role */}
          <Route
            path="/workflow/new"
            element={
              <ProtectedRoute requiredRole="admin">
                <CreateWorkflowView
                  mode="create"
                  onSave={handleSaveWorkflow}
                  onCancel={() => navigate('/')}
                  currentUserRole={currentUserRole}
                />
              </ProtectedRoute>
            }
          />

          {/* Approval Queue - requires operator role */}
          <Route
            path="/approvals"
            element={
              <ProtectedRoute requiredRole="operator">
                <ApprovalQueueView
                  currentUserRole={currentUserRole}
                />
              </ProtectedRoute>
            }
          />

          {/* Mission Runs - requires viewer role */}
          <Route
            path="/runs"
            element={
              <ProtectedRoute requiredRole="viewer">
                <MissionRunsView
                  currentUserRole={currentUserRole}
                />
              </ProtectedRoute>
            }
          />

          {/* Audit Logs - requires admin role */}
          <Route
            path="/audit"
            element={
              <ProtectedRoute requiredRole="admin">
                <AuditLogPage />
              </ProtectedRoute>
            }
          />

          {/* User Management - requires admin role */}
          <Route
            path="/admin/users"
            element={
              <ProtectedRoute requiredRole="admin">
                <UsersManagementPage />
              </ProtectedRoute>
            }
          />

          {/* Profile - accessible to all authenticated users */}
          <Route
            path="/profile"
            element={
              <ProtectedRoute requiredRole="viewer">
                <ProfilePage />
              </ProtectedRoute>
            }
          />

          {/* Catch all - redirect to home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

// Main App component with providers
export default function App() {
  return (
    <Routes>
      <Route path="/*" element={<AppContent />} />
    </Routes>
  );
}
