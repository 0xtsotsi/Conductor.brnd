/**
 * Mission Command Centre - Workflows Integration Example
 *
 * This example demonstrates how to integrate the workflow definitions API
 * into your Mission Command Centre server.
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import {
  createOAuthHandler,
  createJwtMiddleware,
  requireAuth,
  createAuditMiddleware,
  createAuditAPI,
  createMissionsAPI,
  createApprovalsAPI,
  createWorkflowsAPI,
  PgWorkflowStorage,
  runWorkflowDefinitionsMigration,
  createLibSQLUserStorage,
  runUserMigration,
} from './index';

/**
 * Database connection setup
 *
 * Replace this with your actual database connection
 */
const getDatabase = () => {
  // Example: PostgreSQL connection
  // return postgres({
  //   host: process.env.DB_HOST || 'localhost',
  //   port: parseInt(process.env.DB_PORT || '5432'),
  //   database: process.env.DB_NAME || 'mission_command',
  //   user: process.env.DB_USER || 'postgres',
  //   password: process.env.DB_PASSWORD || 'password',
  // });

  // Example: LibSQL connection
  // return createClient({
  //   url: process.env.LIBSQL_URL || 'file:local.db',
  //   authToken: process.env.LIBSQL_AUTH_TOKEN,
  // });

  throw new Error('Please configure your database connection');
};

/**
 * Example: Initialize and configure the Mission Command Centre server
 */
export async function createServer() {
  const app = new Hono();

  // 1. Get database connection
  const db = getDatabase();

  // 2. Run migrations
  await runUserMigration(db);
  await runWorkflowDefinitionsMigration(db);

  // 3. Create storage instances
  const userStorage = createLibSQLUserStorage(db);
  const workflowStorage = new PgWorkflowStorage(db);

  // 4. Create JWT middleware
  const jwtMiddleware = createJwtMiddleware({
    secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
  });

  // 5. Create audit service
  const auditMiddleware = createAuditMiddleware({
    storage: userStorage,
  });

  // Apply middleware
  app.use('/api/*', jwtMiddleware);
  app.use('/api/*', auditMiddleware);
  app.use('*', cors());

  // 6. Mount OAuth handler
  const oauthHandler = createOAuthHandler({
    storage: userStorage,
    jwtSecret: process.env.JWT_SECRET || 'your-secret-key',
    providers: {
      github: {
        clientId: process.env.GITHUB_CLIENT_ID || '',
        clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
      },
    },
  });
  app.route('/', oauthHandler);

  // 7. Mount audit API
  const auditAPI = createAuditAPI({ storage: userStorage });
  app.route('/', auditAPI);

  // 8. Mount missions API (workflow runs)
  const missionsAPI = createMissionsAPI({
    workflowsStorage: {
      // Your workflows storage implementation
      listWorkflowRuns: async () => [],
      getWorkflowRunById: async () => null,
    },
  });
  app.route('/', missionsAPI);

  // 9. Mount approvals API
  const approvalsAPI = createApprovalsAPI({
    storage: {
      // Your approvals storage implementation
      getByRunId: async () => null,
      save: async () => {},
    },
  });
  app.route('/', approvalsAPI);

  // 10. Mount workflows API (workflow definitions)
  const workflowsAPI = createWorkflowsAPI({
    storage: workflowStorage,
  });
  app.route('/', workflowsAPI);

  // 11. Health check endpoint
  app.get('/health', (c) => {
    return c.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  return app;
}

/**
 * Example: Start the server
 */
export async function startServer() {
  const app = await createServer();

  const port = parseInt(process.env.PORT || '3001');
  const server = Bun.serve({
    fetch: app.fetch,
    port,
  });

  console.log(`Mission Command Centre server running on http://localhost:${port}`);
  console.log(`Health check: http://localhost:${port}/health`);
  console.log(`API endpoints:`);
  console.log(`  - POST   /api/workflows/definitions`);
  console.log(`  - GET    /api/workflows/definitions`);
  console.log(`  - GET    /api/workflows/definitions/:id`);
  console.log(`  - PUT    /api/workflows/definitions/:id`);
  console.log(`  - DELETE /api/workflows/definitions/:id`);

  return server;
}

// Only start the server if this file is run directly
if (import.meta.main) {
  startServer().catch(console.error);
}
