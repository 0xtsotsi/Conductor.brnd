import { z } from 'zod';
import { HTTPException } from '../http-exception';
import { createRoute } from '../server-adapter/routes/route-builder';
import type { Context } from '../types';
import { handleError } from './error';
import {
  workflowRunPathParams,
  workflowIdPathParams,
  listWorkflowRunsQuerySchema,
  workflowRunsResponseSchema,
  workflowControlResponseSchema,
  resumeBodySchema,
} from '../schemas/workflows';

// Schema for routes that only need runId (not workflowId)
const runIdPathParams = z.object({
  runId: z.string().describe('Unique identifier for the workflow run'),
});

export interface ApprovalContext extends Context {
  runId?: string;
}

/**
 * GET /api/approvals
 * List all suspended workflow runs across all workflows
 */
export const LIST_APPROVALS_ROUTE = createRoute({
  method: 'GET',
  path: '/api/approvals',
  responseType: 'json',
  queryParamSchema: listWorkflowRunsQuerySchema
    .partial()
    .extend({
      status: z.enum(['suspended', 'pending']).optional().default('suspended'),
      workflowId: z.string().optional(),
    }),
  responseSchema: workflowRunsResponseSchema,
  summary: 'List approval queue',
  description:
    'Returns a paginated list of suspended workflow runs across all workflows that require approval',
  tags: ['Approvals'],
  handler: async ({ mastra, status, workflowId, page, perPage, fromDate, toDate, resourceId }) => {
    try {
      const logger = mastra.getLogger();

      // Get all workflows
      const workflows = mastra.getWorkflows();

      let allRuns: Array<{ workflowId: string; runId: string; suspendedAt: Date }> = [];
      let totalCount = 0;

      // If workflowId is specified, only query that workflow
      const workflowsToQuery = workflowId
        ? { [workflowId]: workflows[workflowId] }
        : workflows;

      // Query runs from each workflow
      for (const [id, workflow] of Object.entries(workflowsToQuery)) {
        if (!workflow) continue;

        try {
          const result = await workflow.listWorkflowRuns({
            status: status as any,
            page,
            perPage,
            fromDate: fromDate ? (typeof fromDate === 'string' ? new Date(fromDate) : fromDate) : undefined,
            toDate: toDate ? (typeof toDate === 'string' ? new Date(toDate) : toDate) : undefined,
            resourceId,
          });

          if (result?.runs) {
            // Augment runs with workflowId
            const augmentedRuns = result.runs.map((run: any) => ({
              ...run,
              workflowId: id,
            }));
            allRuns.push(...augmentedRuns);
            totalCount += result.total || augmentedRuns.length;
          }
        } catch (error) {
          logger.error(`Error fetching runs for workflow ${id}:`, error);
          // Continue to next workflow instead of failing entire request
        }
      }

      // Sort by suspendedAt date (newest first)
      allRuns.sort((a, b) => {
        const dateA = a.suspendedAt ? new Date(a.suspendedAt).getTime() : 0;
        const dateB = b.suspendedAt ? new Date(b.suspendedAt).getTime() : 0;
        return dateB - dateA;
      });

      // Apply pagination to aggregated results
      const finalPage = page || 0;
      const finalPerPage = perPage || 10;
      const startIndex = finalPage * finalPerPage;
      const paginatedRuns = allRuns.slice(startIndex, startIndex + finalPerPage);

      return {
        runs: paginatedRuns,
        total: totalCount,
        page: finalPage,
        perPage: finalPerPage,
      };
    } catch (error) {
      return handleError(error, 'Error listing approvals');
    }
  },
});

/**
 * POST /api/approvals/:runId/approve
 * Approve a suspended workflow run
 */
export const APPROVE_RUN_ROUTE = createRoute({
  method: 'POST',
  path: '/api/approvals/:runId/approve',
  responseType: 'json',
  pathParamSchema: runIdPathParams,
  bodySchema: resumeBodySchema.partial().extend({
    resumeData: z
      .object({
        approved: z.literal(true),
        feedback: z.string().optional(),
      })
      .passthrough(),
  }),
  responseSchema: workflowControlResponseSchema
    .extend({
      runId: z.string(),
      status: z.string(),
    })
    .strict(),
  summary: 'Approve workflow run',
  description: 'Approves a suspended workflow run and resumes execution with approval data',
  tags: ['Approvals'],
  handler: async ({ mastra, runId, ...params }) => {
    try {
      if (!runId) {
        throw new HTTPException(400, { message: 'runId is required' });
      }

      const logger = mastra.getLogger();

      // Find the workflow that contains this run
      const workflows = mastra.getWorkflows();
      let targetWorkflow: any = null;
      let targetRun: any = null;

      for (const workflow of Object.values(workflows)) {
        try {
          const run = await workflow.getWorkflowRunById(runId);
          if (run) {
            targetWorkflow = workflow;
            targetRun = run;
            break;
          }
        } catch {
          // Run not found in this workflow, continue searching
        }
      }

      if (!targetWorkflow || !targetRun) {
        throw new HTTPException(404, { message: 'Workflow run not found' });
      }

      if (targetRun.status !== 'suspended') {
        throw new HTTPException(400, {
          message: `Cannot approve run with status ${targetRun.status}. Run must be suspended.`,
        });
      }

      // Resume the workflow with approval data
      const _run = await targetWorkflow.createRun({
        runId,
        resourceId: targetRun.resourceId,
      });

      await _run.resume(params);

      logger.info(`Approved workflow run ${runId}`);

      return {
        message: 'Run approved',
        runId,
        status: 'running',
      };
    } catch (error) {
      return handleError(error, 'Error approving run');
    }
  },
});

/**
 * POST /api/approvals/:runId/decline
 * Decline a suspended workflow run
 */
export const DECLINE_RUN_ROUTE = createRoute({
  method: 'POST',
  path: '/api/approvals/:runId/decline',
  responseType: 'json',
  pathParamSchema: runIdPathParams,
  bodySchema: resumeBodySchema.partial().extend({
    resumeData: z
      .object({
        approved: z.literal(false),
        feedback: z.string(),
      })
      .passthrough(),
  }),
  responseSchema: workflowControlResponseSchema
    .extend({
      runId: z.string(),
      status: z.string(),
    })
    .strict(),
  summary: 'Decline workflow run',
  description: 'Declines a suspended workflow run and resumes execution with decline data',
  tags: ['Approvals'],
  handler: async ({ mastra, runId, ...params }) => {
    try {
      if (!runId) {
        throw new HTTPException(400, { message: 'runId is required' });
      }

      const logger = mastra.getLogger();

      // Find the workflow that contains this run
      const workflows = mastra.getWorkflows();
      let targetWorkflow: any = null;
      let targetRun: any = null;

      for (const workflow of Object.values(workflows)) {
        try {
          const run = await workflow.getWorkflowRunById(runId);
          if (run) {
            targetWorkflow = workflow;
            targetRun = run;
            break;
          }
        } catch {
          // Run not found in this workflow, continue searching
        }
      }

      if (!targetWorkflow || !targetRun) {
        throw new HTTPException(404, { message: 'Workflow run not found' });
      }

      if (targetRun.status !== 'suspended') {
        throw new HTTPException(400, {
          message: `Cannot decline run with status ${targetRun.status}. Run must be suspended.`,
        });
      }

      // Resume the workflow with decline data
      const _run = await targetWorkflow.createRun({
        runId,
        resourceId: targetRun.resourceId,
      });

      await _run.resume(params);

      logger.info(`Declined workflow run ${runId}`);

      return {
        message: 'Run declined',
        runId,
        status: 'running',
      };
    } catch (error) {
      return handleError(error, 'Error declining run');
    }
  },
});

/**
 * GET /api/approvals/:runId
 * Get details of a specific approval
 */
export const GET_APPROVAL_ROUTE = createRoute({
  method: 'GET',
  path: '/api/approvals/:runId',
  responseType: 'json',
  pathParamSchema: runIdPathParams,
  responseSchema: z.object({
    runId: z.string(),
    workflowId: z.string(),
    status: z.string(),
    suspendedAt: z.date().optional(),
    suspendData: z.any().optional(),
    suspendPayload: z.any().optional(),
    snapshot: z.any().optional(),
  }),
  summary: 'Get approval details',
  description: 'Returns detailed information about a suspended workflow run including suspend payload',
  tags: ['Approvals'],
  handler: async ({ mastra, runId }) => {
    try {
      if (!runId) {
        throw new HTTPException(400, { message: 'runId is required' });
      }

      // Find the workflow that contains this run
      const workflows = mastra.getWorkflows();
      let targetWorkflow: any = null;
      let targetRun: any = null;
      let foundWorkflowId = '';

      for (const [id, workflow] of Object.entries(workflows)) {
        try {
          const run = await workflow.getWorkflowRunById(runId);
          if (run) {
            targetWorkflow = workflow;
            targetRun = run;
            foundWorkflowId = id;
            break;
          }
        } catch {
          // Run not found in this workflow, continue searching
        }
      }

      if (!targetWorkflow || !targetRun) {
        throw new HTTPException(404, { message: 'Workflow run not found' });
      }

      // Get detailed snapshot with suspend information
      const snapshot = await targetWorkflow.getWorkflowRunSnapshot(runId);

      return {
        runId,
        workflowId: foundWorkflowId,
        status: targetRun.status,
        suspendedAt: targetRun.startTime,
        suspendData: targetRun.suspendData,
        suspendPayload: snapshot?.suspendPayload,
        snapshot,
      };
    } catch (error) {
      return handleError(error, 'Error getting approval details');
    }
  },
});
