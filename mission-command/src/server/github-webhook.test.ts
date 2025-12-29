/**
 * Tests for GitHub Webhook Handler
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createGitHubWebhookRouter, registerSuspendedRun, setWorkflowResumeFunction, verifyGitHubSignature } from './github-webhook';

describe('GitHub Webhook Handler', () => {
  let mockResumeFunction: any;
  let router: any;

  beforeEach(() => {
    // Reset state
    mockResumeFunction = vi.fn().mockResolvedValue(undefined);
    setWorkflowResumeFunction(mockResumeFunction);
    router = createGitHubWebhookRouter();
  });

  describe('verifyGitHubSignature', () => {
    it('should verify valid signature', () => {
      const payload = JSON.stringify({ test: 'data' });
      const secret = 'webhook-secret';
      const crypto = require('crypto');
      const hmac = crypto.createHmac('sha256', secret);
      hmac.update(payload);
      const signature = `sha256=${hmac.digest('hex')}`;

      const result = verifyGitHubSignature(payload, signature, secret);
      expect(result).toBe(true);
    });

    it('should reject invalid signature', () => {
      const payload = JSON.stringify({ test: 'data' });
      const secret = 'webhook-secret';
      const signature = 'sha256=invalid';

      const result = verifyGitHubSignature(payload, signature, secret);
      expect(result).toBe(false);
    });

    it('should reject missing signature', () => {
      const payload = JSON.stringify({ test: 'data' });
      const secret = 'webhook-secret';

      const result = verifyGitHubSignature(payload, '', secret);
      expect(result).toBe(false);
    });
  });

  describe('registerSuspendedRun', () => {
    it('should register a suspended run', () => {
      registerSuspendedRun({
        runId: 'run-123',
        prNumber: 42,
        prUrl: 'https://github.com/owner/repo/pull/42',
        owner: 'owner',
        repo: 'repo',
      });

      // The run should now be findable
      // This is tested implicitly through webhook processing
    });
  });

  describe('POST /webhooks/github', () => {
    const validPayload = {
      action: 'merged',
      number: 42,
      pull_request: {
        number: 42,
        html_url: 'https://github.com/owner/repo/pull/42',
        state: 'closed',
        merged: true,
        merged_at: '2025-12-29T12:00:00Z',
        user: { login: 'user1' },
        title: 'Test PR',
        body: 'Test body',
        head: { sha: 'abc123', ref: 'feature-branch' },
        base: { ref: 'main' },
      },
      repository: {
        name: 'repo',
        owner: { login: 'owner' },
        full_name: 'owner/repo',
      },
      sender: { login: 'user1' },
    };

    it('should reject missing signature', async () => {
      const request = {
        method: 'POST',
        url: '/webhooks/github',
        headers: {},
        body: JSON.stringify(validPayload),
        text: async () => JSON.stringify(validPayload),
      };

      // Mock Hono context
      const mockContext = {
        req: {
          header: vi.fn((name: string) => {
            const headers: Record<string, string> = {};
            return headers[name];
          }),
          text: async () => JSON.stringify(validPayload),
        },
        env: {
          GITHUB_WEBHOOK_SECRET: 'secret',
        },
        json: vi.fn().mockImplementation((data: any, status: number) => ({
          status,
          data,
        })),
        get: vi.fn((key: string) => console),
      };

      await router.post('/webhooks/github')(mockContext);

      expect(mockContext.json).toHaveBeenCalledWith(
        { error: 'Missing signature' },
        401
      );
    });

    it('should process PR merged event', async () => {
      // Register suspended run
      registerSuspendedRun({
        runId: 'run-123',
        prNumber: 42,
        prUrl: 'https://github.com/owner/repo/pull/42',
        owner: 'owner',
        repo: 'repo',
      });

      const crypto = require('crypto');
      const payload = JSON.stringify(validPayload);
      const secret = 'webhook-secret';
      const hmac = crypto.createHmac('sha256', secret);
      hmac.update(payload);
      const signature = `sha256=${hmac.digest('hex')}`;

      // Mock Hono context
      const mockContext = {
        req: {
          header: vi.fn((name: string) => {
            const headers: Record<string, string> = {
              'X-Hub-Signature-256': signature,
            };
            return headers[name];
          }),
          text: async () => payload,
        },
        env: {
          GITHUB_WEBHOOK_SECRET: secret,
        },
        json: vi.fn().mockImplementation((data: any, status?: number) => ({
          status,
          data,
        })),
        get: vi.fn((key: string) => console),
      };

      await router.post('/webhooks/github')(mockContext);

      expect(mockResumeFunction).toHaveBeenCalledWith({
        runId: 'run-123',
        resumeData: {
          approved: true,
          prNumber: 42,
          prUrl: 'https://github.com/owner/repo/pull/42',
        },
      });

      expect(mockContext.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Webhook processed',
          action: 'merged',
          resumed: true,
        }),
        200
      );
    });

    it('should process PR closed event', async () => {
      // Register suspended run
      registerSuspendedRun({
        runId: 'run-123',
        prNumber: 42,
        prUrl: 'https://github.com/owner/repo/pull/42',
        owner: 'owner',
        repo: 'repo',
      });

      const closedPayload = {
        ...validPayload,
        action: 'closed',
        pull_request: {
          ...validPayload.pull_request,
          merged: false,
        },
      };

      const crypto = require('crypto');
      const payload = JSON.stringify(closedPayload);
      const secret = 'webhook-secret';
      const hmac = crypto.createHmac('sha256', secret);
      hmac.update(payload);
      const signature = `sha256=${hmac.digest('hex')}`;

      // Mock Hono context
      const mockContext = {
        req: {
          header: vi.fn((name: string) => {
            const headers: Record<string, string> = {
              'X-Hub-Signature-256': signature,
            };
            return headers[name];
          }),
          text: async () => payload,
        },
        env: {
          GITHUB_WEBHOOK_SECRET: secret,
        },
        json: vi.fn().mockImplementation((data: any, status?: number) => ({
          status,
          data,
        })),
        get: vi.fn((key: string) => console),
      };

      await router.post('/webhooks/github')(mockContext);

      expect(mockResumeFunction).toHaveBeenCalledWith({
        runId: 'run-123',
        resumeData: {
          approved: false,
          feedback: 'PR was closed without merging',
          prNumber: 42,
          prUrl: 'https://github.com/owner/repo/pull/42',
        },
      });

      expect(mockContext.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Webhook processed',
          action: 'closed',
          resumed: true,
        }),
        200
      );
    });

    it('should return success for non-suspended PR', async () => {
      const crypto = require('crypto');
      const payload = JSON.stringify(validPayload);
      const secret = 'webhook-secret';
      const hmac = crypto.createHmac('sha256', secret);
      hmac.update(payload);
      const signature = `sha256=${hmac.digest('hex')}`;

      // Mock Hono context
      const mockContext = {
        req: {
          header: vi.fn((name: string) => {
            const headers: Record<string, string> = {
              'X-Hub-Signature-256': signature,
            };
            return headers[name];
          }),
          text: async () => payload,
        },
        env: {
          GITHUB_WEBHOOK_SECRET: secret,
        },
        json: vi.fn().mockImplementation((data: any, status?: number) => ({
          status,
          data,
        })),
        get: vi.fn((key: string) => console),
      };

      await router.post('/webhooks/github')(mockContext);

      expect(mockResumeFunction).not.toHaveBeenCalled();

      expect(mockContext.json).toHaveBeenCalledWith(
        {
          message: 'Webhook received, no action taken',
        },
        200
      );
    });
  });

  describe('GET /webhooks/github/health', () => {
    it('should return health status', async () => {
      // Mock Hono context
      const mockContext = {
        json: vi.fn().mockImplementation((data: any) => data),
      };

      await router.get('/webhooks/github/health')(mockContext);

      expect(mockContext.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'ok',
          timestamp: expect.any(String),
          suspendedRuns: 0,
        })
      );
    });
  });

  describe('GET /webhooks/github/suspended', () => {
    it('should list suspended runs', async () => {
      // Register some suspended runs
      registerSuspendedRun({
        runId: 'run-1',
        prNumber: 42,
        prUrl: 'https://github.com/owner/repo/pull/42',
        owner: 'owner',
        repo: 'repo',
      });

      registerSuspendedRun({
        runId: 'run-2',
        prNumber: 43,
        prUrl: 'https://github.com/owner/repo/pull/43',
        owner: 'owner',
        repo: 'repo',
      });

      // Mock Hono context
      const mockContext = {
        json: vi.fn().mockImplementation((data: any) => data),
      };

      await router.get('/webhooks/github/suspended')(mockContext);

      expect(mockContext.json).toHaveBeenCalledWith({
        count: 2,
        runs: expect.arrayContaining([
          expect.objectContaining({
            runId: 'run-1',
            prNumber: 42,
          }),
          expect.objectContaining({
            runId: 'run-2',
            prNumber: 43,
          }),
        ]),
      });
    });
  });
});
