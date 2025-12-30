/**
 * Approvals API E2E Tests
 *
 * Comprehensive test suite for the Approvals API endpoints (Phase 3).
 * Tests all CRUD operations, RBAC permissions, filtering, pagination,
 * and error scenarios for suspended workflow run approvals.
 *
 * @packageDocumentation
 */

import { test, expect } from '../helpers';
import { randomBytes } from 'crypto';
import type { SuspendedRun } from '../../src/server/suspended-runs-storage';

/**
 * Helper function to generate a test run ID
 */
function generateRunId(): string {
  return `run-${randomBytes(16).toString('hex')}`;
}

/**
 * Helper function to generate test suspended run data
 */
function generateTestSuspendedRun(overrides?: Partial<SuspendedRun>): SuspendedRun {
  const id = randomBytes(16).toString('hex');
  const runId = generateRunId();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

  return {
    id,
    runId,
    prNumber: Math.floor(Math.random() * 1000) + 1,
    prUrl: `https://github.com/test-org/test-repo/pull/${Math.floor(Math.random() * 1000) + 1}`,
    owner: 'test-org',
    repo: 'test-repo',
    createdAt: now,
    expiresAt,
    ...overrides,
  };
}

test.describe('Approvals API - List Approvals (GET /api/approvals)', () => {
  test('should allow admin to list all approvals', async ({ apiClient, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();
    const adminToken = await apiClient.loginAs('admin');

    // Create test suspended runs
    const run1 = generateTestSuspendedRun({ owner: 'org1', repo: 'repo1' });
    const run2 = generateTestSuspendedRun({ owner: 'org2', repo: 'repo2' });

    // Insert directly into database
    await pool.query(
      `INSERT INTO mastra_suspended_runs (id, "runId", "prNumber", "prUrl", owner, repo, "createdAt", "expiresAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [run1.id, run1.runId, run1.prNumber, run1.prUrl, run1.owner, run1.repo, run1.createdAt, run1.expiresAt]
    );
    await pool.query(
      `INSERT INTO mastra_suspended_runs (id, "runId", "prNumber", "prUrl", owner, repo, "createdAt", "expiresAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [run2.id, run2.runId, run2.prNumber, run2.prUrl, run2.owner, run2.repo, run2.createdAt, run2.expiresAt]
    );

    const response = await apiClient.authenticatedRequest('GET', '/api/approvals', undefined, adminToken);

    expect(response.status).toBe(200);
    expect(response.success).toBe(true);
    expect(response.data).toHaveProperty('approvals');
    expect(response.data).toHaveProperty('total');
    expect(response.data).toHaveProperty('limit');
    expect(response.data).toHaveProperty('offset');
    expect(Array.isArray(response.data.approvals)).toBe(true);
    expect(response.data.approvals.length).toBeGreaterThan(0);

    // Cleanup
    await pool.query('DELETE FROM mastra_suspended_runs WHERE id = $1 OR id = $2', [run1.id, run2.id]);
  });

  test('should allow operator to list approvals', async ({ apiClient, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();
    const operatorToken = await apiClient.loginAs('operator');

    const run = generateTestSuspendedRun();
    await pool.query(
      `INSERT INTO mastra_suspended_runs (id, "runId", "prNumber", "prUrl", owner, repo, "createdAt", "expiresAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [run.id, run.runId, run.prNumber, run.prUrl, run.owner, run.repo, run.createdAt, run.expiresAt]
    );

    const response = await apiClient.authenticatedRequest('GET', '/api/approvals', undefined, operatorToken);

    expect(response.status).toBe(200);
    expect(response.success).toBe(true);
    expect(Array.isArray(response.data.approvals)).toBe(true);

    // Cleanup
    await pool.query('DELETE FROM mastra_suspended_runs WHERE id = $1', [run.id]);
  });

  test('should allow viewer to list approvals', async ({ apiClient, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();
    const viewerToken = await apiClient.loginAs('viewer');

    const run = generateTestSuspendedRun();
    await pool.query(
      `INSERT INTO mastra_suspended_runs (id, "runId", "prNumber", "prUrl", owner, repo, "createdAt", "expiresAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [run.id, run.runId, run.prNumber, run.prUrl, run.owner, run.repo, run.createdAt, run.expiresAt]
    );

    const response = await apiClient.authenticatedRequest('GET', '/api/approvals', undefined, viewerToken);

    expect(response.status).toBe(200);
    expect(response.success).toBe(true);
    expect(Array.isArray(response.data.approvals)).toBe(true);

    // Cleanup
    await pool.query('DELETE FROM mastra_suspended_runs WHERE id = $1', [run.id]);
  });

  test('should deny unauthenticated requests (401)', async ({ apiClient }) => {
    const response = await apiClient.authenticatedRequest('GET', '/api/approvals');

    expect(response.status).toBe(401);
    expect(response.success).toBe(false);
  });

  test('should support pagination with limit and offset', async ({ apiClient, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();
    const adminToken = await apiClient.loginAs('admin');

    // Create multiple suspended runs
    const runs: SuspendedRun[] = [];
    for (let i = 0; i < 5; i++) {
      const run = generateTestSuspendedRun();
      runs.push(run);
      await pool.query(
        `INSERT INTO mastra_suspended_runs (id, "runId", "prNumber", "prUrl", owner, repo, "createdAt", "expiresAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [run.id, run.runId, run.prNumber, run.prUrl, run.owner, run.repo, run.createdAt, run.expiresAt]
      );
    }

    // First page with limit 2
    const page1 = await apiClient.authenticatedRequest(
      'GET',
      '/api/approvals?limit=2&offset=0',
      undefined,
      adminToken
    );
    expect(page1.status).toBe(200);
    expect(page1.data.approvals.length).toBeLessThanOrEqual(2);
    expect(page1.data.limit).toBe(2);
    expect(page1.data.offset).toBe(0);

    // Second page
    const page2 = await apiClient.authenticatedRequest(
      'GET',
      '/api/approvals?limit=2&offset=2',
      undefined,
      adminToken
    );
    expect(page2.status).toBe(200);
    expect(page2.data.approvals.length).toBeLessThanOrEqual(2);
    expect(page2.data.limit).toBe(2);
    expect(page2.data.offset).toBe(2);

    // Cleanup
    await pool.query(
      `DELETE FROM mastra_suspended_runs WHERE id = ANY($1::text[])`,
      [runs.map(r => r.id)]
    );
  });

  test('should filter by owner and repo', async ({ apiClient, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();
    const adminToken = await apiClient.loginAs('admin');

    // Create runs for different repos
    const run1 = generateTestSuspendedRun({ owner: 'org1', repo: 'repo1' });
    const run2 = generateTestSuspendedRun({ owner: 'org1', repo: 'repo2' });
    const run3 = generateTestSuspendedRun({ owner: 'org2', repo: 'repo1' });

    await pool.query(
      `INSERT INTO mastra_suspended_runs (id, "runId", "prNumber", "prUrl", owner, repo, "createdAt", "expiresAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8), ($9, $10, $11, $12, $13, $14, $15, $16), ($17, $18, $19, $20, $21, $22, $23, $24)`,
      [
        run1.id, run1.runId, run1.prNumber, run1.prUrl, run1.owner, run1.repo, run1.createdAt, run1.expiresAt,
        run2.id, run2.runId, run2.prNumber, run2.prUrl, run2.owner, run2.repo, run2.createdAt, run2.expiresAt,
        run3.id, run3.runId, run3.prNumber, run3.prUrl, run3.owner, run3.repo, run3.createdAt, run3.expiresAt,
      ]
    );

    // Filter by owner
    const response1 = await apiClient.authenticatedRequest(
      'GET',
      `/api/approvals?owner=org1`,
      undefined,
      adminToken
    );
    expect(response1.status).toBe(200);
    expect(response1.data.approvals.every((a: any) => a.owner === 'org1')).toBe(true);

    // Filter by repo
    const response2 = await apiClient.authenticatedRequest(
      'GET',
      `/api/approvals?repo=repo1`,
      undefined,
      adminToken
    );
    expect(response2.status).toBe(200);
    expect(response2.data.approvals.every((a: any) => a.repo === 'repo1')).toBe(true);

    // Filter by both
    const response3 = await apiClient.authenticatedRequest(
      'GET',
      `/api/approvals?owner=org1&repo=repo1`,
      undefined,
      adminToken
    );
    expect(response3.status).toBe(200);
    expect(response3.data.approvals.every((a: any) => a.owner === 'org1' && a.repo === 'repo1')).toBe(true);

    // Cleanup
    await pool.query(
      `DELETE FROM mastra_suspended_runs WHERE id = ANY($1::text[])`,
      [[run1.id, run2.id, run3.id]]
    );
  });

  test('should return correct approval entry fields', async ({ apiClient, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();
    const adminToken = await apiClient.loginAs('admin');

    const run = generateTestSuspendedRun({
      owner: 'test-owner',
      repo: 'test-repo',
      prNumber: 123,
      prUrl: 'https://github.com/test-owner/test-repo/pull/123',
    });

    await pool.query(
      `INSERT INTO mastra_suspended_runs (id, "runId", "prNumber", "prUrl", owner, repo, "createdAt", "expiresAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [run.id, run.runId, run.prNumber, run.prUrl, run.owner, run.repo, run.createdAt, run.expiresAt]
    );

    const response = await apiClient.authenticatedRequest('GET', '/api/approvals', undefined, adminToken);
    const approval = response.data.approvals.find((a: any) => a.runId === run.runId);

    expect(approval).toBeDefined();
    expect(approval).toHaveProperty('runId');
    expect(approval).toHaveProperty('workflowId');
    expect(approval).toHaveProperty('workflowName');
    expect(approval).toHaveProperty('suspendedAt');
    expect(approval).toHaveProperty('suspendData');
    expect(approval).toHaveProperty('status', 'pending');
    expect(approval).toHaveProperty('priority');
    expect(approval).toHaveProperty('owner', 'test-owner');
    expect(approval).toHaveProperty('repo', 'test-repo');
    expect(approval).toHaveProperty('prNumber', 123);

    // Cleanup
    await pool.query('DELETE FROM mastra_suspended_runs WHERE id = $1', [run.id]);
  });

  test('should return empty list when no approvals exist', async ({ apiClient }) => {
    const adminToken = await apiClient.loginAs('admin');

    const response = await apiClient.authenticatedRequest(
      'GET',
      '/api/approvals?owner=nonexistent-owner',
      undefined,
      adminToken
    );

    expect(response.status).toBe(200);
    expect(response.data.approvals).toEqual([]);
    expect(response.data.total).toBe(0);
  });

  test('should validate limit parameter', async ({ apiClient }) => {
    const adminToken = await apiClient.loginAs('admin');

    // Test with invalid limit (non-numeric)
    const response = await apiClient.authenticatedRequest(
      'GET',
      '/api/approvals?limit=invalid',
      undefined,
      adminToken
    );

    // Should either handle gracefully or return validation error
    expect([200, 400].includes(response.status)).toBe(true);
  });

  test('should validate offset parameter', async ({ apiClient }) => {
    const adminToken = await apiClient.loginAs('admin');

    // Test with invalid offset
    const response = await apiClient.authenticatedRequest(
      'GET',
      '/api/approvals?offset=invalid',
      undefined,
      adminToken
    );

    expect([200, 400].includes(response.status)).toBe(true);
  });
});

test.describe('Approvals API - Get Approval Details (GET /api/approvals/:runId)', () => {
  test('should allow admin to get approval details', async ({ apiClient, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();
    const adminToken = await apiClient.loginAs('admin');

    const run = generateTestSuspendedRun();
    await pool.query(
      `INSERT INTO mastra_suspended_runs (id, "runId", "prNumber", "prUrl", owner, repo, "createdAt", "expiresAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [run.id, run.runId, run.prNumber, run.prUrl, run.owner, run.repo, run.createdAt, run.expiresAt]
    );

    const response = await apiClient.authenticatedRequest(
      'GET',
      `/api/approvals/${run.runId}`,
      undefined,
      adminToken
    );

    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('runId', run.runId);
    expect(response.data).toHaveProperty('workflowId');
    expect(response.data).toHaveProperty('workflowName');
    expect(response.data).toHaveProperty('suspendedAt');
    expect(response.data).toHaveProperty('suspendData');
    expect(response.data).toHaveProperty('status', 'pending');
    expect(response.data).toHaveProperty('history');
    expect(Array.isArray(response.data.history)).toBe(true);
    expect(response.data.history.length).toBeGreaterThan(0);

    // Cleanup
    await pool.query('DELETE FROM mastra_suspended_runs WHERE id = $1', [run.id]);
  });

  test('should allow operator to get approval details', async ({ apiClient, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();
    const operatorToken = await apiClient.loginAs('operator');

    const run = generateTestSuspendedRun();
    await pool.query(
      `INSERT INTO mastra_suspended_runs (id, "runId", "prNumber", "prUrl", owner, repo, "createdAt", "expiresAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [run.id, run.runId, run.prNumber, run.prUrl, run.owner, run.repo, run.createdAt, run.expiresAt]
    );

    const response = await apiClient.authenticatedRequest(
      'GET',
      `/api/approvals/${run.runId}`,
      undefined,
      operatorToken
    );

    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('runId', run.runId);

    // Cleanup
    await pool.query('DELETE FROM mastra_suspended_runs WHERE id = $1', [run.id]);
  });

  test('should allow viewer to get approval details', async ({ apiClient, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();
    const viewerToken = await apiClient.loginAs('viewer');

    const run = generateTestSuspendedRun();
    await pool.query(
      `INSERT INTO mastra_suspended_runs (id, "runId", "prNumber", "prUrl", owner, repo, "createdAt", "expiresAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [run.id, run.runId, run.prNumber, run.prUrl, run.owner, run.repo, run.createdAt, run.expiresAt]
    );

    const response = await apiClient.authenticatedRequest(
      'GET',
      `/api/approvals/${run.runId}`,
      undefined,
      viewerToken
    );

    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('runId', run.runId);

    // Cleanup
    await pool.query('DELETE FROM mastra_suspended_runs WHERE id = $1', [run.id]);
  });

  test('should deny unauthenticated requests (401)', async ({ apiClient, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();

    const run = generateTestSuspendedRun();
    await pool.query(
      `INSERT INTO mastra_suspended_runs (id, "runId", "prNumber", "prUrl", owner, repo, "createdAt", "expiresAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [run.id, run.runId, run.prNumber, run.prUrl, run.owner, run.repo, run.createdAt, run.expiresAt]
    );

    const response = await apiClient.authenticatedRequest('GET', `/api/approvals/${run.runId}`);

    expect(response.status).toBe(401);
    expect(response.success).toBe(false);

    // Cleanup
    await pool.query('DELETE FROM mastra_suspended_runs WHERE id = $1', [run.id]);
  });

  test('should return 404 for non-existent run', async ({ apiClient }) => {
    const adminToken = await apiClient.loginAs('admin');
    const fakeRunId = 'non-existent-run-id';

    const response = await apiClient.authenticatedRequest(
      'GET',
      `/api/approvals/${fakeRunId}`,
      undefined,
      adminToken
    );

    expect(response.status).toBe(404);
    expect(response.success).toBe(false);
    expect(response.data).toHaveProperty('error', 'Not Found');
    expect(response.data).toHaveProperty('code', 'RUN_NOT_FOUND');
  });

  test('should include approval history', async ({ apiClient, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();
    const adminToken = await apiClient.loginAs('admin');

    const run = generateTestSuspendedRun({
      owner: 'history-test',
      repo: 'repo',
      prNumber: 456,
    });

    await pool.query(
      `INSERT INTO mastra_suspended_runs (id, "runId", "prNumber", "prUrl", owner, repo, "createdAt", "expiresAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [run.id, run.runId, run.prNumber, run.prUrl, run.owner, run.repo, run.createdAt, run.expiresAt]
    );

    const response = await apiClient.authenticatedRequest(
      'GET',
      `/api/approvals/${run.runId}`,
      undefined,
      adminToken
    );

    expect(response.status).toBe(200);
    expect(response.data.history).toBeDefined();
    expect(Array.isArray(response.data.history)).toBe(true);
    expect(response.data.history.length).toBeGreaterThan(0);

    const firstEntry = response.data.history[0];
    expect(firstEntry).toHaveProperty('action', 'suspended');
    expect(firstEntry).toHaveProperty('timestamp');
    expect(firstEntry).toHaveProperty('user', 'system');
    expect(firstEntry).toHaveProperty('details');

    // Cleanup
    await pool.query('DELETE FROM mastra_suspended_runs WHERE id = $1', [run.id]);
  });

  test('should include suspendData in response', async ({ apiClient, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();
    const adminToken = await apiClient.loginAs('admin');

    const run = generateTestSuspendedRun({
      prNumber: 789,
      prUrl: 'https://github.com/test/test/pull/789',
    });

    await pool.query(
      `INSERT INTO mastra_suspended_runs (id, "runId", "prNumber", "prUrl", owner, repo, "createdAt", "expiresAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [run.id, run.runId, run.prNumber, run.prUrl, run.owner, run.repo, run.createdAt, run.expiresAt]
    );

    const response = await apiClient.authenticatedRequest(
      'GET',
      `/api/approvals/${run.runId}`,
      undefined,
      adminToken
    );

    expect(response.status).toBe(200);
    expect(response.data.suspendData).toBeDefined();
    expect(response.data.suspendData).toHaveProperty('reason', 'PR approval required');
    expect(response.data.suspendData).toHaveProperty('prUrl', run.prUrl);
    expect(response.data.suspendData).toHaveProperty('prNumber', run.prNumber);

    // Cleanup
    await pool.query('DELETE FROM mastra_suspended_runs WHERE id = $1', [run.id]);
  });
});

test.describe('Approvals API - Approve Workflow (POST /api/approvals/:runId/approve)', () => {
  test('should allow admin to approve workflow', async ({ apiClient, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();
    const adminToken = await apiClient.loginAs('admin');

    const run = generateTestSuspendedRun();
    await pool.query(
      `INSERT INTO mastra_suspended_runs (id, "runId", "prNumber", "prUrl", owner, repo, "createdAt", "expiresAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [run.id, run.runId, run.prNumber, run.prUrl, run.owner, run.repo, run.createdAt, run.expiresAt]
    );

    const response = await apiClient.authenticatedRequest(
      'POST',
      `/api/approvals/${run.runId}/approve`,
      { feedback: 'Looks good, proceed' },
      adminToken
    );

    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('runId', run.runId);
    expect(response.data).toHaveProperty('status', 'approved');
    expect(response.data).toHaveProperty('approvedAt');
    expect(response.data).toHaveProperty('message');

    // Verify it was removed from suspended runs
    const checkResult = await pool.query('SELECT * FROM mastra_suspended_runs WHERE "runId" = $1', [run.runId]);
    expect(checkResult.rows.length).toBe(0);
  });

  test('should allow operator to approve workflow', async ({ apiClient, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();
    const operatorToken = await apiClient.loginAs('operator');

    const run = generateTestSuspendedRun();
    await pool.query(
      `INSERT INTO mastra_suspended_runs (id, "runId", "prNumber", "prUrl", owner, repo, "createdAt", "expiresAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [run.id, run.runId, run.prNumber, run.prUrl, run.owner, run.repo, run.createdAt, run.expiresAt]
    );

    const response = await apiClient.authenticatedRequest(
      'POST',
      `/api/approvals/${run.runId}/approve`,
      { feedback: 'Approved' },
      operatorToken
    );

    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('status', 'approved');
  });

  test('should deny viewer from approving workflow (403)', async ({ apiClient, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();
    const viewerToken = await apiClient.loginAs('viewer');

    const run = generateTestSuspendedRun();
    await pool.query(
      `INSERT INTO mastra_suspended_runs (id, "runId", "prNumber", "prUrl", owner, repo, "createdAt", "expiresAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [run.id, run.runId, run.prNumber, run.prUrl, run.owner, run.repo, run.createdAt, run.expiresAt]
    );

    const response = await apiClient.authenticatedRequest(
      'POST',
      `/api/approvals/${run.runId}/approve`,
      { feedback: 'Trying to approve' },
      viewerToken
    );

    expect(response.status).toBe(403);
    expect(response.success).toBe(false);

    // Cleanup
    await pool.query('DELETE FROM mastra_suspended_runs WHERE id = $1', [run.id]);
  });

  test('should deny unauthenticated requests (401)', async ({ apiClient, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();

    const run = generateTestSuspendedRun();
    await pool.query(
      `INSERT INTO mastra_suspended_runs (id, "runId", "prNumber", "prUrl", owner, repo, "createdAt", "expiresAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [run.id, run.runId, run.prNumber, run.prUrl, run.owner, run.repo, run.createdAt, run.expiresAt]
    );

    const response = await apiClient.authenticatedRequest(
      'POST',
      `/api/approvals/${run.runId}/approve`,
      { feedback: 'Should fail' }
    );

    expect(response.status).toBe(401);
    expect(response.success).toBe(false);

    // Cleanup
    await pool.query('DELETE FROM mastra_suspended_runs WHERE id = $1', [run.id]);
  });

  test('should return 404 for non-existent run', async ({ apiClient }) => {
    const adminToken = await apiClient.loginAs('admin');
    const fakeRunId = 'non-existent-run-id';

    const response = await apiClient.authenticatedRequest(
      'POST',
      `/api/approvals/${fakeRunId}/approve`,
      { feedback: 'Test' },
      adminToken
    );

    expect(response.status).toBe(404);
    expect(response.success).toBe(false);
    expect(response.data).toHaveProperty('error', 'Not Found');
    expect(response.data).toHaveProperty('code', 'RUN_NOT_FOUND');
  });

  test('should allow approval without feedback', async ({ apiClient, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();
    const adminToken = await apiClient.loginAs('admin');

    const run = generateTestSuspendedRun();
    await pool.query(
      `INSERT INTO mastra_suspended_runs (id, "runId", "prNumber", "prUrl", owner, repo, "createdAt", "expiresAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [run.id, run.runId, run.prNumber, run.prUrl, run.owner, run.repo, run.createdAt, run.expiresAt]
    );

    const response = await apiClient.authenticatedRequest(
      'POST',
      `/api/approvals/${run.runId}/approve`,
      {},
      adminToken
    );

    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('status', 'approved');
  });

  test('should remove approved run from suspended runs', async ({ apiClient, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();
    const adminToken = await apiClient.loginAs('admin');

    const run = generateTestSuspendedRun();
    await pool.query(
      `INSERT INTO mastra_suspended_runs (id, "runId", "prNumber", "prUrl", owner, repo, "createdAt", "expiresAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [run.id, run.runId, run.prNumber, run.prUrl, run.owner, run.repo, run.createdAt, run.expiresAt]
    );

    // Verify it exists before approval
    const beforeResult = await pool.query('SELECT * FROM mastra_suspended_runs WHERE "runId" = $1', [run.runId]);
    expect(beforeResult.rows.length).toBe(1);

    // Approve
    await apiClient.authenticatedRequest(
      'POST',
      `/api/approvals/${run.runId}/approve`,
      {},
      adminToken
    );

    // Verify it's removed after approval
    const afterResult = await pool.query('SELECT * FROM mastra_suspended_runs WHERE "runId" = $1', [run.runId]);
    expect(afterResult.rows.length).toBe(0);
  });
});

test.describe('Approvals API - Decline Workflow (POST /api/approvals/:runId/decline)', () => {
  test('should allow admin to decline workflow', async ({ apiClient, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();
    const adminToken = await apiClient.loginAs('admin');

    const run = generateTestSuspendedRun();
    await pool.query(
      `INSERT INTO mastra_suspended_runs (id, "runId", "prNumber", "prUrl", owner, repo, "createdAt", "expiresAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [run.id, run.runId, run.prNumber, run.prUrl, run.owner, run.repo, run.createdAt, run.expiresAt]
    );

    const response = await apiClient.authenticatedRequest(
      'POST',
      `/api/approvals/${run.runId}/decline`,
      { feedback: 'Needs changes before approval' },
      adminToken
    );

    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('runId', run.runId);
    expect(response.data).toHaveProperty('status', 'declined');
    expect(response.data).toHaveProperty('declinedAt');
    expect(response.data).toHaveProperty('message');

    // Verify it was removed from suspended runs
    const checkResult = await pool.query('SELECT * FROM mastra_suspended_runs WHERE "runId" = $1', [run.runId]);
    expect(checkResult.rows.length).toBe(0);
  });

  test('should allow operator to decline workflow', async ({ apiClient, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();
    const operatorToken = await apiClient.loginAs('operator');

    const run = generateTestSuspendedRun();
    await pool.query(
      `INSERT INTO mastra_suspended_runs (id, "runId", "prNumber", "prUrl", owner, repo, "createdAt", "expiresAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [run.id, run.runId, run.prNumber, run.prUrl, run.owner, run.repo, run.createdAt, run.expiresAt]
    );

    const response = await apiClient.authenticatedRequest(
      'POST',
      `/api/approvals/${run.runId}/decline`,
      { feedback: 'Not ready' },
      operatorToken
    );

    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('status', 'declined');
  });

  test('should deny viewer from declining workflow (403)', async ({ apiClient, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();
    const viewerToken = await apiClient.loginAs('viewer');

    const run = generateTestSuspendedRun();
    await pool.query(
      `INSERT INTO mastra_suspended_runs (id, "runId", "prNumber", "prUrl", owner, repo, "createdAt", "expiresAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [run.id, run.runId, run.prNumber, run.prUrl, run.owner, run.repo, run.createdAt, run.expiresAt]
    );

    const response = await apiClient.authenticatedRequest(
      'POST',
      `/api/approvals/${run.runId}/decline`,
      { feedback: 'Trying to decline' },
      viewerToken
    );

    expect(response.status).toBe(403);
    expect(response.success).toBe(false);

    // Cleanup
    await pool.query('DELETE FROM mastra_suspended_runs WHERE id = $1', [run.id]);
  });

  test('should deny unauthenticated requests (401)', async ({ apiClient, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();

    const run = generateTestSuspendedRun();
    await pool.query(
      `INSERT INTO mastra_suspended_runs (id, "runId", "prNumber", "prUrl", owner, repo, "createdAt", "expiresAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [run.id, run.runId, run.prNumber, run.prUrl, run.owner, run.repo, run.createdAt, run.expiresAt]
    );

    const response = await apiClient.authenticatedRequest(
      'POST',
      `/api/approvals/${run.runId}/decline`,
      { feedback: 'Should fail' }
    );

    expect(response.status).toBe(401);
    expect(response.success).toBe(false);

    // Cleanup
    await pool.query('DELETE FROM mastra_suspended_runs WHERE id = $1', [run.id]);
  });

  test('should return 404 for non-existent run', async ({ apiClient }) => {
    const adminToken = await apiClient.loginAs('admin');
    const fakeRunId = 'non-existent-run-id';

    const response = await apiClient.authenticatedRequest(
      'POST',
      `/api/approvals/${fakeRunId}/decline`,
      { feedback: 'Test feedback' },
      adminToken
    );

    expect(response.status).toBe(404);
    expect(response.success).toBe(false);
    expect(response.data).toHaveProperty('error', 'Not Found');
    expect(response.data).toHaveProperty('code', 'RUN_NOT_FOUND');
  });

  test('should require feedback for decline (400)', async ({ apiClient, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();
    const adminToken = await apiClient.loginAs('admin');

    const run = generateTestSuspendedRun();
    await pool.query(
      `INSERT INTO mastra_suspended_runs (id, "runId", "prNumber", "prUrl", owner, repo, "createdAt", "expiresAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [run.id, run.runId, run.prNumber, run.prUrl, run.owner, run.repo, run.createdAt, run.expiresAt]
    );

    const response = await apiClient.authenticatedRequest(
      'POST',
      `/api/approvals/${run.runId}/decline`,
      {},
      adminToken
    );

    expect(response.status).toBe(400);
    expect(response.success).toBe(false);

    // Cleanup
    await pool.query('DELETE FROM mastra_suspended_runs WHERE id = $1', [run.id]);
  });

  test('should reject empty feedback (400)', async ({ apiClient, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();
    const adminToken = await apiClient.loginAs('admin');

    const run = generateTestSuspendedRun();
    await pool.query(
      `INSERT INTO mastra_suspended_runs (id, "runId", "prNumber", "prUrl", owner, repo, "createdAt", "expiresAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [run.id, run.runId, run.prNumber, run.prUrl, run.owner, run.repo, run.createdAt, run.expiresAt]
    );

    const response = await apiClient.authenticatedRequest(
      'POST',
      `/api/approvals/${run.runId}/decline`,
      { feedback: '   ' },
      adminToken
    );

    expect(response.status).toBe(400);
    expect(response.success).toBe(false);

    // Cleanup
    await pool.query('DELETE FROM mastra_suspended_runs WHERE id = $1', [run.id]);
  });

  test('should remove declined run from suspended runs', async ({ apiClient, dbHelper }) => {
    const pool = await dbHelper.getTestDbConnection();
    const adminToken = await apiClient.loginAs('admin');

    const run = generateTestSuspendedRun();
    await pool.query(
      `INSERT INTO mastra_suspended_runs (id, "runId", "prNumber", "prUrl", owner, repo, "createdAt", "expiresAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [run.id, run.runId, run.prNumber, run.prUrl, run.owner, run.repo, run.createdAt, run.expiresAt]
    );

    // Verify it exists before decline
    const beforeResult = await pool.query('SELECT * FROM mastra_suspended_runs WHERE "runId" = $1', [run.runId]);
    expect(beforeResult.rows.length).toBe(1);

    // Decline
    await apiClient.authenticatedRequest(
      'POST',
      `/api/approvals/${run.runId}/decline`,
      { feedback: 'Not approved' },
      adminToken
    );

    // Verify it's removed after decline
    const afterResult = await pool.query('SELECT * FROM mastra_suspended_runs WHERE "runId" = $1', [run.runId]);
    expect(afterResult.rows.length).toBe(0);
  });
});

test.describe('Approvals API - Error Scenarios', () => {
  test('should handle invalid JSON in request body', async ({ apiClient }) => {
    const adminToken = await apiClient.loginAs('admin');
    const baseURL = process.env.BASE_URL || process.env.VITE_MASTRA_API_URL || 'http://localhost:4111';

    const response = await fetch(`${baseURL}/api/approvals/test-run/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`,
      },
      body: 'invalid json',
    });

    expect(response.status).toBe(400);
  });

  test('should handle malformed runId parameter', async ({ apiClient }) => {
    const adminToken = await apiClient.loginAs('admin');

    const response = await apiClient.authenticatedRequest(
      'GET',
      '/api/approvals/run with spaces/123',
      undefined,
      adminToken
    );

    // Should either handle gracefully or return 404
    expect([200, 400, 404].includes(response.status)).toBe(true);
  });

  test('should return consistent error format', async ({ apiClient }) => {
    const adminToken = await apiClient.loginAs('admin');

    const response = await apiClient.authenticatedRequest(
      'POST',
      '/api/approvals/fake-run/approve',
      { feedback: 'Test' },
      adminToken
    );

    if (response.status === 404) {
      expect(response.data).toHaveProperty('error');
      expect(response.data).toHaveProperty('message');
      expect(response.data).toHaveProperty('code');
    }
  });
});

test.describe('Approvals API - Cleanup', () => {
  test.afterAll(async ({ dbHelper }) => {
    // Clean up any remaining test data
    const pool = await dbHelper.getTestDbConnection();
    await pool.query("DELETE FROM mastra_suspended_runs WHERE owner LIKE 'test-%'");
  });
});
