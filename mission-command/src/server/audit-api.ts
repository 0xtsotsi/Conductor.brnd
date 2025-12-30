/**
 * Mission Command Audit API Endpoints
 *
 * Admin-only endpoints for viewing and exporting audit logs.
 *
 * Endpoints:
 * - GET /api/audit/logs - List audit logs with filters (admin only)
 * - GET /api/audit/logs/:id - Get specific log entry (admin only)
 * - GET /api/audit/users/:userId - Get user's audit trail (admin only)
 * - POST /api/audit/export - Export logs to CSV (admin only)
 * - GET /api/audit/stats - Get audit statistics (admin only)
 */

import { Hono } from 'hono';
import { requireRole } from '@mastra/auth/rbac-middleware';
import type { AuditService, AuditLogFilters, AuditEventType } from '../auth/audit-service';
import type { MissionCommandUser } from '@mastra/auth';

/**
 * Audit API options
 */
export interface AuditAPIOptions {
  /** Audit service instance */
  auditService: AuditService;
}

/**
 * Create audit API handler
 */
export function createAuditAPI(options: AuditAPIOptions) {
  const app = new Hono();
  const { auditService } = options;

  /**
   * Route: List audit logs with filters
   * GET /api/audit/logs
   * Admin only
   *
   * Query params:
   * - userId: Filter by user ID
   * - action: Filter by action type (can be comma-separated for multiple)
   * - resource: Filter by resource type
   * - resourceId: Filter by resource ID
   * - success: Filter by success status (true/false)
   * - startDate: Filter by start date (ISO 8601)
   * - endDate: Filter by end date (ISO 8601)
   * - search: Search in details
   * - page: Page number (default: 0)
   * - pageSize: Page size (default: 50, max: 100)
   */
  app.get('/api/audit/logs', requireRole('admin'), async (c) => {
    try {
      const user = c.get('user') as MissionCommandUser;

      // Parse query parameters
      const userId = c.req.query('userId');
      const actionParam = c.req.query('action');
      const resource = c.req.query('resource');
      const resourceId = c.req.query('resourceId');
      const successParam = c.req.query('success');
      const startDateParam = c.req.query('startDate');
      const endDateParam = c.req.query('endDate');
      const search = c.req.query('search');
      const pageParam = c.req.query('page');
      const pageSizeParam = c.req.query('pageSize');

      // Build filters
      const filters: AuditLogFilters = {};

      if (userId) filters.userId = userId;

      if (actionParam) {
        // Support comma-separated actions
        filters.action = actionParam.split(',').map(a => a.trim()) as AuditEventType[];
      }

      if (resource) filters.resource = resource;
      if (resourceId) filters.resourceId = resourceId;

      if (successParam) {
        filters.success = successParam === 'true';
      }

      if (startDateParam) {
        filters.startDate = new Date(startDateParam);
        if (isNaN(filters.startDate.getTime())) {
          return c.json({ error: 'Invalid startDate format' }, 400);
        }
      }

      if (endDateParam) {
        filters.endDate = new Date(endDateParam);
        if (isNaN(filters.endDate.getTime())) {
          return c.json({ error: 'Invalid endDate format' }, 400);
        }
      }

      if (search) filters.search = search;

      // Parse pagination
      const page = parseInt(pageParam || '0');
      const pageSize = Math.min(parseInt(pageSizeParam || '50'), 100); // Max 100 per page

      // Query audit log
      const result = await auditService.getAuditLog(filters, page, pageSize);

      return c.json({
        ...result,
        _metadata: {
          requestedBy: user.email,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error('Failed to list audit logs:', error);
      return c.json({
        error: 'Failed to list audit logs',
        message: error instanceof Error ? error.message : String(error),
      }, 500);
    }
  });

  /**
   * Route: Get specific audit log entry
   * GET /api/audit/logs/:id
   * Admin only
   */
  app.get('/api/audit/logs/:id', requireRole('admin'), async (c) => {
    try {
      const id = c.req.param('id');

      // Note: This requires storage to support getAuditLogById
      // For now, return not found
      return c.json({ error: 'Not implemented' }, 501);
    } catch (error) {
      console.error('Failed to get audit log:', error);
      return c.json({
        error: 'Failed to get audit log',
        message: error instanceof Error ? error.message : String(error),
      }, 500);
    }
  });

  /**
   * Route: Get audit trail for a specific user
   * GET /api/audit/users/:userId
   * Admin only
   *
   * Query params:
   * - limit: Maximum number of entries (default: 100)
   * - offset: Offset for pagination (default: 0)
   */
  app.get('/api/audit/users/:userId', requireRole('admin'), async (c) => {
    try {
      const userId = c.req.param('userId');
      const limitParam = c.req.query('limit');
      const offsetParam = c.req.query('offset');

      const limit = parseInt(limitParam || '100');
      const offset = parseInt(offsetParam || '0');

      const logs = await auditService.getAuditLogForUser(userId, limit, offset);

      return c.json({
        userId,
        logs,
        count: logs.length,
        limit,
        offset,
      });
    } catch (error) {
      console.error('Failed to get user audit trail:', error);
      return c.json({
        error: 'Failed to get user audit trail',
        message: error instanceof Error ? error.message : String(error),
      }, 500);
    }
  });

  /**
   * Route: Export audit logs to CSV
   * POST /api/audit/export
   * Admin only
   *
   * Body:
   * - filters: AuditLogFilters
   * - limit: Maximum number of entries (default: 1000)
   */
  app.post('/api/audit/export', requireRole('admin'), async (c) => {
    try {
      const user = c.get('user') as MissionCommandUser;
      const { filters, limit = 1000 } = await c.req.json();

      // Query audit log
      const result = await auditService.getAuditLog(filters, 0, limit);

      // Generate CSV
      const csv = generateAuditCSV(result.logs);

      // Return CSV file
      return c.body(csv, 200, {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="audit-logs-${new Date().toISOString()}.csv"`,
      });
    } catch (error) {
      console.error('Failed to export audit logs:', error);
      return c.json({
        error: 'Failed to export audit logs',
        message: error instanceof Error ? error.message : String(error),
      }, 500);
    }
  });

  /**
   * Route: Get audit statistics
   * GET /api/audit/stats
   * Admin only
   */
  app.get('/api/audit/stats', requireRole('admin'), async (c) => {
    try {
      // Get recent logs for statistics
      const recentLogs = await auditService.getAuditLog({}, 0, 1000);

      // Calculate statistics
      const stats = {
        total: recentLogs.total,
        byAction: {} as Record<string, number>,
        byResource: {} as Record<string, number>,
        successRate: 0,
        mostActiveUsers: [] as Array<{ userId: string; count: number }>,
      };

      let successCount = 0;

      for (const log of recentLogs.logs) {
        // Count by action
        stats.byAction[log.action] = (stats.byAction[log.action] || 0) + 1;

        // Count by resource
        if (log.resource) {
          stats.byResource[log.resource] = (stats.byResource[log.resource] || 0) + 1;
        }

        // Count success/failure
        if (!log.action.includes('failed') && !log.action.includes('denied')) {
          successCount++;
        }
      }

      // Calculate success rate
      stats.successRate = recentLogs.logs.length > 0
        ? (successCount / recentLogs.logs.length) * 100
        : 0;

      // Get most active users
      const userCounts = new Map<string, number>();
      for (const log of recentLogs.logs) {
        if (log.userId) {
          userCounts.set(log.userId, (userCounts.get(log.userId) || 0) + 1);
        }
      }

      stats.mostActiveUsers = Array.from(userCounts.entries())
        .map(([userId, count]) => ({ userId, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      return c.json(stats);
    } catch (error) {
      console.error('Failed to get audit statistics:', error);
      return c.json({
        error: 'Failed to get audit statistics',
        message: error instanceof Error ? error.message : String(error),
      }, 500);
    }
  });

  return app;
}

/**
 * Generate CSV from audit logs
 */
function generateAuditCSV(logs: any[]): string {
  const headers = [
    'ID',
    'Timestamp',
    'User ID',
    'Action',
    'Resource',
    'Resource ID',
    'IP Address',
    'Success',
    'Details',
  ];

  const rows = logs.map(log => [
    log.id,
    log.createdAt.toISOString(),
    log.userId || '',
    log.action,
    log.resource || '',
    log.details?.resourceId || '',
    log.ipAddress || '',
    !log.action.includes('failed') && !log.action.includes('denied'),
    JSON.stringify(log.details || {}),
  ]);

  // Combine headers and rows
  const allRows = [headers, ...rows];

  // Convert to CSV
  return allRows
    .map(row =>
      row.map(cell => {
        // Escape quotes and wrap in quotes if contains comma
        const str = String(cell);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      }).join(',')
    )
    .join('\n');
}
