/**
 * JWT Authentication Middleware for Mission Command Centre
 *
 * Verifies JWT tokens from the Authorization header and injects
 * the authenticated user into the Hono context for use by
 * downstream middleware and route handlers.
 *
 * This middleware works with JWTs issued by the OAuth handler
 * which uses the jose library for token signing.
 */

import type { MiddlewareHandler } from 'hono';
import { jwtVerify } from 'jose';
import { createSecretKey } from 'crypto';

/**
 * JWT payload structure
 */
export interface JwtPayload {
  sub: string; // Provider-specific user ID
  email: string;
  name?: string;
  avatar_url?: string;
  provider: 'github' | 'google';
  role: 'admin' | 'operator' | 'viewer';
  iat: number;
  exp: number;
}

/**
 * User object injected into context
 */
export interface MissionCommandUser {
  sub: string;
  email: string;
  name?: string;
  avatar_url?: string;
  provider: 'github' | 'google';
  role: 'admin' | 'operator' | 'viewer';
}

/**
 * Extended context with user
 */
export type ContextWithUser = {
  Variables: {
    user: MissionCommandUser;
  };
};

/**
 * JWT Middleware Options
 */
export interface JwtMiddlewareOptions {
  /**
   * JWT secret for token verification
   * Defaults to JWT_AUTH_SECRET environment variable
   */
  secret?: string;

  /**
   * Whether to allow requests without tokens
   * If true, requests without tokens will pass through with no user set
   * If false, requests without tokens will return 401 Unauthorized
   */
  optional?: boolean;

  /**
   * Custom token extractor function
   * Defaults to extracting from Authorization: Bearer <token> header
   */
  tokenExtractor?: (c: any) => string | null;
}

/**
 * Default token extractor: Authorization: Bearer <token>
 */
function defaultTokenExtractor(c: any): string | null {
  const authHeader = c.req?.header?.('Authorization');
  if (!authHeader) {
    return null;
  }

  // Support both "Bearer <token>" and direct token
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  return authHeader;
}

/**
 * Create a JWT authentication middleware
 *
 * Verifies JWT tokens from the Authorization header and injects
 * the authenticated user into the context.
 *
 * @example
 * ```ts
 * import { createJwtMiddleware } from './jwt-middleware';
 *
 * const app = new Hono();
 *
 * // Apply JWT authentication to all routes
 * app.use('*', createJwtMiddleware({ secret: 'your-secret' }));
 *
 * // Or apply to specific routes
 * app.get('/api/protected', createJwtMiddleware(), async (c) => {
 *   const user = c.get('user');
 *   return c.json({ message: `Hello ${user.email}` });
 * });
 * ```
 */
export function createJwtMiddleware(
  options: JwtMiddlewareOptions = {},
): MiddlewareHandler<ContextWithUser> {
  const secret =
    options.secret ??
    process.env.JWT_AUTH_SECRET ??
    process.env.NEXT_PUBLIC_JWT_SECRET ??
    '';

  if (!secret) {
    throw new Error(
      'JWT secret is required. Provide it via options.secret or JWT_AUTH_SECRET environment variable.',
    );
  }

  // Convert secret to crypto key for jose
  const secretKey = createSecretKey(secret, 'utf-8');

  const tokenExtractor = options.tokenExtractor || defaultTokenExtractor;
  const optional = options.optional ?? false;

  return async (c, next) => {
    // Extract token from request
    const token = tokenExtractor(c);

    if (!token) {
      if (optional) {
        // No token, but optional - continue without user
        return next();
      }
      // No token and required - return 401
      return c.json({ error: 'Unauthorized', message: 'Missing authorization token' }, 401);
    }

    try {
      // Verify JWT token
      const { payload } = await jwtVerify(token, secretKey);

      // Validate required fields
      if (!payload.sub || !payload.email || !payload.role) {
        return c.json({ error: 'Unauthorized', message: 'Invalid token payload' }, 401);
      }

      // Validate role
      if (!['admin', 'operator', 'viewer'].includes(payload.role as string)) {
        return c.json({ error: 'Unauthorized', message: 'Invalid role in token' }, 401);
      }

      // Extract user from payload
      const user: MissionCommandUser = {
        sub: payload.sub as string,
        email: payload.email as string,
        name: (payload.name as string | undefined) ?? undefined,
        avatar_url: (payload.avatar_url as string | undefined) ?? undefined,
        provider: (payload.provider as 'github' | 'google') ?? 'github',
        role: payload.role as 'admin' | 'operator' | 'viewer',
      };

      // Inject user into context
      c.set('user', user);

      return next();
    } catch (error: any) {
      // Handle specific JWT errors
      if (error.code === 'ERR_JWT_EXPIRED') {
        return c.json({ error: 'Unauthorized', message: 'Token expired' }, 401);
      }
      if (error.code === 'ERR_JWS_SIGNATURE_VERIFIED' || error.code === 'ERR_JWT_INVALID') {
        return c.json({ error: 'Unauthorized', message: 'Invalid token' }, 401);
      }

      // Generic error
      return c.json({ error: 'Unauthorized', message: 'Token verification failed' }, 401);
    }
  };
}

/**
 * Require authentication middleware
 *
 * Returns 401 if no valid JWT token is provided.
 *
 * @example
 * ```ts
 * import { requireAuth } from './jwt-middleware';
 *
 * app.get('/api/protected', requireAuth(), async (c) => {
 *   const user = c.get('user');
 *   return c.json({ user });
 * });
 * ```
 */
export function requireAuth(options?: Omit<JwtMiddlewareOptions, 'optional'>): MiddlewareHandler<ContextWithUser> {
  return createJwtMiddleware({ ...options, optional: false });
}

/**
 * Optional authentication middleware
 *
 * Attaches user if valid token provided, but doesn't require it.
 *
 * @example
 * ```ts
 * import { optionalAuth } from './jwt-middleware';
 *
 * app.get('/api/public', optionalAuth(), async (c) => {
 *   const user = c.get('user');
 *   return c.json({ message: user ? `Hello ${user.email}` : 'Hello guest' });
 * });
 * ```
 */
export function optionalAuth(options?: Omit<JwtMiddlewareOptions, 'optional'>): MiddlewareHandler<ContextWithUser> {
  return createJwtMiddleware({ ...options, optional: true });
}

/**
 * Helper to get user from context
 *
 * @example
 * ```ts
 * import { getUser } from './jwt-middleware';
 *
 * app.get('/api/protected', requireAuth(), async (c) => {
 *   const user = getUser(c);
 *   return c.json({ email: user.email });
 * });
 * ```
 */
export function getUser(c: any): MissionCommandUser {
  return c.get('user') as MissionCommandUser;
}

/**
 * Helper to get user ID from context
 */
export function getUserId(c: any): string {
  return getUser(c).sub;
}

/**
 * Helper to get user email from context
 */
export function getUserEmail(c: any): string {
  return getUser(c).email;
}

/**
 * Helper to get user role from context
 */
export function getUserRole(c: any): 'admin' | 'operator' | 'viewer' {
  return getUser(c).role;
}
