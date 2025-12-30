import { z } from 'zod';
import { HTTPException } from '../http-exception';
import { createRoute } from '../server-adapter/routes/route-builder';
import type { Context } from '../types';
import { handleError } from './error';
import {
  listApprovalsQuerySchema,
  listApprovalsResponseSchema,
  approvalPathParams,
  approveRunBodySchema,
  declineRunBodySchema,
  approvalActionResponseSchema,
  approvalDetailsResponseSchema,
} from '../schemas/approvals';
import { workflowRunStatusSchema } from '../schemas/workflows';

export interface ApprovalsContext extends Context {
  runId?: string;
}

/**
 * Helper function to find a workflow across the system by run ID
 * This searches in both registered workflows and agent workflows
 */
async function findWorkflowByRunId({
  mastra,
  runId,
}: {
  mastra: ApprovalsContext['mastra'];
  runId: string;
}) {
  const logger = mastra.getLogger();
  const storage = mastra.getStorage();

  if (!storage) {
    throw new HTTPException(500, { message: 'Storage not available' });
  }

  const workflows = mastra.listWorkflows({ serialized: false });
  const workflowNames = Object.keys(workflows);

  // Search for the run across all workflows
  for (const workflowName of workflowNames) {
    try {
      const run = await storage.getWorkflowRunById({ runId, workflowName });
      if (run) {
        const workflow = workflows[workflowName];
        return { workflow, workflowName, run };
      }
    } catch (error) {
      logger.debug(`Error checking workflow ${workflowName} for run ${runId}`, error);
    }
  }

  // Check agent workflows
  const agents = mastra.listAgents();
  if (agents && Object.keys(agents).length > 0) {
    for (const [agentName, agent] of Object.entries(agents)) {
      try {
        const agentWorkflows = await agent.listWorkflows();
        for (const [workflowName, workflow] of Object.entries(agentWorkflows)) {
          try {
            const run = await storage.getWorkflowRunById({ runId, workflowName });
            if (run) {
              return { workflow, workflowName, run, agentName };
            }
          } catch (error) {
            logger.debug(`Error checking agent workflow ${workflowName} for run ${runId}`, error);
          }
        }
      } catch (error) {
        logger.debug(`Error listing workflows for agent ${agentName}`, error);
      }
    }
  }

  return null;
}

/**
 * Helper function to list all suspended workflow runs across the system
 */
async function listSuspendedRuns({
  mastra,
  status,
  workflowId,
  fromDate,
  toDate,
  page = 0,
  perPage = 50,
}: {
  mastra: ApprovalsContext['mastra'];
  status?: 'pending' | 'approved' | 'declined';
  workflowId?: string;
  fromDate?: Date;
  toDate?: Date;
  page?: number;
  perPage?: number;
}) {
  const storage = mastra.getStorage();

  if (!storage) {
    throw new HTTPException(500, { message: 'Storage not available' });
  }

  const logger = mastra.getLogger();
  const approvals: any[] = [];
  let total = 0;

  // Get all workflows
  const workflows = mastra.listWorkflows({ serialized: false });
  const workflowEntries = Object.entries(workflows);

  // If filtering by workflowId, only check that workflow
  const workflowsToCheck = workflowId
    ? workflowEntries.filter(([id]) => id === workflowId)
    : workflowEntries;

  // Also check agent workflows
  const agents = mastra.listAgents();
  if (agents && Object.keys(agents).length > 0 && !workflowId) {
    for (const [agentName, agent] of Object.entries(agents)) {
      try {
        const agentWorkflows = await agent.listWorkflows();
        Object.entries(agentWorkflows).forEach(([workflowName, workflow]) => {
          if (!workflows[workflowName]) {
            workflowsToCheck.push([workflowName, workflow]);
          }
        });
      } catch (error) {
        logger.debug(`Error listing workflows for agent ${agentName}`, error);
      }
    }
  }

  // Check each workflow for suspended runs
  for (const [workflowName, workflow] of workflowsToCheck) {
    try {
      const result = await storage.listWorkflowRuns({
        workflowName,
        status: 'suspended',
        fromDate,
        toDate,
        perPage: false, // Get all to filter
      });

      for (const run of result.runs) {
        const snapshot = typeof run.snapshot === 'string' ? JSON.parse(run.snapshot) : run.snapshot;

        // Check if this run has suspended steps
        const hasSuspendedSteps =
          snapshot &&
          typeof snapshot === 'object' &&
          'steps' in snapshot &&
          Object.values(snapshot.steps as Record<string, unknown>).some(
            (step: unknown) =>
              step &&
              typeof step === 'object' &&
              'status' in step &&
              (step as { status: string }).status === 'suspended',
          );

        if (!hasSuspendedSteps) continue;

        // Map approval status based on suspended steps
        // For now, all suspended runs are considered "pending"
        const approvalStatus = 'pending' as const;

        // Filter by status if provided
        if (status && status !== approvalStatus) continue;

        // Get the suspended step info
        const suspendedStep = Object.values(snapshot.steps as Record<string, unknown>).find(
          (step: unknown) =>
            step &&
            typeof step === 'object' &&
            'status' in step &&
            (step as { status: string }).status === 'suspended',
        );

        const suspendPayload =
          suspendedStep && typeof suspendedStep === 'object' && 'suspendPayload' in suspendedStep
            ? (suspendedStep as { suspendPayload: unknown }).suspendPayload
            : undefined;

        const suspendReason =
          suspendPayload &&
          typeof suspendPayload === 'object' &&
          'reason' in suspendPayload &&
          typeof (suspendPayload as { reason?: string }).reason === 'string'
            ? (suspendPayload as { reason?: string }).reason
            : undefined;

        approvals.push({
          runId: run.runId,
          workflowId: workflowName,
          workflowName: workflow?.name || workflowName,
          suspendedAt: run.updatedAt,
          suspendReason,
          stepId:
            suspendedStep && typeof suspendedStep === 'object' && 'id' in suspendedStep
              ? (suspendedStep as { id: string }).id
              : undefined,
          resourceName: run.resourceId,
          status: approvalStatus,
          createdAt: run.createdAt,
          updatedAt: run.updatedAt,
          suspendPayload,
        });
      }
    } catch (error) {
      logger.debug(`Error listing suspended runs for workflow ${workflowName}`, error);
    }
  }

  total = approvals.length;

  // Apply pagination
  const start = page * perPage;
  const end = start + perPage;
  const paginatedApprovals = approvals.slice(start, end);

  return { approvals: paginatedApprovals, total };
}

/**
 * GET /api/approvals
 * List all suspended workflow runs that require approval
 */
export const LIST_APPROVALS_ROUTE = createRoute({
  method: 'GET',
  path: '/api/approvals',
  responseType: 'json',
  queryParamSchema: listApprovalsQuerySchema,
  responseSchema: listApprovalsResponseSchema,
  summary: 'List approval requests',
  description: 'Returns a paginated list of workflow runs that are suspended and awaiting approval',
  tags: ['Approvals'],
  handler: async ({ mastra, status, workflowId, fromDate, toDate, page, perPage }) => {
    try {
      const result = await listSuspendedRuns({
        mastra,
        status,
        workflowId,
        fromDate,
        toDate,
        page,
        perPage,
      });
      return result;
    } catch (error) {
      return handleError(error, 'Error listing approvals');
    }
  },
});

/**
 * POST /api/approvals/:runId/approve
 * Approve a suspended workflow run and resume execution
 */
export const APPROVE_RUN_ROUTE = createRoute({
  method: 'POST',
  path: '/api/approvals/:runId/approve',
  responseType: 'json',
  pathParamSchema: approvalPathParams,
  bodySchema: approveRunBodySchema,
  responseSchema: approvalActionResponseSchema,
  summary: 'Approve workflow run',
  description: 'Approves a suspended workflow run and resumes execution with optional resume data',
  tags: ['Approvals'],
  handler: async ({ mastra, runId, resumeData, requestContext, tracingOptions }) => {
    try {
      if (!runId) {
        throw new HTTPException(400, { message: 'Run ID is required' });
      }

      const found = await findWorkflowByRunId({ mastra, runId });
      if (!found) {
        throw new HTTPException(404, { message: 'Workflow run not found' });
      }

      const { workflow, workflowName } = found;

      // Create a run instance and resume
      const run = await workflow.createRun({ runId });

      // Start the resume asynchronously
      run
        .resume({
          resumeData,
          requestContext,
          tracingOptions,
        })
        .catch(error => {
          mastra.getLogger().error(`Error resuming workflow run ${runId}`, error);
        });

      return {
        message: 'Workflow run approved and resumed',
        runId,
        action: 'approved',
      };
    } catch (error) {
      return handleError(error, 'Error approving workflow run');
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
  pathParamSchema: approvalPathParams,
  bodySchema: declineRunBodySchema,
  responseSchema: approvalActionResponseSchema,
  summary: 'Decline workflow run',
  description: 'Declines a suspended workflow run. The run remains in suspended state but marked as declined.',
  tags: ['Approvals'],
  handler: async ({ mastra, runId, reason }) => {
    try {
      if (!runId) {
        throw new HTTPException(400, { message: 'Run ID is required' });
      }

      const found = await findWorkflowByRunId({ mastra, runId });
      if (!found) {
        throw new HTTPException(404, { message: 'Workflow run not found' });
      }

      // For declining, we don't resume the workflow
      // The workflow remains suspended but is marked as declined in the approval system
      // In a production system, you might want to store approval state separately
      // For now, we return a success message

      // TODO: Store decline reason in a separate approval tracking table
      // For now, we just log it
      mastra.getLogger().info(`Workflow run ${runId} declined. Reason: ${reason || 'No reason provided'}`);

      return {
        message: reason ? `Workflow run declined: ${reason}` : 'Workflow run declined',
        runId,
        action: 'declined',
      };
    } catch (error) {
      return handleError(error, 'Error declining workflow run');
    }
  },
});

/**
 * GET /api/approvals/:runId
 * Get details for a specific approval request
 */
export const GET_APPROVAL_DETAILS_ROUTE = createRoute({
  method: 'GET',
  path: '/api/approvals/:runId',
  responseType: 'json',
  pathParamSchema: approvalPathParams,
  responseSchema: approvalDetailsResponseSchema,
  summary: 'Get approval details',
  description: 'Returns detailed information about a specific approval request including timeline',
  tags: ['Approvals'],
  handler: async ({ mastra, runId }) => {
    try {
      if (!runId) {
        throw new HTTPException(400, { message: 'Run ID is required' });
      }

      const found = await findWorkflowByRunId({ mastra, runId });
      if (!found) {
        throw new HTTPException(404, { message: 'Workflow run not found' });
      }

      const { workflow, workflowName, run } = found;
      const snapshot = typeof run.snapshot === 'string' ? JSON.parse(run.snapshot) : run.snapshot;

      // Find the suspended step
      const suspendedStep =
        snapshot &&
        typeof snapshot === 'object' &&
        'steps' in snapshot &&
        Object.values(snapshot.steps as Record<string, unknown>).find(
          (step: unknown) =>
            step &&
            typeof step === 'object' &&
            'status' in step &&
            (step as { status: string }).status === 'suspended',
        );

      const suspendPayload =
        suspendedStep && typeof suspendedStep === 'object' && 'suspendPayload' in suspendedStep
          ? (suspendedStep as { suspendPayload: unknown }).suspendPayload
          : undefined;

      const suspendReason =
        suspendPayload &&
        typeof suspendPayload === 'object' &&
        'reason' in suspendPayload &&
        typeof (suspendPayload as { reason?: string }).reason === 'string'
          ? (suspendPayload as { reason?: string }).reason
          : undefined;

      // Build timeline from snapshot
      const timeline = [
        {
          timestamp: run.createdAt,
          type: 'created' as const,
          message: 'Workflow run created',
        },
        {
          timestamp: run.updatedAt,
          type: 'suspended' as const,
          message: 'Workflow suspended awaiting approval',
          details: suspendReason ? { reason: suspendReason } : undefined,
        },
      ];

      return {
        runId: run.runId,
        workflowId: workflowName,
        workflowName: workflow?.name || workflowName,
        suspendedAt: run.updatedAt,
        suspendReason,
        stepId:
          suspendedStep && typeof suspendedStep === 'object' && 'id' in suspendedStep
            ? (suspendedStep as { id: string }).id
            : undefined,
        resourceName: run.resourceId,
        status: 'pending' as const,
        createdAt: run.createdAt,
        updatedAt: run.updatedAt,
        suspendPayload,
        timeline,
      };
    } catch (error) {
      return handleError(error, 'Error getting approval details');
    }
  },
});
