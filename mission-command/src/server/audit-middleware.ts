/**
 * Mission Command Audit Middleware
 *
 * Hono middleware for automatic audit logging of all authentication,
 * authorization, and user management events.
 *
 * Features:
 * - Auto-logs all auth endpoints (login, logout, token refresh)
 * - Auto-logs all admin actions (user management, role changes)
 * - Auto-logs all workflow approvals/declines
 * - Extracts user_id, IP, user_agent from request context
 */

import type { MiddlewareHandler } from 'hono';
import type { Context } from 'hono';
import type { AuditService, AuditEventType } from './audit-service';
import type { MissionCommandUser } from '@mastra/auth';

/**
 * Middleware options
 */
export interface AuditMiddlewareOptions {
  /** Audit service instance */
  auditService: AuditService;
  /** Whether to log successful requests (default: true) */
  logSuccess?: boolean;
  /** Whether to log failed requests (default: true) */
  logFailure?: boolean;
  /** Whether to log request body (default: false for security) */
  logBody?: boolean;
  /** Paths to exclude from audit logging */
  excludePaths?: string[];
  /** Custom logger (default: console) */
  logger?: typeof console;
}

/**
 * Route patterns to auto-log
 */
const AUTH_ROUTE_PATTERNS = [
  { path: '/api/auth/login', action: 'user.login' as AuditEventType, method: 'GET' },
  { path: '/api/auth/callback', action: 'user.session.created' as AuditEventType, method: 'GET' },
  { path: '/api/auth/logout', action: 'user.logout' as AuditEventType, method: 'POST' },
  { path: '/api/auth/refresh', action: 'user.session.refresh' as AuditEventType, method: 'POST' },
];

const USER_MANAGEMENT_ROUTE_PATTERNS = [
  { path: '/api/users/:id', action: 'user.updated' as AuditEventType, method: 'PUT' },
  { path: '/api/users/:id/role', action: 'user.role.changed' as AuditEventType, method: 'PUT' },
  { path: '/api/users/:id', action: 'user.deleted' as AuditEventType, method: 'DELETE' },
  { path: '/api/users/:id/sessions', action: 'user.sessions.revoked' as AuditEventType, method: 'DELETE' },
];

const WORKFLOW_ROUTE_PATTERNS = [
  { path: '/api/approvals/:runId/approve', action: 'workflow.approved' as AuditEventType, method: 'POST' },
  { path: '/api/approvals/:runId/decline', action: 'workflow.declined' as AuditEventType, method: 'POST' },
  { path: '/api/workflows/:workflowId/resume', action: 'workflow.resumed' as AuditEventType, method: 'POST' },
];

/**
 * Match route pattern
 */
function matchRoutePattern(path: string, method: string, patterns: typeof AUTH_ROUTE_PATTERNS) {
  for (const pattern of patterns) {
    if (pattern.method !== method) continue;

    // Convert pattern to regex
    const regexPattern = pattern.path
      .replace(/:[^/]+/g, '[^/]+') // Replace :param with wildcard
      .replace(/\*/g, '.*');

    const regex = new RegExp(`^${regexPattern}$`);

    if (regex.test(path)) {
      return pattern;
    }
  }

  return null;
}

/**
 * Extract resource ID from path
 */
function extractResourceId(path: string, pattern: string): string | undefined {
  // Find the parameter in the pattern
  const paramMatch = pattern.match(/:([^/]+)/);
  if (!paramMatch) return undefined;

  const paramName = paramMatch[1];

  // Split path and pattern to find the corresponding value
  const pathParts = path.split('/');
  const patternParts = pattern.split('/');

  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i] === `:${paramName}`) {
      return pathParts[i];
    }
  }

  return undefined;
}

/**
 * Create audit logging middleware
 */
export function createAuditMiddleware(options: AuditMiddlewareOptions): MiddlewareHandler {
  const {
    auditService,
    logSuccess = true,
    logFailure = true,
    logBody = false,
    excludePaths = [],
    logger = console,
  } = options;

  /**
   * Middleware handler
   */
  return async (c, next) => {
    const path = c.req.path;
    const method = c.req.method;

    // Check if path should be excluded
    if (excludePaths.some(excluded => path.startsWith(excluded))) {
      await next();
      return;
    }

    // Get user from context
    const user = c.get('user') as MissionCommandUser | undefined;

    // Extract IP and user agent
    const ipAddress = c.req?.header('x-forwarded-for')?.split(',')[0]?.trim() ||
                      c.req?.header('x-real-ip') ||
                      c.req?.header('cf-connecting-ip');
    const userAgent = c.req?.header('user-agent');

    // Capture start time for performance tracking
    const startTime = Date.now();

    // Proceed with request
    await next();

    // Capture response status
    const status = c.res.status;
    const success = status >= 200 && status < 400;

    // Determine what to log based on settings
    if ((success && !logSuccess) || (!success && !logFailure)) {
      return;
    }

    // Match route pattern to determine action type
    const matchedPattern = 
      matchRoutePattern(path, method, AUTH_ROUTE_PATTERNS) ||
      matchRoutePattern(path, method, USER_MANAGEMENT_ROUTE_PATTERNS) ||
      matchRoutePattern(path, method, WORKFLOW_ROUTE_PATTERNS);

    if (matchedPattern) {
      // Auto-log based on route pattern
      try {
        const resourceId = extractResourceId(path, matchedPattern.path);

        // Get request body if logging is enabled
        let details: Record<string, any> | undefined;
        if (logBody && ['POST', 'PUT', 'PATCH'].includes(method)) {
          try {
            // Note: Body can only be read once, so this needs to be cached
            // For now, we'll skip body logging in middleware
            details = { method, path };
          } catch {
            details = { method, path };
          }
        } else {
          details = { method, path, status };
        }

        // Log the event
        await auditService.logAuthEvent({
          userId: user?.sub,
          action: matchedPattern.action,
          resource: matchedPattern.path.split('/')[2], // Extract resource type from path
          resourceId,
          details: {
            ...details,
            userEmail: user?.email,
            userRole: user?.role,
          },
          ipAddress,
          userAgent,
          success,
          errorMessage: success ? undefined : `HTTP ${status}`,
        });

        const duration = Date.now() - startTime;
        if (duration > 10) {
          logger.warn(`Audit middleware took ${duration}ms for ${method} ${path}`);
        }
      } catch (error) {
        // Don't fail the request if audit logging fails
        logger.error('Audit middleware failed:', error);
      }
    }
  };
}

/**
 * Create middleware to log authorization checks
 *
 * This should be used before authorization middleware to log both
 * successful and failed authorization attempts.
 */
export function createAuthorizationAuditMiddleware(options: AuditMiddlewareOptions): MiddlewareHandler {
  const { auditService, logger = console } = options;

  return async (c, next) => {
    const path = c.req.path;
    const method = c.req.method;

    // Get user from context
    const user = c.get('user') as MissionCommandUser | undefined;

    // Extract IP and user agent
    const ipAddress = c.req?.header('x-forwarded-for')?.split(',')[0]?.trim() ||
                      c.req?.header('x-real-ip');
    const userAgent = c.req?.header('user-agent');

    // Proceed with request
    await next();

    // Log authorization failures
    const status = c.res.status;
    if (status === 403 && user) {
      try {
        await auditService.logAuthEvent({
          userId: user.sub,
          action: 'auth.permission.denied',
          resource: path.split('/')[2],
          details: {
            method,
            path,
            userEmail: user.email,
            userRole: user.role,
          },
          ipAddress,
          userAgent,
          success: false,
          errorMessage: 'Forbidden',
        });
      } catch (error) {
        logger.error('Authorization audit failed:', error);
      }
    }
  };
}

/**
 * Create middleware to log admin actions
 *
 * This middleware logs all actions performed by admin users.
 */
export function createAdminAuditMiddleware(options: AuditMiddlewareOptions): MiddlewareHandler {
  const { auditService, logger = console } = options;

  return async (c, next) => {
    // Get user from context
    const user = c.get('user') as MissionCommandUser | undefined;

    // Only log admin actions
    if (!user || user.role !== 'admin') {
      await next();
      return;
    }

    const path = c.req.path;
    const method = c.req.method;

    // Extract IP and user agent
    const ipAddress = c.req?.header('x-forwarded-for')?.split(',')[0]?.trim() ||
                      c.req?.header('x-real-ip');
    const userAgent = c.req?.header('user-agent');

    // Proceed with request
    await next();

    // Log all admin actions (write operations)
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      const status = c.res.status;
      const success = status >= 200 && status < 400;

      try {
        await auditService.logAuthEvent({
          userId: user.sub,
          action: 'auth.action.admin',
          resource: path.split('/')[2],
          details: {
            method,
            path,
            status,
            userEmail: user.email,
          },
          ipAddress,
          userAgent,
          success,
          errorMessage: success ? undefined : `HTTP ${status}`,
        });
      } catch (error) {
        logger.error('Admin audit failed:', error);
      }
    }
  };
}

/**
 * Helper: Create combined audit middleware stack
 *
 * This creates a middleware that combines all audit logging strategies.
 */
export function createAuditMiddlewareStack(options: AuditMiddlewareOptions) {
  return [
    createAuditMiddleware(options),
    createAuthorizationAuditMiddleware(options),
    createAdminAuditMiddleware(options),
  ];
}
