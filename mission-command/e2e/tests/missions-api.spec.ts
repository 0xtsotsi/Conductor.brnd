/**
 * Missions API E2E Tests
 *
 * Comprehensive test suite for the Missions API endpoints (Phase 3).
 * Tests all mission monitoring operations, RBAC permissions,
 * filtering, pagination, and execution timeline retrieval.
 *
 * @packageDocumentation
 */

import { test, expect } from '../helpers';
import { randomBytes } from 'crypto';

/**
 * Helper function to generate a test run ID
 */
function generateRunId(): string {
  return `run-${randomBytes(16).toString('hex')}`;
}

/**
 * Helper function to create a test workflow run in the database
 */
async function createTestWorkflowRun(
  pool: any,
  overrides?: {
    runId?: string;
    workflowName?: string;
    status?: 'running' | 'completed' | 'failed';
    createdAt?: Date;
    updatedAt?: Date;
  }
): Promise<string> {
  const runId = overrides?.runId || generateRunId();
  const workflowName = overrides?.workflowName || 'test-workflow';
  const status = overrides?.status || 'running';
  const now = overrides?.createdAt || new Date();
  const updatedAt = overrides?.updatedAt || now;

  // Insert workflow run
  await pool.query(
    `INSERT INTO mastra_workflow_runs ("runId", "workflowName", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4)
     ON CONFLICT ("runId") DO UPDATE SET
       "workflowName" = EXCLUDED."workflowName",
       "updatedAt" = EXCLUDED."updatedAt"`,
    [runId, workflowName, now, updatedAt]
  );

  // Create a basic snapshot with status
  const snapshot = {
    status,
    inputData: { test: 'data' },
    context: {
      step1: {
        status: status === 'running' ? 'success' : status,
        startedAt: now.toISOString(),
        endedAt: status === 'running' ? null : now.toISOString(),
      },
    },
  };

  await pool.query(
    `UPDATE mastra_workflow_runs SET snapshot = $1::jsonb WHERE "runId" = $2`,
    [JSON.stringify(snapshot), runId]
  );

  return runId;
}

/**
 * Helper function to clean up test workflow runs
 */
async function cleanupTestWorkflowRuns(pool: any, runIds: string[]): Promise<void> {
  await pool.query(`DELETE FROM mastra_workflow_runs WHERE "runId" = ANY($1::text[])`, [runIds]);
}

test.describe('Missions API - List Active Missions (GET /api/missions/active)', () => {
  test('should allow admin to list active missions', async ({ apiClient, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();
    const adminToken = await apiClient.loginAs('admin');

    // Create test workflow runs
    const runId1 = await createTestWorkflowRun(pool, { status: 'running' });
    const runId2 = await createTestWorkflowRun(pool, { status: 'running' });

    const response = await apiClient.authenticatedRequest(
      'GET',
      '/api/missions/active',
      undefined,
      adminToken
    );

    expect(response.status).toBe(200);
    expect(response.success).toBe(true);
    expect(response.data).toHaveProperty('runs');
    expect(response.data).toHaveProperty('total');
    expect(response.data).toHaveProperty('limit');
    expect(response.data).toHaveProperty('offset');
    expect(Array.isArray(response.data.runs)).toBe(true);

    // Cleanup
    await cleanupTestWorkflowRuns(pool, [runId1, runId2]);
  });

  test('should allow operator to list active missions', async ({ apiClient, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();
    const operatorToken = await apiClient.loginAs('operator');

    const runId = await createTestWorkflowRun(pool, { status: 'running' });

    const response = await apiClient.authenticatedRequest(
      'GET',
      '/api/missions/active',
      undefined,
      operatorToken
    );

    expect(response.status).toBe(200);
    expect(response.success).toBe(true);
    expect(Array.isArray(response.data.runs)).toBe(true);

    // Cleanup
    await cleanupTestWorkflowRuns(pool, [runId]);
  });

  test('should allow viewer to list active missions', async ({ apiClient, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();
    const viewerToken = await apiClient.loginAs('viewer');

    const runId = await createTestWorkflowRun(pool, { status: 'running' });

    const response = await apiClient.authenticatedRequest(
      'GET',
      '/api/missions/active',
      undefined,
      viewerToken
    );

    expect(response.status).toBe(200);
    expect(response.success).toBe(true);
    expect(Array.isArray(response.data.runs)).toBe(true);

    // Cleanup
    await cleanupTestWorkflowRuns(pool, [runId]);
  });

  test('should deny unauthenticated requests (401)', async ({ apiClient }) => {
    const response = await apiClient.authenticatedRequest('GET', '/api/missions/active');

    expect(response.status).toBe(401);
    expect(response.success).toBe(false);
  });

  test('should filter by workflowId', async ({ apiClient, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();
    const adminToken = await apiClient.loginAs('admin');

    // Create runs with different workflow names
    const runId1 = await createTestWorkflowRun(pool, {
      workflowName: 'deploy-production',
      status: 'running',
    });
    const runId2 = await createTestWorkflowRun(pool, {
      workflowName: 'deploy-staging',
      status: 'running',
    });

    const response = await apiClient.authenticatedRequest(
      'GET',
      '/api/missions/active?workflowId=deploy-production',
      undefined,
      adminToken
    );

    expect(response.status).toBe(200);
    expect(response.data.runs.every((r: any) => r.workflowId === 'deploy-production')).toBe(true);

    // Cleanup
    await cleanupTestWorkflowRuns(pool, [runId1, runId2]);
  });

  test('should support pagination', async ({ apiClient, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();
    const adminToken = await apiClient.loginAs('admin');

    // Create multiple active runs
    const runIds: string[] = [];
    for (let i = 0; i < 5; i++) {
      runIds.push(await createTestWorkflowRun(pool, { status: 'running' }));
    }

    // First page
    const page1 = await apiClient.authenticatedRequest(
      'GET',
      '/api/missions/active?limit=2&offset=0',
      undefined,
      adminToken
    );
    expect(page1.status).toBe(200);
    expect(page1.data.runs.length).toBeLessThanOrEqual(2);
    expect(page1.data.limit).toBe(2);
    expect(page1.data.offset).toBe(0);

    // Second page
    const page2 = await apiClient.authenticatedRequest(
      'GET',
      '/api/missions/active?limit=2&offset=2',
      undefined,
      adminToken
    );
    expect(page2.status).toBe(200);
    expect(page2.data.runs.length).toBeLessThanOrEqual(2);
    expect(page2.data.offset).toBe(2);

    // Cleanup
    await cleanupTestWorkflowRuns(pool, runIds);
  });

  test('should return correct mission run fields', async ({ apiClient, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();
    const adminToken = await apiClient.loginAs('admin');

    const runId = await createTestWorkflowRun(pool, {
      workflowName: 'test-mission',
      status: 'running',
    });

    const response = await apiClient.authenticatedRequest(
      'GET',
      '/api/missions/active',
      undefined,
      adminToken
    );

    expect(response.status).toBe(200);
    const run = response.data.runs.find((r: any) => r.runId === runId);
    expect(run).toBeDefined();
    expect(run).toHaveProperty('runId', runId);
    expect(run).toHaveProperty('workflowId');
    expect(run).toHaveProperty('workflowName');
    expect(run).toHaveProperty('status', 'running');
    expect(run).toHaveProperty('startedAt');
    expect(run).toHaveProperty('currentStep');
    expect(run).toHaveProperty('progress');
    expect(run).toHaveProperty('duration');
    expect(run).toHaveProperty('inputData');

    // Cleanup
    await cleanupTestWorkflowRuns(pool, [runId]);
  });

  test('should only return running missions', async ({ apiClient, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();
    const adminToken = await apiClient.loginAs('admin');

    // Create runs with different statuses
    const runningRunId = await createTestWorkflowRun(pool, { status: 'running' });
    const completedRunId = await createTestWorkflowRun(pool, { status: 'completed' });
    const failedRunId = await createTestWorkflowRun(pool, { status: 'failed' });

    const response = await apiClient.authenticatedRequest(
      'GET',
      '/api/missions/active',
      undefined,
      adminToken
    );

    expect(response.status).toBe(200);
    expect(response.data.runs.every((r: any) => r.status === 'running')).toBe(true);

    // Cleanup
    await cleanupTestWorkflowRuns(pool, [runningRunId, completedRunId, failedRunId]);
  });

  test('should return empty list when no active missions exist', async ({ apiClient, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();
    const adminToken = await apiClient.loginAs('admin');

    // Make sure there are no running workflows
    await pool.query(`DELETE FROM mastra_workflow_runs WHERE snapshot->>'status' = 'running'`);

    const response = await apiClient.authenticatedRequest(
      'GET',
      '/api/missions/active',
      undefined,
      adminToken
    );

    expect(response.status).toBe(200);
    expect(response.data.runs).toEqual([]);
    expect(response.data.total).toBe(0);
  });
});

test.describe('Missions API - List Recent Missions (GET /api/missions/recent)', () => {
  test('should allow admin to list recent missions', async ({ apiClient, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();
    const adminToken = await apiClient.loginAs('admin');

    // Create test workflow runs
    const runId1 = await createTestWorkflowRun(pool, { status: 'completed' });
    const runId2 = await createTestWorkflowRun(pool, { status: 'failed' });

    const response = await apiClient.authenticatedRequest(
      'GET',
      '/api/missions/recent',
      undefined,
      adminToken
    );

    expect(response.status).toBe(200);
    expect(response.success).toBe(true);
    expect(response.data).toHaveProperty('runs');
    expect(response.data).toHaveProperty('total');
    expect(response.data).toHaveProperty('limit');
    expect(response.data).toHaveProperty('offset');
    expect(Array.isArray(response.data.runs)).toBe(true);

    // Cleanup
    await cleanupTestWorkflowRuns(pool, [runId1, runId2]);
  });

  test('should allow operator to list recent missions', async ({ apiClient, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();
    const operatorToken = await apiClient.loginAs('operator');

    const runId = await createTestWorkflowRun(pool, { status: 'completed' });

    const response = await apiClient.authenticatedRequest(
      'GET',
      '/api/missions/recent',
      undefined,
      operatorToken
    );

    expect(response.status).toBe(200);
    expect(response.success).toBe(true);
    expect(Array.isArray(response.data.runs)).toBe(true);

    // Cleanup
    await cleanupTestWorkflowRuns(pool, [runId]);
  });

  test('should allow viewer to list recent missions', async ({ apiClient, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();
    const viewerToken = await apiClient.loginAs('viewer');

    const runId = await createTestWorkflowRun(pool, { status: 'failed' });

    const response = await apiClient.authenticatedRequest(
      'GET',
      '/api/missions/recent',
      undefined,
      viewerToken
    );

    expect(response.status).toBe(200);
    expect(response.success).toBe(true);
    expect(Array.isArray(response.data.runs)).toBe(true);

    // Cleanup
    await cleanupTestWorkflowRuns(pool, [runId]);
  });

  test('should deny unauthenticated requests (401)', async ({ apiClient }) => {
    const response = await apiClient.authenticatedRequest('GET', '/api/missions/recent');

    expect(response.status).toBe(401);
    expect(response.success).toBe(false);
  });

  test('should filter by status - completed', async ({ apiClient, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();
    const adminToken = await apiClient.loginAs('admin');

    // Create runs with different statuses
    const completedRunId = await createTestWorkflowRun(pool, { status: 'completed' });
    const failedRunId = await createTestWorkflowRun(pool, { status: 'failed' });

    const response = await apiClient.authenticatedRequest(
      'GET',
      '/api/missions/recent?status=completed',
      undefined,
      adminToken
    );

    expect(response.status).toBe(200);
    expect(response.data.runs.every((r: any) => r.status === 'completed')).toBe(true);

    // Cleanup
    await cleanupTestWorkflowRuns(pool, [completedRunId, failedRunId]);
  });

  test('should filter by status - failed', async ({ apiClient, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();
    const adminToken = await apiClient.loginAs('admin');

    // Create runs with different statuses
    const completedRunId = await createTestWorkflowRun(pool, { status: 'completed' });
    const failedRunId = await createTestWorkflowRun(pool, { status: 'failed' });

    const response = await apiClient.authenticatedRequest(
      'GET',
      '/api/missions/recent?status=failed',
      undefined,
      adminToken
    );

    expect(response.status).toBe(200);
    expect(response.data.runs.every((r: any) => r.status === 'failed')).toBe(true);

    // Cleanup
    await cleanupTestWorkflowRuns(pool, [completedRunId, failedRunId]);
  });

  test('should filter by status - running', async ({ apiClient, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();
    const adminToken = await apiClient.loginAs('admin');

    // Create runs with different statuses
    const runningRunId = await createTestWorkflowRun(pool, { status: 'running' });
    const completedRunId = await createTestWorkflowRun(pool, { status: 'completed' });

    const response = await apiClient.authenticatedRequest(
      'GET',
      '/api/missions/recent?status=running',
      undefined,
      adminToken
    );

    expect(response.status).toBe(200);
    expect(response.data.runs.every((r: any) => r.status === 'running')).toBe(true);

    // Cleanup
    await cleanupTestWorkflowRuns(pool, [runningRunId, completedRunId]);
  });

  test('should support pagination', async ({ apiClient, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();
    const adminToken = await apiClient.loginAs('admin');

    // Create multiple runs
    const runIds: string[] = [];
    for (let i = 0; i < 5; i++) {
      runIds.push(await createTestWorkflowRun(pool, { status: 'completed' }));
    }

    // First page
    const page1 = await apiClient.authenticatedRequest(
      'GET',
      '/api/missions/recent?limit=2&offset=0',
      undefined,
      adminToken
    );
    expect(page1.status).toBe(200);
    expect(page1.data.runs.length).toBeLessThanOrEqual(2);
    expect(page1.data.limit).toBe(2);

    // Second page
    const page2 = await apiClient.authenticatedRequest(
      'GET',
      '/api/missions/recent?limit=2&offset=2',
      undefined,
      adminToken
    );
    expect(page2.status).toBe(200);
    expect(page2.data.runs.length).toBeLessThanOrEqual(2);
    expect(page2.data.offset).toBe(2);

    // Cleanup
    await cleanupTestWorkflowRuns(pool, runIds);
  });

  test('should return correct default limit (20)', async ({ apiClient, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();
    const adminToken = await apiClient.loginAs('admin');

    const response = await apiClient.authenticatedRequest(
      'GET',
      '/api/missions/recent',
      undefined,
      adminToken
    );

    expect(response.status).toBe(200);
    expect(response.data.limit).toBe(20);
  });

  test('should return completedAt for completed missions', async ({ apiClient, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();
    const adminToken = await apiClient.loginAs('admin');

    const runId = await createTestWorkflowRun(pool, { status: 'completed' });

    const response = await apiClient.authenticatedRequest(
      'GET',
      '/api/missions/recent?status=completed',
      undefined,
      adminToken
    );

    expect(response.status).toBe(200);
    const run = response.data.runs.find((r: any) => r.runId === runId);
    expect(run).toBeDefined();
    expect(run).toHaveProperty('completedAt');
    expect(run.completedAt).not.toBeNull();

    // Cleanup
    await cleanupTestWorkflowRuns(pool, [runId]);
  });

  test('should return outputData for successful missions', async ({ apiClient, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();
    const adminToken = await apiClient.loginAs('admin');

    const runId = await createTestWorkflowRun(pool, {
      status: 'completed',
    });

    const response = await apiClient.authenticatedRequest(
      'GET',
      '/api/missions/recent?status=completed',
      undefined,
      adminToken
    );

    expect(response.status).toBe(200);
    const run = response.data.runs.find((r: any) => r.runId === runId);
    expect(run).toBeDefined();
    expect(run).toHaveProperty('outputData');

    // Cleanup
    await cleanupTestWorkflowRuns(pool, [runId]);
  });
});

test.describe('Missions API - Get Mission Timeline (GET /api/missions/:runId/timeline)', () => {
  test('should allow admin to get mission timeline', async ({ apiClient, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();
    const adminToken = await apiClient.loginAs('admin');

    const runId = await createTestWorkflowRun(pool, { status: 'running' });

    const response = await apiClient.authenticatedRequest(
      'GET',
      `/api/missions/${runId}/timeline`,
      undefined,
      adminToken
    );

    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('runId', runId);
    expect(response.data).toHaveProperty('workflowId');
    expect(response.data).toHaveProperty('timeline');
    expect(Array.isArray(response.data.timeline)).toBe(true);

    // Cleanup
    await cleanupTestWorkflowRuns(pool, [runId]);
  });

  test('should allow operator to get mission timeline', async ({ apiClient, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();
    const operatorToken = await apiClient.loginAs('operator');

    const runId = await createTestWorkflowRun(pool, { status: 'running' });

    const response = await apiClient.authenticatedRequest(
      'GET',
      `/api/missions/${runId}/timeline`,
      undefined,
      operatorToken
    );

    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('runId', runId);
    expect(response.data).toHaveProperty('timeline');

    // Cleanup
    await cleanupTestWorkflowRuns(pool, [runId]);
  });

  test('should allow viewer to get mission timeline', async ({ apiClient, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();
    const viewerToken = await apiClient.loginAs('viewer');

    const runId = await createTestWorkflowRun(pool, { status: 'running' });

    const response = await apiClient.authenticatedRequest(
      'GET',
      `/api/missions/${runId}/timeline`,
      undefined,
      viewerToken
    );

    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('runId', runId);
    expect(response.data).toHaveProperty('timeline');

    // Cleanup
    await cleanupTestWorkflowRuns(pool, [runId]);
  });

  test('should deny unauthenticated requests (401)', async ({ apiClient, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();

    const runId = await createTestWorkflowRun(pool, { status: 'running' });

    const response = await apiClient.authenticatedRequest('GET', `/api/missions/${runId}/timeline`);

    expect(response.status).toBe(401);
    expect(response.success).toBe(false);

    // Cleanup
    await cleanupTestWorkflowRuns(pool, [runId]);
  });

  test('should return 404 for non-existent run', async ({ apiClient }) => {
    const adminToken = await apiClient.loginAs('admin');
    const fakeRunId = 'non-existent-run-id';

    const response = await apiClient.authenticatedRequest(
      'GET',
      `/api/missions/${fakeRunId}/timeline`,
      undefined,
      adminToken
    );

    expect(response.status).toBe(404);
    expect(response.success).toBe(false);
    expect(response.data).toHaveProperty('error', 'Not Found');
  });

  test('should include timeline steps with all required fields', async ({ apiClient, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();
    const adminToken = await apiClient.loginAs('admin');

    const runId = await createTestWorkflowRun(pool, { status: 'running' });

    const response = await apiClient.authenticatedRequest(
      'GET',
      `/api/missions/${runId}/timeline`,
      undefined,
      adminToken
    );

    expect(response.status).toBe(200);
    if (response.data.timeline.length > 0) {
      const step = response.data.timeline[0];
      expect(step).toHaveProperty('stepId');
      expect(step).toHaveProperty('stepName');
      expect(step).toHaveProperty('status');
      expect(step).toHaveProperty('startedAt');
    }

    // Cleanup
    await cleanupTestWorkflowRuns(pool, [runId]);
  });

  test('should include step output for successful steps', async ({ apiClient, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();
    const adminToken = await apiClient.loginAs('admin');

    const runId = await createTestWorkflowRun(pool, { status: 'completed' });

    const response = await apiClient.authenticatedRequest(
      'GET',
      `/api/missions/${runId}/timeline`,
      undefined,
      adminToken
    );

    expect(response.status).toBe(200);

    // Find a successful step
    const successfulStep = response.data.timeline.find((s: any) => s.status === 'success' || s.status === 'completed');
    if (successfulStep) {
      expect(successfulStep).toHaveProperty('output');
    }

    // Cleanup
    await cleanupTestWorkflowRuns(pool, [runId]);
  });

  test('should include step duration', async ({ apiClient, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();
    const adminToken = await apiClient.loginAs('admin');

    const runId = await createTestWorkflowRun(pool, { status: 'completed' });

    const response = await apiClient.authenticatedRequest(
      'GET',
      `/api/missions/${runId}/timeline`,
      undefined,
      adminToken
    );

    expect(response.status).toBe(200);

    if (response.data.timeline.length > 0) {
      const step = response.data.timeline[0];
      expect(step).toHaveProperty('duration');
      if (step.duration !== undefined) {
        expect(typeof step.duration).toBe('number');
      }
    }

    // Cleanup
    await cleanupTestWorkflowRuns(pool, [runId]);
  });

  test('should sort timeline steps by startedAt (most recent first)', async ({ apiClient, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();
    const adminToken = await apiClient.loginAs('admin');

    const runId = await createTestWorkflowRun(pool, { status: 'completed' });

    const response = await apiClient.authenticatedRequest(
      'GET',
      `/api/missions/${runId}/timeline`,
      undefined,
      adminToken
    );

    expect(response.status).toBe(200);

    if (response.data.timeline.length > 1) {
      const timeline = response.data.timeline;
      for (let i = 0; i < timeline.length - 1; i++) {
        if (timeline[i].startedAt && timeline[i + 1].startedAt) {
          const time1 = new Date(timeline[i].startedAt).getTime();
          const time2 = new Date(timeline[i + 1].startedAt).getTime();
          expect(time1).toBeGreaterThanOrEqual(time2);
        }
      }
    }

    // Cleanup
    await cleanupTestWorkflowRuns(pool, [runId]);
  });

  test('should include suspend data for suspended steps', async ({ apiClient, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();
    const adminToken = await apiClient.loginAs('admin');

    // Create a run with suspended step
    const runId = generateRunId();
    const now = new Date();

    await pool.query(
      `INSERT INTO mastra_workflow_runs ("runId", "workflowName", "createdAt", "updatedAt", snapshot)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        runId,
        'test-workflow',
        now,
        now,
        JSON.stringify({
          status: 'suspended',
          inputData: {},
          context: {
            suspendStep: {
              status: 'suspended',
              startedAt: now.toISOString(),
              suspendedAt: now.toISOString(),
              suspendPayload: { reason: 'awaiting approval' },
              suspendOutput: { prUrl: 'https://github.com/test/repo/pull/1' },
            },
          },
        }),
      ]
    );

    const response = await apiClient.authenticatedRequest(
      'GET',
      `/api/missions/${runId}/timeline`,
      undefined,
      adminToken
    );

    expect(response.status).toBe(200);

    const suspendedStep = response.data.timeline.find((s: any) => s.status === 'suspended');
    if (suspendedStep) {
      expect(suspendedStep).toHaveProperty('suspendData');
      expect(suspendedStep.suspendData).toHaveProperty('suspendPayload');
      expect(suspendedStep.suspendData).toHaveProperty('suspendOutput');
      expect(suspendedStep.suspendData).toHaveProperty('suspendedAt');
    }

    // Cleanup
    await cleanupTestWorkflowRuns(pool, [runId]);
  });

  test('should include error information for failed steps', async ({ apiClient, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();
    const adminToken = await apiClient.loginAs('admin');

    // Create a run with failed step
    const runId = generateRunId();
    const now = new Date();

    await pool.query(
      `INSERT INTO mastra_workflow_runs ("runId", "workflowName", "createdAt", "updatedAt", snapshot)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        runId,
        'test-workflow',
        now,
        now,
        JSON.stringify({
          status: 'failed',
          inputData: {},
          context: {
            failedStep: {
              status: 'failed',
              startedAt: now.toISOString(),
              endedAt: now.toISOString(),
              error: {
                message: 'Step execution failed',
                name: 'ExecutionError',
              },
            },
          },
        }),
      ]
    );

    const response = await apiClient.authenticatedRequest(
      'GET',
      `/api/missions/${runId}/timeline`,
      undefined,
      adminToken
    );

    expect(response.status).toBe(200);

    const failedStep = response.data.timeline.find((s: any) => s.status === 'failed');
    if (failedStep) {
      expect(failedStep).toHaveProperty('output');
      expect(failedStep.output).toHaveProperty('error');
      expect(failedStep.output.error).toHaveProperty('message');
      expect(failedStep.output.error).toHaveProperty('name');
    }

    // Cleanup
    await cleanupTestWorkflowRuns(pool, [runId]);
  });
});

test.describe('Missions API - Error Scenarios', () => {
  test('should handle invalid runId parameter', async ({ apiClient }) => {
    const adminToken = await apiClient.loginAs('admin');

    const response = await apiClient.authenticatedRequest(
      'GET',
      '/api/missions/run with spaces/timeline',
      undefined,
      adminToken
    );

    // Should either handle gracefully or return 404
    expect([200, 400, 404].includes(response.status)).toBe(true);
  });

  test('should handle invalid status filter', async ({ apiClient }) => {
    const adminToken = await apiClient.loginAs('admin');

    const response = await apiClient.authenticatedRequest(
      'GET',
      '/api/missions/recent?status=invalid_status',
      undefined,
      adminToken
    );

    // Should either handle gracefully or return validation error
    expect([200, 400].includes(response.status)).toBe(true);
  });

  test('should handle invalid limit parameter', async ({ apiClient }) => {
    const adminToken = await apiClient.loginAs('admin');

    const response = await apiClient.authenticatedRequest(
      'GET',
      '/api/missions/active?limit=invalid',
      undefined,
      adminToken
    );

    // Should either handle gracefully or return validation error
    expect([200, 400].includes(response.status)).toBe(true);
  });

  test('should handle invalid offset parameter', async ({ apiClient }) => {
    const adminToken = await apiClient.loginAs('admin');

    const response = await apiClient.authenticatedRequest(
      'GET',
      '/api/missions/recent?offset=invalid',
      undefined,
      adminToken
    );

    // Should either handle gracefully or return validation error
    expect([200, 400].includes(response.status)).toBe(true);
  });

  test('should return consistent error format', async ({ apiClient }) => {
    const adminToken = await apiClient.loginAs('admin');

    const response = await apiClient.authenticatedRequest(
      'GET',
      '/api/missions/non-existent-run/timeline',
      undefined,
      adminToken
    );

    if (response.status === 404) {
      expect(response.data).toHaveProperty('error');
      expect(response.data).toHaveProperty('message');
    }
  });

  test('should handle very large pagination offset', async ({ apiClient }) => {
    const adminToken = await apiClient.loginAs('admin');

    const response = await apiClient.authenticatedRequest(
      'GET',
      '/api/missions/active?offset=999999',
      undefined,
      adminToken
    );

    expect(response.status).toBe(200);
    expect(response.data.runs).toEqual([]);
  });

  test('should validate query parameters correctly', async ({ apiClient }) => {
    const adminToken = await apiClient.loginAs('admin');

    // Test multiple invalid parameters
    const response = await apiClient.authenticatedRequest(
      'GET',
      '/api/missions/active?limit=-1&offset=-5',
      undefined,
      adminToken
    );

    // Should either handle gracefully or return validation error
    expect([200, 400].includes(response.status)).toBe(true);
  });
});

test.describe('Missions API - Response Formatting', () => {
  test('should format dates in ISO 8601 format', async ({ apiClient, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();
    const adminToken = await apiClient.loginAs('admin');

    const runId = await createTestWorkflowRun(pool, { status: 'running' });

    const response = await apiClient.authenticatedRequest(
      'GET',
      '/api/missions/active',
      undefined,
      adminToken
    );

    expect(response.status).toBe(200);
    const run = response.data.runs.find((r: any) => r.runId === runId);
    expect(run).toBeDefined();
    expect(run.startedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);

    // Cleanup
    await cleanupTestWorkflowRuns(pool, [runId]);
  });

  test('should include progress percentage for running missions', async ({ apiClient, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();
    const adminToken = await apiClient.loginAs('admin');

    const runId = await createTestWorkflowRun(pool, { status: 'running' });

    const response = await apiClient.authenticatedRequest(
      'GET',
      '/api/missions/active',
      undefined,
      adminToken
    );

    expect(response.status).toBe(200);
    const run = response.data.runs.find((r: any) => r.runId === runId);
    expect(run).toBeDefined();
    expect(run).toHaveProperty('progress');

    // Cleanup
    await cleanupTestWorkflowRuns(pool, [runId]);
  });

  test('should calculate duration correctly', async ({ apiClient, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();
    const adminToken = await apiClient.loginAs('admin');

    const runId = await createTestWorkflowRun(pool, { status: 'completed' });

    const response = await apiClient.authenticatedRequest(
      'GET',
      '/api/missions/recent?status=completed',
      undefined,
      adminToken
    );

    expect(response.status).toBe(200);
    const run = response.data.runs.find((r: any) => r.runId === runId);
    expect(run).toBeDefined();
    expect(run).toHaveProperty('duration');

    // Cleanup
    await cleanupTestWorkflowRuns(pool, [runId]);
  });

  test('should include current step for running missions', async ({ apiClient, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();
    const adminToken = await apiClient.loginAs('admin');

    const runId = await createTestWorkflowRun(pool, { status: 'running' });

    const response = await apiClient.authenticatedRequest(
      'GET',
      '/api/missions/active',
      undefined,
      adminToken
    );

    expect(response.status).toBe(200);
    const run = response.data.runs.find((r: any) => r.runId === runId);
    expect(run).toBeDefined();
    expect(run).toHaveProperty('currentStep');

    // Cleanup
    await cleanupTestWorkflowRuns(pool, [runId]);
  });
});

test.describe('Missions API - Cleanup', () => {
  test.afterAll(async ({ dbHelper }) => {
    // Clean up any remaining test data
    const pool = await dbHelper.getTestDbConnection();
    await pool.query(`DELETE FROM mastra_workflow_runs WHERE "workflowName" LIKE 'test-%'`);
  });
});
