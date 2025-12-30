/**
 * Mission Command User Management API
 *
 * Provides endpoints for managing users, sessions, and audit logs.
 * Supports admin-only operations and self-access for users.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import type { OAuthStorage } from './oauth-handler';
import { requireRole, requirePermission } from '@mastra/auth/rbac-middleware';
import { requireAuth } from './jwt-middleware';
import type { MissionCommandUser } from '@mastra/auth';

export interface UsersAPIOptions {
  storage: OAuthStorage;
}

/**
 * Validation schemas
 */
const listUsersQuerySchema = z.object({
  limit: z.string().optional().transform(val => val ? parseInt(val) : 50),
  offset: z.string().optional().transform(val => val ? parseInt(val) : 0),
  role: z.enum(['admin', 'operator', 'viewer']).optional(),
  search: z.string().optional(),
});

const updateUserSchema = z.object({
  name: z.string().optional(),
  avatar_url: z.string().url().optional(),
  role: z.enum(['admin', 'operator', 'viewer']).optional(),
});

/**
 * Check if user is admin or accessing their own data
 */
function isAdminOrSelf(currentUser: MissionCommandUser, targetUserId: string): boolean {
  return currentUser.role === 'admin' || currentUser.sub === targetUserId;
}

/**
 * Create user management API handler
 */
export function createUsersAPI(options: UsersAPIOptions) {
  const app = new Hono();

  const { storage } = options;

  // Apply JWT authentication middleware to all routes
  app.use('/api/users/*', requireAuth());
  app.use('/api/audit-logs', requireAuth());

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
    const query = listUsersQuerySchema.safeParse(c.req.query());
    
    if (!query.success) {
      return c.json({ error: 'Invalid query parameters', details: query.error.flatten() }, 400);
    }

    const { limit, offset, role, search } = query.data;
    const filters: any = {};
    if (role) filters.role = role;
    if (search) filters.search = search;

    const result = await storage.listUsers?.(limit, offset, filters) ?? { users: [], total: 0 };
    
    return c.json({
      users: result.users.map(u => ({
        id: u.id,
        email: u.email,
        name: u.name,
        avatar_url: u.avatar_url,
        role: u.role,
        provider: u.provider,
        created_at: u.created_at,
        updated_at: u.updated_at,
      })),
      total: result.total,
      limit,
      offset,
    });
  });

  /**
   * Route: Get user by ID
   * GET /api/users/:id
   * Admin or self
   */
  app.get('/api/users/:id', async (c) => {
    const id = c.req.param('id');
    const currentUser = getCurrentUser(c);

    // Check permission: admin or self
    if (!isAdminOrSelf(currentUser, id)) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const user = await storage.getUser(id);

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Log audit event
    if (currentUser.role === 'admin' && currentUser.sub !== id) {
      await storage.logAuditEvent?.({
        userId: currentUser.sub,
        action: 'user.view',
        resource: `user:${id}`,
        ipAddress: c.req.header('x-forwarded-for') || c.req.header('x-real-ip'),
      });
    }

    return c.json({
      id: user.id,
      email: user.email,
      name: user.name,
      avatar_url: user.avatar_url,
      role: user.role,
      provider: user.provider,
      created_at: user.created_at,
      updated_at: user.updated_at,
    });
  });

  /**
   * Route: Update user
   * PUT /api/users/:id
   * Admin or self (limited fields for self)
   */
  app.put('/api/users/:id', async (c) => {
    const id = c.req.param('id');
    const currentUser = getCurrentUser(c);

    // Check permission: admin or self
    if (!isAdminOrSelf(currentUser, id)) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const body = updateUserSchema.safeParse(await c.req.json());
    
    if (!body.success) {
      return c.json({ error: 'Invalid request body', details: body.error.flatten() }, 400);
    }

    const { name, avatar_url, role } = body.data;

    // Non-admins cannot change role
    if (role && currentUser.role !== 'admin') {
      return c.json({ error: 'Only admins can change role' }, 403);
    }

    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (avatar_url !== undefined) updates.avatar_url = avatar_url;
    if (role !== undefined && currentUser.role === 'admin') updates.role = role;

    const updatedUser = await storage.updateUser(id, updates);

    // Log audit event
    await storage.logAuditEvent?.({
      userId: currentUser.sub,
      action: 'user.update',
      resource: `user:${id}`,
      details: { fields: Object.keys(updates) },
      ipAddress: c.req.header('x-forwarded-for') || c.req.header('x-real-ip'),
    });

    return c.json({
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      avatar_url: updatedUser.avatar_url,
      role: updatedUser.role,
      provider: updatedUser.provider,
      created_at: updatedUser.created_at,
      updated_at: updatedUser.updated_at,
    });
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

    // Check if user exists
    const user = await storage.getUser(id);
    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    await storage.deleteUser(id);

    // Log audit event
    await storage.logAuditEvent?.({
      userId: currentUser.sub,
      action: 'user.delete',
      resource: `user:${id}`,
      details: { deletedUserEmail: user.email },
      ipAddress: c.req.header('x-forwarded-for') || c.req.header('x-real-ip'),
    });

    return c.json({ success: true });
  });

  /**
   * Route: List user sessions
   * GET /api/users/:id/sessions
   * Admin or self
   */
  app.get('/api/users/:id/sessions', async (c) => {
    const id = c.req.param('id');
    const currentUser = getCurrentUser(c);

    // Check permission: admin or self
    if (!isAdminOrSelf(currentUser, id)) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const limit = parseInt(c.req.query('limit') || '50');
    const offset = parseInt(c.req.query('offset') || '0');

    const result = await storage.getUserSessions?.(id, limit, offset) ?? { sessions: [], total: 0 };

    return c.json({
      sessions: result.sessions.map(s => ({
        id: s.id,
        created_at: s.createdAt,
        expires_at: s.expiresAt,
        ip_address: s.ipAddress,
        user_agent: s.userAgent,
      })),
      total: result.total,
      limit,
      offset,
    });
  });

  /**
   * Route: Invalidate all user sessions
   * DELETE /api/users/:id/sessions
   * Admin or self
   */
  app.delete('/api/users/:id/sessions', async (c) => {
    const id = c.req.param('id');
    const currentUser = getCurrentUser(c);

    // Check permission: admin or self
    if (!isAdminOrSelf(currentUser, id)) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    await storage.invalidateAllUserSessions?.(id);

    // Log audit event
    await storage.logAuditEvent?.({
      userId: currentUser.sub,
      action: 'user.sessions.invalidate_all',
      resource: `user:${id}`,
      ipAddress: c.req.header('x-forwarded-for') || c.req.header('x-real-ip'),
    });

    return c.json({ success: true });
  });

  /**
   * Route: Get user audit log
   * GET /api/users/:id/audit
   * Admin or self
   */
  app.get('/api/users/:id/audit', async (c) => {
    const id = c.req.param('id');
    const currentUser = getCurrentUser(c);

    // Check permission: admin or self
    if (!isAdminOrSelf(currentUser, id)) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const limit = parseInt(c.req.query('limit') || '100');
    const offset = parseInt(c.req.query('offset') || '0');

    const logs = await storage.getAuditLogs?.(id, limit, offset) ?? [];

    return c.json({
      logs: logs.map(log => ({
        id: log.id,
        action: log.action,
        resource: log.resource,
        details: log.details,
        ip_address: log.ipAddress,
        created_at: log.createdAt,
      })),
      limit,
      offset,
    });
  });

  /**
   * Route: Get all audit logs (admin only)
   * GET /api/audit-logs
   * Admin only
   */
  app.get('/api/audit-logs', requireRole('admin'), async (c) => {
    const limit = parseInt(c.req.query('limit') || '100');
    const offset = parseInt(c.req.query('offset') || '0');

    const logs = await storage.getAllAuditLogs?.(limit, offset) ?? [];

    return c.json({
      logs: logs.map(log => ({
        id: log.id,
        user_id: log.userId,
        action: log.action,
        resource: log.resource,
        details: log.details,
        ip_address: log.ipAddress,
        created_at: log.createdAt,
      })),
      limit,
      offset,
    });
  });

  return app;
}
