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
