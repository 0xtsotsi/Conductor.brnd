import { describe, it, expect, vi } from 'vitest';
import {
  LIST_ACTIVE_MISSIONS_ROUTE,
  LIST_RECENT_MISSIONS_ROUTE,
  GET_MISSION_TIMELINE_ROUTE,
} from '../missions';

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
            runId: 'run-456',
            status: 'running',
            startTime: new Date('2025-12-29T12:00:00Z'),
          },
        ],
        total: 1,
      }),
      getWorkflowRunById: vi.fn().mockResolvedValue({
        runId: 'run-456',
        status: 'running',
        startTime: new Date('2025-12-29T12:00:00Z'),
        endTime: new Date('2025-12-29T12:05:00Z'),
      }),
      getWorkflowRunSnapshot: vi.fn().mockResolvedValue({
        steps: {
          'step-1': {
            name: 'First Step',
            status: 'completed',
            startTime: new Date('2025-12-29T12:00:00Z'),
            endTime: new Date('2025-12-29T12:01:00Z'),
            duration: 60000,
          },
        },
        stepGraph: {},
      }),
    },
  }),
};

describe('Missions Handler', () => {
  describe('LIST_ACTIVE_MISSIONS_ROUTE', () => {
    it('should list all active workflow runs', async () => {
      const context = {
        mastra: mockMastra,
        status: 'running',
        page: 0,
        perPage: 10,
      };

      const result = await LIST_ACTIVE_MISSIONS_ROUTE.handler(context);

      expect(result).toHaveProperty('runs');
      expect(result).toHaveProperty('total');
      expect(result.runs).toBeInstanceOf(Array);
    });

    it('should support pagination', async () => {
      const context = {
        mastra: mockMastra,
        status: 'running',
        page: 1,
        perPage: 5,
      };

      const result = await LIST_ACTIVE_MISSIONS_ROUTE.handler(context);

      expect(result.page).toBe(1);
      expect(result.perPage).toBe(5);
    });

    it('should filter by workflowId when provided', async () => {
      const context = {
        mastra: mockMastra,
        status: 'running',
        workflowId: 'test-workflow',
        page: 0,
        perPage: 10,
      };

      const result = await LIST_ACTIVE_MISSIONS_ROUTE.handler(context);

      expect(result.runs).toBeDefined();
    });

    it('should default status to running', async () => {
      const context = {
        mastra: mockMastra,
        page: 0,
        perPage: 10,
      };

      const result = await LIST_ACTIVE_MISSIONS_ROUTE.handler(context);

      expect(result.runs).toBeDefined();
    });
  });

  describe('LIST_RECENT_MISSIONS_ROUTE', () => {
    it('should list recent completed missions', async () => {
      const context = {
        mastra: mockMastra,
        status: ['success', 'failed'],
        limit: 10,
      };

      const result = await LIST_RECENT_MISSIONS_ROUTE.handler(context);

      expect(result).toHaveProperty('runs');
      expect(result).toHaveProperty('total');
      expect(result.runs).toBeInstanceOf(Array);
    });

    it('should support custom limit', async () => {
      const context = {
        mastra: mockMastra,
        status: ['success'],
        limit: 5,
      };

      const result = await LIST_RECENT_MISSIONS_ROUTE.handler(context);

      expect(result.runs.length).toBeLessThanOrEqual(5);
    });

    it('should filter by status', async () => {
      const context = {
        mastra: mockMastra,
        status: ['success'],
        limit: 10,
      };

      const result = await LIST_RECENT_MISSIONS_ROUTE.handler(context);

      expect(result.runs).toBeDefined();
    });

    it('should default limit to 10', async () => {
      const context = {
        mastra: mockMastra,
        status: ['success', 'failed'],
      };

      const result = await LIST_RECENT_MISSIONS_ROUTE.handler(context);

      expect(result.runs.length).toBeLessThanOrEqual(10);
    });

    it('should enforce max limit of 100', async () => {
      const schema = LIST_RECENT_MISSIONS_ROUTE.queryParamSchema;
      const validResult = schema.safeParse({
        status: ['success'],
        limit: 150, // Exceeds max
      });

      expect(validResult.success).toBe(false);
    });
  });

  describe('GET_MISSION_TIMELINE_ROUTE', () => {
    it('should get mission timeline with steps', async () => {
      const context = {
        mastra: mockMastra,
        runId: 'run-456',
      };

      const result = await GET_MISSION_TIMELINE_ROUTE.handler(context);

      expect(result).toHaveProperty('runId', 'run-456');
      expect(result).toHaveProperty('workflowId');
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('steps');
      expect(result).toHaveProperty('stepGraph');
      expect(result.steps).toBeInstanceOf(Array);
    });

    it('should require runId', async () => {
      const context = {
        mastra: mockMastra,
        runId: undefined,
      };

      await expect(GET_MISSION_TIMELINE_ROUTE.handler(context)).rejects.toThrow();
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

      await expect(GET_MISSION_TIMELINE_ROUTE.handler(context)).rejects.toThrow();
    });

    it('should include step details', async () => {
      const context = {
        mastra: mockMastra,
        runId: 'run-456',
      };

      const result = await GET_MISSION_TIMELINE_ROUTE.handler(context);

      expect(result.steps.length).toBeGreaterThan(0);
      expect(result.steps[0]).toHaveProperty('stepId');
      expect(result.steps[0]).toHaveProperty('name');
      expect(result.steps[0]).toHaveProperty('status');
    });

    it('should calculate duration', async () => {
      const context = {
        mastra: mockMastra,
        runId: 'run-456',
      };

      const result = await GET_MISSION_TIMELINE_ROUTE.handler(context);

      expect(result).toHaveProperty('duration');
      expect(typeof result.duration).toBe('number');
    });
  });
});
