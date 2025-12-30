/**
 * Audit System Integration Example
 *
 * This file demonstrates how to integrate the audit logging system
 * into your Mission Command Centre server.
 *
 * File: mission-command/src/server/example-audit-integration.ts
 */

import { Hono } from 'hono';
import { createAuditService, createAuditMiddlewareStack } from '../server';
import { createOAuthHandler } from '../server';
import { createAuditAPI } from '../server';
import { createCleanupJob } from '../server';
import { PgUserStorage } from '../server/user-storage';

/**
 * Example 1: Basic Audit Service Setup
 */
async function setupAuditService() {
  // Create user storage with audit log support
  const userStorage = new PgUserStorage({
    connectionString: process.env.DATABASE_URL!,
  });

  // Initialize database tables (including audit_log)
  await userStorage.init();

  // Create audit service
  const auditService = createAuditService({
    storage: userStorage,
    retentionDays: 90, // Optional: default 90 days
    logger: console,
  });

  return { auditService, userStorage };
}

/**
 * Example 2: Apply Audit Middleware to Server
 */
function setupServerWithAudit(auditService: ReturnType<typeof createAuditService>) {
  const app = new Hono();

  // Create OAuth handler
  const oauthHandler = createOAuthHandler({
    jwtSecret: process.env.JWT_SECRET!,
    frontendUrl: process.env.FRONTEND_URL!,
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    },
    storage: auditService, // OAuth storage also logs audit events
  });

  // Create audit middleware stack
  const auditMiddleware = createAuditMiddlewareStack({
    auditService,
    logSuccess: true,
    logFailure: true,
    logBody: false, // Don't log request bodies for security
    excludePaths: ['/health', '/metrics'], // Exclude monitoring endpoints
  });

  // Apply audit middleware to all API routes
  app.use('/api/*', auditMiddleware);

  // Mount OAuth handler
  app.route('/api/auth', oauthHandler);

  return app;
}

/**
 * Example 3: Mount Audit API Endpoints
 */
function mountAuditAPI(
  app: Hono,
  auditService: ReturnType<typeof createAuditService>
) {
  // Create audit API handler
  const auditAPI = createAuditAPI({
    auditService,
  });

  // Mount audit API (requires admin role)
  app.route('/', auditAPI);
}

/**
 * Example 4: Setup Cleanup Job
 */
function setupCleanupJob(
  userStorage: PgUserStorage,
  suspendedRunsStorage: any
) {
  // Create cleanup job with audit log cleanup
  const cleanupJob = createCleanupJob({
    storage: suspendedRunsStorage,
    auditStorage: userStorage, // Add audit storage
    auditRetentionDays: 90,
    intervalMs: 60 * 60 * 1000, // Run every hour
    logger: console,
    onCleanup: (result) => {
      console.log('Cleanup completed:', result);
      if (result.auditLogsCleaned) {
        console.log(`Cleaned up ${result.auditLogsCleaned} old audit logs`);
      }
    },
  });

  return cleanupJob;
}

/**
 * Example 5: Manual Audit Logging in Custom Controllers
 */
async function logCustomAuditEvent(auditService: ReturnType<typeof createAuditService>) {
  // Example: Logging a custom event in a workflow controller
  await auditService.logWorkflowEvent({
    user: {
      sub: 'user-123',
      email: 'user@example.com',
      role: 'operator',
      provider: 'github',
    },
    action: 'workflow.approved',
    workflowId: 'workflow-abc',
    runId: 'run-xyz',
    reason: 'Approved by operator',
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0...',
  });

  // Example: Logging a failed authorization
  await auditService.logAuthorizationEvent({
    user: {
      sub: 'user-456',
      email: 'unauthorized@example.com',
      role: 'viewer',
      provider: 'github',
    },
    permission: 'workflows:delete',
    resource: 'workflow',
    resourceId: 'workflow-abc',
    granted: false,
    ipAddress: '192.168.1.2',
    userAgent: 'Mozilla/5.0...',
  });

  // Example: Logging a user management event
  await auditService.logUserManagementEvent({
    user: {
      sub: 'admin-789',
      email: 'admin@example.com',
      role: 'admin',
      provider: 'github',
    },
    action: 'user.role.changed',
    targetUserId: 'user-456',
    targetUserEmail: 'user@example.com',
    oldRole: 'viewer',
    newRole: 'operator',
    ipAddress: '192.168.1.3',
    userAgent: 'Mozilla/5.0...',
  });
}

/**
 * Example 6: Query Audit Logs
 */
async function queryAuditLogs(auditService: ReturnType<typeof createAuditService>) {
  // Get all audit logs with pagination
  const result1 = await auditService.getAuditLog({}, 0, 50);
  console.log(`Found ${result1.total} audit logs`);

  // Filter by user
  const result2 = await auditService.getAuditLog(
    {
      userId: 'user-123',
    },
    0,
    50
  );

  // Filter by action type
  const result3 = await auditService.getAuditLog(
    {
      action: ['user.login', 'user.logout'],
    },
    0,
    50
  );

  // Filter by date range
  const result4 = await auditService.getAuditLog(
    {
      startDate: new Date('2025-01-01T00:00:00Z'),
      endDate: new Date('2025-01-31T23:59:59Z'),
    },
    0,
    50
  );

  // Get audit trail for specific user
  const userTrail = await auditService.getAuditLogForUser('user-123', 100, 0);
  console.log(`User has ${userTrail.length} audit events`);
}

/**
 * Example 7: Complete Integration
 */
export async function createIntegratedServer() {
  // Step 1: Setup audit service
  const { auditService, userStorage } = await setupAuditService();

  // Step 2: Setup server with audit middleware
  const app = setupServerWithAudit(auditService);

  // Step 3: Mount audit API
  mountAuditAPI(app, auditService);

  // Step 4: Setup cleanup job (requires SuspendedRunsStorage)
  // const cleanupJob = setupCleanupJob(userStorage, suspendedRunsStorage);

  // Step 5: Add custom routes with manual audit logging
  app.post('/api/custom-action', async (c) => {
    const user = c.get('user');

    // Log custom action
    await auditService.logAuthEvent({
      userId: user?.sub,
      action: 'auth.action.admin',
      resource: 'custom',
      details: {
        action: 'custom-action',
        userEmail: user?.email,
      },
      ipAddress: c.req?.header('x-forwarded-for'),
      success: true,
    });

    return c.json({ message: 'Action logged' });
  });

  return app;
}

/**
 * Example 8: Using Audit Service Directly
 */
export class AuditLogger {
  constructor(private auditService: ReturnType<typeof createAuditService>) {}

  async logPasswordChange(user: any, ipAddress?: string) {
    await this.auditService.logAuthEvent({
      userId: user.sub,
      action: 'user.password.changed',
      resource: 'user',
      resourceId: user.id,
      details: {
        userEmail: user.email,
      },
      ipAddress,
      success: true,
    });
  }

  async logMFADisabled(user: any, ipAddress?: string) {
    await this.auditService.logAuthEvent({
      userId: user.sub,
      action: 'user.mfa.disabled',
      resource: 'user',
      resourceId: user.id,
      details: {
        userEmail: user.email,
      },
      ipAddress,
      success: true,
    });
  }

  async logFailedLogin(email: string, reason: string, ipAddress?: string) {
    await this.auditService.logAuthEvent({
      action: 'user.login.failed',
      resource: 'auth',
      details: {
        email,
        reason,
      },
      ipAddress,
      success: false,
      errorMessage: reason,
    });
  }
}

/**
 * Example 9: Query Helper Functions
 */
export class AuditQuerier {
  constructor(private auditService: ReturnType<typeof createAuditService>) {}

  async getRecentFailedLogins(count: number = 10) {
    const result = await this.auditService.getAuditLog(
      {
        action: 'user.login.failed',
      },
      0,
      count
    );

    return result.logs;
  }

  async getUserActivityLast30Days(userId: string) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    const result = await this.auditService.getAuditLog(
      {
        userId,
        startDate,
      },
      0,
      1000
    );

    return result.logs;
  }

  async getAdminActionsInDateRange(startDate: Date, endDate: Date) {
    const result = await this.auditService.getAuditLog(
      {
        action: 'auth.action.admin',
        startDate,
        endDate,
      },
      0,
      1000
    );

    return result.logs;
  }
}

// Export examples for use in tests
export {
  setupAuditService,
  setupServerWithAudit,
  mountAuditAPI,
  setupCleanupJob,
  logCustomAuditEvent,
  queryAuditLogs,
};
