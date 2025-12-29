/**
 * OAuth Authentication Handler for Mission Command Centre
 *
 * Provides OAuth2 login flows for GitHub and Google.
 * This is a simplified implementation that can be extended for production use.
 *
 * TODO: Production Requirements
 * - Store users in database (PostgreSQL/MySQL)
 * - Implement proper session management
 * - Add refresh token rotation
 * - Rate limiting on auth endpoints
 * - CSRF protection
 * - Audit logging for auth events
 */

import type { HonoContext } from 'hono';
import { MissionCommandUser, MissionCommandRole } from '@mastra/auth';
import jwt from 'jsonwebtoken';

/**
 * OAuth Provider Configuration
 */
interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope: string;
  authUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
}

const OAUTH_CONFIGS: Record<string, OAuthConfig> = {
  github: {
    clientId: process.env.GITHUB_CLIENT_ID || '',
    clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
    redirectUri: process.env.GITHUB_REDIRECT_URI || 'http://localhost:3000/api/auth/github/callback',
    scope: 'read:user user:email',
    authUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    userInfoUrl: 'https://api.github.com/user',
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/google/callback',
    scope: 'openid profile email',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
  },
};

/**
 * JWT Secret for token signing
 */
const JWT_SECRET = process.env.JWT_AUTH_SECRET || 'your-secret-key-change-in-production';

/**
 * Generate state parameter for OAuth flow (CSRF protection)
 */
function generateState(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

/**
 * Get OAuth authorization URL
 */
export function getOAuthUrl(provider: string, redirect?: string): string {
  const config = OAUTH_CONFIGS[provider];
  if (!config) {
    throw new Error(`Unsupported OAuth provider: ${provider}`);
  }

  const state = generateState();
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: config.scope,
    state: state,
    response_type: 'code',
  });

  // Store state in session/cache for verification in callback
  // TODO: Use Redis or similar for production
  sessionStorage?.setItem(`oauth_state_${state}`, redirect || '/');

  return `${config.authUrl}?${params.toString()}`;
}

/**
 * Exchange authorization code for access token
 */
async function exchangeCodeForToken(provider: string, code: string): Promise<string> {
  const config = OAUTH_CONFIGS[provider];
  if (!config) {
    throw new Error(`Unsupported OAuth provider: ${provider}`);
  }

  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code: code,
      redirect_uri: config.redirectUri,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to exchange code for token: ${response.statusText}`);
  }

  const data = await response.json();
  return data.access_token;
}

/**
 * Fetch user info from OAuth provider
 */
async function fetchUserInfo(provider: string, accessToken: string): Promise<{
  sub: string;
  email: string;
  name: string;
  avatar_url?: string;
}> {
  const config = OAUTH_CONFIGS[provider];
  if (!config) {
    throw new Error(`Unsupported OAuth provider: ${provider}`);
  }

  const response = await fetch(config.userInfoUrl, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch user info: ${response.statusText}`);
  }

  const data = await response.json();

  // Normalize user data based on provider
  if (provider === 'github') {
    return {
      sub: `github:${data.id}`,
      email: data.email,
      name: data.name || data.login,
      avatar_url: data.avatar_url,
    };
  } else if (provider === 'google') {
    return {
      sub: `google:${data.id}`,
      email: data.email,
      name: data.name,
      avatar_url: data.picture,
    };
  }

  throw new Error(`Unknown provider: ${provider}`);
}

/**
 * Determine user role based on email domain or explicit mapping
 */
function determineUserRole(email: string): MissionCommandRole {
  // TODO: Load from database in production
  const adminDomains = (process.env.ADMIN_DOMAINS || '').split(',').filter(Boolean);
  const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').filter(Boolean);

  // Check explicit email list
  if (adminEmails.includes(email)) {
    return 'admin';
  }

  // Check domain list
  const domain = email.split('@')[1];
  if (adminDomains.includes(domain)) {
    return 'admin';
  }

  // Default role
  return 'viewer';
}

/**
 * Generate JWT token for user
 */
export function generateJWT(user: MissionCommandUser): string {
  return jwt.sign(
    {
      sub: user.sub,
      email: user.email,
      name: user.name,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

/**
 * Handle OAuth login initiation
 */
export async function handleOAuthLogin(provider: string, redirect?: string) {
  try {
    const authUrl = getOAuthUrl(provider, redirect);
    return { redirectUrl: authUrl };
  } catch (error) {
    console.error(`OAuth login error for ${provider}:`, error);
    throw error;
  }
}

/**
 * Handle OAuth callback
 */
export async function handleOAuthCallback(
  provider: string,
  code: string,
  state: string
): Promise<{ token: string; user: MissionCommandUser; redirect: string }> {
  try {
    // Exchange code for access token
    const accessToken = await exchangeCodeForToken(provider, code);

    // Fetch user info
    const userInfo = await fetchUserInfo(provider, accessToken);

    // Determine user role
    const role = determineUserRole(userInfo.email);

    const user: MissionCommandUser = {
      sub: userInfo.sub,
      email: userInfo.email,
      name: userInfo.name,
      role: role,
    };

    // Generate JWT
    const token = generateJWT(user);

    // Get redirect path from state
    const redirectPath = sessionStorage?.getItem(`oauth_state_${state}`) || '/';
    sessionStorage?.removeItem(`oauth_state_${state}`);

    // TODO: Store user in database
    // TODO: Track login event in audit log

    return { token, user, redirect: redirectPath };
  } catch (error) {
    console.error(`OAuth callback error for ${provider}:`, error);
    throw error;
  }
}

/**
 * Verify JWT token (for use in protected routes)
 */
export function verifyToken(token: string): MissionCommandUser | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as MissionCommandUser;
    return decoded;
  } catch (error) {
    console.error('Token verification error:', error);
    return null;
  }
}
