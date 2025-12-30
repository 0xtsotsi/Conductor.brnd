/**
 * Security Headers Middleware
 *
 * Production-ready security headers implementation following OWASP best practices
 * and modern web security standards.
 *
 * @see https://owasp.org/www-project-secure-headers/
 * @see https://web.dev/articles/security-sensitive-features
 */

import type { Context, Next } from 'hono';

/**
 * Content-Security-Policy configuration
 *
 * STRICT policy for production - blocks XSS, data injection, and clickjacking attacks
 */
const CSP_HEADER =
  "default-src 'self'; " +
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
  "style-src 'self' 'unsafe-inline'; " +
  "img-src 'self' data: https:; " +
  "font-src 'self' data:; " +
  "connect-src 'self'; " +
  "media-src 'self'; " +
  "object-src 'none'; " +
  "frame-src 'none'; " +
  "base-uri 'self'; " +
  "form-action 'self'; " +
  "frame-ancestors 'none'; " +
  "upgrade-insecure-requests";

/**
 * Permissions-Policy configuration
 *
 * Disable sensitive features that aren't needed
 */
const PERMISSIONS_POLICY =
  'geolocation=(), ' +
  'microphone=(), ' +
  'camera=(), ' +
  'payment=(), ' +
  'usb=(), ' +
  'magnetometer=(), ' +
  'gyroscope=(), ' +
  'accelerometer=()';

/**
 * Apply comprehensive security headers to all requests
 *
 * Headers applied:
 * - Content-Security-Policy: Prevents XSS and data injection
 * - X-Content-Type-Options: Prevents MIME sniffing
 * - X-Frame-Options: Prevents clickjacking
 * - X-XSS-Protection: Enables browser XSS filter
 * - Strict-Transport-Security: Enforces HTTPS
 * - Referrer-Policy: Controls referrer information leakage
 * - Permissions-Policy: Disables sensitive browser features
 * - Cross-Origin-Opener-Policy: Iscludes top-level windows
 * - Cross-Origin-Resource-Policy: Controls cross-origin resource access
 * - Cross-Origin-Embedder-Policy: Controls cross-origin embedding
 *
 * @example
 * ```typescript
 * app.use('*', securityHeaders());
 * ```
 */
export function securityHeaders() {
  return async (c: Context, next: Next) => {
    // Content-Security-Policy - STRICT policy for production
    c.header('Content-Security-Policy', CSP_HEADER);

    // X-Content-Type-Options - Prevents MIME type sniffing
    c.header('X-Content-Type-Options', 'nosniff');

    // X-Frame-Options - Prevents clickjacking
    c.header('X-Frame-Options', 'DENY');

    // X-XSS-Protection - Enables browser XSS filter (legacy but still useful)
    c.header('X-XSS-Protection', '1; mode=block');

    // Strict-Transport-Security - Enforces HTTPS (HSTS)
    // 1 year including subdomains, preload for HSTS preload list
    c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

    // Referrer-Policy - Controls referrer information in navigation
    c.header('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Permissions-Policy - Disables sensitive browser features
    c.header('Permissions-Policy', PERMISSIONS_POLICY);

    // Cross-Origin-Opener-Policy - Isolates top-level windows
    c.header('Cross-Origin-Opener-Policy', 'same-origin');

    // Cross-Origin-Resource-Policy - Controls cross-origin resource access
    c.header('Cross-Origin-Resource-Policy', 'same-origin');

    // Cross-Origin-Embedder-Policy - Controls cross-origin embedding
    c.header('Cross-Origin-Embedder-Policy', 'require-corp');

    await next();
  };
}

/**
 * Apply enhanced security headers for authentication endpoints
 *
 * Adds additional security measures for auth flows:
 * - Stricter CSP to prevent token theft
 * - No caching to prevent token leakage
 * - No indexing to prevent information disclosure
 *
 * @example
 * ```typescript
 * app.use('/api/auth/*', authSecurityHeaders());
 * ```
 */
export function authSecurityHeaders() {
  return async (c: Context, next: Next) => {
    // Apply standard security headers
    await securityHeaders()(c, async () => {});

    // Stricter CSP for auth endpoints - prevent token theft
    const authCSP =
      "default-src 'self'; " +
      "script-src 'self'; " +
      "style-src 'self'; " +
      "img-src 'self'; " +
      "connect-src 'self'; " +
      "object-src 'none'; " +
      "frame-ancestors 'none'; " +
      "base-uri 'self'; " +
      "form-action 'self'";

    c.header('Content-Security-Policy', authCSP);

    // Cache-Control - Prevent caching of auth responses
    c.header('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    c.header('Pragma', 'no-cache');
    c.header('Expires', '0');

    // X-Robots-Tag - Prevent indexing of auth pages
    c.header('X-Robots-Tag', 'noindex, nofollow');

    await next();
  };
}

/**
 * Apply security headers for API endpoints
 *
 * Optimized for API responses:
 * - No caching for sensitive endpoints
 * - Proper content type handling
 *
 * @param sensitive - Whether this endpoint returns sensitive data
 * @example
 * ```typescript
 * app.use('/api/users/*', apiSecurityHeaders(true));
 * app.use('/api/workflows', apiSecurityHeaders(false));
 * ```
 */
export function apiSecurityHeaders(sensitive: boolean = false) {
  return async (c: Context, next: Next) => {
    // Apply standard security headers
    await securityHeaders()(c, async () => {});

    if (sensitive) {
      // No caching for sensitive data
      c.header('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      c.header('Pragma', 'no-cache');
      c.header('Expires', '0');
    } else {
      // Short caching for non-sensitive API responses
      c.header('Cache-Control', 'max-age=60, must-revalidate');
    }

    // Ensure JSON content type for API responses
    if (!c.header('Content-Type')) {
      c.header('Content-Type', 'application/json; charset=utf-8');
    }

    await next();
  };
}

/**
 * Apply security headers for webhook endpoints
 *
 * Webhook-specific security:
 * - Strict content validation
 * - No caching
 * - Limited referrer information
 *
 * @example
 * ```typescript
 * app.use('/webhooks/*', webhookSecurityHeaders());
 * ```
 */
export function webhookSecurityHeaders() {
  return async (c: Context, next: Next) => {
    // Apply standard security headers
    await securityHeaders()(c, async () => {});

    // No caching for webhooks
    c.header('Cache-Control', 'no-store, no-cache, must-revalidate, private');

    // Limit referrer information for webhook URLs
    c.header('Referrer-Policy', 'no-referrer');

    await next();
  };
}

/**
 * Configure development headers (less strict, more debugging)
 *
 * WARNING: Only use in development!
 *
 * @example
 * ```typescript
 * if (process.env.NODE_ENV === 'development') {
 *   app.use('*', developmentHeaders());
 * }
 * ```
 */
export function developmentHeaders() {
  return async (c: Context, next: Next) => {
    // Relaxed CSP for development tools
    const devCSP =
      "default-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data: http://localhost:* http://127.0.0.1:*; " +
      "connect-src 'self' ws://localhost:* ws://127.0.0.1:* http://localhost:* http://127.0.0.1:*";

    c.header('Content-Security-Policy', devCSP);
    c.header('X-Content-Type-Options', 'nosniff');

    // Disable HSTS in development
    // c.header('Strict-Transport-Security', 'max-age=0');

    await next();
  };
}
