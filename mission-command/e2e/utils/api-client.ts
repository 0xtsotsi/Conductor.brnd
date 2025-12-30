/**
 * API Test Client for E2E Testing
 *
 * Provides a client for making authenticated API requests in tests.
 * Handles user management, session management, and authentication tokens.
 *
 * @packageDocumentation
 */

import {
  generateMockToken,
  generateExpiredToken,
  generateMockRefreshToken,
  TEST_USERS,
  type UserRole,
  type OAuthProvider,
} from './oauth-mocks.js';

/**
 * HTTP methods
 */
type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

/**
 * API response wrapper
 */
export interface APIResponse<T = any> {
  data?: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  success: boolean;
}

/**
 * User data structure
 */
export interface UserData {
  id?: string;
  email: string;
  name: string;
  role: UserRole;
  provider: OAuthProvider;
}

/**
 * Create user request
 */
export interface CreateUserRequest {
  email: string;
  name: string;
  role: UserRole;
  provider?: OAuthProvider;
}

/**
 * Update user request
 */
export interface UpdateUserRequest {
  email?: string;
  name?: string;
  role?: UserRole;
}

/**
 * Session data
 */
export interface SessionData {
  id: string;
  userId: string;
  expiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * API client configuration
 */
interface APIClientConfig {
  baseURL?: string;
  timeout?: number;
}

/**
 * API Client class for making authenticated requests
 */
export class APIClient {
  private baseURL: string;
  private timeout: number;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;

  constructor(config: APIClientConfig = {}) {
    this.baseURL = config.baseURL || process.env.VITE_MASTRA_API_URL || process.env.MASTRA_API_URL || 'http://localhost:4111';
    this.timeout = config.timeout || 30000;
  }

  /**
   * Make an authenticated API request
   *
   * @param method - HTTP method
   * @param endpoint - API endpoint (e.g., '/api/users')
   * @param body - Request body (optional)
   * @param token - JWT token (optional, uses current token if not provided)
   * @returns API response
   *
   * @example
   * ```typescript
   * const client = new APIClient();
   * const response = await client.authenticatedRequest('GET', '/api/users');
   * ```
   */
  async authenticatedRequest<T = any>(
    method: HTTPMethod,
    endpoint: string,
    body?: any,
    token?: string
  ): Promise<APIResponse<T>> {
    const authToken = token || this.accessToken;

    if (!authToken) {
      throw new Error('No access token available. Please login first.');
    }

    const url = `${this.baseURL}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
    };

    const options: RequestInit = {
      method,
      headers,
      signal: AbortSignal.timeout(this.timeout),
    };

    if (body && method !== 'GET') {
      options.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url, options);
      const responseData = await this.parseResponse<T>(response);

      return {
        data: responseData,
        status: response.status,
        statusText: response.statusText,
        headers: this.parseHeaders(response.headers),
        success: response.ok,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`API request failed: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Get current user info
   *
   * @param token - JWT token (optional)
   * @returns User data
   *
   * @example
   * ```typescript
   * const user = await client.getUserInfo();
   * console.log(user.email, user.role);
   * ```
   */
  async getUserInfo(token?: string): Promise<APIResponse<UserData>> {
    return this.authenticatedRequest<UserData>('GET', '/api/auth/me', undefined, token);
  }

  /**
   * List all users (admin only)
   *
   * @param token - JWT token (optional)
   * @param limit - Maximum number of users to return (default: 50)
   * @param offset - Offset for pagination (default: 0)
   * @param filters - Optional filters (role, search)
   * @returns List of users
   *
   * @example
   * ```typescript
   * const users = await client.getUsers(adminToken, 10, 0, { role: 'admin' });
   * ```
   */
  async getUsers(
    token?: string,
    limit: number = 50,
    offset: number = 0,
    filters?: { role?: string; search?: string }
  ): Promise<APIResponse<{ users: UserData[]; total: number }>> {
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
    });

    if (filters?.role) {
      params.append('role', filters.role);
    }

    if (filters?.search) {
      params.append('search', filters.search);
    }

    return this.authenticatedRequest(
      'GET',
      `/api/users?${params.toString()}`,
      undefined,
      token
    );
  }

  /**
   * Create a test user
   *
   * @param token - JWT token with admin permissions
   * @param userData - User data
   * @returns Created user
   *
   * @example
   * ```typescript
   * const newUser = await client.createTestUser(adminToken, {
   *   email: 'test@example.com',
   *   name: 'Test User',
   *   role: 'operator',
   * });
   * ```
   */
  async createTestUser(token: string, userData: CreateUserRequest): Promise<APIResponse<UserData>> {
    return this.authenticatedRequest<UserData>('POST', '/api/users', userData, token);
  }

  /**
   * Delete a test user
   *
   * @param token - JWT token with admin permissions
   * @param userId - User ID to delete
   * @returns Response
   *
   * @example
   * ```typescript
   * await client.deleteTestUser(adminToken, userId);
   * ```
   */
  async deleteTestUser(token: string, userId: string): Promise<APIResponse<void>> {
    return this.authenticatedRequest<void>('DELETE', `/api/users/${userId}`, undefined, token);
  }

  /**
   * Update a test user
   *
   * @param token - JWT token with admin permissions
   * @param userId - User ID to update
   * @param updates - User data to update
   * @returns Updated user
   *
   * @example
   * ```typescript
   * const updated = await client.updateTestUser(adminToken, userId, {
   *   role: 'admin',
   * });
   * ```
   */
  async updateTestUser(
    token: string,
    userId: string,
    updates: UpdateUserRequest
  ): Promise<APIResponse<UserData>> {
    return this.authenticatedRequest<UserData>('PUT', `/api/users/${userId}`, updates, token);
  }

  /**
   * Invalidate all sessions for a user
   *
   * @param token - JWT token
   * @returns Response
   *
   * @example
   * ```typescript
   * await client.invalidateAllSessions(token);
   * ```
   */
  async invalidateAllSessions(token: string): Promise<APIResponse<{ success: boolean; deletedCount: number }>> {
    return this.authenticatedRequest('POST', '/api/auth/logout-all', undefined, token);
  }

  /**
   * Invalidate current session
   *
   * @param token - JWT token
   * @returns Response
   *
   * @example
   * ```typescript
   * await client.logout(token);
   * ```
   */
  async logout(token: string): Promise<APIResponse<{ success: boolean }>> {
    return this.authenticatedRequest('POST', '/api/auth/logout', undefined, token);
  }

  /**
   * Refresh access token
   *
   * @param refreshToken - Refresh token
   * @returns New tokens
   *
   * @example
   * ```typescript
   * const tokens = await client.refreshAccessToken(refreshToken);
   * this.accessToken = tokens.accessToken;
   * ```
   */
  async refreshAccessToken(refreshToken: string): Promise<APIResponse<{
    accessToken: string;
    refreshToken: string;
    tokenType: string;
    expiresIn: string;
  }>> {
    const response = await fetch(`${this.baseURL}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
      signal: AbortSignal.timeout(this.timeout),
    });

    const data = await response.json();

    return {
      data,
      status: response.status,
      statusText: response.statusText,
      headers: this.parseHeaders(response.headers),
      success: response.ok,
    };
  }

  /**
   * Get user sessions
   *
   * @param token - JWT token
   * @param userId - User ID
   * @param limit - Maximum sessions (default: 50)
   * @param offset - Pagination offset (default: 0)
   * @returns User sessions
   *
   * @example
   * ```typescript
   * const sessions = await client.getUserSessions(token, userId);
   * ```
   */
  async getUserSessions(
    token: string,
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<APIResponse<{ sessions: SessionData[]; total: number }>> {
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
    });

    return this.authenticatedRequest(
      'GET',
      `/api/users/${userId}/sessions?${params.toString()}`,
      undefined,
      token
    );
  }

  /**
   * Get audit logs
   *
   * @param token - JWT token
   * @param userId - User ID (optional, get all if admin)
   * @param limit - Maximum logs (default: 100)
   * @param offset - Pagination offset (default: 0)
   * @returns Audit logs
   *
   * @example
   * ```typescript
   * const logs = await client.getAuditLogs(token, userId);
   * ```
   */
  async getAuditLogs(
    token: string,
    userId?: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<APIResponse<any[]>> {
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
    });

    const endpoint = userId
      ? `/api/users/${userId}/audit-logs?${params.toString()}`
      : `/api/audit-logs?${params.toString()}`;

    return this.authenticatedRequest(endpoint, undefined, undefined, token);
  }

  /**
   * Login as a test user and set access token
   *
   * @param role - User role
   * @param provider - OAuth provider
   * @returns Access token
   *
   * @example
   * ```typescript
   * await client.loginAs('admin');
   * const users = await client.getUsers();
   * ```
   */
  async loginAs(role: UserRole = 'viewer', provider: OAuthProvider = 'github'): Promise<string> {
    const profile = TEST_USERS[role];
    const token = await generateMockToken(
      {
        ...profile,
        provider,
      },
      role
    );

    this.accessToken = token;
    this.refreshToken = generateMockRefreshToken(role);

    return token;
  }

  /**
   * Set access token manually
   *
   * @param token - JWT token
   *
   * @example
   * ```typescript
   * client.setToken(customToken);
   * ```
   */
  setToken(token: string): void {
    this.accessToken = token;
  }

  /**
   * Get current access token
   *
   * @returns Access token or null
   */
  getToken(): string | null {
    return this.accessToken;
  }

  /**
   * Set refresh token manually
   *
   * @param token - Refresh token
   *
   * @example
   * ```typescript
   * client.setRefreshToken(refreshToken);
   * ```
   */
  setRefreshToken(token: string): void {
    this.refreshToken = token;
  }

  /**
   * Get current refresh token
   *
   * @returns Refresh token or null
   */
  getRefreshToken(): string | null {
    return this.refreshToken;
  }

  /**
   * Clear all tokens
   */
  clearTokens(): void {
    this.accessToken = null;
    this.refreshToken = null;
  }

  /**
   * Generate expired token for testing
   *
   * @param role - User role
   * @returns Expired JWT token
   *
   * @example
   * ```typescript
   * const expiredToken = await client.generateExpiredToken('viewer');
   * client.setToken(expiredToken);
   * // This request should fail with 401
   * ```
   */
  async generateExpiredToken(role: UserRole = 'viewer'): Promise<string> {
    const profile = TEST_USERS[role];
    return generateExpiredToken(profile, role);
  }

  /**
   * Parse response body
   */
  private async parseResponse<T>(response: Response): Promise<T | null> {
    const contentType = response.headers.get('content-type');

    if (!contentType) {
      return null;
    }

    if (contentType.includes('application/json')) {
      return response.json();
    }

    if (contentType.includes('text/')) {
      return response.text() as any;
    }

    return null;
  }

  /**
   * Parse response headers
   */
  private parseHeaders(headers: Headers): Record<string, string> {
    const result: Record<string, string> = {};

    headers.forEach((value, key) => {
      result[key] = value;
    });

    return result;
  }
}

/**
 * Create a pre-configured API client for testing
 *
 * @param role - User role to login as
 * @param config - Client configuration
 * @returns Configured API client
 *
 * @example
 * ```typescript
 * const adminClient = createTestClient('admin');
 * const users = await adminClient.getUsers();
 * ```
 */
export async function createTestClient(
  role: UserRole = 'viewer',
  config?: APIClientConfig
): Promise<APIClient> {
  const client = new APIClient(config);
  await client.loginAs(role);
  return client;
}

/**
 * Create multiple test clients for different users
 *
 * @param roles - Array of user roles
 * @param config - Client configuration
 * @returns Array of configured API clients
 *
 * @example
 * ```typescript
 * const clients = await createMultipleTestClients(['admin', 'operator', 'viewer']);
 * const [adminClient, operatorClient, viewerClient] = clients;
 * ```
 */
export async function createMultipleTestClients(
  roles: UserRole[],
  config?: APIClientConfig
): Promise<APIClient[]> {
  const clients: APIClient[] = [];

  for (const role of roles) {
    const client = new APIClient(config);
    await client.loginAs(role);
    clients.push(client);
  }

  return clients;
}
