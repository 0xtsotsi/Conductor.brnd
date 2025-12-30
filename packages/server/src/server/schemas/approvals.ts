import z from 'zod';
import { createCombinedPaginationSchema, messageResponseSchema } from './common';

/**
 * Schema for approval request details
 * Represents a workflow run that is suspended and awaiting approval
 */
export const approvalRequestSchema = z.object({
  runId: z.string().describe('Unique identifier for the workflow run'),
  workflowId: z.string().describe('Identifier of the workflow'),
  workflowName: z.string().optional().describe('Human-readable name of the workflow'),
  suspendedAt: z.date().describe('When the workflow was suspended'),
  suspendedBy: z.string().optional().describe('Who or what suspended the workflow'),
  suspendReason: z.string().optional().describe('Reason provided for suspension'),
  stepId: z.string().optional().describe('The step that initiated suspension'),
  resourceName: z.string().optional().describe('Associated resource identifier'),
  inputData: z.unknown().optional().describe('Input data provided to the workflow'),
  suspendPayload: z.unknown().optional().describe('Payload provided when suspending'),
  status: z.enum(['pending', 'approved', 'declined']).describe('Current approval status'),
  createdAt: z.date().describe('When the workflow run was created'),
  updatedAt: z.date().describe('When the workflow run was last updated'),
});

/**
 * Schema for listing approval requests with pagination
 */
export const listApprovalsResponseSchema = z.object({
  approvals: z.array(approvalRequestSchema),
  total: z.number().describe('Total count of approval requests'),
});

/**
 * Query parameters for listing approval requests
 */
export const listApprovalsQuerySchema = createCombinedPaginationSchema().extend({
  status: z.enum(['pending', 'approved', 'declined']).optional().describe('Filter by approval status'),
  workflowId: z.string().optional().describe('Filter by workflow ID'),
  fromDate: z.coerce.date().optional().describe('Filter by suspension date (from)'),
  toDate: z.coerce.date().optional().describe('Filter by suspension date (to)'),
});

/**
 * Path parameters for approval-specific routes
 */
export const approvalPathParams = z.object({
  runId: z.string().describe('Unique identifier for the workflow run'),
});

/**
 * Schema for approving a workflow run
 */
export const approveRunBodySchema = z.object({
  resumeData: z.unknown().optional().describe('Data to pass when resuming the workflow'),
  requestContext: z.record(z.string(), z.unknown()).optional().describe('Additional request context'),
  tracingOptions: z
    .object({
      isEnabled: z.boolean().optional(),
      tracingId: z.string().optional(),
    })
    .optional()
    .describe('Tracing options for the resumed execution'),
});

/**
 * Schema for declining a workflow run
 */
export const declineRunBodySchema = z.object({
  reason: z.string().optional().describe('Reason for declining the approval'),
  requestContext: z.record(z.string(), z.unknown()).optional().describe('Additional request context'),
});

/**
 * Response schema for approve/decline operations
 */
export const approvalActionResponseSchema = messageResponseSchema.extend({
  runId: z.string().optional().describe('The workflow run ID that was acted upon'),
  action: z.enum(['approved', 'declined']).optional().describe('The action taken'),
});

/**
 * Response schema for getting approval details
 */
export const approvalDetailsResponseSchema = approvalRequestSchema.extend({
  timeline: z
    .array(
      z.object({
        timestamp: z.date(),
        type: z.enum(['created', 'suspended', 'approved', 'declined', 'resumed', 'failed']),
        message: z.string(),
        details: z.unknown().optional(),
      }),
    )
    .optional()
    .describe('Timeline of approval events'),
});
