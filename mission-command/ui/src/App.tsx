import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Navigation } from './components/Navigation';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { useAuth } from './providers/AuthProvider';

// Import UI views from the parent package
import {
  CatalogView,
  WorkflowDetailView,
  CreateWorkflowView,
  ApprovalQueueView,
  MissionRunsView,
} from '@mission-command/github-tools';

function App() {
  const { role, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  const handleWorkflowSelect = (workflowId: string) => {
    navigate(`/workflow/${workflowId}`);
  };

  const handleWorkflowCreate = () => {
    navigate('/workflow/new');
  };

  // Show loading state while auth is initializing
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-mastra-el-accent mx-auto mb-4"></div>
          <p className="text-mastra-el-text-muted">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-mastra-bg-1 text-mastra-el-text">
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<LoginPage />} />

        {/* Protected Routes */}
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <div className="min-h-screen">
                <Navigation />
                <main className="min-h-[calc(100vh-64px)]">
                  <Routes>
                    {/* Home - Mission Catalog */}
                    <Route
                      path="/"
                      element={
                        role ? (
                          <CatalogView
                            onWorkflowSelect={handleWorkflowSelect}
                            onWorkflowCreate={handleWorkflowCreate}
                            currentUserRole={role}
                          />
                        ) : null
                      }
                    />

                    {/* Workflow Detail */}
                    <Route
                      path="/workflow/:id"
                      element={
                        role ? (
                          <WorkflowDetailView
                            onBack={() => navigate('/')}
                            currentUserRole={role}
                          />
                        ) : null
                      }
                    />

                    {/* Create New Workflow - Admin/Operator only */}
                    <Route
                      path="/workflow/new"
                      element={
                        role ? (
                          <ProtectedRoute requiredRole="operator">
                            <CreateWorkflowView
                              onSave={(workflow) => {
                                // TODO: Implement workflow creation
                                console.log('Creating workflow:', workflow);
                                navigate('/');
                              }}
                              onCancel={() => navigate('/')}
                              currentUserRole={role}
                            />
                          </ProtectedRoute>
                        ) : null
                      }
                    />

                    {/* Approval Queue - Operator/Admin only */}
                    <Route
                      path="/approvals"
                      element={
                        role ? (
                          <ProtectedRoute requiredRole="operator">
                            <ApprovalQueueView currentUserRole={role} />
                          </ProtectedRoute>
                        ) : null
                      }
                    />

                    {/* Mission Runs */}
                    <Route
                      path="/runs"
                      element={
                        role ? (
                          <MissionRunsView currentUserRole={role} />
                        ) : null
                      }
                    />

                    {/* Catch all - redirect to home */}
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </main>
              </div>
            </ProtectedRoute>
          }
        />
      </Routes>
    </div>
  );
}

export default App;
