/**
 * Mission Command Centre - Workflow Definition Storage
 *
 * PostgreSQL-based storage for workflow definitions.
 */

export type { WorkflowDefinition, WorkflowStepConfig, WorkflowDefinitionStorage } from './handlers/workflows';

import type { WorkflowDefinition, WorkflowDefinitionStorage } from './handlers/workflows';

/**
 * PostgreSQL-based workflow definition storage
 */
export class PgWorkflowStorage implements WorkflowDefinitionStorage {
  constructor(private db: any) {}

  async list(): Promise<WorkflowDefinition[]> {
    const result = await this.db.query(`
      SELECT * FROM workflow_definitions
      ORDER BY created_at DESC
    `);

    return result.rows.map(this.mapRowToDefinition);
  }

  async get(id: string): Promise<WorkflowDefinition | null> {
    const result = await this.db.query(
      'SELECT * FROM workflow_definitions WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToDefinition(result.rows[0]);
  }

  async create(definition: Omit<WorkflowDefinition, 'id' | 'createdAt' | 'updatedAt'>): Promise<WorkflowDefinition> {
    const id = this.generateId();
    const now = new Date().toISOString();

    const result = await this.db.query(
      `INSERT INTO workflow_definitions (id, name, description, input_schema, output_schema, steps, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        id,
        definition.name,
        definition.description || null,
        JSON.stringify(definition.inputSchema),
        JSON.stringify(definition.outputSchema),
        JSON.stringify(definition.steps),
        definition.createdBy,
        now,
        now,
      ]
    );

    return this.mapRowToDefinition(result.rows[0]);
  }

  async update(id: string, updates: Partial<Omit<WorkflowDefinition, 'id' | 'createdAt' | 'updatedAt'>>): Promise<WorkflowDefinition> {
    const existing = await this.get(id);
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

    const result = await this.db.query(
      `UPDATE workflow_definitions
       SET name = $1, description = $2, input_schema = $3, output_schema = $4, steps = $5, updated_at = $6
       WHERE id = $7
       RETURNING *`,
      [
        updated.name,
        updated.description || null,
        JSON.stringify(updated.inputSchema),
        JSON.stringify(updated.outputSchema),
        JSON.stringify(updated.steps),
        updated.updatedAt,
        id,
      ]
    );

    return this.mapRowToDefinition(result.rows[0]);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.query(
      'DELETE FROM workflow_definitions WHERE id = $1',
      [id]
    );

    return (result.rowCount ?? 0) > 0;
  }

  private mapRowToDefinition(row: any): WorkflowDefinition {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      inputSchema: typeof row.input_schema === 'string' ? JSON.parse(row.input_schema) : row.input_schema,
      outputSchema: typeof row.output_schema === 'string' ? JSON.parse(row.output_schema) : row.output_schema,
      steps: typeof row.steps === 'string' ? JSON.parse(row.steps) : row.steps,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private generateId(): string {
    return `workflow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * SQL to create the workflow_definitions table
 */
export const CREATE_WORKFLOW_DEFINITIONS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS workflow_definitions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  input_schema JSONB NOT NULL DEFAULT '{"type":"object"}',
  output_schema JSONB NOT NULL DEFAULT '{"type":"object"}',
  steps JSONB NOT NULL DEFAULT '[]',
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workflow_definitions_created_by ON workflow_definitions(created_by);
CREATE INDEX IF NOT EXISTS idx_workflow_definitions_created_at ON workflow_definitions(created_at DESC);
`;

/**
 * Run the workflow definitions table migration
 */
export async function runWorkflowDefinitionsMigration(db: any): Promise<void> {
  await db.query(CREATE_WORKFLOW_DEFINITIONS_TABLE_SQL);
}
