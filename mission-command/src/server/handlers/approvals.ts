/**
 * Mission Command Approvals API Handler
 *
 * Provides endpoints for managing suspended workflow runs requiring approval.
 *
 * Endpoints:
 * - GET /api/approvals - List all suspended workflow runs with filters
 * - GET /api/approvals/:runId - Get approval details for a specific run
 * - POST /api/approvals/:runId/approve - Approve a suspended workflow run
 * - POST /api/approvals/:runId/decline - Decline a suspended workflow run
 *
 * Phase 3 Implementation
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { requireRole } from '@mastra/auth';
import { requireAuth } from '../jwt-middleware';
import type { MissionCommandUser } from '@mastra/auth';
import type { AuditService } from '../../auth/audit-service';
import type { SuspendedRunsStorage } from '../suspended-runs-storage';

/**
 * Suspend data structure from workflow suspension
 */
export interface SuspendData {
  reason: string;
  prUrl?: string;
  prNumber?: number;
  [key: string]: any;
}

/**
 * Approval status
 */
export type ApprovalStatus = 'pending' | 'approved' | 'declined';

/**
 * Approval entry in list response
 */
export interface ApprovalEntry {
  runId: string;
  workflowId: string;
  workflowName: string;
  suspendedAt: string;
  suspendData: SuspendData;
  status: ApprovalStatus;
  priority?: 'low' | 'normal' | 'high';
  owner?: string;
  repo?: string;
  prNumber?: number;
}

/**
 * Approval details response
 */
export interface ApprovalDetails extends ApprovalEntry {
  history: ApprovalHistoryEntry[];
}

/**
 * Approval history entry
 */
export interface ApprovalHistoryEntry {
  action: 'suspended' | 'approved' | 'declined';
  timestamp: string;
  user?: string;
  details?: string;
}

/**
 * Approvals API options
 */
export interface ApprovalsAPIOptions {
  /** Suspended runs storage instance */
  suspendedRunsStorage: SuspendedRunsStorage;
  /** Audit service instance */
  auditService?: AuditService;
  /** Optional: Custom workflow resume function */
  resumeWorkflow?: (params: {
    runId: string;
    resumeData: {
      approved: boolean;
      feedback?: string;
      prNumber?: number;
      prUrl?: string;
    };
  }) => Promise<void>;
}

/**
 * Query parameters for listing approvals
 */
const listApprovalsQuerySchema = z.object({
  workflowId: z.string().optional(),
  status: z.enum(['pending', 'approved', 'declined']).optional(),
  owner: z.string().optional(),
  repo: z.string().optional(),
  limit: z.string().optional().transform(val => val ? parseInt(val) : 50),
  offset: z.string().optional().transform(val => val ? parseInt(val) : 0),
});

/**
 * Request body for approve endpoint
 */
const approveBodySchema = z.object({
  feedback: z.string().optional(),
});

/**
 * Request body for decline endpoint
 */
const declineBodySchema = z.object({
  feedback: z.string().min(1, 'Feedback is required for decline'),
});

/**
 * Create approvals API handler
 */
export function createApprovalsAPI(options: ApprovalsAPIOptions) {
  const app = new Hono();
  const { suspendedRunsStorage, auditService, resumeWorkflow } = options;

  // Apply JWT authentication middleware to all routes
  app.use('/api/approvals/*', requireAuth());

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
   * Route: List all suspended workflow runs
   * GET /api/approvals
   * Requires: viewer role
   *
   * Query params:
   * - workflowId: Filter by workflow ID
   * - status: Filter by status (pending, approved, declined)
   * - owner: Filter by repository owner
   * - repo: Filter by repository name
   * - limit: Maximum number of entries (default: 50)
   * - offset: Offset for pagination (default: 0)
   */
  app.get('/api/approvals', requireRole('viewer'), async (c) => {
    try {
      const user = getCurrentUser(c);

      // Parse query parameters
      const query = listApprovalsQuerySchema.safeParse(c.req.query());

      if (!query.success) {
        return c.json(
          { error: 'Invalid query parameters', details: query.error.flatten() },
          400
        );
      }

      const { workflowId, status, owner, repo, limit, offset } = query.data;

      // Get all suspended runs from storage
      const allRuns = await suspendedRunsStorage.listSuspendedRuns();

      // Filter runs based on query parameters
      let filteredRuns = allRuns;

      if (owner && repo) {
        // If owner/repo specified, we need to filter by these
        filteredRuns = filteredRuns.filter(
          run => run.owner === owner && run.repo === repo
        );
      } else if (owner) {
        filteredRuns = filteredRuns.filter(run => run.owner === owner);
      } else if (repo) {
        filteredRuns = filteredRuns.filter(run => run.repo === repo);
      }

      // Apply pagination
      const paginatedRuns = filteredRuns.slice(offset, offset + limit);

      // Transform to approval entries
      // Note: Since SuspendedRun doesn't have all fields we need, we use available data
      const approvals: ApprovalEntry[] = paginatedRuns.map(run => ({
        runId: run.runId,
        workflowId: 'unknown', // Not stored in SuspendedRun, would need to query workflow storage
        workflowName: 'Unknown Workflow',
        suspendedAt: run.createdAt.toISOString(),
        suspendData: {
          reason: 'PR approval required',
          prUrl: run.prUrl,
          prNumber: run.prNumber,
        },
        status: 'pending' as ApprovalStatus, // All suspended runs are pending
        priority: 'normal',
        owner: run.owner,
        repo: run.repo,
        prNumber: run.prNumber,
      }));

      // Log audit event for viewing approvals
      if (auditService) {
        await auditService.logAuthEvent({
          userId: user.sub,
          action: 'auth.resource.access',
          resource: 'approvals',
          details: {
            userEmail: user.email,
            userRole: user.role,
            count: approvals.length,
          },
          ipAddress: extractIpAddress(c),
          userAgent: extractUserAgent(c),
          success: true,
        });
      }

      return c.json({
        approvals,
        total: filteredRuns.length,
        limit,
        offset,
      });
    } catch (error) {
      console.error('Failed to list approvals:', error);
      return c.json(
        {
          error: 'Failed to list approvals',
          message: error instanceof Error ? error.message : String(error),
        },
        500
      );
    }
  });

  /**
   * Route: Get approval details for a specific run
   * GET /api/approvals/:runId
   * Requires: viewer role
   *
   * Returns detailed information about a suspended workflow run including history.
   */
  app.get('/api/approvals/:runId', requireRole('viewer'), async (c) => {
    try {
      const user = getCurrentUser(c);
      const runId = c.req.param('runId');

      // Find suspended run by run ID
      const suspendedRun = await suspendedRunsStorage.findSuspendedRunByRunId(runId);

      if (!suspendedRun) {
        return c.json(
          {
            error: 'Not Found',
            message: `Workflow run '${runId}' not found or not suspended`,
            code: 'RUN_NOT_FOUND',
          },
          404
        );
      }

      // Build approval details
      const approval: ApprovalDetails = {
        runId: suspendedRun.runId,
        workflowId: 'unknown', // Not stored in SuspendedRun
        workflowName: 'Unknown Workflow',
        suspendedAt: suspendedRun.createdAt.toISOString(),
        suspendData: {
          reason: 'PR approval required',
          prUrl: suspendedRun.prUrl,
          prNumber: suspendedRun.prNumber,
        },
        status: 'pending' as ApprovalStatus,
        priority: 'normal',
        owner: suspendedRun.owner,
        repo: suspendedRun.repo,
        prNumber: suspendedRun.prNumber,
        history: [
          {
            action: 'suspended',
            timestamp: suspendedRun.createdAt.toISOString(),
            user: 'system',
            details: `Workflow suspended awaiting PR approval for ${suspendedRun.owner}/${suspendedRun.repo}#${suspendedRun.prNumber}`,
          },
        ],
      };

      // Log audit event for viewing approval details
      if (auditService) {
        await auditService.logAuthEvent({
          userId: user.sub,
          action: 'auth.resource.access',
          resource: 'approval',
          resourceId: runId,
          details: {
            userEmail: user.email,
            userRole: user.role,
          },
          ipAddress: extractIpAddress(c),
          userAgent: extractUserAgent(c),
          success: true,
        });
      }

      return c.json(approval);
    } catch (error) {
      console.error('Failed to get approval details:', error);
      return c.json(
        {
          error: 'Failed to get approval details',
          message: error instanceof Error ? error.message : String(error),
        },
        500
      );
    }
  });

  /**
   * Route: Approve a suspended workflow run
   * POST /api/approvals/:runId/approve
   * Requires: operator role or higher
   *
   * Body:
   * - feedback: Optional approval feedback
   *
   * Resumes the workflow with approval status.
   */
  app.post('/api/approvals/:runId/approve', requireRole('operator'), async (c) => {
    try {
      const user = getCurrentUser(c);
      const runId = c.req.param('runId');

      // Parse request body
      const body = approveBodySchema.safeParse(await c.req.json());

      if (!body.success) {
        return c.json(
          { error: 'Invalid request body', details: body.error.flatten() },
          400
        );
      }

      const { feedback } = body.data;

      // Find suspended run by run ID
      const suspendedRun = await suspendedRunsStorage.findSuspendedRunByRunId(runId);

      if (!suspendedRun) {
        return c.json(
          {
            error: 'Not Found',
            message: `Workflow run '${runId}' not found or not suspended`,
            code: 'RUN_NOT_FOUND',
          },
          404
        );
      }

      // Resume workflow with approval
      if (resumeWorkflow) {
        await resumeWorkflow({
          runId: suspendedRun.runId,
          resumeData: {
            approved: true,
            feedback,
            prNumber: suspendedRun.prNumber,
            prUrl: suspendedRun.prUrl,
          },
        });
      } else {
        console.warn('No resumeWorkflow function provided, skipping workflow resume');
      }

      // Remove from suspended runs after successful approval
      await suspendedRunsStorage.removeSuspendedRun(
        suspendedRun.owner,
        suspendedRun.repo,
        suspendedRun.prNumber
      );

      // Log audit event for approval
      if (auditService) {
        await auditService.logWorkflowEvent({
          user,
          action: 'workflow.approved',
          workflowId: 'unknown', // Would need workflow storage to get actual ID
          runId: suspendedRun.runId,
          reason: feedback,
          ipAddress: extractIpAddress(c),
          userAgent: extractUserAgent(c),
        });
      }

      return c.json({
        runId: suspendedRun.runId,
        status: 'approved',
        approvedAt: new Date().toISOString(),
        message: feedback || 'Workflow resumed successfully',
      });
    } catch (error) {
      console.error('Failed to approve workflow run:', error);

      // Log failed approval attempt
      if (auditService) {
        const user = getCurrentUser(c);
        await auditService.logWorkflowEvent({
          user,
          action: 'workflow.failed',
          workflowId: 'unknown',
          runId: c.req.param('runId'),
          reason: error instanceof Error ? error.message : String(error),
          ipAddress: extractIpAddress(c),
          userAgent: extractUserAgent(c),
        });
      }

      return c.json(
        {
          error: 'Failed to approve workflow run',
          message: error instanceof Error ? error.message : String(error),
          code: 'WORKFLOW_RESUME_FAILED',
        },
        500
      );
    }
  });

  /**
   * Route: Decline a suspended workflow run
   * POST /api/approvals/:runId/decline
   * Requires: operator role or higher
   *
   * Body:
   * - feedback: Required decline reason
   *
   * Resumes the workflow with rejection status.
   */
  app.post('/api/approvals/:runId/decline', requireRole('operator'), async (c) => {
    try {
      const user = getCurrentUser(c);
      const runId = c.req.param('runId');

      // Parse request body
      const body = declineBodySchema.safeParse(await c.req.json());

      if (!body.success) {
        return c.json(
          { error: 'Invalid request body', details: body.error.flatten() },
          400
        );
      }

      const { feedback } = body.data;

      // Find suspended run by run ID
      const suspendedRun = await suspendedRunsStorage.findSuspendedRunByRunId(runId);

      if (!suspendedRun) {
        return c.json(
          {
            error: 'Not Found',
            message: `Workflow run '${runId}' not found or not suspended`,
            code: 'RUN_NOT_FOUND',
          },
          404
        );
      }

      // Resume workflow with rejection
      if (resumeWorkflow) {
        await resumeWorkflow({
          runId: suspendedRun.runId,
          resumeData: {
            approved: false,
            feedback,
            prNumber: suspendedRun.prNumber,
            prUrl: suspendedRun.prUrl,
          },
        });
      } else {
        console.warn('No resumeWorkflow function provided, skipping workflow resume');
      }

      // Remove from suspended runs after processing decline
      await suspendedRunsStorage.removeSuspendedRun(
        suspendedRun.owner,
        suspendedRun.repo,
        suspendedRun.prNumber
      );

      // Log audit event for decline
      if (auditService) {
        await auditService.logWorkflowEvent({
          user,
          action: 'workflow.declined',
          workflowId: 'unknown', // Would need workflow storage to get actual ID
          runId: suspendedRun.runId,
          reason: feedback,
          ipAddress: extractIpAddress(c),
          userAgent: extractUserAgent(c),
        });
      }

      return c.json({
        runId: suspendedRun.runId,
        status: 'declined',
        declinedAt: new Date().toISOString(),
        message: 'Workflow resumed with rejection',
      });
    } catch (error) {
      console.error('Failed to decline workflow run:', error);

      // Log failed decline attempt
      if (auditService) {
        const user = getCurrentUser(c);
        await auditService.logWorkflowEvent({
          user,
          action: 'workflow.failed',
          workflowId: 'unknown',
          runId: c.req.param('runId'),
          reason: error instanceof Error ? error.message : String(error),
          ipAddress: extractIpAddress(c),
          userAgent: extractUserAgent(c),
        });
      }

      return c.json(
        {
          error: 'Failed to decline workflow run',
          message: error instanceof Error ? error.message : String(error),
          code: 'WORKFLOW_RESUME_FAILED',
        },
        500
      );
    }
  });

  return app;
}
