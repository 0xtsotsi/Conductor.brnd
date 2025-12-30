import { z } from 'zod';
import { HTTPException } from '../http-exception';
import { createRoute } from '../server-adapter/routes/route-builder';
import { wrapSchemaForQueryParams } from '../server-adapter/routes/route-builder';
import type { Context } from '../types';
import { handleError } from './error';
import {
  listActiveMissionsQuerySchema,
  listMissionsResponseSchema,
  missionPathParams,
  listRecentMissionsQuerySchema,
  missionTimelineResponseSchema,
  missionTimelineQuerySchema,
} from '../schemas/missions';
import { workflowRunStatusSchema } from '../schemas/workflows';

export interface MissionsContext extends Context {
  runId?: string;
}

/**
 * Helper function to get workflow from the system
 */
async function getWorkflowById({
  mastra,
  workflowId,
}: {
  mastra: MissionsContext['mastra'];
  workflowId: string;
}) {
  const logger = mastra.getLogger();

  let workflow;
  let actualWorkflowId = workflowId;

  // Check if workflow exists directly
  try {
    workflow = mastra.getWorkflowById(workflowId);
    if (!workflow) {
      // Try to find in agent workflows
      const agents = mastra.listAgents();
      if (agents && Object.keys(agents).length > 0) {
        for (const [agentName, agent] of Object.entries(agents)) {
          try {
            const agentWorkflows = await agent.listWorkflows();
            if (agentWorkflows[workflowId]) {
              workflow = agentWorkflows[workflowId];
              break;
            }
          } catch (error) {
            logger.debug(`Error listing workflows for agent ${agentName}`, error);
          }
        }
      }
    }
  } catch (error) {
    logger.debug('Error getting workflow, searching agents for workflow', error);
  }

  if (!workflow) {
    throw new HTTPException(404, { message: 'Workflow not found' });
  }

  return { workflow, workflowId: actualWorkflowId };
}

/**
 * Helper function to build mission run object from storage run
 */
function buildMissionRun(run: any, workflowId?: string, workflow?: any) {
  const snapshot = typeof run.snapshot === 'string' ? JSON.parse(run.snapshot) : run.snapshot;

  // Extract status from snapshot
  const status = snapshot?.status || 'unknown';

  // Calculate step counts
  const steps = snapshot?.steps || {};
  const stepCount = Object.keys(steps).length;
  const completedSteps = Object.values(steps).filter(
    (step: any) => step?.status === 'success',
  ).length;

  // Find current executing step
  const currentStepEntry = Object.entries(steps).find(
    ([, step]: [string, any]) =>
      step?.status === 'running' || step?.status === 'waiting' || step?.status === 'suspended',
  );
  const currentStep = currentStepEntry?.[0];

  // Get suspend info if applicable
  const suspendedStepEntry = Object.entries(steps).find(
    ([, step]: [string, any]) => step?.status === 'suspended',
  );

  return {
    runId: run.runId,
    workflowId: workflowId || run.workflowName,
    workflowName: workflow?.name || run.workflowName,
    status,
    resourceName: run.resourceId,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
    startedAt: snapshot?.startedAt,
    completedAt: snapshot?.completedAt,
    suspendedAt: suspendedStepEntry?.[1]?.suspendPayload?.__workflow_meta?.timestamp
      ? new Date(suspendedStepEntry[1].suspendPayload.__workflow_meta.timestamp)
      : undefined,
    suspendReason: suspendedStepEntry?.[1]?.suspendPayload?.reason,
    error: snapshot?.error?.message || snapshot?.error,
    currentStep,
    stepCount,
    completedSteps,
    inputSummary: snapshot?.inputData,
    result: snapshot?.result,
  };
}

/**
 * GET /api/missions/active
 * List all active (running/waiting/suspended/paused) workflow runs
 */
export const LIST_ACTIVE_MISSIONS_ROUTE = createRoute({
  method: 'GET',
  path: '/api/missions/active',
  responseType: 'json',
  queryParamSchema: wrapSchemaForQueryParams(
    listActiveMissionsQuerySchema.omit({ status: true }).extend({
      status: z
        .enum(['running', 'waiting', 'suspended', 'paused'])
        .optional()
        .describe('Filter by specific active status'),
    }),
  ),
  responseSchema: listMissionsResponseSchema,
  summary: 'List active missions',
  description: 'Returns a paginated list of all active workflow runs (running, waiting, suspended, or paused)',
  tags: ['Missions'],
  handler: async ({ mastra, status, workflowId, resourceName, page = 0, perPage = 50 }) => {
    try {
      const storage = mastra.getStorage();
      if (!storage) {
        throw new HTTPException(500, { message: 'Storage not available' });
      }

      const logger = mastra.getLogger();
      const missions: any[] = [];

      // Determine which workflows to check
      let workflowIdsToCheck: string[] = [];
      if (workflowId) {
        workflowIdsToCheck = [workflowId];
      } else {
        // Get all workflows
        const workflows = mastra.listWorkflows({ serialized: false });
        workflowIdsToCheck = Object.keys(workflows);

        // Also check agent workflows
        const agents = mastra.listAgents();
        if (agents && Object.keys(agents).length > 0) {
          for (const [, agent] of Object.entries(agents)) {
            try {
              const agentWorkflows = await agent.listWorkflows();
              Object.keys(agentWorkflows).forEach(id => {
                if (!workflowIdsToCheck.includes(id)) {
                  workflowIdsToCheck.push(id);
                }
              });
            } catch (error) {
              logger.debug('Error listing agent workflows', error);
            }
          }
        }
      }

      // Active statuses to check
      const activeStatuses: (typeof status)[] = status ? [status] : ['running', 'waiting', 'suspended', 'paused'];

      // Collect runs from all workflows
      for (const wfId of workflowIdsToCheck) {
        try {
          for (const activeStatus of activeStatuses) {
            const result = await storage.listWorkflowRuns({
              workflowName: wfId,
              status: activeStatus as any,
              perPage: false,
            });

            for (const run of result.runs) {
              // Filter by resource name if provided
              if (resourceName && run.resourceId !== resourceName) continue;

              try {
                const workflow = await mastra.getWorkflowById(wfId);
                missions.push(buildMissionRun(run, wfId, workflow));
              } catch {
                // Workflow might be an agent workflow
                missions.push(buildMissionRun(run, wfId));
              }
            }
          }
        } catch (error) {
          logger.debug(`Error listing runs for workflow ${wfId}`, error);
        }
      }

      // Sort by updatedAt descending (most recently active first)
      missions.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

      const total = missions.length;
      const start = page * perPage;
      const end = start + perPage;
      const paginatedMissions = missions.slice(start, end);

      return { missions: paginatedMissions, total };
    } catch (error) {
      return handleError(error, 'Error listing active missions');
    }
  },
});

/**
 * GET /api/missions/recent
 * List recent workflow runs, ordered by most recently updated
 */
export const LIST_RECENT_MISSIONS_ROUTE = createRoute({
  method: 'GET',
  path: '/api/missions/recent',
  responseType: 'json',
  queryParamSchema: wrapSchemaForQueryParams(listRecentMissionsQuerySchema),
  responseSchema: listMissionsResponseSchema,
  summary: 'List recent missions',
  description: 'Returns a paginated list of recently updated workflow runs',
  tags: ['Missions'],
  handler: async ({ mastra, status, workflowId, resourceName, hours = 24, page = 0, perPage = 50 }) => {
    try {
      const storage = mastra.getStorage();
      if (!storage) {
        throw new HTTPException(500, { message: 'Storage not available' });
      }

      const logger = mastra.getLogger();
      const missions: any[] = [];

      // Calculate date cutoff
      const fromDate = new Date(Date.now() - hours * 60 * 60 * 1000);

      // Determine which workflows to check
      let workflowIdsToCheck: string[] = [];
      if (workflowId) {
        workflowIdsToCheck = [workflowId];
      } else {
        const workflows = mastra.listWorkflows({ serialized: false });
        workflowIdsToCheck = Object.keys(workflows);

        const agents = mastra.listAgents();
        if (agents && Object.keys(agents).length > 0) {
          for (const [, agent] of Object.entries(agents)) {
            try {
              const agentWorkflows = await agent.listWorkflows();
              Object.keys(agentWorkflows).forEach(id => {
                if (!workflowIdsToCheck.includes(id)) {
                  workflowIdsToCheck.push(id);
                }
              });
            } catch (error) {
              logger.debug('Error listing agent workflows', error);
            }
          }
        }
      }

      // Collect runs from all workflows
      for (const wfId of workflowIdsToCheck) {
        try {
          const result = await storage.listWorkflowRuns({
            workflowName: wfId,
            status: status as any,
            fromDate,
            perPage: false,
          });

          for (const run of result.runs) {
            // Filter by resource name if provided
            if (resourceName && run.resourceId !== resourceName) continue;

            try {
              const workflow = await mastra.getWorkflowById(wfId);
              missions.push(buildMissionRun(run, wfId, workflow));
            } catch {
              missions.push(buildMissionRun(run, wfId));
            }
          }
        } catch (error) {
          logger.debug(`Error listing runs for workflow ${wfId}`, error);
        }
      }

      // Sort by updatedAt descending
      missions.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

      const total = missions.length;
      const start = page * perPage;
      const end = start + perPage;
      const paginatedMissions = missions.slice(start, end);

      return { missions: paginatedMissions, total };
    } catch (error) {
      return handleError(error, 'Error listing recent missions');
    }
  },
});

/**
 * GET /api/missions/:runId/timeline
 * Get timeline events for a specific mission run
 */
export const GET_MISSION_TIMELINE_ROUTE = createRoute({
  method: 'GET',
  path: '/api/missions/:runId/timeline',
  responseType: 'json',
  pathParamSchema: missionPathParams,
  queryParamSchema: missionTimelineQuerySchema,
  responseSchema: missionTimelineResponseSchema,
  summary: 'Get mission timeline',
  description: 'Returns chronological timeline of events for a specific mission run',
  tags: ['Missions'],
  handler: async ({ mastra, runId, includeSteps, excludeSteps, eventType }) => {
    try {
      if (!runId) {
        throw new HTTPException(400, { message: 'Run ID is required' });
      }

      const storage = mastra.getStorage();
      if (!storage) {
        throw new HTTPException(500, { message: 'Storage not available' });
      }

      const logger = mastra.getLogger();

      // Find the run across all workflows
      let foundRun = null;
      let foundWorkflowId = null;
      let foundWorkflow = null;

      const workflows = mastra.listWorkflows({ serialized: false });
      const workflowNames = Object.keys(workflows);

      for (const workflowName of workflowNames) {
        try {
          const run = await storage.getWorkflowRunById({ runId, workflowName });
          if (run) {
            foundRun = run;
            foundWorkflowId = workflowName;
            foundWorkflow = workflows[workflowName];
            break;
          }
        } catch (error) {
          // Continue searching
        }
      }

      // Check agent workflows
      if (!foundRun) {
        const agents = mastra.listAgents();
        if (agents && Object.keys(agents).length > 0) {
          for (const [, agent] of Object.entries(agents)) {
            try {
              const agentWorkflows = await agent.listWorkflows();
              for (const [workflowName, workflow] of Object.entries(agentWorkflows)) {
                try {
                  const run = await storage.getWorkflowRunById({ runId, workflowName });
                  if (run) {
                    foundRun = run;
                    foundWorkflowId = workflowName;
                    foundWorkflow = workflow;
                    break;
                  }
                } catch {
                  // Continue
                }
              }
              if (foundRun) break;
            } catch {
              // Continue
            }
          }
        }
      }

      if (!foundRun || !foundWorkflowId) {
        throw new HTTPException(404, { message: 'Mission run not found' });
      }

      const snapshot = typeof foundRun.snapshot === 'string' ? JSON.parse(foundRun.snapshot) : foundRun.snapshot;
      const steps = snapshot?.steps || {};

      // Build timeline from snapshot
      const timeline: any[] = [];

      // Created event
      timeline.push({
        timestamp: foundRun.createdAt,
        type: 'created',
        message: 'Mission run created',
      });

      // Started event
      if (snapshot?.startedAt) {
        timeline.push({
          timestamp: new Date(snapshot.startedAt),
          type: 'started',
          message: 'Mission execution started',
          duration: snapshot.startedAt
            ? new Date(snapshot.startedAt).getTime() - foundRun.createdAt.getTime()
            : undefined,
        });
      }

      // Step events
      const includeStepSet = includeSteps ? new Set(includeSteps.split(',')) : null;
      const excludeStepSet = excludeSteps ? new Set(excludeSteps.split(',')) : null;
      const eventTypeSet = eventType ? new Set(eventType.split(',')) : null;

      for (const [stepId, step] of Object.entries(steps)) {
        if (!step || typeof step !== 'object') continue;

        // Filter steps
        if (includeStepSet && !includeStepSet.has(stepId)) continue;
        if (excludeStepSet && excludeStepSet.has(stepId)) continue;

        const stepStatus = (step as any).status;
        const stepCreatedAt = (step as any).createdAt;
        const stepCompletedAt = (step as any).completedAt;

        // Step started
        if (stepCreatedAt) {
          const event = {
            timestamp: new Date(stepCreatedAt),
            type: 'step_started',
            stepId,
            message: `Step "${stepId}" started`,
          };
          if (!eventTypeSet || eventTypeSet.has('step_started')) {
            timeline.push(event);
          }
        }

        // Step completed/failed
        if (stepCompletedAt) {
          let eventTypeStr = 'step_completed';
          let message = `Step "${stepId}" completed`;

          if (stepStatus === 'failed') {
            eventTypeStr = 'step_failed';
            message = `Step "${stepId}" failed`;
          } else if (stepStatus === 'suspended') {
            eventTypeStr = 'suspended';
            message = `Step "${stepId}" suspended`;
          }

          const event = {
            timestamp: new Date(stepCompletedAt),
            type: eventTypeStr,
            stepId,
            message,
            details: (step as any).error ? { error: (step as any).error } : undefined,
            duration: stepCreatedAt
              ? new Date(stepCompletedAt).getTime() - new Date(stepCreatedAt).getTime()
              : undefined,
          };
          if (!eventTypeSet || eventTypeSet.has(eventTypeStr)) {
            timeline.push(event);
          }
        }
      }

      // Completed/Failed event
      if (snapshot?.completedAt) {
        const status = snapshot?.status;
        let eventTypeStr = 'completed';
        let message = 'Mission completed successfully';

        if (status === 'failed') {
          eventTypeStr = 'failed';
          message = 'Mission failed';
        } else if (status === 'canceled') {
          eventTypeStr = 'canceled';
          message = 'Mission was canceled';
        }

        timeline.push({
          timestamp: new Date(snapshot.completedAt),
          type: eventTypeStr,
          message,
          duration: snapshot.startedAt
            ? new Date(snapshot.completedAt).getTime() - new Date(snapshot.startedAt).getTime()
            : undefined,
        });
      }

      // Sort timeline by timestamp
      timeline.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      // Calculate summary
      const stepCounts: Record<string, number> = {};
      for (const event of timeline) {
        if (event.stepId) {
          stepCounts[event.stepId] = (stepCounts[event.stepId] || 0) + 1;
        }
      }

      const firstEvent = timeline[0];
      const lastEvent = timeline[timeline.length - 1];
      const duration =
        firstEvent && lastEvent ? lastEvent.timestamp.getTime() - firstEvent.timestamp.getTime() : undefined;

      return {
        runId: foundRun.runId,
        workflowId: foundWorkflowId,
        status: snapshot?.status || 'unknown',
        timeline,
        summary: {
          totalEvents: timeline.length,
          duration,
          stepCounts,
        },
      };
    } catch (error) {
      return handleError(error, 'Error getting mission timeline');
    }
  },
});
