/**
 * Mission Command Centre - Missions API Handler
 *
 * Provides endpoints for monitoring and viewing workflow runs.
 *
 * Endpoints:
 * - GET /api/missions/active - List active workflow runs
 * - GET /api/missions/recent - List recent workflow runs with status filter
 * - GET /api/missions/:runId/timeline - Get execution timeline for a run
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { requireRole } from '@mastra/auth/rbac-middleware';
import { requireAuth } from '../jwt-middleware';
import type { WorkflowsStorage } from '@mastra/core/storage';
import type { MissionCommandUser } from '@mastra/auth';

/**
 * Mission run data structure
 */
export interface MissionRun {
  runId: string;
  workflowId: string;
  workflowName: string;
  status: 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  currentStep?: string;
  progress?: number;
  duration?: number;
  inputData?: any;
  outputData?: any;
}

/**
 * Timeline step data structure
 */
export interface TimelineStep {
  stepId: string;
  stepName: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'suspended';
  startedAt?: string;
  completedAt?: string;
  duration?: number;
  output?: any;
  suspendData?: any;
}

/**
 * Missions API options
 */
export interface MissionsAPIOptions {
  /** Workflows storage instance */
  workflowsStorage: WorkflowsStorage;
}

/**
 * Query parameter validation schema for listActive
 */
const listActiveQuerySchema = z.object({
  workflowId: z.string().optional(),
  limit: z.string().optional().transform(val => val ? parseInt(val, 10) : 50),
  offset: z.string().optional().transform(val => val ? parseInt(val, 10) : 0),
});

/**
 * Query parameter validation schema for listRecent
 */
const listRecentQuerySchema = z.object({
  status: z.enum(['completed', 'failed', 'running']).optional(),
  limit: z.string().optional().transform(val => val ? parseInt(val, 10) : 20),
  offset: z.string().optional().transform(val => val ? parseInt(val, 10) : 0),
});

/**
 * Create missions API handler
 */
export function createMissionsAPI(options: MissionsAPIOptions) {
  const app = new Hono();
  const { workflowsStorage } = options;

  // Apply JWT authentication middleware to all routes
  app.use('/api/missions/*', requireAuth());

  /**
   * Helper: Extract user from context
   */
  function getCurrentUser(c: any): MissionCommandUser {
    return c.get('user') as MissionCommandUser;
  }

  /**
   * Helper: Convert storage workflow run to mission run format
   */
  function formatMissionRun(run: any): MissionRun {
    const snapshot = run.snapshot || {};

    // Calculate duration
    let duration: number | undefined;
    if (run.startedAt) {
      const endTime = run.completedAt ? new Date(run.completedAt).getTime() : Date.now();
      duration = endTime - new Date(run.startedAt).getTime();
    }

    // Calculate progress based on completed steps vs total steps
    let progress: number | undefined;
    if (snapshot.context) {
      const steps = Object.keys(snapshot.context);
      const completedSteps = steps.filter(stepId => {
        const result = snapshot.context[stepId];
        return result && (result.status === 'success' || result.status === 'failed');
      });
      progress = steps.length > 0 ? completedSteps.length / steps.length : 0;
    }

    // Determine current step
    let currentStep: string | undefined;
    if (snapshot.activePaths && snapshot.activePaths.length > 0) {
      // Get the last active path
      const lastPath = snapshot.activePaths[snapshot.activePaths.length - 1];
      currentStep = Array.isArray(lastPath) ? lastPath.join('.') : String(lastPath);
    }

    return {
      runId: run.runId,
      workflowId: run.workflowName,
      workflowName: run.workflowName, // Could be enhanced with a display name
      status: snapshot.status || 'running',
      startedAt: run.createdAt ? new Date(run.createdAt).toISOString() : new Date().toISOString(),
      completedAt: run.updatedAt && snapshot.status !== 'running'
        ? new Date(run.updatedAt).toISOString()
        : undefined,
      currentStep,
      progress,
      duration,
      inputData: snapshot.inputData,
      outputData: snapshot.value,
    };
  }

  /**
   * Helper: Build timeline from workflow run snapshot
   */
  function buildTimeline(run: any): TimelineStep[] {
    const snapshot = run.snapshot || {};
    const context = snapshot.context || {};
    const timeline: TimelineStep[] = [];

    // Process each step in the context
    for (const [stepId, stepResult] of Object.entries(context)) {
      const result = stepResult as any;

      if (!result) continue;

      const step: TimelineStep = {
        stepId,
        stepName: stepId, // Could be enhanced with display names
        status: result.status || 'pending',
      };

      // Add timestamps
      if (result.startedAt) {
        step.startedAt = new Date(result.startedAt).toISOString();
      }

      if (result.endedAt) {
        step.completedAt = new Date(result.endedAt).toISOString();
      }

      // Calculate duration
      if (result.startedAt && result.endedAt) {
        step.duration = result.endedAt - result.startedAt;
      }

      // Add output for successful steps
      if (result.status === 'success' && result.output !== undefined) {
        step.output = result.output;
      }

      // Add suspend data for suspended steps
      if (result.status === 'suspended') {
        step.suspendData = {
          suspendPayload: result.suspendPayload,
          suspendOutput: result.suspendOutput,
          suspendedAt: result.suspendedAt ? new Date(result.suspendedAt).toISOString() : undefined,
        };
      }

      // Add error for failed steps
      if (result.status === 'failed' && result.error) {
        step.output = {
          error: {
            message: result.error.message || 'Unknown error',
            name: result.error.name || 'Error',
          },
        };
      }

      timeline.push(step);
    }

    // Sort by start time (most recent first)
    timeline.sort((a, b) => {
      const timeA = a.startedAt ? new Date(a.startedAt).getTime() : 0;
      const timeB = b.startedAt ? new Date(b.startedAt).getTime() : 0;
      return timeB - timeA;
    });

    return timeline;
  }

  /**
   * Route: List active workflow runs
   * GET /api/missions/active
   * Requires: viewer role
   *
   * Query params:
   * - workflowId: Filter by workflow ID
   * - limit: Maximum number of runs to return (default: 50)
   * - offset: Offset for pagination (default: 0)
   */
  app.get('/api/missions/active', requireRole('viewer'), async (c) => {
    try {
      const user = getCurrentUser(c);

      // Parse query parameters
      const query = listActiveQuerySchema.safeParse(c.req.query());

      if (!query.success) {
        return c.json({
          error: 'Invalid query parameters',
          details: query.error.flatten(),
        }, 400);
      }

      const { workflowId, limit, offset } = query.data;

      // Query workflow storage for active runs
      const result = await workflowsStorage.listWorkflowRuns({
        workflowName: workflowId,
        status: 'running',
        perPage: limit,
        page: Math.floor(offset / limit),
      });

      // Format runs
      const runs = result.runs.map(formatMissionRun);

      return c.json({
        runs,
        total: result.total,
        limit,
        offset,
      });
    } catch (error) {
      console.error('Failed to list active missions:', error);
      return c.json({
        error: 'Failed to list active missions',
        message: error instanceof Error ? error.message : String(error),
      }, 500);
    }
  });

  /**
   * Route: List recent workflow runs
   * GET /api/missions/recent
   * Requires: viewer role
   *
   * Query params:
   * - status: Filter by status ('completed' | 'failed' | 'running')
   * - limit: Maximum number of runs to return (default: 20)
   * - offset: Offset for pagination (default: 0)
   */
  app.get('/api/missions/recent', requireRole('viewer'), async (c) => {
    try {
      const user = getCurrentUser(c);

      // Parse query parameters
      const query = listRecentQuerySchema.safeParse(c.req.query());

      if (!query.success) {
        return c.json({
          error: 'Invalid query parameters',
          details: query.error.flatten(),
        }, 400);
      }

      const { status, limit, offset } = query.data;

      // Query workflow storage for recent runs
      const result = await workflowsStorage.listWorkflowRuns({
        status,
        perPage: limit,
        page: Math.floor(offset / limit),
      });

      // Format runs
      const runs = result.runs.map(formatMissionRun);

      return c.json({
        runs,
        total: result.total,
        limit,
        offset,
      });
    } catch (error) {
      console.error('Failed to list recent missions:', error);
      return c.json({
        error: 'Failed to list recent missions',
        message: error instanceof Error ? error.message : String(error),
      }, 500);
    }
  });

  /**
   * Route: Get execution timeline for a run
   * GET /api/missions/:runId/timeline
   * Requires: viewer role
   *
   * Returns detailed timeline of step executions for a specific workflow run.
   */
  app.get('/api/missions/:runId/timeline', requireRole('viewer'), async (c) => {
    try {
      const runId = c.req.param('runId');

      if (!runId) {
        return c.json({
          error: 'Bad Request',
          message: 'runId is required',
        }, 400);
      }

      // Get workflow run from storage
      const run = await workflowsStorage.getWorkflowRunById({ runId });

      if (!run) {
        return c.json({
          error: 'Not Found',
          message: `Workflow run '${runId}' not found`,
        }, 404);
      }

      // Build timeline from run snapshot
      const timeline = buildTimeline(run);

      return c.json({
        runId,
        workflowId: run.workflowName,
        timeline,
      });
    } catch (error) {
      console.error('Failed to get mission timeline:', error);
      return c.json({
        error: 'Failed to get mission timeline',
        message: error instanceof Error ? error.message : String(error),
      }, 500);
    }
  });

  return app;
}
