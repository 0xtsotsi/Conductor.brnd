/**
 * OAuth Mock Helpers for E2E Testing
 *
 * Provides mock OAuth responses for GitHub and Google providers.
 * Simulates OAuth callback endpoints and generates fake JWT tokens for testing.
 *
 * @packageDocumentation
 */

import { SignJWT } from 'jose';

/**
 * User role types
 */
export type UserRole = 'admin' | 'operator' | 'viewer';

/**
 * OAuth provider types
 */
export type OAuthProvider = 'github' | 'google';

/**
 * Mock OAuth profile
 */
export interface MockOAuthProfile {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
  provider: OAuthProvider;
}

/**
 * JWT payload structure matching oauth-handler.ts
 */
export interface MockJWTPayload {
  sub: string;
  email: string;
  name: string;
  role: UserRole;
  provider: OAuthProvider;
  type: 'access';
  iat?: number;
  exp?: number;
}

/**
 * OAuth callback response
 */
export interface MockOAuthCallbackResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: string;
}

/**
 * Test user configurations
 */
export const TEST_USERS = {
  admin: {
    sub: 'github_admin_123',
    email: 'admin@test.com',
    name: 'Admin User',
    avatar_url: 'https://github.com/admin.png',
    provider: 'github' as OAuthProvider,
    role: 'admin' as UserRole,
  },
  operator: {
    sub: 'github_operator_456',
    email: 'operator@test.com',
    name: 'Operator User',
    avatar_url: 'https://github.com/operator.png',
    provider: 'github' as OAuthProvider,
    role: 'operator' as UserRole,
  },
  viewer: {
    sub: 'github_viewer_789',
    email: 'viewer@test.com',
    name: 'Viewer User',
    avatar_url: 'https://github.com/viewer.png',
    provider: 'github' as OAuthProvider,
    role: 'viewer' as UserRole,
  },
} as const;

/**
 * Default JWT secret (should match test environment)
 */
const DEFAULT_JWT_SECRET = 'test-secret-key-for-jwt-signing';

/**
 * Default token expiration (15 minutes)
 */
const DEFAULT_EXPIRATION = '15m';

/**
 * Generate a fake JWT token for testing
 *
 * @param profile - OAuth profile
 * @param role - User role
 * @param secret - JWT secret (optional, uses default if not provided)
 * @param expiration - Token expiration (optional, uses 15m if not provided)
 * @returns Signed JWT token
 *
 * @example
 * ```typescript
 * const token = await generateMockToken(TEST_USERS.admin, 'admin');
 * ```
 */
export async function generateMockToken(
  profile: MockOAuthProfile,
  role: UserRole,
  secret: string = DEFAULT_JWT_SECRET,
  expiration: string = DEFAULT_EXPIRATION
): Promise<string> {
  const secretKey = new TextEncoder().encode(secret);

  const token = await new SignJWT({
    sub: profile.id,
    email: profile.email,
    name: profile.name,
    role,
    provider: profile.provider,
    type: 'access',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiration)
    .sign(secretKey);

  return token;
}

/**
 * Generate an expired JWT token for testing error scenarios
 *
 * @param profile - OAuth profile
 * @param role - User role
 * @param secret - JWT secret (optional)
 * @returns Expired JWT token
 *
 * @example
 * ```typescript
 * const expiredToken = await generateExpiredToken(TEST_USERS.viewer, 'viewer');
 * ```
 */
export async function generateExpiredToken(
  profile: MockOAuthProfile,
  role: UserRole,
  secret: string = DEFAULT_JWT_SECRET
): Promise<string> {
  const secretKey = new TextEncoder().encode(secret);

  // Create token that expired 1 hour ago
  const expirationTime = Math.floor(Date.now() / 1000) - 3600;

  const token = await new SignJWT({
    sub: profile.id,
    email: profile.email,
    name: profile.name,
    role,
    provider: profile.provider,
    type: 'access',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(expirationTime - 3600) // Issued 2 hours ago
    .setExpirationTime(expirationTime) // Expired 1 hour ago
    .sign(secretKey);

  return token;
}

/**
 * Generate a malformed JWT token for testing error scenarios
 *
 * @returns Malformed token string
 *
 * @example
 * ```typescript
 * const badToken = generateMalformedToken();
 * ```
 */
export function generateMalformedToken(): string {
  return 'not.a.valid.jwt.token';
}

/**
 * Mock GitHub OAuth callback response
 *
 * @param role - User role to generate token for
 * @param secret - JWT secret (optional)
 * @returns Mock callback response
 *
 * @example
 * ```typescript
 * const response = mockGitHubCallback('admin');
 * // Returns: { accessToken: '...', refreshToken: '...', tokenType: 'Bearer', expiresIn: '15m' }
 * ```
 */
export async function mockGitHubCallback(
  role: UserRole = 'viewer',
  secret: string = DEFAULT_JWT_SECRET
): Promise<MockOAuthCallbackResponse> {
  const profile = {
    ...TEST_USERS[role],
    provider: 'github' as OAuthProvider,
  };

  const accessToken = await generateMockToken(profile, role, secret);
  const refreshToken = `mock-refresh-token-${role}-${Date.now()}`;

  return {
    accessToken,
    refreshToken,
    tokenType: 'Bearer',
    expiresIn: DEFAULT_EXPIRATION,
  };
}

/**
 * Mock Google OAuth callback response
 *
 * @param role - User role to generate token for
 * @param secret - JWT secret (optional)
 * @returns Mock callback response
 *
 * @example
 * ```typescript
 * const response = mockGoogleCallback('operator');
 * ```
 */
export async function mockGoogleCallback(
  role: UserRole = 'viewer',
  secret: string = DEFAULT_JWT_SECRET
): Promise<MockOAuthCallbackResponse> {
  const profile = {
    ...TEST_USERS[role],
    provider: 'google' as OAuthProvider,
  };

  const accessToken = await generateMockToken(profile, role, secret);
  const refreshToken = `mock-refresh-token-google-${role}-${Date.now()}`;

  return {
    accessToken,
    refreshToken,
    tokenType: 'Bearer',
    expiresIn: DEFAULT_EXPIRATION,
  };
}

/**
 * Mock failed OAuth login response
 *
 * @param provider - OAuth provider
 * @param errorReason - Reason for failure
 * @returns Error response object
 *
 * @example
 * ```typescript
 * const error = mockOAuthFailed('github', 'access_denied');
 * ```
 */
export function mockOAuthFailed(
  provider: OAuthProvider,
  errorReason: string = 'access_denied'
): { error: string; error_description: string } {
  return {
    error: errorReason,
    error_description: `${provider.charAt(0).toUpperCase() + provider.slice(1)} OAuth failed: ${errorReason}`,
  };
}

/**
 * Mock GitHub user profile API response
 *
 * @param role - User role
 * @returns GitHub user profile object
 *
 * @example
 * ```typescript
 * const profile = mockGitHubUserProfile('admin');
 * ```
 */
export function mockGitHubUserProfile(role: UserRole = 'viewer'): Record<string, any> {
  const user = TEST_USERS[role];

  return {
    id: user.sub.replace('github_', ''),
    login: user.email.split('@')[0],
    email: user.email,
    name: user.name,
    avatar_url: user.avatar_url,
    type: 'User',
    site_admin: role === 'admin',
  };
}

/**
 * Mock Google user profile API response
 *
 * @param role - User role
 * @returns Google user profile object
 *
 * @example
 * ```typescript
 * const profile = mockGoogleUserProfile('operator');
 * ```
 */
export function mockGoogleUserProfile(role: UserRole = 'viewer'): Record<string, any> {
  const user = TEST_USERS[role];

  return {
    id: user.sub.replace('google_', ''),
    email: user.email,
    name: user.name,
    picture: user.avatar_url,
    verified_email: true,
    given_name: user.name.split(' ')[0],
    family_name: user.name.split(' ').slice(1).join(' '),
  };
}

/**
 * Generate mock refresh token
 *
 * @param role - User role
 * @returns Mock refresh token string
 *
 * @example
 * ```typescript
 * const refreshToken = generateMockRefreshToken('admin');
 * ```
 */
export function generateMockRefreshToken(role: UserRole = 'viewer'): string {
  return `mock-refresh-token-${role}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

/**
 * Mock GitHub OAuth authorization URL
 *
 * @param clientId - GitHub OAuth client ID
 * @param redirectUri - Redirect URI after authorization
 * @param state - OAuth state parameter
 * @returns GitHub authorization URL
 *
 * @example
 * ```typescript
 * const url = mockGitHubAuthURL('client123', 'http://localhost:5173/auth/callback', 'state456');
 * ```
 */
export function mockGitHubAuthURL(
  clientId: string,
  redirectUri: string,
  state: string
): string {
  return `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=user:email&state=${state}`;
}

/**
 * Mock Google OAuth authorization URL
 *
 * @param clientId - Google OAuth client ID
 * @param redirectUri - Redirect URI after authorization
 * @param state - OAuth state parameter
 * @returns Google authorization URL
 *
 * @example
 * ```typescript
 * const url = mockGoogleAuthURL('client123', 'http://localhost:5173/auth/callback', 'state456');
 * ```
 */
export function mockGoogleAuthURL(
  clientId: string,
  redirectUri: string,
  state: string
): string {
  return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=openid email profile&state=${state}`;
}

/**
 * Decode JWT token without verification (for testing only)
 *
 * @param token - JWT token
 * @returns Decoded payload
 * @throws Error if token is invalid
 *
 * @example
 * ```typescript
 * const payload = decodeJWT(token);
 * console.log(payload.email, payload.role);
 * ```
 */
export function decodeJWT(token: string): MockJWTPayload {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid token format');
    }

    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    return payload as MockJWTPayload;
  } catch (error) {
    throw new Error(`Failed to decode JWT: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Mock OAuth state parameter
 *
 * @param redirectUri - Redirect URI to encode in state
 * @returns Base64-encoded state parameter
 *
 * @example
 * ```typescript
 * const state = mockOAuthState('/dashboard');
 * ```
 */
export function mockOAuthState(redirectUri: string = '/'): string {
  return Buffer.from(JSON.stringify({ redirectUri })).toString('base64');
}
