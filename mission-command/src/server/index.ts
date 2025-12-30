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
  AuditLogEntry,
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

// Export audit API
export {
  createAuditAPI,
} from './audit-api';

export type {
  AuditAPIOptions,
} from './audit-api';
