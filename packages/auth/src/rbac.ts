import type { HonoRequest } from 'hono';
import type { MastraAuthProviderOptions } from '@mastra/core/server';
import { MastraAuthProvider } from '@mastra/core/server';

/**
 * Role-based access control (RBAC) for Mission Command Centre
 *
 * Roles:
 * - Admin: Full access to all resources
 * - Operator: Can start missions, approve tasks, view executions
 * - Viewer: Read-only access to workflows and executions
 */

/**
 * User roles for Mission Command Centre
 */
export type MissionCommandRole = 'admin' | 'operator' | 'viewer';

/**
 * User permissions for Mission Command Centre
 */
export type MissionCommandPermission =
  // Workflow management
  | 'workflows:create'
  | 'workflows:read'
  | 'workflows:update'
  | 'workflows:delete'
  // Workflow execution
  | 'workflows:execute'
  | 'workflows:approve'
  | 'workflows:reject'
  | 'workflows:resume'
  // Agent management
  | 'agents:create'
  | 'agents:read'
  | 'agents:update'
  | 'agents:delete'
  // Monitoring
  | 'monitoring:read'
  | 'monitoring:cancel'
  // System administration
  | 'admin:users'
  | 'admin:roles'
  | 'admin:settings';

/**
 * User type with role information
 */
export interface MissionCommandUser {
  sub: string;
  email?: string;
  name?: string;
  role: MissionCommandRole;
  permissions?: MissionCommandPermission[];
}

/**
 * Role definitions with default permissions
 */
export const ROLE_PERMISSIONS: Record<
  MissionCommandRole,
  MissionCommandPermission[]
> = {
  admin: [
    // Full access to everything
    'workflows:create',
    'workflows:read',
    'workflows:update',
    'workflows:delete',
    'workflows:execute',
    'workflows:approve',
    'workflows:reject',
    'workflows:resume',
    'agents:create',
    'agents:read',
    'agents:update',
    'agents:delete',
    'monitoring:read',
    'monitoring:cancel',
    'admin:users',
    'admin:roles',
    'admin:settings',
  ],
  operator: [
    // Can execute and approve workflows
    'workflows:read',
    'workflows:execute',
    'workflows:approve',
    'workflows:reject',
    'workflows:resume',
    'agents:read',
    'monitoring:read',
    'monitoring:cancel',
  ],
  viewer: [
    // Read-only access
    'workflows:read',
    'agents:read',
    'monitoring:read',
  ],
};

/**
 * Check if a role has a specific permission
 */
export function roleHasPermission(
  role: MissionCommandRole,
  permission: MissionCommandPermission,
): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

/**
 * Check if a user has a specific permission
 */
export function userHasPermission(
  user: MissionCommandUser,
  permission: MissionCommandPermission,
): boolean {
  // Check custom permissions first
  if (user.permissions && user.permissions.includes(permission)) {
    return true;
  }
  // Fall back to role-based permissions
  return roleHasPermission(user.role, permission);
}

/**
 * Check if a user has any of the specified permissions
 */
export function userHasAnyPermission(
  user: MissionCommandUser,
  permissions: MissionCommandPermission[],
): boolean {
  return permissions.some(permission => userHasPermission(user, permission));
}

/**
 * Permission map for API routes
 * Maps route patterns to required permissions
 */
export const ROUTE_PERMISSIONS: Record<
  string,
  Record<string, MissionCommandPermission | MissionCommandPermission[]>
> = {
  // Workflow routes
  '/api/workflows': {
    GET: 'workflows:read',
    POST: 'workflows:create',
  },
  '/api/workflows/:id': {
    GET: 'workflows:read',
    PUT: 'workflows:update',
    DELETE: 'workflows:delete',
  },
  // Workflow execution routes
  '/api/workflows/:id/run': {
    POST: 'workflows:execute',
  },
  '/api/workflows/:workflowId/runs/:runId/approve': {
    POST: 'workflows:approve',
  },
  '/api/workflows/:workflowId/runs/:runId/reject': {
    POST: 'workflows:reject',
  },
  '/api/workflows/:workflowId/runs/:runId/resume': {
    POST: 'workflows:resume',
  },
  // Agent routes
  '/api/agents': {
    GET: 'agents:read',
    POST: 'agents:create',
  },
  '/api/agents/:id': {
    GET: 'agents:read',
    PUT: 'agents:update',
    DELETE: 'agents:delete',
  },
  // Monitoring routes
  '/api/runs': {
    GET: 'monitoring:read',
  },
  '/api/runs/:id': {
    GET: 'monitoring:read',
    DELETE: 'monitoring:cancel',
  },
  // Admin routes
  '/api/admin/users': {
    GET: 'admin:users',
    POST: 'admin:users',
  },
  '/api/admin/roles': {
    GET: 'admin:roles',
    POST: 'admin:roles',
  },
  '/api/admin/settings': {
    GET: 'admin:settings',
    PUT: 'admin:settings',
  },
};

/**
 * RBAC Auth Provider Options
 */
export interface MissionCommandAuthOptions
  extends MastraAuthProviderOptions<MissionCommandUser> {
  /**
   * Secret for JWT verification
   */
  secret?: string;
  /**
   * Custom role permissions (overrides defaults)
   */
  customRolePermissions?: Partial<
    Record<MissionCommandRole, MissionCommandPermission[]>
  >;
  /**
   * Custom route permissions
   */
  customRoutePermissions?: typeof ROUTE_PERMISSIONS;
}

/**
 * RBAC Auth Provider for Mission Command Centre
 *
 * Extends MastraAuthProvider with role-based access control
 */
export class MissionCommandAuth extends MastraAuthProvider<MissionCommandUser> {
  private secret: string;
  private customRolePermissions?: Partial<
    Record<MissionCommandRole, MissionCommandPermission[]>
  >;
  private customRoutePermissions?: typeof ROUTE_PERMISSIONS;

  constructor(options?: MissionCommandAuthOptions) {
    super({ name: options?.name ?? 'mission-command-rbac' });

    this.secret = options?.secret ?? process.env.JWT_AUTH_SECRET ?? '';
    if (!this.secret) {
      throw new Error('JWT auth secret is required');
    }

    this.customRolePermissions = options?.customRolePermissions;
    this.customRoutePermissions = options?.customRoutePermissions;
    this.registerOptions(options);
  }

  /**
   * Authenticate a JWT token and return the user with role
   */
  async authenticateToken(
    token: string,
    _request: HonoRequest,
  ): Promise<MissionCommandUser | null> {
    try {
      const jwt = await import('jsonwebtoken');
      const payload = jwt.verify(token, this.secret) as any;

      // Ensure the user has a role (default to viewer if not specified)
      if (!payload.role) {
        payload.role = 'viewer';
      }

      return payload as MissionCommandUser;
    } catch (error) {
      return null;
    }
  }

  /**
   * Authorize a user for a specific route and method
   */
  async authorizeUser(
    user: MissionCommandUser,
    request: HonoRequest,
  ): Promise<boolean> {
    const path = request.path;
    const method = request.method;

    // Merge custom route permissions with defaults
    const routePermissions = {
      ...ROUTE_PERMISSIONS,
      ...this.customRoutePermissions,
    };

    // Find matching route permission
    const requiredPermission = this.findRequiredPermission(
      path,
      method,
      routePermissions,
    );

    if (!requiredPermission) {
      // No permission required (public route)
      return true;
    }

    // Check if user has the required permission
    if (Array.isArray(requiredPermission)) {
      return userHasAnyPermission(user, requiredPermission);
    }

    return userHasPermission(user, requiredPermission);
  }

  /**
   * Find the required permission for a route
   */
  private findRequiredPermission(
    path: string,
    method: string,
    routePermissions: typeof ROUTE_PERMISSIONS,
  ): MissionCommandPermission | MissionCommandPermission[] | null {
    // Exact match first
    if (routePermissions[path]?.[method]) {
      return routePermissions[path][method] as MissionCommandPermission;
    }

    // Pattern match (e.g., /api/workflows/:id)
    for (const [route, permissions] of Object.entries(routePermissions)) {
      if (permissions[method] && this.pathMatches(path, route)) {
        return permissions[method] as MissionCommandPermission;
      }
    }

    return null;
  }

  /**
   * Check if a path matches a route pattern
   */
  private pathMatches(path: string, pattern: string): boolean {
    // Convert pattern to regex
    const regexPattern = pattern
      .replace(/:[^/]+/g, '[^/]+')
      .replace(/\*/g, '.*');
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(path);
  }

  /**
   * Get role permissions for a user
   */
  getRolePermissions(role: MissionCommandRole): MissionCommandPermission[] {
    if (this.customRolePermissions?.[role]) {
      return this.customRolePermissions[role]!;
    }
    return ROLE_PERMISSIONS[role];
  }

  /**
   * Get user permissions
   */
  getUserPermissions(user: MissionCommandUser): MissionCommandPermission[] {
    if (user.permissions) {
      return user.permissions;
    }
    return this.getRolePermissions(user.role);
  }
}
