/**
 * GitHub Webhook Handler for Mission Command Centre
 *
 * Receives GitHub webhook events and resumes suspended workflows.
 * Handles pull_request events (opened, synchronized, closed, merged).
 * Verifies webhook signatures for security.
 */

import { Hono } from 'hono';
import { z } from 'zod';

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
 * Suspended workflow run storage
 * In production, this would be a database
 */
interface SuspendedRun {
  runId: string;
  prNumber: number;
  prUrl: string;
  owner: string;
  repo: string;
  suspendedAt: Date;
}

// In-memory storage for suspended runs (production: use database)
const suspendedRuns = new Map<string, SuspendedRun>();

/**
 * Register a suspended workflow run for later resume
 */
export function registerSuspendedRun(params: {
  runId: string;
  prNumber: number;
  prUrl: string;
  owner: string;
  repo: string;
}) {
  const key = `${params.owner}/${params.repo}/${params.prNumber}`;
  suspendedRuns.set(key, {
    runId: params.runId,
    prNumber: params.prNumber,
    prUrl: params.prUrl,
    owner: params.owner,
    repo: params.repo,
    suspendedAt: new Date(),
  });
}

/**
 * Find a suspended run by PR number
 */
function findSuspendedRun(owner: string, repo: string, prNumber: number): SuspendedRun | undefined {
  const key = `${owner}/${repo}/${prNumber}`;
  return suspendedRuns.get(key);
}

/**
 * Remove a suspended run after resume
 */
function removeSuspendedRun(owner: string, repo: string, prNumber: number): void {
  const key = `${owner}/${repo}/${prNumber}`;
  suspendedRuns.delete(key);
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
   */
  router.post('/webhooks/github', async (c) => {
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
      const { owner, repo } = payload.repository;
      const prNumber = payload.pull_request.number;
      const prUrl = payload.pull_request.html_url;

      // Find suspended workflow run
      const suspendedRun = findSuspendedRun(owner.login, repo.name, prNumber);

      if (!suspendedRun) {
        logger.info(`No suspended run found for PR #${prNumber} in ${owner.login}/${repo.name}`);
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
        removeSuspendedRun(owner.login, repo.name, prNumber);

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
  router.get('/webhooks/github/health', (c) => {
    return c.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      suspendedRuns: suspendedRuns.size,
    });
  });

  /**
   * GET /webhooks/github/suspended
   *
   * List all suspended workflow runs (for debugging/monitoring).
   */
  router.get('/webhooks/github/suspended', (c) => {
    const runs = Array.from(suspendedRuns.values()).map(run => ({
      runId: run.runId,
      prNumber: run.prNumber,
      prUrl: run.prUrl,
      owner: run.owner,
      repo: run.repo,
      suspendedAt: run.suspendedAt.toISOString(),
    }));

    return c.json({
      count: runs.length,
      runs,
    });
  });

  return router;
}

/**
 * Export default router
 */
export default createGitHubWebhookRouter;
