import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Navigation } from './components/Navigation';
import { MissionCommandRole } from '@mastra/auth';

// Import UI views from the parent package
import {
  CatalogView,
  WorkflowDetailView,
  CreateWorkflowView,
  ApprovalQueueView,
  MissionRunsView,
} from '@mission-command/github-tools';

// Mock current user role - TODO: Get from auth context
const CURRENT_USER_ROLE: MissionCommandRole = 'admin';

function App() {
  const navigate = useNavigate();

  const handleWorkflowSelect = (workflowId: string) => {
    navigate(`/workflow/${workflowId}`);
  };

  const handleWorkflowCreate = () => {
    navigate('/workflow/new');
  };

  return (
    <div className="min-h-screen bg-mastra-bg-1 text-mastra-el-text">
      <Navigation currentUserRole={CURRENT_USER_ROLE} />

      <main className="min-h-[calc(100vh-64px)]">
        <Routes>
          {/* Home - Mission Catalog */}
          <Route
            path="/"
            element={
              <CatalogView
                onWorkflowSelect={handleWorkflowSelect}
                onWorkflowCreate={handleWorkflowCreate}
                currentUserRole={CURRENT_USER_ROLE}
              />
            }
          />

          {/* Workflow Detail */}
          <Route
            path="/workflow/:id"
            element={
              <WorkflowDetailView
                onBack={() => navigate('/')}
                currentUserRole={CURRENT_USER_ROLE}
              />
            }
          />

          {/* Create New Workflow */}
          <Route
            path="/workflow/new"
            element={
              <CreateWorkflowView
                onSave={(workflow) => {
                  // TODO: Implement workflow creation
                  console.log('Creating workflow:', workflow);
                  navigate('/');
                }}
                onCancel={() => navigate('/')}
                currentUserRole={CURRENT_USER_ROLE}
              />
            }
          />

          {/* Approval Queue */}
          <Route
            path="/approvals"
            element={
              <ApprovalQueueView
                currentUserRole={CURRENT_USER_ROLE}
              />
            }
          />

          {/* Mission Runs */}
          <Route
            path="/runs"
            element={
              <MissionRunsView
                currentUserRole={CURRENT_USER_ROLE}
              />
            }
          />

          {/* Catch all - redirect to home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
