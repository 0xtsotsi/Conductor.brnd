/**
 * Mission Catalog UI - Component Exports
 *
 * Main interface components for the Mission Command Centre workflow catalog.
 * Leverages @mastra/playground-ui components for consistency.
 */

// UI Components
export { CatalogView } from './CatalogView';
export { WorkflowDetailView } from './WorkflowDetailView';
export { CreateWorkflowView } from './CreateWorkflowView';
export { ApprovalQueueView } from './ApprovalQueueView';
export { MissionRunsView } from './MissionRunsView';

// Providers and Auth
export { AuthProvider, useAuth } from './providers/AuthProvider';
export {
  ProtectedRoute,
  UnauthorizedPage,
  LoginPage,
} from './providers/ProtectedRoute';

// Component Types
export type {
  CatalogViewProps,
} from './CatalogView';

export type {
  WorkflowDetailViewProps,
} from './WorkflowDetailView';

export type {
  CreateWorkflowViewProps,
  WorkflowConfig,
  WorkflowStepConfig,
} from './CreateWorkflowView';

export type {
  ApprovalQueueViewProps,
} from './ApprovalQueueView';

export type {
  MissionRunsViewProps,
} from './MissionRunsView';

// Provider Types
export type {
  AuthContextValue,
  AuthProviderProps,
} from './providers/AuthProvider';

export type {
  ProtectedRouteProps,
} from './providers/ProtectedRoute';
