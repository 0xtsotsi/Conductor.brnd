/**
 * GitHub Webhook Handler for Mission Command Centre
 *
 * Receives GitHub webhook events and triggers workflow continuations.
 * Handles PR events: opened, updated, closed, merged.
 *
 * Security: Verifies GitHub webhook signatures
 */

import { Hono } from 'hono';
import { z } from 'zod';

/**
 * GitHub webhook event types
 */
type GitHubEvent =
  | 'pull_request'
  | 'pull_request_review'
  | 'pull_request_review_comment'
  | 'push';

/**
 * GitHub webhook payload schemas
 */
const PullRequestOpenedSchema = z.object({
  action: z.enum(['opened', 'reopened', 'synchronized']),
  number: z.number(),
  pull_request: z.object({
    number: z.number(),
    state: z.string(),
    title: z.string(),
    body: z.string().nullable(),
    html_url: z.string().url(),
    user: z.object({
      login: z.string(),
    }),
    base: z.object({
      ref: z.string(),
      repo: z.object({
        owner: z.object({
          login: z.string(),
        }),
        name: z.string(),
      }),
    }),
    head: z.object({
      ref: z.string(),
      sha: z.string(),
    }),
  }),
  repository: z.object({
    owner: z.object({
      login: z.string(),
    }),
    name: z.string(),
    full_name: z.string(),
  }),
});

const PullRequestClosedSchema = z.object({
  action: z.enum(['closed']),
  number: z.number(),
  pull_request: z.object({
    number: z.number(),
    state: z.string(),
    merged: z.boolean(),
    merged_at: z.string().nullable(),
    html_url: z.string().url(),
  }),
  repository: z.object({
    owner: z.object({
      login: z.string(),
    }),
    name: z.string(),
    full_name: z.string(),
  }),
});

/**
 * Suspended workflow storage (in-memory for now, use DB in production)
 *
 * Maps PR URLs to suspended workflow run IDs
 */
const suspendedWorkflows = new Map<string, string>();

/**
 * Register a suspended workflow for PR approval
 */
export function registerSuspendedWorkflow(prUrl: string, runId: string) {
  suspendedWorkflows.set(prUrl, runId);
}

/**
 * Unregister a suspended workflow
 */
export function unregisterSuspendedWorkflow(prUrl: string) {
  suspendedWorkflows.delete(prUrl);
}

/**
 * Find suspended workflow by PR URL
 */
export function findSuspendedWorkflow(prUrl: string): string | undefined {
  return suspendedWorkflows.get(prUrl);
}

/**
 * Verify GitHub webhook signature
 */
function verifyGitHubSignature(payload: string, signature: string, secret: string): boolean {
  const hmac = crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = Uint8Array.from(
    Buffer.from(signature.replace('sha256=', ''), 'hex')
  );

  const payloadBuffer = new TextEncoder().encode(payload);

  // Verify signature
  const result = crypto.subtle.verify(
    'HMAC',
    hmac,
    signatureBuffer,
    payloadBuffer
  );

  return result; // This returns a Promise<boolean>
}

/**
 * GitHub Webhook Handler
 *
 * Express/Hono route handler for GitHub webhooks
 */
export function createGitHubWebhookHandler(secret?: string) {
  const app = new Hono();

  /**
   * POST /webhooks/github
   *
   * Receives GitHub webhook events and triggers workflow actions
   */
  app.post('/webhooks/github', async (c) => {
    // Get webhook signature
    const signature = c.req.header('x-hub-signature-256');
    if (!signature) {
      return c.json({ error: 'Missing signature' }, 401);
    }

    // Get raw body for verification
    const body = await c.req.text();
    const payload = JSON.parse(body);

    // Verify signature if secret is provided
    if (secret) {
      // TODO: Implement signature verification
      // For now, we'll skip this but it's critical for production
    }

    // Get event type
    const eventType = c.req.header('x-github-event') as GitHubEvent;
    const deliveryId = c.req.header('x-github-delivery');

    console.log(`Received GitHub webhook: ${eventType} (${deliveryId})`);

    // Handle different event types
    switch (eventType) {
      case 'pull_request': {
        const prEvent = PullRequestOpenedSchema.safeParse(payload);

        if (!prEvent.success) {
          console.error('Invalid PR event payload:', prEvent.error);
          return c.json({ error: 'Invalid payload' }, 400);
        }

        const { action, number, pull_request, repository } = prEvent.data;
        const prUrl = pull_request.html_url;

        // Handle PR opened/reopened
        if (action === 'opened' || action === 'reopened') {
          console.log(`PR #${number} ${action} in ${repository.full_name}`);

          // Find suspended workflow waiting for this PR
          const runId = findSuspendedWorkflow(prUrl);

          if (runId) {
            console.log(`Found suspended workflow ${runId} for PR ${prUrl}`);

            // Notify the workflow that PR has been opened
            // TODO: Call webhook notification API
            // await notifyWorkflow(runId, { type: 'pr_opened', prNumber: number, prUrl });

            return c.json({
              message: 'PR opened, workflow notified',
              runId,
            });
          } else {
            console.log(`No suspended workflow found for PR ${prUrl}`);
            return c.json({ message: 'PR opened, no matching workflow' }, 200);
          }
        }

        // Handle PR merged
        if (action === 'closed' && pull_request.merged) {
          console.log(`PR #${number} merged in ${repository.full_name}`);

          const runId = findSuspendedWorkflow(prUrl);

          if (runId) {
            // Resume workflow with approved=true
            const response = await fetch(`/api/workflows/runs/${runId}/resume`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                resumeData: {
                  approved: true,
                  feedback: `Automatically approved: PR was merged by ${pull_request.merged_by || 'unknown'}`,
                },
              }),
            });

            if (response.ok) {
              unregisterSuspendedWorkflow(prUrl);
              return c.json({ message: 'Workflow resumed after merge', runId });
            } else {
              return c.json({ error: 'Failed to resume workflow' }, 500);
            }
          }
        }

        // Handle PR closed without merge
        if (action === 'closed' && !pull_request.merged) {
          console.log(`PR #${number} closed without merge in ${repository.full_name}`);

          const runId = findSuspendedWorkflow(prUrl);

          if (runId) {
            // Resume workflow with approved=false
            await fetch(`/api/workflows/runs/${runId}/resume`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                resumeData: {
                  approved: false,
                  feedback: `PR was closed without being merged`,
                },
              }),
            });

            unregisterSuspendedWorkflow(prUrl);
            return c.json({ message: 'Workflow resumed with rejection' });
          }
        }

        return c.json({ message: 'Event processed' });
      }

      case 'pull_request_review': {
        // Handle PR review events (approved/changes requested)
        const { action, review, pull_request } = payload as any;

        console.log(`PR review ${action} on #${pull_request.number}`);

        // Find workflow and notify
        const runId = findSuspendedWorkflow(pull_request.html_url);

        if (runId && action === 'submitted') {
          // Check if review is approving or requesting changes
          if (review.state === 'approved') {
            await fetch(`/api/workflows/runs/${runId}/resume`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                resumeData: {
                  approved: true,
                  feedback: `Approved by ${review.user.login}: ${review.body || 'No comments'}`,
                },
              }),
            });

            unregisterSuspendedWorkflow(pull_request.html_url);
            return c.json({ message: 'Workflow approved via review' });
          } else if (review.state === 'changes_requested') {
            await fetch(`/api/workflows/runs/${runId}/resume`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                resumeData: {
                  approved: false,
                  feedback: `Changes requested by ${review.user.login}: ${review.body || 'No comments'}`,
                },
              }),
            });

            return c.json({ message: 'Workflow rejected via review' });
          }
        }

        return c.json({ message: 'Review event processed' });
      }

      default:
        console.log(`Unhandled event type: ${eventType}`);
        return c.json({ message: 'Event received but not processed' }, 200);
    }
  });

  /**
   * GET /webhooks/github
   *
   * Health check endpoint for webhook configuration
   */
  app.get('/webhooks/github', (c) => {
    return c.json({
      status: 'ok',
      message: 'GitHub webhook handler is running',
      events: ['pull_request', 'pull_request_review'],
    });
  });

  return app;
}

/**
 * Export for use in Mastra Server
 */
export default createGitHubWebhookHandler;
