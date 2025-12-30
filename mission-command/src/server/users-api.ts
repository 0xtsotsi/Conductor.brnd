/**
 * Mission Command User Management API
 *
 * Provides admin-only endpoints for managing users.
 * All endpoints require admin role.
 */

import { Hono } from 'hono';
import type { OAuthStorage } from './oauth-handler';
import { requireRole, requirePermission } from '@mastra/auth/rbac-middleware';
import type { MissionCommandUser } from '@mastra/auth';

export interface UsersAPIOptions {
  storage: OAuthStorage;
}

/**
 * Create user management API handler
 */
export function createUsersAPI(options: UsersAPIOptions) {
  const app = new Hono();

  const { storage } = options;

  /**
   * Helper: Extract user from context
   */
  function getCurrentUser(c: any): MissionCommandUser {
    return c.get('user') as MissionCommandUser;
  }

  /**
   * Route: List all users
   * GET /api/users
   * Admin only
   */
  app.get('/api/users', requireRole('admin'), async (c) => {
    // Note: This requires storage to support listing all users
    // For now, return empty array (to be implemented with proper storage)
    return c.json({
      users: [],
      total: 0,
    });
  });

  /**
   * Route: Get user by ID
   * GET /api/users/:id
   * Admin only
   */
  app.get('/api/users/:id', requireRole('admin'), async (c) => {
    const id = c.req.param('id');

    // This requires storage to support finding by ID
    // For now, return 404
    return c.json({ error: 'User not found' }, 404);
  });

  /**
   * Route: Update user role
   * PUT /api/users/:id/role
   * Admin only
   */
  app.put('/api/users/:id/role', requireRole('admin'), async (c) => {
    const id = c.req.param('id');
    const { role } = await c.req.json();

    if (!['admin', 'operator', 'viewer'].includes(role)) {
      return c.json({ error: 'Invalid role' }, 400);
    }

    // This requires storage to support updating by ID
    return c.json({ error: 'Not implemented' }, 501);
  });

  /**
   * Route: Delete user
   * DELETE /api/users/:id
   * Admin only
   */
  app.delete('/api/users/:id', requireRole('admin'), async (c) => {
    const id = c.req.param('id');
    const currentUser = getCurrentUser(c);

    // Prevent self-deletion
    if (id === currentUser.sub) {
      return c.json({ error: 'Cannot delete yourself' }, 400);
    }

    // This requires storage to support deletion
    return c.json({ error: 'Not implemented' }, 501);
  });

  return app;
}
