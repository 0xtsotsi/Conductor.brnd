/**
 * Mission Command Server Integration Example
 *
 * This file shows how to integrate the OAuth handler, user management API,
 * and audit logging system into a Mastra server instance.
 *
 * Setup:
 * 1. Configure environment variables (see .env.example)
 * 2. Run database migrations
 * 3. Start Mastra server with OAuth enabled
 */

import { Mastra } from '@mastra/core';
import { MissionCommandAuth } from '@mastra/auth';
import { createOAuthHandler } from './oauth-handler';
import { createUsersAPI } from './users-api';
import { createLibSQLUserStorage, runUserMigration } from './user-storage';
import { createLibsqlStore } from '@mastra/storage-libsql';
import { createAuditService } from '../auth/audit-service';
import { createAuditMiddlewareStack } from './audit-middleware';
import { createAuditAPI } from './audit-api';
import { createWorkflowsAPI, PgWorkflowStorage, runWorkflowDefinitionsMigration } from './workflow-storage';

/**
 * Create Mission Command server with OAuth authentication and audit logging
 */
export async function createMissionCommandServer() {
  // Initialize LibSQL storage
  const storage = createLibsqlStore({
    url: process.env.LIBSQL_URL || 'file:mission-command.db',
  });

  // Run user migration to create table
  await runUserMigration(storage);

  // Run workflow definitions migration
  await runWorkflowDefinitionsMigration(storage);

  // Create user storage adapter
  const userStorage = createLibSQLUserStorage(storage);

  // Create workflow storage adapter
  const workflowStorage = new PgWorkflowStorage(storage);

  // Create audit service
  const auditService = createAuditService({
    storage: userStorage,
    retentionDays: 90,
    logger: console,
  });

  // Create OAuth handler
  const oauthHandler = createOAuthHandler({
    jwtSecret: process.env.JWT_AUTH_SECRET || 'your-secret-key',
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
    github: {
      clientId: process.env.GITHUB_CLIENT_ID || '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    },
    defaultRole: (process.env.DEFAULT_ROLE as any) || 'viewer',
    storage: userStorage,
  });

  // Create user management API
  const usersAPI = createUsersAPI({
    storage: userStorage,
  });

  // Create audit API
  const auditAPI = createAuditAPI({
    auditService,
  });

  // Create workflows API
  const workflowsAPI = createWorkflowsAPI({
    storage: workflowStorage,
  });

  // Create audit middleware stack
  const auditMiddleware = createAuditMiddlewareStack({
    auditService,
    logSuccess: true,
    logFailure: true,
    logBody: false,
    excludePaths: ['/health', '/metrics'],
  });

  // Create Mission Command auth
  const auth = new MissionCommandAuth({
    secret: process.env.JWT_AUTH_SECRET || 'your-secret-key',
  });

  // Create Mastra instance
  const mastra = new Mastra({
    auth,
    storage,
  });

  // Get Hono app
  const app = mastra.getServer();

  // Apply audit middleware to all API routes
  app.use('/api/*', auditMiddleware);

  // Mount OAuth handler
  app.route('/api/auth', oauthHandler);

  // Mount user management API
  app.route('/api/users', usersAPI);

  // Mount audit API
  app.route('/api/audit', auditAPI);

  // Mount workflows API
  app.route('/', workflowsAPI);

  return mastra;
}

/**
 * Example .env configuration:
 *
 * # JWT Secret for token signing
 * JWT_AUTH_SECRET=your-super-secret-key-change-this
 *
 * # Frontend URL (for OAuth redirects)
 * FRONTEND_URL=http://localhost:3000
 *
 * # GitHub OAuth App (create at https://github.com/settings/developers)
 * GITHUB_CLIENT_ID=your-github-client-id
 * GITHUB_CLIENT_SECRET=your-github-client-secret
 *
 * # Google OAuth App (create at https://console.cloud.google.com)
 * GOOGLE_CLIENT_ID=your-google-client-id
 * GOOGLE_CLIENT_SECRET=your-google-client-secret
 *
 * # Default role for new users
 * DEFAULT_ROLE=viewer
 *
 * # LibSQL database URL
 * LIBSQL_URL=file:mission-command.db
 */
