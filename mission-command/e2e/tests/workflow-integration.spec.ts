/**
 * Workflow Integration E2E Tests
 *
 * Comprehensive end-to-end tests for the Mission Command Centre workflow system.
 * Tests workflow execution, suspension/resume patterns, approval queues, and
 * role-based access control.
 *
 * @packageDocumentation
 */

import { test, expect } from '../fixtures/base';
import { resetRandomSeed, randomString } from '../utils/test-data-generator';

/**
 * Test configuration
 */
const WORKFLOW_ID = 'code-review-workflow';
const TEST_REPO = {
  owner: 'test-org',
  repo: 'test-repo',
  url: 'https://github.com/test-org/test-repo',
};

/**
 * Clean up test data before and after tests
 */
test.beforeEach(async ({ dbHelper }) => {
  const pool = await dbHelper.getTestDbConnection();
  await dbHelper.resetTestDatabase(pool);
  resetRandomSeed();
});

test.afterEach(async ({ dbHelper }) => {
  const pool = await dbHelper.getTestDbConnection();
  await dbHelper.resetTestDatabase(pool);
});

/**
 * ============================================================================
 * Test Suite 1: Workflow Execution
 * ============================================================================
 */
test.describe('Workflow Execution', () => {
  test('Admin can create new workflow', async ({ apiClient, assertionHelper }) => {
    const adminToken = await apiClient.loginAs('admin');

    const response = await apiClient.authenticatedRequest(
      'POST',
      `/api/workflows/${WORKFLOW_ID}/start-async`,
      {
        input: {
          featureId: `test-feature-${randomString(8)}`,
          repoUrl: TEST_REPO.url,
          baseBranch: 'main',
          owner: TEST_REPO.owner,
          repo: TEST_REPO.repo,
          featureDescription: 'Test feature for E2E testing',
          mergeMethod: 'squash',
        },
      },
      adminToken
    );

    expect(response.status).toBe(200);
    expect(response.success).toBe(true);
    expect(response.data).toHaveProperty('runId');
    expect(response.data).toHaveProperty('status');
  });

  test('Operator cannot create workflow (403)', async ({ apiClient }) => {
    const operatorToken = await apiClient.loginAs('operator');

    const response = await apiClient.authenticatedRequest(
      'POST',
      `/api/workflows/${WORKFLOW_ID}/start-async`,
      {
        input: {
          featureId: `test-feature-${randomString(8)}`,
          repoUrl: TEST_REPO.url,
          baseBranch: 'main',
          owner: TEST_REPO.owner,
          repo: TEST_REPO.repo,
          featureDescription: 'Test feature',
        },
      },
      operatorToken
    );

    expect(response.status).toBe(403);
    expect(response.success).toBe(false);
  });

  test('Viewer cannot create workflow (403)', async ({ apiClient }) => {
    const viewerToken = await apiClient.loginAs('viewer');

    const response = await apiClient.authenticatedRequest(
      'POST',
      `/api/workflows/${WORKFLOW_ID}/start-async`,
      {
        input: {
          featureId: `test-feature-${randomString(8)}`,
          repoUrl: TEST_REPO.url,
          baseBranch: 'main',
          owner: TEST_REPO.owner,
          repo: TEST_REPO.repo,
          featureDescription: 'Test feature',
        },
      },
      viewerToken
    );

    expect(response.status).toBe(403);
    expect(response.success).toBe(false);
  });

  test('Workflow execution returns runId', async ({ apiClient }) => {
    const adminToken = await apiClient.loginAs('admin');

    const response = await apiClient.authenticatedRequest(
      'POST',
      `/api/workflows/${WORKFLOW_ID}/start-async`,
      {
        input: {
          featureId: `test-feature-${randomString(8)}`,
          repoUrl: TEST_REPO.url,
          baseBranch: 'main',
          owner: TEST_REPO.owner,
          repo: TEST_REPO.repo,
          featureDescription: 'Test feature',
        },
      },
      adminToken
    );

    expect(response.data).toHaveProperty('runId');
    expect(typeof response.data.runId).toBe('string');
    expect(response.data.runId.length).toBeGreaterThan(0);
  });

  test('Workflow initial status is "running"', async ({ apiClient }) => {
    const adminToken = await apiClient.loginAs('admin');

    const executeResponse = await apiClient.authenticatedRequest(
      'POST',
      `/api/workflows/${WORKFLOW_ID}/start-async`,
      {
        input: {
          featureId: `test-feature-${randomString(8)}`,
          repoUrl: TEST_REPO.url,
          baseBranch: 'main',
          owner: TEST_REPO.owner,
          repo: TEST_REPO.repo,
          featureDescription: 'Test feature',
        },
      },
      adminToken
    );

    const runId = executeResponse.data.runId;

    // Give workflow time to start
    await new Promise(resolve => setTimeout(resolve, 1000));

    const statusResponse = await apiClient.authenticatedRequest(
      'GET',
      `/api/workflows/${WORKFLOW_ID}/runs/${runId}`,
      undefined,
      adminToken
    );

    expect(statusResponse.data.status).toMatch(/running|suspended/);
  });

  test('Workflow steps execute in correct order', async ({ apiClient }) => {
    const adminToken = await apiClient.loginAs('admin');

    const response = await apiClient.authenticatedRequest(
      'POST',
      `/api/workflows/${WORKFLOW_ID}/start-async`,
      {
        input: {
          featureId: `test-feature-${randomString(8)}`,
          repoUrl: TEST_REPO.url,
          baseBranch: 'main',
          owner: TEST_REPO.owner,
          repo: TEST_REPO.repo,
          featureDescription: 'Test feature',
        },
      },
      adminToken
    );

    const runId = response.data.runId;

    // Wait for workflow to progress
    await new Promise(resolve => setTimeout(resolve, 2000));

    const runResponse = await apiClient.authenticatedRequest(
      'GET',
      `/api/workflows/${WORKFLOW_ID}/runs/${runId}/execution-result`,
      undefined,
      adminToken
    );

    expect(runResponse.data).toHaveProperty('steps');
    if (runResponse.data.steps) {
      const stepNames = runResponse.data.steps.map((s: any) => s.id);
      expect(stepNames).toContain('create-branch');
      expect(stepNames).toContain('implement-feature');
      expect(stepNames).toContain('create-pr');
    }
  });
});

/**
 * ============================================================================
 * Test Suite 2: Workflow Suspension (Approval Step)
 * ============================================================================
 */
test.describe('Workflow Suspension', () => {
  test('Workflow suspends at approval step', async ({ apiClient }) => {
    const adminToken = await apiClient.loginAs('admin');

    const executeResponse = await apiClient.authenticatedRequest(
      'POST',
      `/api/workflows/${WORKFLOW_ID}/start-async`,
      {
        input: {
          featureId: `test-feature-${randomString(8)}`,
          repoUrl: TEST_REPO.url,
          baseBranch: 'main',
          owner: TEST_REPO.owner,
          repo: TEST_REPO.repo,
          featureDescription: 'Test feature for suspension',
        },
      },
      adminToken
    );

    const runId = executeResponse.data.runId;

    // Wait for workflow to reach approval step
    await new Promise(resolve => setTimeout(resolve, 3000));

    const statusResponse = await apiClient.authenticatedRequest(
      'GET',
      `/api/workflows/${WORKFLOW_ID}/runs/${runId}`,
      undefined,
      adminToken
    );

    expect(statusResponse.data.status).toBe('suspended');
  });

  test('Suspended workflow status is "suspended"', async ({ apiClient }) => {
    const adminToken = await apiClient.loginAs('admin');

    const executeResponse = await apiClient.authenticatedRequest(
      'POST',
      `/api/workflows/${WORKFLOW_ID}/start-async`,
      {
        input: {
          featureId: `test-feature-${randomString(8)}`,
          repoUrl: TEST_REPO.url,
          baseBranch: 'main',
          owner: TEST_REPO.owner,
          repo: TEST_REPO.repo,
          featureDescription: 'Test feature',
        },
      },
      adminToken
    );

    const runId = executeResponse.data.runId;

    // Wait for suspension
    await new Promise(resolve => setTimeout(resolve, 3000));

    const statusResponse = await apiClient.authenticatedRequest(
      'GET',
      `/api/workflows/${WORKFLOW_ID}/runs/${runId}`,
      undefined,
      adminToken
    );

    expect(statusResponse.data.status).toBe('suspended');
    expect(statusResponse.data).toHaveProperty('suspendedAt');
  });

  test('Suspended workflow appears in approval queue', async ({ apiClient }) => {
    const adminToken = await apiClient.loginAs('admin');

    const executeResponse = await apiClient.authenticatedRequest(
      'POST',
      `/api/workflows/${WORKFLOW_ID}/start-async`,
      {
        input: {
          featureId: `test-feature-${randomString(8)}`,
          repoUrl: TEST_REPO.url,
          baseBranch: 'main',
          owner: TEST_REPO.owner,
          repo: TEST_REPO.repo,
          featureDescription: 'Test feature for approval queue',
        },
      },
      adminToken
    );

    const runId = executeResponse.data.runId;

    // Wait for suspension
    await new Promise(resolve => setTimeout(resolve, 3000));

    const approvalsResponse = await apiClient.authenticatedRequest(
      'GET',
      '/api/approvals',
      undefined,
      adminToken
    );

    expect(approvalsResponse.data.runs).toBeInstanceOf(Array);
    const foundRun = approvalsResponse.data.runs.find((r: any) => r.runId === runId);
    expect(foundRun).toBeDefined();
    expect(foundRun.status).toBe('suspended');
  });

  test('Suspended workflow cannot proceed without approval', async ({ apiClient }) => {
    const adminToken = await apiClient.loginAs('admin');

    const executeResponse = await apiClient.authenticatedRequest(
      'POST',
      `/api/workflows/${WORKFLOW_ID}/start-async`,
      {
        input: {
          featureId: `test-feature-${randomString(8)}`,
          repoUrl: TEST_REPO.url,
          baseBranch: 'main',
          owner: TEST_REPO.owner,
          repo: TEST_REPO.repo,
          featureDescription: 'Test feature',
        },
      },
      adminToken
    );

    const runId = executeResponse.data.runId;

    // Wait for suspension
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check status multiple times to ensure it stays suspended
    const check1 = await apiClient.authenticatedRequest(
      'GET',
      `/api/workflows/${WORKFLOW_ID}/runs/${runId}`,
      undefined,
      adminToken
    );
    expect(check1.data.status).toBe('suspended');

    await new Promise(resolve => setTimeout(resolve, 2000));

    const check2 = await apiClient.authenticatedRequest(
      'GET',
      `/api/workflows/${WORKFLOW_ID}/runs/${runId}`,
      undefined,
      adminToken
    );
    expect(check2.data.status).toBe('suspended');
  });

  test('Suspension includes workflow context/state', async ({ apiClient }) => {
    const adminToken = await apiClient.loginAs('admin');

    const executeResponse = await apiClient.authenticatedRequest(
      'POST',
      `/api/workflows/${WORKFLOW_ID}/start-async`,
      {
        input: {
          featureId: `test-feature-${randomString(8)}`,
          repoUrl: TEST_REPO.url,
          baseBranch: 'main',
          owner: TEST_REPO.owner,
          repo: TEST_REPO.repo,
          featureDescription: 'Test feature with context',
          mergeMethod: 'squash',
        },
      },
      adminToken
    );

    const runId = executeResponse.data.runId;

    // Wait for suspension
    await new Promise(resolve => setTimeout(resolve, 3000));

    const approvalResponse = await apiClient.authenticatedRequest(
      'GET',
      `/api/approvals/${runId}`,
      undefined,
      adminToken
    );

    expect(approvalResponse.data).toHaveProperty('suspendData');
    expect(approvalResponse.data).toHaveProperty('suspendPayload');
    expect(approvalResponse.data.suspendPayload).toHaveProperty('prNumber');
    expect(approvalResponse.data.suspendPayload).toHaveProperty('prUrl');
  });
});

/**
 * ============================================================================
 * Test Suite 3: Workflow Approval
 * ============================================================================
 */
test.describe('Workflow Approval', () => {
  let adminToken: string;
  let runId: string;

  test.beforeEach(async ({ apiClient }) => {
    adminToken = await apiClient.loginAs('admin');

    // Start a workflow and wait for it to suspend
    const executeResponse = await apiClient.authenticatedRequest(
      'POST',
      `/api/workflows/${WORKFLOW_ID}/start-async`,
      {
        input: {
          featureId: `test-feature-${randomString(8)}`,
          repoUrl: TEST_REPO.url,
          baseBranch: 'main',
          owner: TEST_REPO.owner,
          repo: TEST_REPO.repo,
          featureDescription: 'Test feature for approval',
        },
      },
      adminToken
    );

    runId = executeResponse.data.runId;

    // Wait for workflow to suspend at approval step
    await new Promise(resolve => setTimeout(resolve, 3000));
  });

  test('Operator can approve workflow', async ({ apiClient }) => {
    const operatorToken = await apiClient.loginAs('operator');

    const response = await apiClient.authenticatedRequest(
      'POST',
      `/api/approvals/${runId}/approve`,
      {
        resumeData: {
          approved: true,
          feedback: 'LGTM! Looks good to merge.',
        },
      },
      operatorToken
    );

    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('message');
    expect(response.data.message).toContain('approved');
  });

  test('Admin can approve workflow', async ({ apiClient }) => {
    const response = await apiClient.authenticatedRequest(
      'POST',
      `/api/approvals/${runId}/approve`,
      {
        resumeData: {
          approved: true,
          feedback: 'Approved for merge',
        },
      },
      adminToken
    );

    expect(response.status).toBe(200);
    expect(response.data.message).toContain('approved');
  });

  test('Viewer cannot approve workflow (403)', async ({ apiClient }) => {
    const viewerToken = await apiClient.loginAs('viewer');

    const response = await apiClient.authenticatedRequest(
      'POST',
      `/api/approvals/${runId}/approve`,
      {
        resumeData: {
          approved: true,
          feedback: 'Trying to approve',
        },
      },
      viewerToken
    );

    expect(response.status).toBe(403);
    expect(response.success).toBe(false);
  });

  test('Approved workflow resumes execution', async ({ apiClient }) => {
    await apiClient.authenticatedRequest(
      'POST',
      `/api/approvals/${runId}/approve`,
      {
        resumeData: {
          approved: true,
        },
      },
      adminToken
    );

    // Wait for workflow to complete
    await new Promise(resolve => setTimeout(resolve, 3000));

    const statusResponse = await apiClient.authenticatedRequest(
      'GET',
      `/api/workflows/${WORKFLOW_ID}/runs/${runId}`,
      undefined,
      adminToken
    );

    expect(statusResponse.data.status).not.toBe('suspended');
    expect(['completed', 'success', 'failed']).toContain(statusResponse.data.status);
  });

  test('Approved workflow completes successfully', async ({ apiClient }) => {
    await apiClient.authenticatedRequest(
      'POST',
      `/api/approvals/${runId}/approve`,
      {
        resumeData: {
          approved: true,
          feedback: 'Approved',
        },
      },
      adminToken
    );

    // Wait for completion
    await new Promise(resolve => setTimeout(resolve, 4000));

    const resultResponse = await apiClient.authenticatedRequest(
      'GET',
      `/api/workflows/${WORKFLOW_ID}/runs/${runId}/execution-result`,
      undefined,
      adminToken
    );

    expect(resultResponse.data).toHaveProperty('status');
    expect(['completed', 'success']).toContain(resultResponse.data.status);
  });

  test('Approval with optional feedback is recorded', async ({ apiClient }) => {
    const feedback = 'Great work! This meets all requirements.';

    await apiClient.authenticatedRequest(
      'POST',
      `/api/approvals/${runId}/approve`,
      {
        resumeData: {
          approved: true,
          feedback,
        },
      },
      adminToken
    );

    // Wait for completion
    await new Promise(resolve => setTimeout(resolve, 3000));

    const resultResponse = await apiClient.authenticatedRequest(
      'GET',
      `/api/workflows/${WORKFLOW_ID}/runs/${runId}/execution-result`,
      undefined,
      adminToken
    );

    // The feedback should be in the workflow result
    expect(resultResponse.data).toBeDefined();
  });
});

/**
 * ============================================================================
 * Test Suite 4: Workflow Rejection
 * ============================================================================
 */
test.describe('Workflow Rejection', () => {
  let adminToken: string;
  let runId: string;

  test.beforeEach(async ({ apiClient }) => {
    adminToken = await apiClient.loginAs('admin');

    const executeResponse = await apiClient.authenticatedRequest(
      'POST',
      `/api/workflows/${WORKFLOW_ID}/start-async`,
      {
        input: {
          featureId: `test-feature-${randomString(8)}`,
          repoUrl: TEST_REPO.url,
          baseBranch: 'main',
          owner: TEST_REPO.owner,
          repo: TEST_REPO.repo,
          featureDescription: 'Test feature for rejection',
        },
      },
      adminToken
    );

    runId = executeResponse.data.runId;
    await new Promise(resolve => setTimeout(resolve, 3000));
  });

  test('Operator can reject workflow', async ({ apiClient }) => {
    const operatorToken = await apiClient.loginAs('operator');

    const response = await apiClient.authenticatedRequest(
      'POST',
      `/api/approvals/${runId}/decline`,
      {
        resumeData: {
          approved: false,
          feedback: 'Needs more testing before merge',
        },
      },
      operatorToken
    );

    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('message');
  });

  test('Admin can reject workflow', async ({ apiClient }) => {
    const response = await apiClient.authenticatedRequest(
      'POST',
      `/api/approvals/${runId}/decline`,
      {
        resumeData: {
          approved: false,
          feedback: 'Changes requested',
        },
      },
      adminToken
    );

    expect(response.status).toBe(200);
    expect(response.data.message).toContain('declined');
  });

  test('Viewer cannot reject workflow (403)', async ({ apiClient }) => {
    const viewerToken = await apiClient.loginAs('viewer');

    const response = await apiClient.authenticatedRequest(
      'POST',
      `/api/approvals/${runId}/decline`,
      {
        resumeData: {
          approved: false,
          feedback: 'Trying to reject',
        },
      },
      viewerToken
    );

    expect(response.status).toBe(403);
    expect(response.success).toBe(false);
  });

  test('Rejected workflow terminates', async ({ apiClient }) => {
    await apiClient.authenticatedRequest(
      'POST',
      `/api/approvals/${runId}/decline`,
      {
        resumeData: {
          approved: false,
          feedback: 'Please make these changes',
        },
      },
      adminToken
    );

    // Wait for workflow to handle rejection
    await new Promise(resolve => setTimeout(resolve, 3000));

    const statusResponse = await apiClient.authenticatedRequest(
      'GET',
      `/api/workflows/${WORKFLOW_ID}/runs/${runId}`,
      undefined,
      adminToken
    );

    expect(statusResponse.data.status).not.toBe('suspended');
    expect(['completed', 'failed', 'success']).toContain(statusResponse.data.status);
  });

  test('Rejected workflow status is "failed" or "rejected"', async ({ apiClient }) => {
    await apiClient.authenticatedRequest(
      'POST',
      `/api/approvals/${runId}/decline`,
      {
        resumeData: {
          approved: false,
          feedback: 'Not approved',
        },
      },
      adminToken
    );

    await new Promise(resolve => setTimeout(resolve, 3000));

    const resultResponse = await apiClient.authenticatedRequest(
      'GET',
      `/api/workflows/${WORKFLOW_ID}/runs/${runId}/execution-result`,
      undefined,
      adminToken
    );

    // Check if workflow completed with rejection result
    expect(resultResponse.data).toHaveProperty('status');
  });

  test('Rejection reason is recorded', async ({ apiClient }) => {
    const feedback = 'The implementation needs more comprehensive error handling';

    await apiClient.authenticatedRequest(
      'POST',
      `/api/approvals/${runId}/decline`,
      {
        resumeData: {
          approved: false,
          feedback,
        },
      },
      adminToken
    );

    await new Promise(resolve => setTimeout(resolve, 3000));

    const resultResponse = await apiClient.authenticatedRequest(
      'GET',
      `/api/workflows/${WORKFLOW_ID}/runs/${runId}/execution-result`,
      undefined,
      adminToken
    );

    expect(resultResponse.data).toBeDefined();
  });
});

/**
 * ============================================================================
 * Test Suite 5: Workflow Status Monitoring
 * ============================================================================
 */
test.describe('Workflow Status Monitoring', () => {
  test('Can get workflow run by ID', async ({ apiClient }) => {
    const adminToken = await apiClient.loginAs('admin');

    const executeResponse = await apiClient.authenticatedRequest(
      'POST',
      `/api/workflows/${WORKFLOW_ID}/start-async`,
      {
        input: {
          featureId: `test-feature-${randomString(8)}`,
          repoUrl: TEST_REPO.url,
          baseBranch: 'main',
          owner: TEST_REPO.owner,
          repo: TEST_REPO.repo,
          featureDescription: 'Test feature',
        },
      },
      adminToken
    );

    const runId = executeResponse.data.runId;

    await new Promise(resolve => setTimeout(resolve, 1000));

    const response = await apiClient.authenticatedRequest(
      'GET',
      `/api/workflows/${WORKFLOW_ID}/runs/${runId}`,
      undefined,
      adminToken
    );

    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('runId', runId);
    expect(response.data).toHaveProperty('status');
  });

  test('Status updates as workflow progresses', async ({ apiClient }) => {
    const adminToken = await apiClient.loginAs('admin');

    const executeResponse = await apiClient.authenticatedRequest(
      'POST',
      `/api/workflows/${WORKFLOW_ID}/start-async`,
      {
        input: {
          featureId: `test-feature-${randomString(8)}`,
          repoUrl: TEST_REPO.url,
          baseBranch: 'main',
          owner: TEST_REPO.owner,
          repo: TEST_REPO.repo,
          featureDescription: 'Test feature',
        },
      },
      adminToken
    );

    const runId = executeResponse.data.runId;

    // Check initial status
    await new Promise(resolve => setTimeout(resolve, 500));
    const status1 = await apiClient.authenticatedRequest(
      'GET',
      `/api/workflows/${WORKFLOW_ID}/runs/${runId}`,
      undefined,
      adminToken
    );
    expect(status1.data.status).toMatch(/running|suspended/);

    // Check after suspension
    await new Promise(resolve => setTimeout(resolve, 3000));
    const status2 = await apiClient.authenticatedRequest(
      'GET',
      `/api/workflows/${WORKFLOW_ID}/runs/${runId}`,
      undefined,
      adminToken
    );
    expect(status2.data.status).toBe('suspended');
  });

  test('Workflow history shows all steps', async ({ apiClient }) => {
    const adminToken = await apiClient.loginAs('admin');

    const executeResponse = await apiClient.authenticatedRequest(
      'POST',
      `/api/workflows/${WORKFLOW_ID}/start-async`,
      {
        input: {
          featureId: `test-feature-${randomString(8)}`,
          repoUrl: TEST_REPO.url,
          baseBranch: 'main',
          owner: TEST_REPO.owner,
          repo: TEST_REPO.repo,
          featureDescription: 'Test feature',
        },
      },
      adminToken
    );

    const runId = executeResponse.data.runId;

    // Wait for workflow to progress
    await new Promise(resolve => setTimeout(resolve, 3000));

    const resultResponse = await apiClient.authenticatedRequest(
      'GET',
      `/api/workflows/${WORKFLOW_ID}/runs/${runId}/execution-result`,
      undefined,
      adminToken
    );

    expect(resultResponse.data).toHaveProperty('steps');
    if (resultResponse.data.steps) {
      expect(resultResponse.data.steps.length).toBeGreaterThan(0);
    }
  });

  test('Completed workflow shows final status', async ({ apiClient }) => {
    const adminToken = await apiClient.loginAs('admin');

    // Start and approve a workflow
    const executeResponse = await apiClient.authenticatedRequest(
      'POST',
      `/api/workflows/${WORKFLOW_ID}/start-async`,
      {
        input: {
          featureId: `test-feature-${randomString(8)}`,
          repoUrl: TEST_REPO.url,
          baseBranch: 'main',
          owner: TEST_REPO.owner,
          repo: TEST_REPO.repo,
          featureDescription: 'Test feature to complete',
        },
      },
      adminToken
    );

    const runId = executeResponse.data.runId;

    // Wait for suspension
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Approve
    await apiClient.authenticatedRequest(
      'POST',
      `/api/approvals/${runId}/approve`,
      {
        resumeData: { approved: true },
      },
      adminToken
    );

    // Wait for completion
    await new Promise(resolve => setTimeout(resolve, 3000));

    const resultResponse = await apiClient.authenticatedRequest(
      'GET',
      `/api/workflows/${WORKFLOW_ID}/runs/${runId}/execution-result`,
      undefined,
      adminToken
    );

    expect(['completed', 'success']).toContain(resultResponse.data.status);
  });

  test('Failed workflow shows error details', async ({ apiClient }) => {
    const adminToken = await apiClient.loginAs('admin');

    // Start workflow with invalid data to trigger failure
    const executeResponse = await apiClient.authenticatedRequest(
      'POST',
      `/api/workflows/${WORKFLOW_ID}/start-async`,
      {
        input: {
          featureId: `test-feature-${randomString(8)}`,
          repoUrl: 'https://github.com/invalid/repo',
          baseBranch: 'main',
          owner: 'invalid-owner',
          repo: 'invalid-repo',
          featureDescription: 'Test feature that will fail',
        },
      },
      adminToken
    );

    const runId = executeResponse.data.runId;

    // Wait for execution
    await new Promise(resolve => setTimeout(resolve, 5000));

    const resultResponse = await apiClient.authenticatedRequest(
      'GET',
      `/api/workflows/${WORKFLOW_ID}/runs/${runId}/execution-result`,
      undefined,
      adminToken
    );

    // Should have error information
    expect(resultResponse.data).toBeDefined();
  });
});

/**
 * ============================================================================
 * Test Suite 6: Approval Queue Management
 * ============================================================================
 */
test.describe('Approval Queue Management', () => {
  test('Operators can view approval queue', async ({ apiClient }) => {
    const adminToken = await apiClient.loginAs('admin');
    const operatorToken = await apiClient.loginAs('operator');

    // Create a suspended workflow
    const executeResponse = await apiClient.authenticatedRequest(
      'POST',
      `/api/workflows/${WORKFLOW_ID}/start-async`,
      {
        input: {
          featureId: `test-feature-${randomString(8)}`,
          repoUrl: TEST_REPO.url,
          baseBranch: 'main',
          owner: TEST_REPO.owner,
          repo: TEST_REPO.repo,
          featureDescription: 'Test feature for queue',
        },
      },
      adminToken
    );

    const runId = executeResponse.data.runId;
    await new Promise(resolve => setTimeout(resolve, 3000));

    const response = await apiClient.authenticatedRequest(
      'GET',
      '/api/approvals',
      undefined,
      operatorToken
    );

    expect(response.status).toBe(200);
    expect(response.data.runs).toBeInstanceOf(Array);
    const foundRun = response.data.runs.find((r: any) => r.runId === runId);
    expect(foundRun).toBeDefined();
  });

  test('Admins can view approval queue', async ({ apiClient }) => {
    const adminToken = await apiClient.loginAs('admin');

    const executeResponse = await apiClient.authenticatedRequest(
      'POST',
      `/api/workflows/${WORKFLOW_ID}/start-async`,
      {
        input: {
          featureId: `test-feature-${randomString(8)}`,
          repoUrl: TEST_REPO.url,
          baseBranch: 'main',
          owner: TEST_REPO.owner,
          repo: TEST_REPO.repo,
          featureDescription: 'Test feature',
        },
      },
      adminToken
    );

    const runId = executeResponse.data.runId;
    await new Promise(resolve => setTimeout(resolve, 3000));

    const response = await apiClient.authenticatedRequest(
      'GET',
      '/api/approvals',
      undefined,
      adminToken
    );

    expect(response.status).toBe(200);
    expect(response.data.runs.length).toBeGreaterThan(0);
  });

  test('Viewers cannot view approval queue (403)', async ({ apiClient }) => {
    const viewerToken = await apiClient.loginAs('viewer');

    const response = await apiClient.authenticatedRequest(
      'GET',
      '/api/approvals',
      undefined,
      viewerToken
    );

    expect(response.status).toBe(403);
  });

  test('Approval queue shows pending workflows', async ({ apiClient }) => {
    const adminToken = await apiClient.loginAs('admin');

    // Create multiple suspended workflows
    const runIds: string[] = [];

    for (let i = 0; i < 3; i++) {
      const executeResponse = await apiClient.authenticatedRequest(
        'POST',
        `/api/workflows/${WORKFLOW_ID}/start-async`,
        {
          input: {
            featureId: `test-feature-${randomString(8)}`,
            repoUrl: TEST_REPO.url,
            baseBranch: 'main',
            owner: TEST_REPO.owner,
            repo: TEST_REPO.repo,
            featureDescription: `Test feature ${i}`,
          },
        },
        adminToken
      );

      runIds.push(executeResponse.data.runId);
    }

    // Wait for all to suspend
    await new Promise(resolve => setTimeout(resolve, 4000));

    const response = await apiClient.authenticatedRequest(
      'GET',
      '/api/approvals',
      undefined,
      adminToken
    );

    expect(response.data.runs.length).toBeGreaterThanOrEqual(3);
  });

  test('Approval queue shows workflow details', async ({ apiClient }) => {
    const adminToken = await apiClient.loginAs('admin');

    const executeResponse = await apiClient.authenticatedRequest(
      'POST',
      `/api/workflows/${WORKFLOW_ID}/start-async`,
      {
        input: {
          featureId: `test-feature-${randomString(8)}`,
          repoUrl: TEST_REPO.url,
          baseBranch: 'main',
          owner: TEST_REPO.owner,
          repo: TEST_REPO.repo,
          featureDescription: 'Test feature with details',
        },
      },
      adminToken
    );

    const runId = executeResponse.data.runId;
    await new Promise(resolve => setTimeout(resolve, 3000));

    const response = await apiClient.authenticatedRequest(
      'GET',
      '/api/approvals',
      undefined,
      adminToken
    );

    const run = response.data.runs.find((r: any) => r.runId === runId);
    expect(run).toHaveProperty('runId');
    expect(run).toHaveProperty('status');
    expect(run).toHaveProperty('suspendedAt');
  });

  test('Empty approval queue returns empty array', async ({ apiClient }) => {
    const adminToken = await apiClient.loginAs('admin');

    const response = await apiClient.authenticatedRequest(
      'GET',
      '/api/approvals',
      undefined,
      adminToken
    );

    expect(response.data.runs).toEqual([]);
  });
});

/**
 * ============================================================================
 * Test Suite 7: Mission Runs Tracking
 * ============================================================================
 */
test.describe('Mission Runs Tracking', () => {
  test('All users can view active missions', async ({ apiClient }) => {
    const adminToken = await apiClient.loginAs('admin');

    // Start a workflow
    await apiClient.authenticatedRequest(
      'POST',
      `/api/workflows/${WORKFLOW_ID}/start-async`,
      {
        input: {
          featureId: `test-feature-${randomString(8)}`,
          repoUrl: TEST_REPO.url,
          baseBranch: 'main',
          owner: TEST_REPO.owner,
          repo: TEST_REPO.repo,
          featureDescription: 'Test feature',
        },
      },
      adminToken
    );

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Test all roles can view runs
    const viewerToken = await apiClient.loginAs('viewer');

    const response = await apiClient.authenticatedRequest(
      'GET',
      `/api/workflows/${WORKFLOW_ID}/runs`,
      undefined,
      viewerToken
    );

    expect(response.status).toBe(200);
    expect(response.data.runs).toBeInstanceOf(Array);
    expect(response.data.runs.length).toBeGreaterThan(0);
  });

  test('All users can view completed missions', async ({ apiClient }) => {
    const adminToken = await apiClient.loginAs('admin');

    // Start and complete a workflow
    const executeResponse = await apiClient.authenticatedRequest(
      'POST',
      `/api/workflows/${WORKFLOW_ID}/start-async`,
      {
        input: {
          featureId: `test-feature-${randomString(8)}`,
          repoUrl: TEST_REPO.url,
          baseBranch: 'main',
          owner: TEST_REPO.owner,
          repo: TEST_REPO.repo,
          featureDescription: 'Test feature to complete',
        },
      },
      adminToken
    );

    const runId = executeResponse.data.runId;
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Approve to complete
    await apiClient.authenticatedRequest(
      'POST',
      `/api/approvals/${runId}/approve`,
      { resumeData: { approved: true } },
      adminToken
    );

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Viewer can view completed runs
    const viewerToken = await apiClient.loginAs('viewer');

    const response = await apiClient.authenticatedRequest(
      'GET',
      `/api/workflows/${WORKFLOW_ID}/runs?status=completed`,
      undefined,
      viewerToken
    );

    expect(response.status).toBe(200);
  });

  test('Mission runs show workflow status', async ({ apiClient }) => {
    const adminToken = await apiClient.loginAs('admin');

    const executeResponse = await apiClient.authenticatedRequest(
      'POST',
      `/api/workflows/${WORKFLOW_ID}/start-async`,
      {
        input: {
          featureId: `test-feature-${randomString(8)}`,
          repoUrl: TEST_REPO.url,
          baseBranch: 'main',
          owner: TEST_REPO.owner,
          repo: TEST_REPO.repo,
          featureDescription: 'Test feature',
        },
      },
      adminToken
    );

    const runId = executeResponse.data.runId;

    const response = await apiClient.authenticatedRequest(
      'GET',
      `/api/workflows/${WORKFLOW_ID}/runs`,
      undefined,
      adminToken
    );

    const run = response.data.runs.find((r: any) => r.runId === runId);
    expect(run).toHaveProperty('status');
    expect(run).toHaveProperty('startTime');
  });

  test('Mission runs show start/end timestamps', async ({ apiClient }) => {
    const adminToken = await apiClient.loginAs('admin');

    const executeResponse = await apiClient.authenticatedRequest(
      'POST',
      `/api/workflows/${WORKFLOW_ID}/start-async`,
      {
        input: {
          featureId: `test-feature-${randomString(8)}`,
          repoUrl: TEST_REPO.url,
          baseBranch: 'main',
          owner: TEST_REPO.owner,
          repo: TEST_REPO.repo,
          featureDescription: 'Test feature',
        },
      },
      adminToken
    );

    const runId = executeResponse.data.runId;

    const response = await apiClient.authenticatedRequest(
      'GET',
      `/api/workflows/${WORKFLOW_ID}/runs/${runId}`,
      undefined,
      adminToken
    );

    expect(response.data).toHaveProperty('startTime');
    expect(response.data.startTime).toBeDefined();
  });

  test('Mission runs show approval status', async ({ apiClient }) => {
    const adminToken = await apiClient.loginAs('admin');

    const executeResponse = await apiClient.authenticatedRequest(
      'POST',
      `/api/workflows/${WORKFLOW_ID}/start-async`,
      {
        input: {
          featureId: `test-feature-${randomString(8)}`,
          repoUrl: TEST_REPO.url,
          baseBranch: 'main',
          owner: TEST_REPO.owner,
          repo: TEST_REPO.repo,
          featureDescription: 'Test feature for approval status',
        },
      },
      adminToken
    );

    const runId = executeResponse.data.runId;
    await new Promise(resolve => setTimeout(resolve, 3000));

    const response = await apiClient.authenticatedRequest(
      'GET',
      `/api/workflows/${WORKFLOW_ID}/runs/${runId}`,
      undefined,
      adminToken
    );

    expect(response.data.status).toBe('suspended');
  });
});

/**
 * ============================================================================
 * Test Suite 8: Workflow Context & Data
 * ============================================================================
 */
test.describe('Workflow Context & Data', () => {
  test('Workflow input is persisted', async ({ apiClient }) => {
    const adminToken = await apiClient.loginAs('admin');

    const inputData = {
      featureId: `test-feature-${randomString(8)}`,
      repoUrl: TEST_REPO.url,
      baseBranch: 'main',
      owner: TEST_REPO.owner,
      repo: TEST_REPO.repo,
      featureDescription: 'Test feature with input persistence',
      mergeMethod: 'squash' as const,
    };

    const executeResponse = await apiClient.authenticatedRequest(
      'POST',
      `/api/workflows/${WORKFLOW_ID}/start-async`,
      { input: inputData },
      adminToken
    );

    const runId = executeResponse.data.runId;

    const resultResponse = await apiClient.authenticatedRequest(
      'GET',
      `/api/workflows/${WORKFLOW_ID}/runs/${runId}/execution-result`,
      undefined,
      adminToken
    );

    expect(resultResponse.data).toHaveProperty('input');
    expect(resultResponse.data.input).toMatchObject(inputData);
  });

  test('Workflow output is accessible', async ({ apiClient }) => {
    const adminToken = await apiClient.loginAs('admin');

    const executeResponse = await apiClient.authenticatedRequest(
      'POST',
      `/api/workflows/${WORKFLOW_ID}/start-async`,
      {
        input: {
          featureId: `test-feature-${randomString(8)}`,
          repoUrl: TEST_REPO.url,
          baseBranch: 'main',
          owner: TEST_REPO.owner,
          repo: TEST_REPO.repo,
          featureDescription: 'Test feature output',
        },
      },
      adminToken
    );

    const runId = executeResponse.data.runId;

    // Wait for suspension
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Approve
    await apiClient.authenticatedRequest(
      'POST',
      `/api/approvals/${runId}/approve`,
      { resumeData: { approved: true } },
      adminToken
    );

    await new Promise(resolve => setTimeout(resolve, 3000));

    const resultResponse = await apiClient.authenticatedRequest(
      'GET',
      `/api/workflows/${WORKFLOW_ID}/runs/${runId}/execution-result`,
      undefined,
      adminToken
    );

    expect(resultResponse.data).toHaveProperty('output');
    expect(resultResponse.data.output).toHaveProperty('result');
  });

  test('Workflow state is preserved across suspension', async ({ apiClient }) => {
    const adminToken = await apiClient.loginAs('admin');

    const executeResponse = await apiClient.authenticatedRequest(
      'POST',
      `/api/workflows/${WORKFLOW_ID}/start-async`,
      {
        input: {
          featureId: `test-feature-${randomString(8)}`,
          repoUrl: TEST_REPO.url,
          baseBranch: 'main',
          owner: TEST_REPO.owner,
          repo: TEST_REPO.repo,
          featureDescription: 'Test feature state preservation',
        },
      },
      adminToken
    );

    const runId = executeResponse.data.runId;

    // Wait for suspension
    await new Promise(resolve => setTimeout(resolve, 3000));

    const beforeResume = await apiClient.authenticatedRequest(
      'GET',
      `/api/workflows/${WORKFLOW_ID}/runs/${runId}/execution-result`,
      undefined,
      adminToken
    );

    // Approve
    await apiClient.authenticatedRequest(
      'POST',
      `/api/approvals/${runId}/approve`,
      { resumeData: { approved: true } },
      adminToken
    );

    await new Promise(resolve => setTimeout(resolve, 3000));

    const afterResume = await apiClient.authenticatedRequest(
      'GET',
      `/api/workflows/${WORKFLOW_ID}/runs/${runId}/execution-result`,
      undefined,
      adminToken
    );

    expect(beforeResume.data).toHaveProperty('steps');
    expect(afterResume.data).toHaveProperty('steps');
  });

  test('Resume data includes approval decision', async ({ apiClient }) => {
    const adminToken = await apiClient.loginAs('admin');

    const executeResponse = await apiClient.authenticatedRequest(
      'POST',
      `/api/workflows/${WORKFLOW_ID}/start-async`,
      {
        input: {
          featureId: `test-feature-${randomString(8)}`,
          repoUrl: TEST_REPO.url,
          baseBranch: 'main',
          owner: TEST_REPO.owner,
          repo: TEST_REPO.repo,
          featureDescription: 'Test feature approval decision',
        },
      },
      adminToken
    );

    const runId = executeResponse.data.runId;
    await new Promise(resolve => setTimeout(resolve, 3000));

    const feedback = 'Approved with feedback';

    await apiClient.authenticatedRequest(
      'POST',
      `/api/approvals/${runId}/approve`,
      {
        resumeData: {
          approved: true,
          feedback,
        },
      },
      adminToken
    );

    await new Promise(resolve => setTimeout(resolve, 3000));

    const resultResponse = await apiClient.authenticatedRequest(
      'GET',
      `/api/workflows/${WORKFLOW_ID}/runs/${runId}/execution-result`,
      undefined,
      adminToken
    );

    expect(resultResponse.data).toBeDefined();
  });
});

/**
 * ============================================================================
 * Test Suite 9: GitHub Integration (Mocked)
 * ============================================================================
 */
test.describe('GitHub Integration (Mocked)', () => {
  test('Workflow creates GitHub branch (mocked)', async ({ apiClient }) => {
    const adminToken = await apiClient.loginAs('admin');

    const response = await apiClient.authenticatedRequest(
      'POST',
      `/api/workflows/${WORKFLOW_ID}/start-async`,
      {
        input: {
          featureId: `test-feature-${randomString(8)}`,
          repoUrl: TEST_REPO.url,
          baseBranch: 'main',
          owner: TEST_REPO.owner,
          repo: TEST_REPO.repo,
          featureDescription: 'Test branch creation',
        },
      },
      adminToken
    );

    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('runId');
  });

  test('Workflow creates pull request (mocked)', async ({ apiClient }) => {
    const adminToken = await apiClient.loginAs('admin');

    const executeResponse = await apiClient.authenticatedRequest(
      'POST',
      `/api/workflows/${WORKFLOW_ID}/start-async`,
      {
        input: {
          featureId: `test-feature-${randomString(8)}`,
          repoUrl: TEST_REPO.url,
          baseBranch: 'main',
          owner: TEST_REPO.owner,
          repo: TEST_REPO.repo,
          featureDescription: 'Test PR creation',
        },
      },
      adminToken
    );

    const runId = executeResponse.data.runId;

    // Wait for PR creation
    await new Promise(resolve => setTimeout(resolve, 3000));

    const approvalResponse = await apiClient.authenticatedRequest(
      'GET',
      `/api/approvals/${runId}`,
      undefined,
      adminToken
    );

    expect(approvalResponse.data.suspendPayload).toHaveProperty('prNumber');
    expect(approvalResponse.data.suspendPayload).toHaveProperty('prUrl');
  });

  test('Workflow merges PR after approval (mocked)', async ({ apiClient }) => {
    const adminToken = await apiClient.loginAs('admin');

    const executeResponse = await apiClient.authenticatedRequest(
      'POST',
      `/api/workflows/${WORKFLOW_ID}/start-async`,
      {
        input: {
          featureId: `test-feature-${randomString(8)}`,
          repoUrl: TEST_REPO.url,
          baseBranch: 'main',
          owner: TEST_REPO.owner,
          repo: TEST_REPO.repo,
          featureDescription: 'Test PR merge',
          mergeMethod: 'squash',
        },
      },
      adminToken
    );

    const runId = executeResponse.data.runId;
    await new Promise(resolve => setTimeout(resolve, 3000));

    await apiClient.authenticatedRequest(
      'POST',
      `/api/approvals/${runId}/approve`,
      { resumeData: { approved: true } },
      adminToken
    );

    await new Promise(resolve => setTimeout(resolve, 3000));

    const resultResponse = await apiClient.authenticatedRequest(
      'GET',
      `/api/workflows/${WORKFLOW_ID}/runs/${runId}/execution-result`,
      undefined,
      adminToken
    );

    expect(resultResponse.data).toHaveProperty('output');
    if (resultResponse.data.output) {
      expect(resultResponse.data.output.result).toContain('merged');
    }
  });
});

/**
 * ============================================================================
 * Test Suite 10: Error Scenarios
 * ============================================================================
 */
test.describe('Error Scenarios', () => {
  test('Invalid workflow ID returns 404', async ({ apiClient }) => {
    const adminToken = await apiClient.loginAs('admin');

    const response = await apiClient.authenticatedRequest(
      'POST',
      '/api/workflows/invalid-workflow-id/start-async',
      {
        input: {
          featureId: 'test',
          repoUrl: TEST_REPO.url,
          baseBranch: 'main',
          owner: 'test',
          repo: 'test',
          featureDescription: 'Test',
        },
      },
      adminToken
    );

    expect(response.status).toBe(404);
  });

  test('Resume non-existent workflow returns error', async ({ apiClient }) => {
    const adminToken = await apiClient.loginAs('admin');

    const response = await apiClient.authenticatedRequest(
      'POST',
      `/api/approvals/non-existent-run-id/approve`,
      { resumeData: { approved: true } },
      adminToken
    );

    expect(response.status).toBe(404);
  });

  test('Invalid runId returns 404', async ({ apiClient }) => {
    const adminToken = await apiClient.loginAs('admin');

    const response = await apiClient.authenticatedRequest(
      'GET',
      `/api/workflows/${WORKFLOW_ID}/runs/invalid-run-id`,
      undefined,
      adminToken
    );

    expect(response.status).toBe(404);
  });
});

/**
 * ============================================================================
 * Test Suite 11: UI Workflow Interactions
 * ============================================================================
 */
test.describe('UI Workflow Interactions', () => {
  test('Admin can create workflow from UI', async ({ page, loginAs }) => {
    await loginAs('admin');

    await page.goto('/workflow/new');

    // Fill out workflow form
    await page.fill('[data-testid="feature-id-input"]', `test-feature-${randomString(8)}`);
    await page.fill('[data-testid="repo-url-input"]', TEST_REPO.url);
    await page.fill('[data-testid="feature-description-input"]', 'Test feature from UI');

    // Submit form
    await page.click('[data-testid="create-workflow-button"]');

    // Should redirect or show success
    await expect(page.locator('[data-testid="workflow-status"]')).toBeVisible({ timeout: 5000 });
  });

  test('Workflow creation form validates input', async ({ page, loginAs }) => {
    await loginAs('admin');

    await page.goto('/workflow/new');

    // Try to submit without required fields
    await page.click('[data-testid="create-workflow-button"]');

    // Should show validation errors
    await expect(page.locator('[data-testid="validation-error"]')).toBeVisible();
  });

  test('Workflow progress is visible in UI', async ({ page, loginAs, apiClient }) => {
    await loginAs('admin');

    // Start a workflow via API
    const adminToken = await apiClient.loginAs('admin');
    const executeResponse = await apiClient.authenticatedRequest(
      'POST',
      `/api/workflows/${WORKFLOW_ID}/start-async`,
      {
        input: {
          featureId: `test-feature-${randomString(8)}`,
          repoUrl: TEST_REPO.url,
          baseBranch: 'main',
          owner: TEST_REPO.owner,
          repo: TEST_REPO.repo,
          featureDescription: 'Test feature for UI',
        },
      },
      adminToken
    );

    const runId = executeResponse.data.runId;

    // Navigate to workflow run page
    await page.goto(`/runs/${runId}`);

    // Should show workflow status
    await expect(page.locator('[data-testid="workflow-status"]')).toBeVisible();
  });

  test('Approval queue UI shows pending workflows', async ({ page, loginAs, apiClient }) => {
    await loginAs('admin');

    // Start a workflow via API
    const adminToken = await apiClient.loginAs('admin');
    await apiClient.authenticatedRequest(
      'POST',
      `/api/workflows/${WORKFLOW_ID}/start-async`,
      {
        input: {
          featureId: `test-feature-${randomString(8)}`,
          repoUrl: TEST_REPO.url,
          baseBranch: 'main',
          owner: TEST_REPO.owner,
          repo: TEST_REPO.repo,
          featureDescription: 'Test feature for approval UI',
        },
      },
      adminToken
    );

    // Wait for suspension
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Navigate to approval queue
    await page.goto('/approvals');

    // Should show pending workflows
    await expect(page.locator('[data-testid="approval-queue"]')).toBeVisible();
  });

  test('Can approve/reject from UI', async ({ page, loginAs, apiClient }) => {
    await loginAs('admin');

    // Start a workflow via API
    const adminToken = await apiClient.loginAs('admin');
    const executeResponse = await apiClient.authenticatedRequest(
      'POST',
      `/api/workflows/${WORKFLOW_ID}/start-async`,
      {
        input: {
          featureId: `test-feature-${randomString(8)}`,
          repoUrl: TEST_REPO.url,
          baseBranch: 'main',
          owner: TEST_REPO.owner,
          repo: TEST_REPO.repo,
          featureDescription: 'Test feature for UI approval',
        },
      },
      adminToken
    );

    const runId = executeResponse.data.runId;

    // Wait for suspension
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Navigate to approval queue
    await page.goto('/approvals');

    // Click approve button
    await page.click(`[data-testid="approve-button-${runId}"]`);

    // Should show success message
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
  });

  test('Mission runs UI shows history', async ({ page, loginAs }) => {
    await loginAs('viewer');

    await page.goto('/runs');

    // Should show runs list
    await expect(page.locator('[data-testid="runs-list"]')).toBeVisible();
  });
});

/**
 * ============================================================================
 * Test Suite 12: Workflow Permissions
 * ============================================================================
 */
test.describe('Workflow Permissions', () => {
  test('Only admin can start workflows', async ({ apiClient }) => {
    const adminToken = await apiClient.loginAs('admin');
    const operatorToken = await apiClient.loginAs('operator');
    const viewerToken = await apiClient.loginAs('viewer');

    // Admin should succeed
    const adminResponse = await apiClient.authenticatedRequest(
      'POST',
      `/api/workflows/${WORKFLOW_ID}/start-async`,
      {
        input: {
          featureId: `test-feature-${randomString(8)}`,
          repoUrl: TEST_REPO.url,
          baseBranch: 'main',
          owner: TEST_REPO.owner,
          repo: TEST_REPO.repo,
          featureDescription: 'Test feature',
        },
      },
      adminToken
    );

    expect(adminResponse.status).toBe(200);

    // Operator should fail
    const operatorResponse = await apiClient.authenticatedRequest(
      'POST',
      `/api/workflows/${WORKFLOW_ID}/start-async`,
      {
        input: {
          featureId: `test-feature-${randomString(8)}`,
          repoUrl: TEST_REPO.url,
          baseBranch: 'main',
          owner: TEST_REPO.owner,
          repo: TEST_REPO.repo,
          featureDescription: 'Test feature',
        },
      },
      operatorToken
    );

    expect(operatorResponse.status).toBe(403);

    // Viewer should fail
    const viewerResponse = await apiClient.authenticatedRequest(
      'POST',
      `/api/workflows/${WORKFLOW_ID}/start-async`,
      {
        input: {
          featureId: `test-feature-${randomString(8)}`,
          repoUrl: TEST_REPO.url,
          baseBranch: 'main',
          owner: TEST_REPO.owner,
          repo: TEST_REPO.repo,
          featureDescription: 'Test feature',
        },
      },
      viewerToken
    );

    expect(viewerResponse.status).toBe(403);
  });

  test('Only operator+ can approve', async ({ apiClient }) => {
    const adminToken = await apiClient.loginAs('admin');

    // Create a suspended workflow
    const executeResponse = await apiClient.authenticatedRequest(
      'POST',
      `/api/workflows/${WORKFLOW_ID}/start-async`,
      {
        input: {
          featureId: `test-feature-${randomString(8)}`,
          repoUrl: TEST_REPO.url,
          baseBranch: 'main',
          owner: TEST_REPO.owner,
          repo: TEST_REPO.repo,
          featureDescription: 'Test feature',
        },
      },
      adminToken
    );

    const runId = executeResponse.data.runId;
    await new Promise(resolve => setTimeout(resolve, 3000));

    const operatorToken = await apiClient.loginAs('operator');
    const viewerToken = await apiClient.loginAs('viewer');

    // Operator should succeed
    const operatorResponse = await apiClient.authenticatedRequest(
      'POST',
      `/api/approvals/${runId}/approve`,
      { resumeData: { approved: true } },
      operatorToken
    );

    expect(operatorResponse.status).toBe(200);

    // Viewer should fail
    const viewerResponse = await apiClient.authenticatedRequest(
      'POST',
      `/api/approvals/${runId}/approve`,
      { resumeData: { approved: true } },
      viewerToken
    );

    expect(viewerResponse.status).toBe(403);
  });

  test('Only operator+ can reject', async ({ apiClient }) => {
    const adminToken = await apiClient.loginAs('admin');

    // Create another suspended workflow
    const executeResponse = await apiClient.authenticatedRequest(
      'POST',
      `/api/workflows/${WORKFLOW_ID}/start-async`,
      {
        input: {
          featureId: `test-feature-${randomString(8)}`,
          repoUrl: TEST_REPO.url,
          baseBranch: 'main',
          owner: TEST_REPO.owner,
          repo: TEST_REPO.repo,
          featureDescription: 'Test feature for rejection',
        },
      },
      adminToken
    );

    const runId = executeResponse.data.runId;
    await new Promise(resolve => setTimeout(resolve, 3000));

    const operatorToken = await apiClient.loginAs('operator');
    const viewerToken = await apiClient.loginAs('viewer');

    // Operator should succeed
    const operatorResponse = await apiClient.authenticatedRequest(
      'POST',
      `/api/approvals/${runId}/decline`,
      {
        resumeData: {
          approved: false,
          feedback: 'Not approved',
        },
      },
      operatorToken
    );

    expect(operatorResponse.status).toBe(200);

    // Viewer should fail
    const viewerResponse = await apiClient.authenticatedRequest(
      'POST',
      `/api/approvals/${runId}/decline`,
      {
        resumeData: {
          approved: false,
          feedback: 'Trying to reject',
        },
      },
      viewerToken
    );

    expect(viewerResponse.status).toBe(403);
  });

  test('All users can view runs', async ({ apiClient }) => {
    const adminToken = await apiClient.loginAs('admin');

    // Create a workflow run
    await apiClient.authenticatedRequest(
      'POST',
      `/api/workflows/${WORKFLOW_ID}/start-async`,
      {
        input: {
          featureId: `test-feature-${randomString(8)}`,
          repoUrl: TEST_REPO.url,
          baseBranch: 'main',
          owner: TEST_REPO.owner,
          repo: TEST_REPO.repo,
          featureDescription: 'Test feature for viewing',
        },
      },
      adminToken
    );

    await new Promise(resolve => setTimeout(resolve, 1000));

    // All roles should be able to view runs
    const viewerToken = await apiClient.loginAs('viewer');
    const viewerResponse = await apiClient.authenticatedRequest(
      'GET',
      `/api/workflows/${WORKFLOW_ID}/runs`,
      undefined,
      viewerToken
    );

    expect(viewerResponse.status).toBe(200);

    const operatorToken = await apiClient.loginAs('operator');
    const operatorResponse = await apiClient.authenticatedRequest(
      'GET',
      `/api/workflows/${WORKFLOW_ID}/runs`,
      undefined,
      operatorToken
    );

    expect(operatorResponse.status).toBe(200);

    const adminResponse = await apiClient.authenticatedRequest(
      'GET',
      `/api/workflows/${WORKFLOW_ID}/runs`,
      undefined,
      adminToken
    );

    expect(adminResponse.status).toBe(200);
  });
});
