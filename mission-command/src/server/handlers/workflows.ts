/**
 * Mission Command Centre - Workflows API Handler
 *
 * Provides endpoints for managing workflow definitions.
 *
 * Endpoints:
 * - GET /api/workflows/definitions - List all workflow definitions
 * - GET /api/workflows/definitions/:id - Get a specific workflow definition
 * - POST /api/workflows/definitions - Create a new workflow definition
 * - PUT /api/workflows/definitions/:id - Update a workflow definition
 * - DELETE /api/workflows/definitions/:id - Delete a workflow definition
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { requireRole } from '@mastra/auth';
import { requireAuth } from '../jwt-middleware';
import type { MissionCommandUser } from '@mastra/auth';

/**
 * Workflow step configuration
 */
export interface WorkflowStepConfig {
  id: string;
  name: string;
  type: 'execute' | 'branch' | 'parallel' | 'suspend';
  inputSchema: any;
  outputSchema: any;
  condition?: string;
}

/**
 * Workflow definition data structure
 */
export interface WorkflowDefinition {
  id: string;
  name: string;
  description?: string;
  inputSchema: any;
  outputSchema: any;
  steps: WorkflowStepConfig[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Workflows API options
 */
export interface WorkflowsAPIOptions {
  /** Custom storage implementation for workflow definitions */
  storage?: WorkflowDefinitionStorage;
}

/**
 * Storage interface for workflow definitions
 * Can be implemented with PostgreSQL, LibSQL, or in-memory storage
 */
export interface WorkflowDefinitionStorage {
  list(): Promise<WorkflowDefinition[]>;
  get(id: string): Promise<WorkflowDefinition | null>;
  create(definition: Omit<WorkflowDefinition, 'id' | 'createdAt' | 'updatedAt'>): Promise<WorkflowDefinition>;
  update(id: string, definition: Partial<Omit<WorkflowDefinition, 'id' | 'createdAt' | 'updatedAt'>>): Promise<WorkflowDefinition>;
  delete(id: string): Promise<boolean>;
}

/**
 * In-memory implementation of workflow definition storage
 * For production, replace with a database-backed implementation
 */
class InMemoryWorkflowStorage implements WorkflowDefinitionStorage {
  private workflows: Map<string, WorkflowDefinition> = new Map();

  async list(): Promise<WorkflowDefinition[]> {
    return Array.from(this.workflows.values());
  }

  async get(id: string): Promise<WorkflowDefinition | null> {
    return this.workflows.get(id) || null;
  }

  async create(definition: Omit<WorkflowDefinition, 'id' | 'createdAt' | 'updatedAt'>): Promise<WorkflowDefinition> {
    const id = this.generateId();
    const now = new Date().toISOString();
    const newWorkflow: WorkflowDefinition = {
      ...definition,
      id,
      createdAt: now,
      updatedAt: now,
    };
    this.workflows.set(id, newWorkflow);
    return newWorkflow;
  }

  async update(id: string, updates: Partial<Omit<WorkflowDefinition, 'id' | 'createdAt' | 'updatedAt'>>): Promise<WorkflowDefinition> {
    const existing = this.workflows.get(id);
    if (!existing) {
      throw new Error(`Workflow definition ${id} not found`);
    }
    const updated: WorkflowDefinition = {
      ...existing,
      ...updates,
      id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };
    this.workflows.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    return this.workflows.delete(id);
  }

  private generateId(): string {
    return `workflow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Validation schema for creating a workflow definition
 */
const createWorkflowSchema = z.object({
  name: z.string().min(1, 'Workflow name is required'),
  description: z.string().optional(),
  inputSchema: z.object({}).passthrough().optional().default({ type: 'object' }),
  outputSchema: z.object({}).passthrough().optional().default({ type: 'object' }),
  steps: z.array(z.object({
    id: z.string(),
    name: z.string(),
    type: z.enum(['execute', 'branch', 'parallel', 'suspend']),
    inputSchema: z.object({}).passthrough(),
    outputSchema: z.object({}).passthrough(),
    condition: z.string().optional(),
  })).min(1, 'At least one step is required'),
});

/**
 * Validation schema for updating a workflow definition
 */
const updateWorkflowSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  inputSchema: z.object({}).passthrough().optional(),
  outputSchema: z.object({}).passthrough().optional(),
  steps: z.array(z.object({
    id: z.string(),
    name: z.string(),
    type: z.enum(['execute', 'branch', 'parallel', 'suspend']),
    inputSchema: z.object({}).passthrough(),
    outputSchema: z.object({}).passthrough(),
    condition: z.string().optional(),
  })).optional(),
});

/**
 * Create workflows API handler
 */
export function createWorkflowsAPI(options?: WorkflowsAPIOptions) {
  const app = new Hono();
  const storage = options?.storage || new InMemoryWorkflowStorage();

  // Apply JWT authentication middleware to all routes
  app.use('/api/workflows/definitions/*', requireAuth());

  /**
   * Helper: Extract user from context
   */
  function getCurrentUser(c: any): MissionCommandUser {
    return c.get('user') as MissionCommandUser;
  }

  /**
   * GET /api/workflows/definitions
   *
   * Lists all workflow definitions
   *
   * - Returns: Array of workflow definitions
   */
  app.get('/api/workflows/definitions', requireRole('viewer'), async (c) => {
    try {
      const definitions = await storage.list();
      return c.json({
        success: true,
        data: definitions,
      });
    } catch (error) {
      console.error('Error listing workflow definitions:', error);
      return c.json({
        success: false,
        error: 'Failed to list workflow definitions',
      }, 500);
    }
  });

  /**
   * GET /api/workflows/definitions/:id
   *
   * Gets a specific workflow definition
   *
   * - id: Workflow definition ID
   * - Returns: Workflow definition details
   */
  app.get('/api/workflows/definitions/:id', requireRole('viewer'), async (c) => {
    try {
      const id = c.req.param('id');
      const definition = await storage.get(id);

      if (!definition) {
        return c.json({
          success: false,
          error: 'Workflow definition not found',
        }, 404);
      }

      return c.json({
        success: true,
        data: definition,
      });
    } catch (error) {
      console.error('Error getting workflow definition:', error);
      return c.json({
        success: false,
        error: 'Failed to get workflow definition',
      }, 500);
    }
  });

  /**
   * POST /api/workflows/definitions
   *
   * Creates a new workflow definition
   *
   * Admin only
   *
   * Request body:
   * - name: Workflow name (required)
   * - description: Workflow description (optional)
   * - inputSchema: JSON Schema for workflow input
   * - outputSchema: JSON Schema for workflow output
   * - steps: Array of workflow step configurations
   *
   * - Returns: Created workflow definition
   */
  app.post('/api/workflows/definitions', requireRole('admin'), async (c) => {
    try {
      const user = getCurrentUser(c);
      const body = await c.req.json();

      // Validate request body
      const validatedData = createWorkflowSchema.safeParse(body);
      if (!validatedData.success) {
        return c.json({
          success: false,
          error: 'Invalid workflow definition',
          details: validatedData.error.errors,
        }, 400);
      }

      // Create workflow definition
      const definition = await storage.create({
        ...validatedData.data,
        createdBy: user.userId,
      });

      return c.json({
        success: true,
        data: definition,
      }, 201);
    } catch (error) {
      console.error('Error creating workflow definition:', error);
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create workflow definition',
      }, 500);
    }
  });

  /**
   * PUT /api/workflows/definitions/:id
   *
   * Updates an existing workflow definition
   *
   * Admin only
   *
   * - id: Workflow definition ID
   * - Returns: Updated workflow definition
   */
  app.put('/api/workflows/definitions/:id', requireRole('admin'), async (c) => {
    try {
      const id = c.req.param('id');
      const body = await c.req.json();

      // Validate request body
      const validatedData = updateWorkflowSchema.safeParse(body);
      if (!validatedData.success) {
        return c.json({
          success: false,
          error: 'Invalid workflow definition',
          details: validatedData.error.errors,
        }, 400);
      }

      // Update workflow definition
      const definition = await storage.update(id, validatedData.data);

      return c.json({
        success: true,
        data: definition,
      });
    } catch (error) {
      console.error('Error updating workflow definition:', error);
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update workflow definition',
      }, error instanceof Error && error.message.includes('not found') ? 404 : 500);
    }
  });

  /**
   * DELETE /api/workflows/definitions/:id
   *
   * Deletes a workflow definition
   *
   * Admin only
   *
   * - id: Workflow definition ID
   * - Returns: Success message
   */
  app.delete('/api/workflows/definitions/:id', requireRole('admin'), async (c) => {
    try {
      const id = c.req.param('id');
      const deleted = await storage.delete(id);

      if (!deleted) {
        return c.json({
          success: false,
          error: 'Workflow definition not found',
        }, 404);
      }

      return c.json({
        success: true,
        message: 'Workflow definition deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting workflow definition:', error);
      return c.json({
        success: false,
        error: 'Failed to delete workflow definition',
      }, 500);
    }
  });

  return app;
}

export type { WorkflowDefinitionStorage, WorkflowDefinition, WorkflowStepConfig };
