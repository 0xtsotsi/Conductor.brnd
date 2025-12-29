import { BrowserRouter, Routes, Route, useNavigate, useLocation, useParams, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CatalogView, WorkflowDetailView, CreateWorkflowView, ApprovalQueueView, MissionRunsView } from '@mission-command/github-tools/ui';
import { MissionCommandRole } from '@mastra/auth';
import { MastraClientProvider } from '@mastra/react';
import { AuthProvider, useAuth } from './providers/AuthProvider';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function Navigation() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, role } = useAuth();

  const navItems = [
    { path: '/', label: 'Catalog' },
    { path: '/runs', label: 'Runs' },
    { path: '/approvals', label: 'Approvals' },
  ];

  return (
    <nav className="bg-mastra-bg-2 border-b border-mastra-border-1">
      <div className="container mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-8">
            <h1 className="text-xl font-bold text-mastra-el-6">Mission Command Centre</h1>
            {navItems.map((item) => (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  location.pathname === item.path
                    ? 'bg-mastra-bg-5 text-mastra-el-6'
                    : 'text-mastra-el-3 hover:text-mastra-el-5 hover:bg-mastra-bg-3'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="flex items-center space-x-4">
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-mastra-bg-7 text-mastra-el-6">
              {role}
            </span>
            {user && (
              <span className="text-sm text-mastra-el-4">{user.email}</span>
            )}
            <button
              onClick={logout}
              className="px-3 py-1 text-sm text-mastra-el-3 hover:text-mastra-el-5 border border-mastra-border-1 rounded hover:bg-mastra-bg-3 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}

function WorkflowDetailWrapper() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { role } = useAuth();

  if (!id) {
    return <div>Workflow not found</div>;
  }

  return (
    <WorkflowDetailView
      workflowId={id}
      onEdit={() => console.log('Edit workflow')}
      onDelete={() => console.log('Delete workflow')}
      onBack={() => navigate('/')}
      currentUserRole={role}
    />
  );
}

function AppRoutes() {
  const { role } = useAuth();

  const handleWorkflowSelect = (workflowId: string) => {
    window.location.href = `/workflow/${workflowId}`;
  };

  const handleWorkflowCreate = () => {
    window.location.href = '/workflow/new';
  };

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-mastra-bg-1">
        <Navigation />
        <main>
          <Routes>
            {/* Public route */}
            <Route path="/login" element={<LoginPage />} />

            {/* Protected routes */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <CatalogView
                    onWorkflowSelect={handleWorkflowSelect}
                    onWorkflowCreate={handleWorkflowCreate}
                    currentUserRole={role}
                  />
                </ProtectedRoute>
              }
            />
            <Route
              path="/workflow/:id"
              element={
                <ProtectedRoute>
                  <WorkflowDetailWrapper />
                </ProtectedRoute>
              }
            />
            <Route
              path="/workflow/new"
              element={
                <ProtectedRoute requiredRole="admin">
                  <CreateWorkflowView />
                </ProtectedRoute>
              }
            />
            <Route
              path="/approvals"
              element={
                <ProtectedRoute requiredRole="operator">
                  <ApprovalQueueView currentUserRole={role} />
                </ProtectedRoute>
              }
            />
            <Route
              path="/runs"
              element={
                <ProtectedRoute>
                  <MissionRunsView currentUserRole={role} />
                </ProtectedRoute>
              }
            />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

function App() {
  const apiUrl = import.meta.env.VITE_MASTRA_API_URL || 'http://localhost:4111';

  return (
    <QueryClientProvider client={queryClient}>
      <MastraClientProvider baseUrl={apiUrl}>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </MastraClientProvider>
    </QueryClientProvider>
  );
}

export default App;
