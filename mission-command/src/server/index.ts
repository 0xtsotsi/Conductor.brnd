/**
 * Mission Command Centre - Server Components
 *
 * Webhook handlers and server utilities for Mission Command Centre.
 */

// Export complete webhook handler with signature verification
export {
  createGitHubWebhookRouter,
  registerSuspendedRun,
  setWorkflowResumeFunction,
  setSuspendedRunsStorage,
  verifyGitHubSignature,
} from './github-webhook';

export type {
  GitHubWebhookPayload,
  WorkflowResumeFunction,
} from './github-webhook';

// Export OAuth authentication handler
export {
  createOAuthHandler,
} from './oauth-handler';

export type {
  OAuthHandlerOptions,
  OAuthStorage,
} from './oauth-handler';

// Export user storage implementations
export {
  createLibSQLUserStorage,
  createInMemoryUserStorage,
  PgUserStorage,
  runUserMigration,
  CREATE_USERS_TABLE_SQL,
} from './user-storage';

export type {
  UserSession,
} from './user-storage';

// Export user management API
export {
  createUsersAPI,
} from './users-api';

// Export suspended runs storage
export {
  SuspendedRunsStorage,
  createSuspendedRunsStorage,
} from './suspended-runs-storage';

export type {
  SuspendedRun,
} from './suspended-runs-storage';

// Export rate limiting
export {
  rateLimit,
  createGitHubWebhookRateLimit,
  startRateLimitCleanup,
} from './rate-limit';

export type {
  RateLimitConfig,
} from './rate-limit';

// Export cleanup job
export {
  CleanupJob,
  createCleanupJob,
  createManualCleanupHandler,
} from './cleanup';

export type {
  CleanupJobConfig,
  CleanupResult,
} from './cleanup';

// Export audit service
export {
  createAuditService,
  AuditService,
  extractIpAddress,
  extractUserAgent,
  redactPII,
} from '../auth/audit-service';

export type {
  AuditEvent,
  AuditLogEntry,
  AuditEventType,
  AuditLogFilters,
  AuditLogResult,
  AuditServiceConfig,
} from '../auth/audit-service';

// Export audit middleware
export {
  createAuditMiddleware,
  createAuthorizationAuditMiddleware,
  createAdminAuditMiddleware,
  createAuditMiddlewareStack,
} from './audit-middleware';

export type {
  AuditMiddlewareOptions,
} from './audit-middleware';

// Export JWT authentication middleware
export {
  createJwtMiddleware,
  requireAuth,
  optionalAuth,
  getUser,
  getUserId,
  getUserEmail,
  getUserRole,
} from './jwt-middleware';

export type {
  JwtPayload,
  MissionCommandUser,
  ContextWithUser,
  JwtMiddlewareOptions,
} from './jwt-middleware';

// Export audit API
export {
  createAuditAPI,
} from './audit-api';

export type {
  AuditAPIOptions,
} from './audit-api';

// Export missions API
export {
  createMissionsAPI,
} from './handlers/missions';

export type {
  MissionRun,
  TimelineStep,
  MissionsAPIOptions,
} from './handlers/missions';

// Export approvals API
export {
  createApprovalsAPI,
} from './handlers/approvals';

export type {
  SuspendData,
  ApprovalStatus,
  ApprovalEntry,
  ApprovalDetails,
  ApprovalHistoryEntry,
  ApprovalsAPIOptions,
} from './handlers/approvals';

// Export workflows API
export {
  createWorkflowsAPI,
} from './handlers/workflows';

export type {
  WorkflowDefinition,
  WorkflowStepConfig,
  WorkflowDefinitionStorage,
  WorkflowsAPIOptions,
} from './handlers/workflows';

// Export workflow storage
export {
  PgWorkflowStorage,
  runWorkflowDefinitionsMigration,
  CREATE_WORKFLOW_DEFINITIONS_TABLE_SQL,
} from './workflow-storage';

// Export Mastra workflow execution system
export {
  createMastraSystem,
} from './mastra-server';

export type {
  MastraServerOptions,
} from './mastra-server';
