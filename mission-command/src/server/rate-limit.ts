/**
 * Rate Limiting Middleware for GitHub Webhooks
 *
 * Prevents abuse and DDoS attacks on webhook endpoints.
 * Supports per-IP and per-repository rate limiting.
 */

import { Hono } from 'hono';
import type { Context, Next } from 'hono';

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  /** Maximum requests per window */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Key generator function (default: by IP address) */
  keyGenerator?: (c: Context) => string | Promise<string>;
  /** Skip function (bypass rate limit for certain requests) */
  skip?: (c: Context) => boolean | Promise<boolean>;
  /** Custom error handler */
  errorHandler?: (c: Context, info: { limit: number; remaining: number; reset: Date }) => Response;
}

/**
 * Rate limit storage entry
 */
interface RateLimitEntry {
  count: number;
  resetTime: Date;
}

/**
 * In-memory rate limit storage
 * In production, use Redis or a database for distributed systems
 */
const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Clean up expired entries (call periodically)
 */
export function cleanupExpiredEntries(): void {
  const now = new Date();

  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}

/**
 * Create rate limiting middleware
 */
export function rateLimit(config: RateLimitConfig) {
  const {
    maxRequests,
    windowMs,
    keyGenerator,
    skip,
    errorHandler,
  } = config;

  return async (c: Context, next: Next) => {
    // Check if should skip rate limiting
    if (skip && await skip(c)) {
      return next();
    }

    // Generate key for this request
    const key = keyGenerator
      ? await keyGenerator(c)
      : `ip:${c.req.header('x-forwarded-for') || c.req.header('cf-connecting-ip') || 'unknown'}`;

    const now = new Date();
    let entry = rateLimitStore.get(key);

    // Initialize or reset entry if window has expired
    if (!entry || entry.resetTime < now) {
      entry = {
        count: 0,
        resetTime: new Date(now.getTime() + windowMs),
      };
      rateLimitStore.set(key, entry);
    }

    // Increment counter
    entry.count++;
    rateLimitStore.set(key, entry);

    // Check if limit exceeded
    if (entry.count > maxRequests) {
      const resetTime = entry.resetTime;
      const remaining = 0;

      // Set rate limit headers
      c.header('X-RateLimit-Limit', String(maxRequests));
      c.header('X-RateLimit-Remaining', String(remaining));
      c.header('X-RateLimit-Reset', String(Math.ceil(resetTime.getTime() / 1000)));
      c.header('Retry-After', String(Math.ceil((resetTime.getTime() - now.getTime()) / 1000)));

      // Use custom error handler or default
      if (errorHandler) {
        return errorHandler(c, {
          limit: maxRequests,
          remaining,
          reset: resetTime,
        });
      }

      return c.json({
        error: 'Too many requests',
        message: `Rate limit exceeded. Try again after ${resetTime.toISOString()}`,
        limit: maxRequests,
        resetAt: resetTime.toISOString(),
      }, 429);
    }

    // Set rate limit headers for successful requests
    const remaining = maxRequests - entry.count;
    c.header('X-RateLimit-Limit', String(maxRequests));
    c.header('X-RateLimit-Remaining', String(remaining));
    c.header('X-RateLimit-Reset', String(Math.ceil(entry.resetTime.getTime() / 1000)));

    return next();
  };
}

/**
 * GitHub webhook-specific rate limit configuration
 */
export function createGitHubWebhookRateLimit() {
  return rateLimit({
    // 100 requests per hour per IP
    maxRequests: 100,
    windowMs: 60 * 60 * 1000, // 1 hour

    // Use IP address as key
    keyGenerator: (c) => {
      // Try to get real IP from various headers (for proxies/CDNs)
      const ip = c.req.header('x-forwarded-for') ||
                 c.req.header('cf-connecting-ip') ||
                 c.req.header('x-real-ip') ||
                 'unknown';
      return `github-webhook:${ip}`;
    },

    // Skip rate limiting for health checks
    skip: (c) => {
      return c.req.path === '/webhooks/github/health';
    },
  });
}

/**
 * Start periodic cleanup of expired rate limit entries
 * Run this in your server initialization
 */
export function startRateLimitCleanup(intervalMs: number = 60 * 1000): NodeJS.Timeout {
  return setInterval(cleanupExpiredEntries, intervalMs);
}

// ============================================================================
// AUTHENTICATION-SPECIFIC RATE LIMITING
// ============================================================================

/**
 * Login-specific rate limiting
 *
 * Stricter limits for login endpoints to prevent brute force attacks
 *
 * @example
 * ```typescript
 * app.post('/api/auth/login', createLoginRateLimit(), loginHandler);
 * ```
 */
export function createLoginRateLimit() {
  return rateLimit({
    // 5 attempts per 15 minutes per IP and per account
    maxRequests: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes

    // Use both IP and email as key (prevent distributed attacks)
    keyGenerator: async (c: Context) => {
      const ip = c.req.header('x-forwarded-for') ||
                 c.req.header('cf-connecting-ip') ||
                 c.req.header('x-real-ip') ||
                 'unknown';

      try {
        // Try to extract email from request body
        const body = c.req.raw.body;
        if (body && c.req.header('content-type')?.includes('application/json')) {
          const data = JSON.parse(body as any);
          if (data?.email) {
            // Combine IP and email for most effective protection
            return `login:${ip}:${data.email}`;
          }
        }
      } catch {
        // Ignore parsing errors, fall back to IP only
      }

      return `login:${ip}`;
    },

    // Never skip login rate limiting
    skip: undefined,
  });
}

/**
 * Generic authentication endpoint rate limiting
 *
 * For auth endpoints like /api/auth/* (excluding login which has stricter limits)
 *
 * @example
 * ```typescript
 * app.use('/api/auth/*', createAuthRateLimit());
 * ```
 */
export function createAuthRateLimit() {
  return rateLimit({
    // 10 requests per 15 minutes per IP
    maxRequests: 10,
    windowMs: 15 * 60 * 1000, // 15 minutes

    keyGenerator: (c: Context) => {
      const ip = c.req.header('x-forwarded-for') ||
                 c.req.header('cf-connecting-ip') ||
                 c.req.header('x-real-ip') ||
                 'unknown';
      return `auth:${ip}`;
    },

    // Skip health checks
    skip: (c) => {
      return c.req.path === '/health' || c.req.path === '/api/health';
    },
  });
}

/**
 * Token refresh rate limiting
 *
 * Prevents abuse of token refresh endpoints
 *
 * @example
 * ```typescript
 * app.post('/api/auth/refresh', createTokenRefreshRateLimit(), refreshHandler);
 * ```
 */
export function createTokenRefreshRateLimit() {
  return rateLimit({
    // 20 refresh requests per hour per IP
    maxRequests: 20,
    windowMs: 60 * 60 * 1000, // 1 hour

    keyGenerator: (c: Context) => {
      const ip = c.req.header('x-forwarded-for') ||
                 c.req.header('cf-connecting-ip') ||
                 c.req.header('x-real-ip') ||
                 'unknown';
      return `token-refresh:${ip}`;
    },
  });
}

/**
 * Password reset rate limiting
 *
 * Strict limits to prevent email flooding
 *
 * @example
 * ```typescript
 * app.post('/api/auth/reset-password', createPasswordResetRateLimit(), resetHandler);
 * ```
 */
export function createPasswordResetRateLimit() {
  return rateLimit({
    // 3 attempts per hour per email AND per IP
    maxRequests: 3,
    windowMs: 60 * 60 * 1000, // 1 hour

    keyGenerator: async (c: Context) => {
      const ip = c.req.header('x-forwarded-for') ||
                 c.req.header('cf-connecting-ip') ||
                 c.req.header('x-real-ip') ||
                 'unknown';

      try {
        const body = c.req.raw.body;
        if (body && c.req.header('content-type')?.includes('application/json')) {
          const data = JSON.parse(body as any);
          if (data?.email) {
            // Use both email and IP to prevent flooding
            return `password-reset:${ip}:${data.email}`;
          }
        }
      } catch {
        // Fall back to IP only
      }

      return `password-reset:${ip}`;
    },
  });
}

// ============================================================================
// API RATE LIMITING
// ============================================================================

/**
 * General API rate limiting
 *
 * Per-user rate limiting for API endpoints
 *
 * @example
 * ```typescript
 * app.use('/api/*', createApiRateLimit());
 * ```
 */
export function createApiRateLimit() {
  return rateLimit({
    // 100 requests per minute per user
    maxRequests: 100,
    windowMs: 60 * 1000, // 1 minute

    keyGenerator: (c: Context) => {
      // Try to get user ID from JWT
      const userId = c.get('userId') || c.get('user')?.id;

      if (userId) {
        return `api:user:${userId}`;
      }

      // Fall back to IP address for unauthenticated requests
      const ip = c.req.header('x-forwarded-for') ||
                 c.req.header('cf-connecting-ip') ||
                 c.req.header('x-real-ip') ||
                 'unknown';
      return `api:ip:${ip}`;
    },

    // Skip rate limiting for health checks and webhooks
    skip: (c) => {
      return c.req.path === '/health' ||
             c.req.path === '/api/health' ||
             c.req.path.startsWith('/webhooks/');
    },
  });
}

/**
 * Expensive operation rate limiting
 *
 * Stricter limits for resource-intensive operations
 *
 * @example
 * ```typescript
 * app.post('/api/workflows/*/execute', createExpensiveOperationRateLimit());
 * app.post('/api/export/*', createExpensiveOperationRateLimit());
 * ```
 */
export function createExpensiveOperationRateLimit() {
  return rateLimit({
    // 10 requests per minute per user
    maxRequests: 10,
    windowMs: 60 * 1000, // 1 minute

    keyGenerator: (c: Context) => {
      const userId = c.get('userId') || c.get('user')?.id;

      if (userId) {
        return `expensive:user:${userId}`;
      }

      const ip = c.req.header('x-forwarded-for') ||
                 c.req.header('cf-connecting-ip') ||
                 c.req.header('x-real-ip') ||
                 'unknown';
      return `expensive:ip:${ip}`;
    },
  });
}

// ============================================================================
// RATE LIMIT STATISTICS
// ============================================================================

/**
 * Get rate limit statistics
 *
 * Useful for monitoring and dashboards
 *
 * @example
 * ```typescript
 * app.get('/api/admin/rate-limit-stats', requireRole('admin'), (c) => {
 *   return c.json(getRateLimitStats());
 * });
 * ```
 */
export function getRateLimitStats(): {
  totalEntries: number;
  activeEntries: number;
  expiredEntries: number;
} {
  const now = new Date();
  let activeEntries = 0;
  let expiredEntries = 0;

  for (const [, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      expiredEntries++;
    } else {
      activeEntries++;
    }
  }

  return {
    totalEntries: rateLimitStore.size,
    activeEntries,
    expiredEntries,
  };
}
