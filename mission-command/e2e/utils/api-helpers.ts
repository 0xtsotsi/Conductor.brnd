/**
 * API helper utilities for E2E tests
 *
 * These utilities provide helper functions for making API requests
 * during E2E tests, useful for setting up test data or verifying state.
 */

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  status: number;
}

/**
 * Make authenticated API request
 */
export async function apiRequest<T>(
  baseUrl: string,
  token: string,
  endpoint: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options?.headers,
      },
    });

    const data = await response.json();

    return {
      data: response.ok ? data : undefined,
      error: !response.ok ? data.message || 'Request failed' : undefined,
      status: response.status,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Unknown error',
      status: 0,
    };
  }
}

/**
 * GET request helper
 */
export async function apiGet<T>(
  baseUrl: string,
  token: string,
  endpoint: string
): Promise<ApiResponse<T>> {
  return apiRequest<T>(baseUrl, token, endpoint, { method: 'GET' });
}

/**
 * POST request helper
 */
export async function apiPost<T>(
  baseUrl: string,
  token: string,
  endpoint: string,
  body: unknown
): Promise<ApiResponse<T>> {
  return apiRequest<T>(baseUrl, token, endpoint, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/**
 * PUT request helper
 */
export async function apiPut<T>(
  baseUrl: string,
  token: string,
  endpoint: string,
  body: unknown
): Promise<ApiResponse<T>> {
  return apiRequest<T>(baseUrl, token, endpoint, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

/**
 * DELETE request helper
 */
export async function apiDelete<T>(
  baseUrl: string,
  token: string,
  endpoint: string
): Promise<ApiResponse<T>> {
  return apiRequest<T>(baseUrl, token, endpoint, { method: 'DELETE' });
}
