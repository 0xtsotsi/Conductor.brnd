/**
 * Mission Command OAuth Authentication Handler
 *
 * Provides OAuth2 flow for GitHub and Google authentication.
 * Handles login redirect, callback processing, and JWT token issuance.
 *
 * Architecture:
 * 1. User clicks "Login with GitHub/Google" in LoginPage
 * 2. Frontend redirects to /api/auth/login?provider=github&redirect_uri=/
 * 3. Backend redirects to GitHub/Google OAuth consent screen
 * 4. User approves, provider redirects to /api/auth/callback?code=xxx&state=xxx
 * 5. Backend exchanges code for access token, fetches user profile
 * 6. Backend creates/updates user in database, issues JWT with role
 * 7. Backend redirects to frontend with JWT in URL fragment
 * 8. Frontend stores JWT in localStorage, redirects to dashboard
 */

import { Hono } from 'hono';
import { setCookie } from 'hono/cookie';
import { oauthConfig as githubConfig } from '@hono/oauth-providers/github';
import { oauthConfig as googleConfig } from '@hono/oauth-providers/google';
import { SignJWT } from 'jose';

/**
 * OAuth user profile from providers
 */
type OAuthProfile = {
  id: string;
  email: string;
  name?: string;
  avatar_url?: string;
  provider: 'github' | 'google';
};

/**
 * User record from database
 */
type MissionCommandUserDB = {
  id: string;
  sub: string; // Provider-specific user ID
  email: string;
  name?: string;
  avatar_url?: string;
  provider: 'github' | 'google';
  role: 'admin' | 'operator' | 'viewer';
  created_at: Date;
  updated_at: Date;
};

/**
 * OAuth handler configuration
 */
export interface OAuthHandlerOptions {
  /**
   * JWT secret for token signing
   */
  jwtSecret: string;

  /**
   * Frontend URL for redirects
   */
  frontendUrl: string;

  /**
   * GitHub OAuth app credentials
   */
  github?: {
    clientId: string;
    clientSecret: string;
  };

  /**
   * Google OAuth app credentials
   */
  google?: {
    clientId: string;
    clientSecret: string;
  };

  /**
   * Default role for new users
   */
  defaultRole?: 'admin' | 'operator' | 'viewer';

  /**
   * Storage adapter for user persistence
   */
  storage?: OAuthStorage;
}

/**
 * Storage interface for user persistence
 */
export interface OAuthStorage {
  /**
   * Find user by provider ID
   */
  findUserByProvider(sub: string, provider: string): Promise<MissionCommandUserDB | null>;

  /**
   * Create new user
   */
  createUser(user: Omit<MissionCommandUserDB, 'id' | 'created_at' | 'updated_at'>): Promise<MissionCommandUserDB>;

  /**
   * Update user
   */
  updateUser(id: string, updates: Partial<MissionCommandUserDB>): Promise<MissionCommandUserDB>;
}

/**
 * Create OAuth authentication handler
 */
export function createOAuthHandler(options: OAuthHandlerOptions) {
  const app = new Hono();

  const {
    jwtSecret,
    frontendUrl,
    github,
    google,
    defaultRole = 'viewer',
    storage,
  } = options;

  /**
   * Helper: Generate JWT token for user
   */
  async function generateToken(user: MissionCommandUserDB): Promise<string> {
    const secret = new TextEncoder().encode(jwtSecret);

    const token = await new SignJWT({
      sub: user.sub,
      email: user.email,
      name: user.name,
      role: user.role,
      provider: user.provider,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d') // Token expires in 7 days
      .sign(secret);

    return token;
  }

  /**
   * Helper: Fetch GitHub user profile
   */
  async function getGitHubProfile(accessToken: string): Promise<OAuthProfile> {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch GitHub user profile');
    }

    const data = await response.json();

    return {
      id: data.id.toString(),
      email: data.email,
      name: data.name,
      avatar_url: data.avatar_url,
      provider: 'github',
    };
  }

  /**
   * Helper: Fetch Google user profile
   */
  async function getGoogleProfile(accessToken: string): Promise<OAuthProfile> {
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch Google user profile');
    }

    const data = await response.json();

    return {
      id: data.id,
      email: data.email,
      name: data.name,
      avatar_url: data.picture,
      provider: 'google',
    };
  }

  /**
   * Helper: Get or create user from OAuth profile
   */
  async function getOrCreateUser(profile: OAuthProfile): Promise<MissionCommandUserDB> {
    if (!storage) {
      // In-memory fallback (for development only)
      return {
        id: 'temp',
        sub: profile.id,
        email: profile.email,
        name: profile.name,
        avatar_url: profile.avatar_url,
        provider: profile.provider,
        role: defaultRole,
        created_at: new Date(),
        updated_at: new Date(),
      };
    }

    // Try to find existing user
    let user = await storage.findUserByProvider(profile.id, profile.provider);

    if (!user) {
      // Create new user with default role
      user = await storage.createUser({
        sub: profile.id,
        email: profile.email,
        name: profile.name,
        avatar_url: profile.avatar_url,
        provider: profile.provider,
        role: defaultRole,
        created_at: new Date(),
        updated_at: new Date(),
      });
    } else {
      // Update user profile
      user = await storage.updateUser(user.id, {
        email: profile.email,
        name: profile.name,
        avatar_url: profile.avatar_url,
        updated_at: new Date(),
      });
    }

    return user;
  }

  /**
   * Route: Initiate OAuth login
   * GET /api/auth/login?provider=github|google&redirect_uri=/
   */
  app.get('/login', async (c) => {
    const provider = c.req.query('provider') || 'github';
    const redirectUri = c.req.query('redirect_uri') || '/';

    // Store redirect URI in state for later
    const state = Buffer.from(JSON.stringify { redirectUri })).toString('base64');

    if (provider === 'github') {
      if (!github) {
        return c.json({ error: 'GitHub OAuth not configured' }, 500);
      }

      // Redirect to GitHub OAuth
      const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${github.clientId}&scope=user:email&state=${state}`;
      return c.redirect(githubAuthUrl);
    }

    if (provider === 'google') {
      if (!google) {
        return c.json({ error: 'Google OAuth not configured' }, 500);
      }

      // Redirect to Google OAuth
      const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${google.clientId}&redirect_uri=${encodeURIComponent(`${frontendUrl}/api/auth/callback`)}&response_type=code&scope=openid email profile&state=${state}`;
      return c.redirect(googleAuthUrl);
    }

    return c.json({ error: 'Invalid provider' }, 400);
  });

  /**
   * Route: OAuth callback handler
   * GET /api/auth/callback?code=xxx&state=xxx
   */
  app.get('/callback', async (c) => {
    const code = c.req.query('code');
    const state = c.req.query('state');

    if (!code) {
      return c.json({ error: 'Missing authorization code' }, 400);
    }

    // Decode state to get redirect URI
    let redirectUri = '/';
    try {
      const stateData = JSON.parse(Buffer.from(state || '', 'base64').toString());
      redirectUri = stateData.redirectUri || '/';
    } catch {
      // Invalid state, use default
    }

    let profile: OAuthProfile;

    // Determine provider from state or code context
    // For simplicity, we'll try both providers
    try {
      // Try GitHub first
      if (github) {
        // Exchange code for access token
        const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            client_id: github.clientId,
            client_secret: github.clientSecret,
            code,
          }),
        });

        const tokenData = await tokenResponse.json();

        if (tokenData.access_token) {
          profile = await getGitHubProfile(tokenData.access_token);

          // Get or create user
          const user = await getOrCreateUser(profile);

          // Generate JWT
          const token = await generateToken(user);

          // Redirect to frontend with token
          return c.redirect(`${frontendUrl}${redirectUri}#token=${token}`);
        }
      }
    } catch (error) {
      console.error('GitHub OAuth failed:', error);
    }

    try {
      // Try Google
      if (google) {
        // Exchange code for access token
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            client_id: google.clientId,
            client_secret: google.clientSecret,
            code,
            grant_type: 'authorization_code',
            redirect_uri: `${frontendUrl}/api/auth/callback`,
          }),
        });

        const tokenData = await tokenResponse.json();

        if (tokenData.access_token) {
          profile = await getGoogleProfile(tokenData.access_token);

          // Get or create user
          const user = await getOrCreateUser(profile);

          // Generate JWT
          const token = await generateToken(user);

          // Redirect to frontend with token
          return c.redirect(`${frontendUrl}${redirectUri}#token=${token}`);
        }
      }
    } catch (error) {
      console.error('Google OAuth failed:', error);
    }

    // Both providers failed
    return c.redirect(`${frontendUrl}/login?error=oauth_failed`);
  });

  /**
   * Route: Logout
   * POST /api/auth/logout
   */
  app.post('/logout', async (c) => {
    // Clear JWT cookie
    setCookie(c, 'mastra_jwt', '', {
      path: '/',
      maxAge: 0,
    });

    return c.json({ success: true });
  });

  return app;
}
