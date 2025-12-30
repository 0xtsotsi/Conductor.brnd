import { z } from 'zod';
import { HTTPException } from '../http-exception';
import { createRoute } from '../server-adapter/routes/route-builder';
import type { Context } from '../types';
import { handleError } from './error';
import { listWorkflowRunsQuerySchema, workflowRunsResponseSchema } from '../schemas/workflows';

export interface MissionContext extends Context {
  runId?: string;
}

/**
 * GET /api/missions/active
 * List all active/running workflow runs across all workflows
 */
export const LIST_ACTIVE_MISSIONS_ROUTE = createRoute({
  method: 'GET',
  path: '/api/missions/active',
  responseType: 'json',
  queryParamSchema: listWorkflowRunsQuerySchema.partial().extend({
    status: z.literal('running').optional(),
    workflowId: z.string().optional(),
  }),
  responseSchema: workflowRunsResponseSchema,
  summary: 'List active missions',
  description:
    'Returns a paginated list of currently running workflow executions across all workflows',
  tags: ['Missions'],
  handler: async ({ mastra, status = 'running', workflowId, page, perPage, fromDate, toDate, resourceId }) => {
    try {
      const logger = mastra.getLogger();

      // Get all workflows
      const workflows = mastra.getWorkflows();

      let allRuns: any[] = [];
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
            status,
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

      // Sort by startTime (most recently started first)
      allRuns.sort((a, b) => {
        const dateA = a.startTime ? new Date(a.startTime).getTime() : 0;
        const dateB = b.startTime ? new Date(b.startTime).getTime() : 0;
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
      return handleError(error, 'Error listing active missions');
    }
  },
});

/**
 * GET /api/missions/recent
 * List recent completed/failed workflow runs
 */
export const LIST_RECENT_MISSIONS_ROUTE = createRoute({
  method: 'GET',
  path: '/api/missions/recent',
  responseType: 'json',
  queryParamSchema: z.object({
    status: z.enum(['success', 'failed', 'tripwire']).array().optional().default(['success', 'failed']),
    limit: z.number().min(1).max(100).optional().default(10),
    workflowId: z.string().optional(),
  }),
  responseSchema: z.object({
    runs: z.array(
      z.object({
        runId: z.string(),
        workflowId: z.string(),
        status: z.string(),
        startTime: z.date().optional(),
        endTime: z.date().optional(),
        duration: z.number().optional(),
      })
    ),
    total: z.number(),
  }),
  summary: 'List recent missions',
  description:
    'Returns a list of recently completed or failed workflow executions across all workflows',
  tags: ['Missions'],
  handler: async ({ mastra, status, limit, workflowId }) => {
    try {
      const logger = mastra.getLogger();

      // Get all workflows
      const workflows = mastra.getWorkflows();

      let allRuns: any[] = [];

      // If workflowId is specified, only query that workflow
      const workflowsToQuery = workflowId
        ? { [workflowId]: workflows[workflowId] }
        : workflows;

      // Query runs from each workflow for each status
      for (const workflowStatus of status) {
        for (const [id, workflow] of Object.entries(workflowsToQuery)) {
          if (!workflow) continue;

          try {
            const result = await workflow.listWorkflowRuns({
              status: workflowStatus as any,
              page: 0,
              perPage: limit,
            });

            if (result?.runs) {
              // Augment runs with workflowId
              const augmentedRuns = result.runs.map((run: any) => ({
                ...run,
                workflowId: id,
              }));
              allRuns.push(...augmentedRuns);
            }
          } catch (error) {
            logger.error(`Error fetching ${workflowStatus} runs for workflow ${id}:`, error);
            // Continue to next workflow
          }
        }
      }

      // Sort by endTime (most recently completed first)
      allRuns.sort((a, b) => {
        const dateA = a.endTime ? new Date(a.endTime).getTime() : 0;
        const dateB = b.endTime ? new Date(b.endTime).getTime() : 0;
        return dateB - dateA;
      });

      // Apply limit
      const limitedRuns = allRuns.slice(0, limit);

      return {
        runs: limitedRuns,
        total: allRuns.length,
      };
    } catch (error) {
      return handleError(error, 'Error listing recent missions');
    }
  },
});

/**
 * GET /api/missions/:runId/timeline
 * Get mission execution timeline with step graph
 */
export const GET_MISSION_TIMELINE_ROUTE = createRoute({
  method: 'GET',
  path: '/api/missions/:runId/timeline',
  responseType: 'json',
  pathParamSchema: z.object({
    runId: z.string(),
  }),
  responseSchema: z.object({
    runId: z.string(),
    workflowId: z.string(),
    status: z.string(),
    startTime: z.date().optional(),
    endTime: z.date().optional(),
    duration: z.number().optional(),
    steps: z.array(
      z.object({
        stepId: z.string(),
        name: z.string(),
        status: z.string(),
        startTime: z.date().optional(),
        endTime: z.date().optional(),
        duration: z.number().optional(),
        input: z.any().optional(),
        output: z.any().optional(),
        error: z.any().optional(),
      })
    ),
    stepGraph: z.any().optional(),
  }),
  summary: 'Get mission timeline',
  description:
    'Returns detailed execution timeline for a workflow run including all steps and their statuses',
  tags: ['Missions'],
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

      // Get detailed snapshot with step information
      const snapshot = await targetWorkflow.getWorkflowRunSnapshot(runId);

      // Extract step information from snapshot
      const steps = Object.entries(snapshot?.steps || {}).map(([stepId, stepData]: [string, any]) => ({
        stepId,
        name: stepData.name || stepId,
        status: stepData.status || 'unknown',
        startTime: stepData.startTime ? new Date(stepData.startTime) : undefined,
        endTime: stepData.endTime ? new Date(stepData.endTime) : undefined,
        duration: stepData.duration,
        input: stepData.input,
        output: stepData.output,
        error: stepData.error,
      }));

      // Calculate duration
      let duration: number | undefined;
      if (targetRun.startTime && targetRun.endTime) {
        duration = new Date(targetRun.endTime).getTime() - new Date(targetRun.startTime).getTime();
      }

      return {
        runId,
        workflowId: foundWorkflowId,
        status: targetRun.status,
        startTime: targetRun.startTime ? new Date(targetRun.startTime) : undefined,
        endTime: targetRun.endTime ? new Date(targetRun.endTime) : undefined,
        duration,
        steps,
        stepGraph: snapshot?.stepGraph,
      };
    } catch (error) {
      return handleError(error, 'Error getting mission timeline');
    }
  },
});
