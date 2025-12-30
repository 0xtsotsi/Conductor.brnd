/**
 * Example Server Initialization
 *
 * This example shows how to initialize the Mission Command Centre server
 * with all Phase 4 production hardening features:
 * - PostgreSQL-backed storage
 * - Rate limiting
 * - Automatic cleanup
 */

import { Hono } from 'hono';
import {
  createGitHubWebhookRouter,
  setSuspendedRunsStorage,
  setWorkflowResumeFunction,
  createSuspendedRunsStorage,
  createCleanupJob,
  startRateLimitCleanup,
} from './index';

/**
 * Initialize the server with all production features
 */
export async function createServer(config: {
  // Database configuration
  databaseUrl: string;

  // GitHub webhook secret (required)
  githubWebhookSecret: string;

  // Optional: Workflow resume function
  resumeWorkflow?: (params: {
    runId: string;
    resumeData: {
      approved: boolean;
      feedback?: string;
      prNumber: number;
      prUrl: string;
    };
  }) => Promise<void>;

  // Optional: Cleanup interval (default: 1 hour)
  cleanupIntervalMs?: number;

  // Optional: Rate limit cleanup interval (default: 1 minute)
  rateLimitCleanupIntervalMs?: number;
}) {
  const {
    databaseUrl,
    githubWebhookSecret,
    resumeWorkflow,
    cleanupIntervalMs = 60 * 60 * 1000, // 1 hour
    rateLimitCleanupIntervalMs = 60 * 1000, // 1 minute
  } = config;

  // Create the main app
  const app = new Hono();

  // Initialize suspended runs storage
  const storage = createSuspendedRunsStorage({
    connectionString: databaseUrl,
  });

  // Initialize the storage (creates tables if needed)
  await storage.init();

  // Set the storage for the webhook handler
  setSuspendedRunsStorage(storage);

  // Set the workflow resume function if provided
  if (resumeWorkflow) {
    setWorkflowResumeFunction(resumeWorkflow);
  }

  // Create the webhook router
  const webhookRouter = createGitHubWebhookRouter();

  // Mount the webhook router
  app.route('/', webhookRouter);

  // Start automatic cleanup job
  const cleanupJob = createCleanupJob({
    storage,
    intervalMs: cleanupIntervalMs,
    logger: console,
    onCleanup: (result) => {
      console.log(`[Cleanup] Removed ${result.cleaned} expired runs, ${result.remaining} remaining (${result.duration}ms)`);
    },
  });

  // Start rate limit cleanup
  const rateLimitCleanupId = startRateLimitCleanup(rateLimitCleanupIntervalMs);

  // Graceful shutdown handler
  const shutdown = async () => {
    console.log('Shutting down server...');

    // Stop cleanup job
    cleanupJob.stop();

    // Stop rate limit cleanup
    clearInterval(rateLimitCleanupId);

    console.log('Server shutdown complete');
  };

  // Handle shutdown signals
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  return {
    app,
    storage,
    cleanupJob,
    shutdown,
  };
}

/**
 * Example usage:
 *
 * ```typescript
 * import { createServer } from './server/example';
 *
 * async function main() {
 *   const server = await createServer({
 *     databaseUrl: process.env.DATABASE_URL,
 *     githubWebhookSecret: process.env.GITHUB_WEBHOOK_SECRET,
 *
 *     resumeWorkflow: async ({ runId, resumeData }) => {
 *       // Resume the workflow with the approval decision
 *       await mastra.getWorkflow('code-review').resume(runId, resumeData);
 *     },
 *   });
 *
 *   // Start the server
 *   const port = 4111;
 *   Bun.serve({
 *     port,
 *     fetch: server.app.fetch,
 *   });
 *
 *   console.log(`Server running on http://localhost:${port}`);
 * }
 *
 * main().catch(console.error);
 * ```
 */
