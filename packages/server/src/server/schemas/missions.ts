import z from 'zod';
import { createCombinedPaginationSchema } from './common';

/**
 * Schema for workflow run status
 */
export const missionRunStatusSchema = z.enum([
  'running',
  'waiting',
  'suspended',
  'success',
  'failed',
  'canceled',
  'pending',
  'bailed',
  'tripwire',
  'paused',
]);

/**
 * Schema for a mission run (workflow run)
 * Represents an active or recent workflow execution
 */
export const missionRunSchema = z.object({
  runId: z.string().describe('Unique identifier for the mission run'),
  workflowId: z.string().describe('Identifier of the workflow'),
  workflowName: z.string().optional().describe('Human-readable name of the workflow'),
  status: missionRunStatusSchema.describe('Current execution status'),
  resourceName: z.string().optional().describe('Associated resource identifier'),
  createdAt: z.date().describe('When the mission run was created'),
  updatedAt: z.date().describe('When the mission run was last updated'),
  startedAt: z.date().optional().describe('When execution started'),
  completedAt: z.date().optional().describe('When execution completed (if finished)'),
  suspendedAt: z.date().optional().describe('When the mission was suspended (if applicable)'),
  suspendReason: z.string().optional().describe('Reason for suspension'),
  error: z.string().optional().describe('Error message if failed'),
  currentStep: z.string().optional().describe('Currently executing step'),
  stepCount: z.number().optional().describe('Total number of steps'),
  completedSteps: z.number().optional().describe('Number of completed steps'),
  inputSummary: z.unknown().optional().describe('Summary of input data'),
  result: z.unknown().optional().describe('Final result (if completed)'),
});

/**
 * Schema for listing mission runs with pagination
 */
export const listMissionsResponseSchema = z.object({
  missions: z.array(missionRunSchema),
  total: z.number().describe('Total count of mission runs'),
});

/**
 * Query parameters for listing active missions
 * Active missions are those with status: running, waiting, suspended, paused
 */
export const listActiveMissionsQuerySchema = createCombinedPaginationSchema().extend({
  workflowId: z.string().optional().describe('Filter by workflow ID'),
  status: z
    .enum(['running', 'waiting', 'suspended', 'paused'])
    .optional()
    .describe('Filter by specific status'),
  resourceName: z.string().optional().describe('Filter by resource name'),
});

/**
 * Query parameters for listing recent missions
 * Recent missions are ordered by most recently updated
 */
export const listRecentMissionsQuerySchema = createCombinedPaginationSchema().extend({
  workflowId: z.string().optional().describe('Filter by workflow ID'),
  status: missionRunStatusSchema.optional().describe('Filter by status'),
  resourceName: z.string().optional().describe('Filter by resource name'),
  hours: z.coerce
    .number()
    .optional()
    .describe('Number of hours to look back (default: 24)'),
});

/**
 * Path parameters for mission-specific routes
 */
export const missionPathParams = z.object({
  runId: z.string().describe('Unique identifier for the mission run'),
});

/**
 * Schema for a timeline event
 */
export const timelineEventSchema = z.object({
  timestamp: z.date().describe('When the event occurred'),
  type: z
    .enum([
      'created',
      'started',
      'step_started',
      'step_completed',
      'step_failed',
      'suspended',
      'resumed',
      'completed',
      'failed',
      'canceled',
      'paused',
    ])
    .describe('Type of event'),
  stepId: z.string().optional().describe('Associated step ID'),
  message: z.string().describe('Human-readable event description'),
  details: z.unknown().optional().describe('Additional event details'),
  duration: z.number().optional().describe('Event duration in milliseconds'),
});

/**
 * Schema for mission timeline response
 */
export const missionTimelineResponseSchema = z.object({
  runId: z.string().describe('Mission run identifier'),
  workflowId: z.string().describe('Workflow identifier'),
  status: missionRunStatusSchema.describe('Current status'),
  timeline: z.array(timelineEventSchema).describe('Chronological list of events'),
  summary: z
    .object({
      totalEvents: z.number(),
      duration: z.number().optional().describe('Total duration in milliseconds'),
      stepCounts: z.record(z.string(), z.number()).describe('Count of events by step'),
    })
    .describe('Summary statistics'),
});

/**
 * Query parameters for mission timeline
 */
export const missionTimelineQuerySchema = z.object({
  includeSteps: z
    .string()
    .optional()
    .describe('Comma-separated list of step IDs to include'),
  excludeSteps: z
    .string()
    .optional()
    .describe('Comma-separated list of step IDs to exclude'),
  eventType: z
    .string()
    .optional()
    .describe('Comma-separated list of event types to filter by'),
});
