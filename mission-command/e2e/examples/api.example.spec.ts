/**
 * Example E2E Test: API Client Usage
 *
 * Demonstrates how to test API endpoints with the provided utilities.
 */

import { test, expect } from '../helpers';
import { APIClient, createTestClient, createMultipleTestClients } from '../utils/api-client';

test.describe('API Client Tests', () => {
  let adminClient: APIClient;
  let operatorClient: APIClient;
  let viewerClient: APIClient;

  test.beforeAll(async () => {
    // Create clients for different roles
    [adminClient, operatorClient, viewerClient] = await createMultipleTestClients([
      'admin',
      'operator',
      'viewer',
    ]);
  });

  test('admin should be able to list all users', async () => {
    const response = await adminClient.getUsers();

    expect(response.success).toBe(true);
    expect(response.status).toBe(200);
    expect(response.data?.users).toBeDefined();
    expect(Array.isArray(response.data?.users)).toBe(true);
  });

  test('operator should not be able to list users', async () => {
    const response = await operatorClient.getUsers();

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.success).toBe(false);
  });

  test('admin should be able to create new user', async () => {
    const newUser = {
      email: 'test@example.com',
      name: 'Test User',
      role: 'operator' as const,
      provider: 'github' as const,
    };

    const response = await adminClient.createTestUser(adminClient.getToken()!, newUser);

    expect(response.success).toBe(true);
    expect(response.status).toBe(201);
    expect(response.data?.email).toBe(newUser.email);
  });

  test('admin should be able to update user role', async () => {
    // First create a user
    const newUser = {
      email: 'update-test@example.com',
      name: 'Update Test User',
      role: 'viewer' as const,
      provider: 'github' as const,
    };

    const createResponse = await adminClient.createTestUser(adminClient.getToken()!, newUser);
    const userId = createResponse.data?.id;

    expect(userId).toBeDefined();

    // Update user role
    const updateResponse = await adminClient.updateTestUser(adminClient.getToken()!, userId, {
      role: 'operator',
    });

    expect(updateResponse.success).toBe(true);
    expect(updateResponse.data?.role).toBe('operator');
  });

  test('admin should be able to delete user', async () => {
    // Create a user to delete
    const newUser = {
      email: 'delete-test@example.com',
      name: 'Delete Test User',
      role: 'viewer' as const,
      provider: 'github' as const,
    };

    const createResponse = await adminClient.createTestUser(adminClient.getToken()!, newUser);
    const userId = createResponse.data?.id;

    expect(userId).toBeDefined();

    // Delete user
    const deleteResponse = await adminClient.deleteTestUser(adminClient.getToken()!, userId);

    expect(deleteResponse.success).toBe(true);
    expect(deleteResponse.status).toBe(204);
  });

  test('viewer should be able to view approvals', async () => {
    const response = await viewerClient.authenticatedRequest('GET', '/api/approvals');

    expect(response.success).toBe(true);
    expect(response.status).toBe(200);
  });

  test('operator should be able to approve workflow', async () => {
    const approvalData = {
      workflowId: 'test-workflow-id',
      status: 'approved',
    };

    const response = await operatorClient.authenticatedRequest(
      'POST',
      '/api/approvals',
      approvalData
    );

    expect(response.success).toBe(true);
    expect(response.status).toBe(201);
  });

  test('viewer should not be able to approve workflow', async () => {
    const approvalData = {
      workflowId: 'test-workflow-id',
      status: 'approved',
    };

    const response = await viewerClient.authenticatedRequest(
      'POST',
      '/api/approvals',
      approvalData
    );

    expect(response.success).toBe(false);
    expect(response.status).toBeGreaterThanOrEqual(400);
  });

  test('should be able to logout and invalidate session', async () => {
    const client = await createTestClient('admin');

    // Logout
    const response = await client.logout(client.getToken()!);

    expect(response.success).toBe(true);
    expect(response.data?.success).toBe(true);

    // Try to use token after logout
    const failedResponse = await client.authenticatedRequest('GET', '/api/users');

    expect(failedResponse.success).toBe(false);
  });

  test('should be able to invalidate all sessions', async () => {
    const client = await createTestClient('admin');

    // Invalidate all sessions
    const response = await client.invalidateAllSessions(client.getToken()!);

    expect(response.success).toBe(true);
    expect(response.data?.success).toBe(true);
  });

  test('should be able to get audit logs', async () => {
    const response = await adminClient.getAuditLogs(adminClient.getToken()!);

    expect(response.success).toBe(true);
    expect(response.status).toBe(200);
    expect(Array.isArray(response.data)).toBe(true);
  });

  test('should be able to get user sessions', async () => {
    // Get current user info first
    const userResponse = await adminClient.getUserInfo(adminClient.getToken()!);
    const userId = userResponse.data?.id;

    expect(userId).toBeDefined();

    // Get user sessions
    const sessionsResponse = await adminClient.getUserSessions(
      adminClient.getToken()!,
      userId
    );

    expect(sessionsResponse.success).toBe(true);
    expect(sessionsResponse.data?.sessions).toBeDefined();
    expect(Array.isArray(sessionsResponse.data?.sessions)).toBe(true);
  });

  test('should handle expired tokens gracefully', async () => {
    const client = new APIClient();

    // Generate expired token
    const expiredToken = await client.generateExpiredToken('viewer');
    client.setToken(expiredToken);

    // Try to make request with expired token
    const response = await client.authenticatedRequest('GET', '/api/approvals');

    expect(response.success).toBe(false);
    expect(response.status).toBe(401);
  });

  test('should handle invalid tokens gracefully', async () => {
    const client = new APIClient();

    // Set invalid token
    client.setToken('invalid.token.here');

    // Try to make request
    const response = await client.authenticatedRequest('GET', '/api/approvals');

    expect(response.success).toBe(false);
    expect(response.status).toBe(401);
  });
});

test.describe('API Rate Limiting', () => {
  test('should enforce rate limits', async () => {
    const client = await createTestClient('viewer');

    // Make many requests quickly
    const requests = Array(100).fill(null).map(() =>
      client.authenticatedRequest('GET', '/api/approvals')
    );

    const responses = await Promise.all(requests);

    // At least some requests should be rate limited
    const rateLimitedResponses = responses.filter(r => r.status === 429);

    expect(rateLimitedResponses.length).toBeGreaterThan(0);
  });
});
