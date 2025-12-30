/**
 * Persistent Storage for Suspended Workflow Runs
 *
 * PostgreSQL-backed storage for suspended workflow runs awaiting PR approval.
 * Supports server restart recovery and automatic cleanup.
 */

import type { IDatabase } from 'pg-promise';
import type { PgDomainConfig } from '../../../../stores/pg/src/storage/db';
import { PgDB } from '../../../../stores/pg/src/storage/db';

/**
 * Table name for suspended workflow runs
 */
const TABLE_SUSPENDED_RUNS = 'mastra_suspended_runs';

/**
 * Suspended workflow run data
 */
export interface SuspendedRun {
  id: string;
  runId: string;
  prNumber: number;
  prUrl: string;
  owner: string;
  repo: string;
  createdAt: Date;
  expiresAt: Date;
}

/**
 * Create table schema for suspended runs
 */
const SUSPENDED_RUNS_SCHEMA = {
  id: { type: 'uuid', primaryKey: true },
  runId: { type: 'text', nullable: false },
  prNumber: { type: 'integer', nullable: false },
  prUrl: { type: 'text', nullable: false },
  owner: { type: 'text', nullable: false },
  repo: { type: 'text', nullable: false },
  createdAt: { type: 'timestamp', nullable: false },
  expiresAt: { type: 'timestamp', nullable: false },
};

/**
 * Storage class for suspended workflow runs
 */
export class SuspendedRunsStorage extends PgDB {
  constructor(config: PgDomainConfig) {
    super(config);
  }

  /**
   * Initialize the suspended runs table
   */
  async init(): Promise<void> {
    await this.createTable({
      tableName: TABLE_SUSPENDED_RUNS as any,
      schema: SUSPENDED_RUNS_SCHEMA,
    });

    // Create indexes for efficient queries
    await this.createIndex({
      name: 'idx_suspended_runs_lookup',
      table: TABLE_SUSPENDED_RUNS as any,
      columns: ['owner', 'repo', 'prNumber'],
      unique: true,
    });

    await this.createIndex({
      name: 'idx_suspended_runs_expires_at',
      table: TABLE_SUSPENDED_RUNS as any,
      columns: ['expiresAt'],
    });

    await this.createIndex({
      name: 'idx_suspended_runs_run_id',
      table: TABLE_SUSPENDED_RUNS as any,
      columns: ['runId'],
    });
  }

  /**
   * Register a suspended workflow run
   */
  async registerSuspendedRun(params: {
    id: string;
    runId: string;
    prNumber: number;
    prUrl: string;
    owner: string;
    repo: string;
    ttlDays?: number;
  }): Promise<void> {
    const ttlDays = params.ttlDays || 7;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + ttlDays);

    await this.insert({
      tableName: TABLE_SUSPENDED_RUNS as any,
      record: {
        id: params.id,
        runId: params.runId,
        prNumber: params.prNumber,
        prUrl: params.prUrl,
        owner: params.owner,
        repo: params.repo,
        createdAt: new Date(),
        expiresAt,
      },
    });
  }

  /**
   * Find a suspended run by PR number
   */
  async findSuspendedRun(
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<SuspendedRun | null> {
    const result = await this.load<SuspendedRun>({
      tableName: TABLE_SUSPENDED_RUNS as any,
      keys: {
        owner,
        repo,
        prNumber: String(prNumber),
      },
    });

    return result;
  }

  /**
   * Find a suspended run by run ID
   */
  async findSuspendedRunByRunId(runId: string): Promise<SuspendedRun | null> {
    const schemaName = this.schemaName || 'public';
    const tableName = schemaName === 'public'
      ? `"${TABLE_SUSPENDED_RUNS}"`
      : `"${schemaName}"."${TABLE_SUSPENDED_RUNS}"`;

    const result = await this.client.oneOrNone<SuspendedRun>(
      `SELECT * FROM ${tableName} WHERE "runId" = $1 ORDER BY "createdAt" DESC LIMIT 1`,
      [runId]
    );

    return result || null;
  }

  /**
   * Remove a suspended run after resume
   */
  async removeSuspendedRun(owner: string, repo: string, prNumber: number): Promise<void> {
    const schemaName = this.schemaName || 'public';
    const tableName = schemaName === 'public'
      ? `"${TABLE_SUSPENDED_RUNS}"`
      : `"${schemaName}"."${TABLE_SUSPENDED_RUNS}"`;

    await this.client.none(
      `DELETE FROM ${tableName} WHERE "owner" = $1 AND "repo" = $2 AND "prNumber" = $3`,
      [owner, repo, prNumber]
    );
  }

  /**
   * List all suspended runs (for debugging/monitoring)
   */
  async listSuspendedRuns(): Promise<SuspendedRun[]> {
    const schemaName = this.schemaName || 'public';
    const tableName = schemaName === 'public'
      ? `"${TABLE_SUSPENDED_RUNS}"`
      : `"${schemaName}"."${TABLE_SUSPENDED_RUNS}"`;

    const results = await this.client.manyOrNone<SuspendedRun>(
      `SELECT * FROM ${tableName} ORDER BY "createdAt" DESC`
    );

    return results || [];
  }

  /**
   * Clean up expired runs
   */
  async cleanupExpiredRuns(): Promise<number> {
    const schemaName = this.schemaName || 'public';
    const tableName = schemaName === 'public'
      ? `"${TABLE_SUSPENDED_RUNS}"`
      : `"${schemaName}"."${TABLE_SUSPENDED_RUNS}"`;

    const result = await this.client.result(
      `DELETE FROM ${tableName} WHERE "expiresAt" < NOW()`
    );

    return result.rowCount || 0;
  }

  /**
   * Clean up all runs (for testing/admin)
   */
  async clearAllRuns(): Promise<void> {
    await this.clearTable({
      tableName: TABLE_SUSPENDED_RUNS as any,
    });
  }
}

/**
 * Create a suspended runs storage instance
 */
export function createSuspendedRunsStorage(config: {
  client?: IDatabase<{}>;
  connectionString?: string;
  schemaName?: string;
}): SuspendedRunsStorage {
  let pgConfig: PgDomainConfig;

  if (config.client) {
    pgConfig = {
      client: config.client,
      schemaName: config.schemaName,
    };
  } else {
    // If connectionString is provided, we need to create a pg-promise instance
    // This requires importing pgPromise dynamically
    const pgp = require('pg-promise')();
    const client = pgp(config.connectionString);

    pgConfig = {
      client,
      schemaName: config.schemaName,
    };
  }

  return new SuspendedRunsStorage(pgConfig);
}
