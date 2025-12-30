/**
 * Mastra Workflow Execution System for Mission Command Centre
 *
 * Provides a Mastra instance with workflow registration and execution API endpoints:
 * - POST /api/workflows/{id}/start-async - Start a workflow execution
 * - GET /api/workflows/{id}/runs/{runId} - Get workflow run status
 * - POST /api/workflows/{id}/runs/{runId}/resume - Resume a suspended workflow
 * - GET /api/workflows/{id}/runs/{runId}/execution-result - Get workflow execution result
 *
 * Integrates with:
 * - JWT authentication middleware (requireAuth)
 * - PgUserStorage for user data
 * - SuspendedRunsStorage for workflow suspension
 * - Audit service for logging workflow events
 * - Existing code-review workflow
 *
 * @packageDocumentation
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { Mastra } from '@mastra/core';
import { requireRole } from '@mastra/auth';
import { requireAuth, type MissionCommandUser } from './jwt-middleware';
import type { WorkflowsStorage } from '@mastra/core/storage';
import { AuditService } from '../auth/audit-service';
import { SuspendedRunsStorage } from './suspended-runs-storage';
import { codeReviewWorkflow } from '../workflows/code-review-workflow';

/**
 * Mastra server configuration options
 */
export interface MastraServerOptions {
  /** Workflows storage instance */
  workflowsStorage: WorkflowsStorage;
  /** Suspended runs storage instance */
  suspendedRunsStorage: SuspendedRunsStorage;
  /** Audit service instance */
  auditService: AuditService;
  /** Optional custom logger */
  logger?: typeof console;
}

/**
 * Start workflow request body schema
 */
const startWorkflowSchema = z.object({
  input: z.any(), // Workflow-specific input data
  options: z
    .object({
      runId: z.string().optional(),
      priority: z.enum(['low', 'normal', 'high']).optional(),
    })
    .optional(),
});

/**
 * Resume workflow request body schema
 */
const resumeWorkflowSchema = z.object({
  resumeData: z.any(), // Resume data specific to workflow's suspend step
});

/**
 * Create a Mastra instance with the code-review workflow registered
 *
 * @example
 * ```typescript
 * const { mastra, workflowAPIRouter } = createMastraSystem({
 *   workflowsStorage,
 *   suspendedRunsStorage,
 *   auditService
 * });
 * ```
 */
export function createMastraSystem(options: MastraServerOptions) {
  const { workflowsStorage, suspendedRunsStorage, auditService, logger = console } = options;

  // Create Mastra instance with code-review workflow
  const mastra = new Mastra({
    workflows: {
      codeReviewWorkflow,
    },
    storage: workflowsStorage as any,
  });

  logger.info('Mastra instance created with code-review workflow');

  // Create workflow API router
  const workflowAPIRouter = createWorkflowAPIRouter({
    mastra,
    workflowsStorage,
    suspendedRunsStorage,
    auditService,
    logger,
  });

  return { mastra, workflowAPIRouter };
}

/**
 * Create workflow API router with execution endpoints
 */
function createWorkflowAPIRouter(options: MastraServerOptions & { mastra: Mastra }) {
  const { mastra, workflowsStorage, auditService, logger = console } = options;
  const app = new Hono();

  // Apply JWT authentication to all routes
  app.use('/api/workflows/*', requireAuth());

  /**
   * Helper: Extract user from context
   */
  function getCurrentUser(c: any): MissionCommandUser {
    return c.get('user') as MissionCommandUser;
  }

  /**
   * Helper: Extract IP address from request
   */
  function extractIpAddress(c: any): string | undefined {
    return (
      c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
      c.req.header('x-real-ip') ||
      c.req.header('cf-connecting-ip')
    );
  }

  /**
   * Helper: Extract user agent from request
   */
  function extractUserAgent(c: any): string | undefined {
    return c.req.header('user-agent');
  }

  /**
   * Route: Start a workflow execution asynchronously
   * POST /api/workflows/{id}/start-async
   * Requires: admin role
   *
   * Body:
   * - input: Workflow input data (workflow-specific)
   * - options.runId: Optional custom run ID
   * - options.priority: Optional priority level
   *
   * Returns:
   * - runId: Unique identifier for the workflow run
   * - status: Initial status ('running' or 'suspended')
   */
  app.post('/api/workflows/:id/start-async', requireRole('admin'), async (c: any) => {
    const user = getCurrentUser(c);
    const workflowId = c.req.param('id');

    if (!workflowId) {
      return c.json(
        {
          error: 'Bad Request',
          message: 'workflow ID is required',
        },
        400
      );
    }

    try {
      // Parse request body
      const body = await c.req.json();
      const validationResult = startWorkflowSchema.safeParse(body);

      if (!validationResult.success) {
        return c.json(
          {
            error: 'Invalid request body',
            details: validationResult.error.flatten(),
          },
          400
        );
      }

      const { input, options } = validationResult.data;

      // Get the workflow
      const workflow = mastra.getWorkflow(workflowId);

      // Create a workflow run
      const run = await workflow.createRun({
        runId: options?.runId,
      });

      // Start the workflow asynchronously
      // Note: We don't await this - it runs in the background
      run.start(input).catch((error: unknown) => {
        logger.error(`Workflow ${workflowId} run ${run.runId} failed:`, error);

        // Log failure to audit service
        auditService
          .logWorkflowEvent({
            user,
            action: 'workflow.failed',
            workflowId,
            runId: run.runId,
            reason: error instanceof Error ? error.message : String(error),
            ipAddress: extractIpAddress(c),
            userAgent: extractUserAgent(c),
          })
          .catch(err => logger.error('Failed to log workflow failure:', err));
      });

      // Log workflow start to audit service
      await auditService.logWorkflowEvent({
        user,
        action: 'workflow.started',
        workflowId,
        runId: run.runId,
        ipAddress: extractIpAddress(c),
        userAgent: extractUserAgent(c),
      });

      // Return immediately with runId
      return c.json({
        runId: run.runId,
        status: 'running',
        workflowId,
        startedAt: new Date().toISOString(),
      });
    } catch (error: any) {
      logger.error(`Failed to start workflow ${workflowId}:`, error);

      // Check if it's a "workflow not found" error
      if (error?.id === 'MASTRA_GET_WORKFLOW_BY_ID_NOT_FOUND') {
        return c.json(
          {
            error: 'Not Found',
            message: `Workflow '${workflowId}' not found`,
            code: 'WORKFLOW_NOT_FOUND',
          },
          404
        );
      }

      return c.json(
        {
          error: 'Failed to start workflow',
          message: error instanceof Error ? error.message : String(error),
          code: 'WORKFLOW_START_FAILED',
        },
        500
      );
    }
  });

  /**
   * Route: Get workflow run status
   * GET /api/workflows/{id}/runs/{runId}
   * Requires: viewer role
   *
   * Returns:
   * - runId: Workflow run identifier
   * - workflowId: Workflow identifier
   * - status: Current status ('running', 'suspended', 'completed', 'failed')
   * - startTime: When the run started
   * - endTime: When the run ended (if completed)
   * - suspendedAt: When the run was suspended (if applicable)
   */
  app.get('/api/workflows/:id/runs/:runId', requireRole('viewer'), async (c: any) => {
    getCurrentUser(c); // Auth required
    const workflowId = c.req.param('id');
    const runId = c.req.param('runId');

    if (!workflowId || !runId) {
      return c.json(
        {
          error: 'Bad Request',
          message: 'workflow ID and run ID are required',
        },
        400
      );
    }

    try {
      // Get the workflow - validates workflow exists
      void mastra.getWorkflow(workflowId);

      // Get the run from storage
      const run = await workflowsStorage.getWorkflowRunById({ runId });

      if (!run) {
        return c.json(
          {
            error: 'Not Found',
            message: `Workflow run '${runId}' not found`,
            code: 'RUN_NOT_FOUND',
          },
          404
        );
      }

      const snapshot = run.snapshot || {};

      return c.json({
        runId: run.runId,
        workflowId: run.workflowName,
        status: snapshot.status || 'running',
        startTime: run.createdAt ? new Date(run.createdAt).toISOString() : undefined,
        endTime: run.updatedAt && snapshot.status !== 'running' ? new Date(run.updatedAt).toISOString() : undefined,
        suspendedAt: snapshot.suspendedAt ? new Date(snapshot.suspendedAt).toISOString() : undefined,
      });
    } catch (error: any) {
      logger.error(`Failed to get workflow run ${runId}:`, error);

      return c.json(
        {
          error: 'Failed to get workflow run',
          message: error instanceof Error ? error.message : String(error),
          code: 'GET_RUN_FAILED',
        },
        500
      );
    }
  });

  /**
   * Route: Resume a suspended workflow run
   * POST /api/workflows/{id}/runs/{runId}/resume
   * Requires: operator role
   *
   * Body:
   * - resumeData: Data to resume the workflow with (workflow-specific)
   *
   * Returns:
   * - runId: Workflow run identifier
   * - status: New status ('running', 'completed', 'failed')
   * - message: Status message
   */
  app.post('/api/workflows/:id/runs/:runId/resume', requireRole('operator'), async (c: any) => {
    const user = getCurrentUser(c);
    const workflowId = c.req.param('id');
    const runId = c.req.param('runId');

    if (!workflowId || !runId) {
      return c.json(
        {
          error: 'Bad Request',
          message: 'workflow ID and run ID are required',
        },
        400
      );
    }

    try {
      // Parse request body
      const body = await c.req.json();
      const validationResult = resumeWorkflowSchema.safeParse(body);

      if (!validationResult.success) {
        return c.json(
          {
            error: 'Invalid request body',
            details: validationResult.error.flatten(),
          },
          400
        );
      }

      const { resumeData } = validationResult.data;

      // Get the workflow
      const workflow = mastra.getWorkflow(workflowId);

      // Create run instance and resume
      const run = await workflow.createRun({ runId });
      await run.resume(resumeData);

      // Log workflow resume to audit service
      await auditService.logWorkflowEvent({
        user,
        action: 'workflow.resumed',
        workflowId,
        runId,
        reason: `Workflow resumed with data: ${JSON.stringify(resumeData)}`,
        ipAddress: extractIpAddress(c),
        userAgent: extractUserAgent(c),
      });

      return c.json({
        runId,
        status: 'running',
        message: 'Workflow resumed successfully',
      });
    } catch (error: any) {
      logger.error(`Failed to resume workflow run ${runId}:`, error);

      // Log failed resume attempt
      await auditService.logWorkflowEvent({
        user,
        action: 'workflow.failed',
        workflowId,
        runId,
        reason: error instanceof Error ? error.message : String(error),
        ipAddress: extractIpAddress(c),
        userAgent: extractUserAgent(c),
      });

      return c.json(
        {
          error: 'Failed to resume workflow run',
          message: error instanceof Error ? error.message : String(error),
          code: 'WORKFLOW_RESUME_FAILED',
        },
        500
      );
    }
  });

  /**
   * Route: Get workflow execution result
   * GET /api/workflows/{id}/runs/{runId}/execution-result
   * Requires: viewer role
   *
   * Returns:
   * - runId: Workflow run identifier
   * - workflowId: Workflow identifier
   * - status: Final status
   * - input: Original input data
   * - output: Final output data (if completed)
   * - steps: Array of step execution details
   * - errors: Any errors that occurred
   */
  app.get('/api/workflows/:id/runs/:runId/execution-result', requireRole('viewer'), async (c: any) => {
    getCurrentUser(c); // Auth required
    const workflowId = c.req.param('id');
    const runId = c.req.param('runId');

    if (!workflowId || !runId) {
      return c.json(
        {
          error: 'Bad Request',
          message: 'workflow ID and run ID are required',
        },
        400
      );
    }

    try {
      // Get the workflow - validates workflow exists
      void mastra.getWorkflow(workflowId);

      // Get the run from storage
      const run = await workflowsStorage.getWorkflowRunById({ runId });

      if (!run) {
        return c.json(
          {
            error: 'Not Found',
            message: `Workflow run '${runId}' not found`,
            code: 'RUN_NOT_FOUND',
          },
          404
        );
      }

      const snapshot = run.snapshot || {};
      const context = snapshot.context || {};

      // Build steps array from context
      const steps = Object.entries(context).map(([stepId, stepResult]: [string, any]) => ({
        id: stepId,
        status: stepResult?.status || 'unknown',
        output: stepResult?.output,
        error: stepResult?.error,
        startedAt: stepResult?.startedAt ? new Date(stepResult.startedAt).toISOString() : undefined,
        completedAt: stepResult?.endedAt ? new Date(stepResult.endedAt).toISOString() : undefined,
      }));

      return c.json({
        runId: run.runId,
        workflowId: run.workflowName,
        status: snapshot.status || 'running',
        input: snapshot.inputData,
        output: snapshot.value,
        steps,
        suspendedAt: snapshot.suspendedAt ? new Date(snapshot.suspendedAt).toISOString() : undefined,
        errors: snapshot.errors,
      });
    } catch (error: any) {
      logger.error(`Failed to get execution result for run ${runId}:`, error);

      return c.json(
        {
          error: 'Failed to get execution result',
          message: error instanceof Error ? error.message : String(error),
          code: 'GET_RESULT_FAILED',
        },
        500
      );
    }
  });

  /**
   * Route: List all runs for a workflow
   * GET /api/workflows/{id}/runs
   * Requires: viewer role
   *
   * Query params:
   * - status: Filter by status ('running', 'completed', 'failed', 'suspended')
   * - limit: Maximum number of runs to return (default: 50)
   * - offset: Offset for pagination (default: 0)
   *
   * Returns:
   * - runs: Array of workflow run summaries
   * - total: Total count of runs
   */
  app.get('/api/workflows/:id/runs', requireRole('viewer'), async (c: any) => {
    getCurrentUser(c); // Auth required
    const workflowId = c.req.param('id');

    if (!workflowId) {
      return c.json(
        {
          error: 'Bad Request',
          message: 'workflow ID is required',
        },
        400
      );
    }

    try {
      const query = c.req.query();
      const status = query.status as 'running' | 'completed' | 'failed' | 'suspended' | undefined;
      const limit = parseInt(query.limit || '50', 10);
      const offset = parseInt(query.offset || '0', 10);

      // Get the workflow and list runs
      const workflow = mastra.getWorkflow(workflowId);
      const result = await workflow.listWorkflowRuns({
        status,
        perPage: limit,
        page: Math.floor(offset / limit),
      });

      const runs = result.runs.map((run: any) => {
        const snapshot = run.snapshot || {};
        return {
          runId: run.runId,
          status: snapshot.status || 'running',
          startTime: run.createdAt ? new Date(run.createdAt).toISOString() : undefined,
          endTime: run.updatedAt && snapshot.status !== 'running' ? new Date(run.updatedAt).toISOString() : undefined,
          suspendedAt: snapshot.suspendedAt ? new Date(snapshot.suspendedAt).toISOString() : undefined,
        };
      });

      return c.json({
        runs,
        total: result.total,
        limit,
        offset,
      });
    } catch (error: any) {
      logger.error(`Failed to list runs for workflow ${workflowId}:`, error);

      return c.json(
        {
          error: 'Failed to list workflow runs',
          message: error instanceof Error ? error.message : String(error),
          code: 'LIST_RUNS_FAILED',
        },
        500
      );
    }
  });

  return app;
}
