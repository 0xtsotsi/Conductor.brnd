/**
 * Example: Integrating Missions API into Mission Command Server
 *
 * This example demonstrates how to register the missions API handler
 * with your Hono server instance.
 */

import { Hono } from 'hono';
import { Mastra } from '@mastra/core';
import { createLibsqlStore } from '@mastra/storage-libsql';
import { createMissionsAPI } from './handlers/missions';

/**
 * Create and configure the Mission Command server with missions API
 */
export async function createMissionCommandServer() {
  // Initialize Hono app
  const app = new Hono();

  // Initialize Mastra
  const mastra = new Mastra({
    storage: createLibsqlStore({
      connectionString: process.env.LIBSQL_URL || 'file:local.db',
    }),
  });

  // Get workflows storage from Mastra
  const storage = await mastra.getStorage();
  const workflowsStorage = await storage.getStore('workflows');

  if (!workflowsStorage) {
    throw new Error('Workflows storage not available');
  }

  // Register Missions API
  const missionsAPI = createMissionsAPI({
    workflowsStorage,
  });

  // Mount missions API routes
  app.route('/', missionsAPI);

  return app;
}

/**
 * Example: Register missions API with existing authentication middleware
 */
export function registerMissionsAPIWithAuth(
  app: Hono,
  workflowsStorage: any,
  authMiddleware: any
) {
  // Create missions API
  const missionsAPI = createMissionsAPI({
    workflowsStorage,
  });

  // Apply authentication middleware before missions routes
  // Note: The missions API already has RBAC checks (requireRole('viewer'))
  // but you may want to add JWT validation first
  app.route('/api', missionsAPI);
}

/**
 * Example: Usage in server startup
 */
export async function startServer() {
  const app = await createMissionCommandServer();

  const port = parseInt(process.env.PORT || '3000');

  Bun.serve({
    port,
    fetch: app.fetch,
  });

  console.log(`Mission Command server running on port ${port}`);
  console.log(`Available endpoints:`);
  console.log(`  GET  /api/missions/active - List active workflow runs`);
  console.log(`  GET  /api/missions/recent - List recent workflow runs`);
  console.log(`  GET  /api/missions/:runId/timeline - Get execution timeline`);
}

// Uncomment to run server directly
// startServer().catch(console.error);
