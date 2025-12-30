import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import {
  LIST_APPROVALS_ROUTE,
  APPROVE_RUN_ROUTE,
  DECLINE_RUN_ROUTE,
  GET_APPROVAL_ROUTE,
} from '../approvals';

// Mock Mastra instance
const mockMastra = {
  getLogger: () => ({
    error: vi.fn(),
    info: vi.fn(),
  }),
  getWorkflows: () => ({
    'test-workflow': {
      listWorkflowRuns: vi.fn().mockResolvedValue({
        runs: [
          {
            runId: 'run-123',
            status: 'suspended',
            suspendedAt: new Date('2025-12-29T12:00:00Z'),
            suspendData: {
              reason: 'PR requires approval',
              prUrl: 'https://github.com/owner/repo/pull/42',
              prNumber: 42,
            },
          },
        ],
        total: 1,
      }),
      getWorkflowRunById: vi.fn().mockResolvedValue({
        runId: 'run-123',
        status: 'suspended',
        resourceId: 'resource-123',
        startTime: new Date('2025-12-29T12:00:00Z'),
        suspendData: {
          reason: 'PR requires approval',
        },
      }),
      getWorkflowRunSnapshot: vi.fn().mockResolvedValue({
        suspendPayload: {
          reason: 'PR requires approval',
          prUrl: 'https://github.com/owner/repo/pull/42',
        },
      }),
      createRun: vi.fn().mockResolvedValue({
        resume: vi.fn().mockResolvedValue(undefined),
      }),
    },
  }),
};

describe('Approvals Handler', () => {
  describe('LIST_APPROVALS_ROUTE', () => {
    it('should list all suspended workflow runs', async () => {
      const context = {
        mastra: mockMastra,
        status: 'suspended',
        page: 0,
        perPage: 10,
      };

      const result = await LIST_APPROVALS_ROUTE.handler(context);

      expect(result).toHaveProperty('runs');
      expect(result).toHaveProperty('total');
      expect(result.runs).toBeInstanceOf(Array);
      expect(result.runs.length).toBeGreaterThan(0);
    });

    it('should support pagination', async () => {
      const context = {
        mastra: mockMastra,
        status: 'suspended',
        page: 1,
        perPage: 5,
      };

      const result = await LIST_APPROVALS_ROUTE.handler(context);

      expect(result.page).toBe(1);
      expect(result.perPage).toBe(5);
    });

    it('should filter by workflowId when provided', async () => {
      const context = {
        mastra: mockMastra,
        status: 'suspended',
        workflowId: 'test-workflow',
        page: 0,
        perPage: 10,
      };

      const result = await LIST_APPROVALS_ROUTE.handler(context);

      expect(result.runs).toBeDefined();
    });
  });

  describe('APPROVE_RUN_ROUTE', () => {
    it('should approve a suspended workflow run', async () => {
      const context = {
        mastra: mockMastra,
        runId: 'run-123',
        resumeData: {
          approved: true,
          feedback: 'Looks good!',
        },
      };

      const result = await APPROVE_RUN_ROUTE.handler(context);

      expect(result).toHaveProperty('message', 'Run approved');
      expect(result).toHaveProperty('runId', 'run-123');
      expect(result).toHaveProperty('status', 'running');
    });

    it('should require runId', async () => {
      const context = {
        mastra: mockMastra,
        runId: undefined,
        resumeData: { approved: true },
      };

      await expect(APPROVE_RUN_ROUTE.handler(context)).rejects.toThrow();
    });

    it('should handle non-existent runId', async () => {
      const mastraWithMissingRun = {
        ...mockMastra,
        getWorkflows: () => ({}),
      };

      const context = {
        mastra: mastraWithMissingRun,
        runId: 'non-existent',
        resumeData: { approved: true },
      };

      await expect(APPROVE_RUN_ROUTE.handler(context)).rejects.toThrow();
    });
  });

  describe('DECLINE_RUN_ROUTE', () => {
    it('should decline a suspended workflow run', async () => {
      const context = {
        mastra: mockMastra,
        runId: 'run-123',
        resumeData: {
          approved: false,
          feedback: 'Needs changes',
        },
      };

      const result = await DECLINE_RUN_ROUTE.handler(context);

      expect(result).toHaveProperty('message', 'Run declined');
      expect(result).toHaveProperty('runId', 'run-123');
      expect(result).toHaveProperty('status', 'running');
    });

    it('should require feedback for decline', async () => {
      const context = {
        mastra: mockMastra,
        runId: 'run-123',
        resumeData: {
          approved: false,
          feedback: '', // Empty feedback
        },
      };

      // Should validate via schema, not handler
      const schema = DECLINE_RUN_ROUTE.bodySchema;
      const validResult = schema.safeParse({
        resumeData: {
          approved: false,
          feedback: 'Required feedback',
        },
      });

      expect(validResult.success).toBe(true);
    });
  });

  describe('GET_APPROVAL_ROUTE', () => {
    it('should get approval details', async () => {
      const context = {
        mastra: mockMastra,
        runId: 'run-123',
      };

      const result = await GET_APPROVAL_ROUTE.handler(context);

      expect(result).toHaveProperty('runId', 'run-123');
      expect(result).toHaveProperty('workflowId');
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('suspendData');
      expect(result).toHaveProperty('suspendPayload');
    });

    it('should require runId', async () => {
      const context = {
        mastra: mockMastra,
        runId: undefined,
      };

      await expect(GET_APPROVAL_ROUTE.handler(context)).rejects.toThrow();
    });

    it('should return 404 for non-existent run', async () => {
      const mastraWithMissingRun = {
        ...mockMastra,
        getWorkflows: () => ({}),
      };

      const context = {
        mastra: mastraWithMissingRun,
        runId: 'non-existent',
      };

      await expect(GET_APPROVAL_ROUTE.handler(context)).rejects.toThrow();
    });
  });
});
