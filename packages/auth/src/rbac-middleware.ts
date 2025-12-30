import type { MiddlewareHandler, Context } from 'hono';
import type { ContextWithMastra } from '@mastra/core/server';
import type {
  MissionCommandUser,
  MissionCommandPermission,
} from './rbac';

/**
 * Create a middleware that requires a specific permission
 *
 * @example
 * ```ts
 * const app = new Hono();
 *
 * // Require workflow create permission
 * app.post('/api/workflows', requirePermission('workflows:create'), async (c) => {
 *   // Handler code
 * });
 *
 * // Require any of multiple permissions
 * app.delete('/api/workflows/:id', requirePermission(['workflows:delete', 'admin:settings']), async (c) => {
 *   // Handler code
 * });
 * ```
 */
export function requirePermission(
  permission: MissionCommandPermission | MissionCommandPermission[],
): MiddlewareHandler<{
  Variables: {
    mastra: any;
    user: MissionCommandUser;
  };
}> {
  return async (c, next) => {
    const user = c.get('user') as MissionCommandUser | undefined;

    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { userHasPermission, userHasAnyPermission } = await import('./rbac');

    const hasPermission = Array.isArray(permission)
      ? userHasAnyPermission(user, permission)
      : userHasPermission(user, permission);

    if (!hasPermission) {
      return c.json(
        {
          error: 'Forbidden',
          message: `Missing required permission: ${
            Array.isArray(permission) ? permission.join(' or ') : permission
          }`,
        },
        403,
      );
    }

    await next();
  };
}

/**
 * Create a middleware that requires a specific role
 *
 * @example
 * ```ts
 * const app = new Hono();
 *
 * // Only admins can access this route
 * app.post('/api/admin/settings', requireRole('admin'), async (c) => {
 *   // Handler code
 * });
 * ```
 */
export function requireRole(role: 'admin' | 'operator' | 'viewer'): MiddlewareHandler<{
  Variables: {
    mastra: any;
    user: MissionCommandUser;
  };
}> {
  return async (c, next) => {
    const user = c.get('user') as MissionCommandUser | undefined;

    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    if (user.role !== role) {
      return c.json(
        {
          error: 'Forbidden',
          message: `Required role: ${role}`,
        },
        403,
      );
    }

    await next();
  };
}

/**
 * Create a middleware that requires minimum role level
 *
 * Role hierarchy: admin > operator > viewer
 *
 * @example
 * ```ts
 * const app = new Hono();
 *
 * // Operators and admins can access
 * app.post('/api/workflows/:id/run', requireMinRole('operator'), async (c) => {
 *   // Handler code
 * });
 * ```
 */
export function requireMinRole(minRole: 'admin' | 'operator' | 'viewer'): MiddlewareHandler<{
  Variables: {
    mastra: any;
    user: MissionCommandUser;
  };
}> {
  const roleLevels = { admin: 3, operator: 2, viewer: 1 };

  return async (c, next) => {
    const user = c.get('user') as MissionCommandUser | undefined;

    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userLevel = roleLevels[user.role] ?? 0;
    const requiredLevel = roleLevels[minRole] ?? 0;

    if (userLevel < requiredLevel) {
      return c.json(
        {
          error: 'Forbidden',
          message: `Required minimum role: ${minRole}`,
        },
        403,
      );
    }

    await next();
  };
}

/**
 * Inject user into context from Mastra auth
 *
 * This middleware should be applied after Mastra's auth middleware
 * to make the user object available to subsequent middleware and handlers
 *
 * @example
 * ```ts
 * import { Mastra } from '@mastra/core';
 * import { MissionCommandAuth } from '@mastra/auth';
 * import { injectUser } from '@mastra/auth/rbac-middleware';
 *
 * const mastra = new Mastra({
 *   server: {
 *     auth: new MissionCommandAuth(),
 *   },
 * });
 *
 * const app = mastra.getServer();
 * app.use('*', injectUser);
 * ```
 */
export function injectUser(): MiddlewareHandler<{
  Variables: {
    mastra: any;
    requestContext: any;
    user: MissionCommandUser;
  };
}> {
  return async (c, next) => {
    // Get user from request context (set by Mastra auth)
    const requestContext = c.get('requestContext');
    const user = requestContext?.get('user');

    if (user) {
      c.set('user', user);
    }

    await next();
  };
}
