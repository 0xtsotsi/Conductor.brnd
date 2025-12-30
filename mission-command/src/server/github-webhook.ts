/**
 * GitHub Webhook Handler for Mission Command Centre
 *
 * Receives GitHub webhook events and resumes suspended workflows.
 * Handles pull_request events (opened, synchronized, closed, merged).
 * Verifies webhook signatures for security.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { createGitHubWebhookRateLimit } from './rate-limit';

/**
 * GitHub webhook event schemas
 */
export const GitHubWebhookPayloadSchema = z.object({
  action: z.enum(['opened', 'synchronized', 'closed', 'merged', 'reopened']),
  number: z.number().describe('Pull request number'),
  pull_request: z.object({
    number: z.number(),
    html_url: z.string(),
    state: z.string(),
    merged: z.boolean().optional(),
    merged_at: z.string().nullable().optional(),
    user: z.object({
      login: z.string(),
    }),
    title: z.string(),
    body: z.string().nullable().optional(),
    head: z.object({
      sha: z.string(),
      ref: z.string(),
    }),
    base: z.object({
      ref: z.string(),
    }),
  }),
  repository: z.object({
    name: z.string(),
    owner: z.object({
      login: z.string(),
    }),
    full_name: z.string(),
  }),
  sender: z.object({
    login: z.string(),
  }),
});

export type GitHubWebhookPayload = z.infer<typeof GitHubWebhookPayloadSchema>;

/**
 * Use persistent storage for suspended workflow runs
 * Storage instance is set via setSuspendedRunsStorage()
 */
let suspendedRunsStorage: import('./suspended-runs-storage').SuspendedRunsStorage | null = null;

/**
 * Register a suspended workflow run for later resume
 */
export async function registerSuspendedRun(params: {
  runId: string;
  prNumber: number;
  prUrl: string;
  owner: string;
  repo: string;
}) {
  if (!suspendedRunsStorage) {
    throw new Error('Suspended runs storage not initialized. Call setSuspendedRunsStorage() first.');
  }

  // Generate a unique ID for this run
  const id = crypto.randomUUID();

  await suspendedRunsStorage.registerSuspendedRun({
    id,
    runId: params.runId,
    prNumber: params.prNumber,
    prUrl: params.prUrl,
    owner: params.owner,
    repo: params.repo,
    ttlDays: 7,
  });
}

/**
 * Find a suspended run by PR number
 */
async function findSuspendedRun(
  owner: string,
  repo: string,
  prNumber: number
): Promise<import('./suspended-runs-storage').SuspendedRun | null> {
  if (!suspendedRunsStorage) {
    throw new Error('Suspended runs storage not initialized. Call setSuspendedRunsStorage() first.');
  }

  return await suspendedRunsStorage.findSuspendedRun(owner, repo, prNumber);
}

/**
 * Remove a suspended run after resume
 */
async function removeSuspendedRun(owner: string, repo: string, prNumber: number): Promise<void> {
  if (!suspendedRunsStorage) {
    throw new Error('Suspended runs storage not initialized. Call setSuspendedRunsStorage() first.');
  }

  await suspendedRunsStorage.removeSuspendedRun(owner, repo, prNumber);
}

/**
 * Workflow resume function (to be injected)
 * In production, this would call Mastra's workflow resume API
 */
export type WorkflowResumeFunction = (params: {
  runId: string;
  resumeData: {
    approved: boolean;
    feedback?: string;
    prNumber: number;
    prUrl: string;
  };
}) => Promise<void>;

let resumeWorkflow: WorkflowResumeFunction | null = null;

/**
 * Set the workflow resume function
 */
export function setWorkflowResumeFunction(fn: WorkflowResumeFunction) {
  resumeWorkflow = fn;
}

/**
 * Set the suspended runs storage instance
 */
export function setSuspendedRunsStorage(
  storage: import('./suspended-runs-storage').SuspendedRunsStorage
) {
  suspendedRunsStorage = storage;
}

/**
 * Verify GitHub webhook signature
 */
export function verifyGitHubSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  if (!signature) {
    return false;
  }

  // Signature format: sha256=<hex>
  const [algorithm, hash] = signature.split('=');
  if (algorithm !== 'sha256') {
    return false;
  }

  // Import crypto for HMAC verification
  const crypto = require('crypto');
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  const digest = hmac.digest('hex');

  // Constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(digest));
}

/**
 * Parse GitHub webhook signature header
 */
function parseSignature(signatureHeader: string): string | null {
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
    return null;
  }
  return signatureHeader;
}

/**
 * Create webhook handler router
 */
export function createGitHubWebhookRouter() {
  const router = new Hono();

  /**
   * POST /webhooks/github
   *
   * Receives GitHub webhook events and resumes workflows.
   * Requires signature verification.
   * Rate limited: 100 requests/hour per IP.
   */
  router.post('/webhooks/github', createGitHubWebhookRateLimit(), async (c) => {
    const logger = c.get('logger') || console;

    try {
      // Get signature from headers
      const signatureHeader = c.req.header('X-Hub-Signature-256');
      if (!signatureHeader) {
        logger.error('Missing X-Hub-Signature-256 header');
        return c.json({ error: 'Missing signature' }, 401);
      }

      // Get raw body for signature verification
      const body = await c.req.text();
      const rawBody = body;

      // Verify signature
      const secret = c.env?.GITHUB_WEBHOOK_SECRET || process.env.GITHUB_WEBHOOK_SECRET;
      if (!secret) {
        logger.error('GITHUB_WEBHOOK_SECRET not configured');
        return c.json({ error: 'Webhook not configured' }, 500);
      }

      const signature = parseSignature(signatureHeader);
      if (!signature || !verifyGitHubSignature(rawBody, signature, secret)) {
        logger.error('Invalid webhook signature');
        return c.json({ error: 'Invalid signature' }, 401);
      }

      // Parse payload
      let payload: GitHubWebhookPayload;
      try {
        const jsonPayload = JSON.parse(rawBody);
        payload = GitHubWebhookPayloadSchema.parse(jsonPayload);
      } catch (error) {
        logger.error('Failed to parse webhook payload:', error);
        return c.json({ error: 'Invalid payload' }, 400);
      }

      // Log webhook event
      logger.info('GitHub webhook received:', {
        action: payload.action,
        prNumber: payload.number,
        repository: payload.repository.full_name,
        sender: payload.sender.login,
      });

      // Extract PR details
      const repositoryOwner = payload.repository.owner.login;
      const repositoryName = payload.repository.name;
      const prNumber = payload.pull_request.number;
      const prUrl = payload.pull_request.html_url;

      // Find suspended workflow run
      const suspendedRun = await findSuspendedRun(repositoryOwner, repositoryName, prNumber);

      if (!suspendedRun) {
        logger.info(`No suspended run found for PR #${prNumber} in ${repositoryOwner}/${repositoryName}`);
        // Return 200 anyway (webhook was received, just no action taken)
        return c.json({ message: 'Webhook received, no action taken' }, 200);
      }

      // Determine action based on event
      let shouldResume = false;
      let approved = false;
      let feedback: string | undefined;

      switch (payload.action) {
        case 'opened':
        case 'synchronized':
        case 'reopened':
          // PR was updated, don't auto-resume (wait for explicit approval)
          logger.info(`PR #${prNumber} updated, awaiting explicit approval`);
          return c.json({ message: 'PR updated, awaiting approval' }, 200);

        case 'closed':
          // PR was closed without merging
          shouldResume = true;
          approved = false;
          feedback = 'PR was closed without merging';
          break;

        case 'merged':
          // PR was merged (implicit approval)
          shouldResume = true;
          approved = true;
          logger.info(`PR #${prNumber} was merged, resuming workflow with approval`);
          break;

        default:
          logger.warn(`Unhandled action: ${payload.action}`);
          return c.json({ message: 'Action not handled' }, 200);
      }

      // Resume workflow if needed
      if (shouldResume && resumeWorkflow) {
        logger.info(`Resuming workflow run ${suspendedRun.runId} for PR #${prNumber}`);

        await resumeWorkflow({
          runId: suspendedRun.runId,
          resumeData: {
            approved,
            feedback,
            prNumber,
            prUrl,
          },
        });

        // Remove from suspended runs after successful resume
        await removeSuspendedRun(repositoryOwner, repositoryName, prNumber);

        logger.info(`Workflow run ${suspendedRun.runId} resumed successfully`);
      }

      // Return success
      return c.json({
        message: 'Webhook processed',
        prNumber,
        action: payload.action,
        resumed: shouldResume,
      }, 200);

    } catch (error) {
      logger.error('Error processing webhook:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  /**
   * GET /webhooks/github/health
   *
   * Health check endpoint for webhook handler.
   */
  router.get('/webhooks/github/health', async (c) => {
    let suspendedRunsCount = 0;

    if (suspendedRunsStorage) {
      const runs = await suspendedRunsStorage.listSuspendedRuns();
      suspendedRunsCount = runs.length;
    }

    return c.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      suspendedRuns: suspendedRunsCount,
    });
  });

  /**
   * GET /webhooks/github/suspended
   *
   * List all suspended workflow runs (for debugging/monitoring).
   */
  router.get('/webhooks/github/suspended', async (c) => {
    if (!suspendedRunsStorage) {
      return c.json({
        error: 'Suspended runs storage not initialized',
      }, 500);
    }

    const runs = await suspendedRunsStorage.listSuspendedRuns();

    return c.json({
      count: runs.length,
      runs: runs.map(run => ({
        runId: run.runId,
        prNumber: run.prNumber,
        prUrl: run.prUrl,
        owner: run.owner,
        repo: run.repo,
        createdAt: run.createdAt.toISOString(),
        expiresAt: run.expiresAt.toISOString(),
      })),
    });
  });

  /**
   * POST /webhooks/github/cleanup
   *
   * Manually trigger cleanup of expired suspended runs.
   * Also runs automatically via background job.
   */
  router.post('/webhooks/github/cleanup', async (c) => {
    if (!suspendedRunsStorage) {
      return c.json({
        error: 'Suspended runs storage not initialized',
      }, 500);
    }

    try {
      const cleaned = await suspendedRunsStorage.cleanupExpiredRuns();
      const remaining = (await suspendedRunsStorage.listSuspendedRuns()).length;

      return c.json({
        message: 'Cleanup completed',
        cleaned,
        remaining,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const logger = c.get('logger') || console;
      logger.error('Manual cleanup failed:', error);

      return c.json({
        error: 'Cleanup failed',
        message: error instanceof Error ? error.message : String(error),
      }, 500);
    }
  });

  return router;
}

/**
 * Export default router
 */
export default createGitHubWebhookRouter;
