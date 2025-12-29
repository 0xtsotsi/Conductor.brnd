import { BrowserRouter, Routes, Route, useNavigate, useLocation, useParams } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CatalogView, WorkflowDetailView, CreateWorkflowView, ApprovalQueueView, MissionRunsView } from '@mission-command/github-tools/ui';
import { MissionCommandRole } from '@mastra/auth';

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
              Admin
            </span>
          </div>
        </div>
      </div>
    </nav>
  );
}

function WorkflowDetailWrapper() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  if (!id) {
    return <div>Workflow not found</div>;
  }

  return (
    <WorkflowDetailView
      workflowId={id}
      onEdit={() => console.log('Edit workflow')}
      onDelete={() => console.log('Delete workflow')}
      onBack={() => navigate('/')}
      currentUserRole={'admin'}
    />
  );
}

function App() {
  const currentUserRole: MissionCommandRole = 'admin';

  const handleWorkflowSelect = (workflowId: string) => {
    window.location.href = `/workflow/${workflowId}`;
  };

  const handleWorkflowCreate = () => {
    window.location.href = '/workflow/new';
  };

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div className="min-h-screen bg-mastra-bg-1">
          <Navigation />
          <main>
            <Routes>
              <Route
                path="/"
                element={
                  <CatalogView
                    onWorkflowSelect={handleWorkflowSelect}
                    onWorkflowCreate={handleWorkflowCreate}
                    currentUserRole={currentUserRole}
                  />
                }
              />
              <Route path="/workflow/:id" element={<WorkflowDetailWrapper />} />
              <Route path="/workflow/new" element={<CreateWorkflowView />} />
              <Route path="/approvals" element={<ApprovalQueueView currentUserRole={currentUserRole} />} />
              <Route path="/runs" element={<MissionRunsView currentUserRole={currentUserRole} />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
