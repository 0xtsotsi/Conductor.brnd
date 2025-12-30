/**
 * Mission Command Audit Service
 *
 * Comprehensive audit logging for all authentication, authorization,
 * and user management events for security compliance.
 *
 * Features:
 * - Event logging for all auth/authz events
 * - Queryable audit log with filters
 * - User-specific audit trails
 * - Write-once semantics (immutable)
 * - Performance optimized (< 10ms per request)
 */

import type { OAuthStorage } from '../server/oauth-handler';
import type { MissionCommandUser } from '@mastra/auth';

/**
 * Audit event types
 */
export type AuditEventType =
  // Authentication events
  | 'user.login'
  | 'user.login.failed'
  | 'user.logout'
  | 'user.session.created'
  | 'user.session.invalidated'
  | 'user.session.refresh'
  | 'user.password.changed'
  | 'user.mfa.enabled'
  | 'user.mfa.disabled'
  // Authorization events
  | 'auth.permission.check'
  | 'auth.permission.denied'
  | 'auth.resource.access'
  | 'auth.resource.denied'
  | 'auth.action.admin'
  // User management events
  | 'user.created'
  | 'user.updated'
  | 'user.deleted'
  | 'user.role.changed'
  | 'user.sessions.revoked'
  // Workflow events
  | 'workflow.approved'
  | 'workflow.declined'
  | 'workflow.started'
  | 'workflow.failed'
  | 'workflow.resumed';

/**
 * Base audit event
 */
export interface AuditEvent {
  /** User ID (optional for system events) */
  userId?: string;
  /** Action type */
  action: AuditEventType;
  /** Resource type (user, workflow, etc.) */
  resource?: string;
  /** Resource identifier */
  resourceId?: string;
  /** Additional context */
  details?: Record<string, any>;
  /** IP address of requestor */
  ipAddress?: string;
  /** User agent of requestor */
  userAgent?: string;
  /** Whether the operation succeeded */
  success: boolean;
  /** Error message (if failed) */
  errorMessage?: string;
}

/**
 * Full audit log entry (as stored in database)
 */
export interface AuditLogEntry extends AuditEvent {
  /** Log entry ID */
  id: string;
  /** Timestamp when event occurred */
  createdAt: Date;
}

/**
 * Query filters for audit log
 */
export interface AuditLogFilters {
  /** Filter by user ID */
  userId?: string;
  /** Filter by action type */
  action?: AuditEventType | AuditEventType[];
  /** Filter by resource type */
  resource?: string;
  /** Filter by resource ID */
  resourceId?: string;
  /** Filter by success status */
  success?: boolean;
  /** Filter by start date */
  startDate?: Date;
  /** Filter by end date */
  endDate?: Date;
  /** Search in details */
  search?: string;
}

/**
 * Paginated audit log result
 */
export interface AuditLogResult {
  /** Audit log entries */
  logs: AuditLogEntry[];
  /** Total count matching filters */
  total: number;
  /** Current page number */
  page: number;
  /** Page size */
  pageSize: number;
}

/**
 * Audit service configuration
 */
export interface AuditServiceConfig {
  /** Storage adapter */
  storage: OAuthStorage;
  /** Default retention period in days (default: 90) */
  retentionDays?: number;
  /** Logger function (default: console) */
  logger?: typeof console;
}

/**
 * Audit service class
 */
export class AuditService {
  private storage: OAuthStorage;
  private retentionDays: number;
  private logger: typeof console;

  constructor(config: AuditServiceConfig) {
    this.storage = config.storage;
    this.retentionDays = config.retentionDays || 90;
    this.logger = config.logger || console;
  }

  /**
   * Log an authentication event
   */
  async logAuthEvent(event: Omit<AuditEvent, 'action'> & { action: AuditEventType }): Promise<AuditLogEntry> {
    const logEvent: AuditEvent = {
      ...event,
      action: event.action,
    };

    return this.logEvent(logEvent);
  }

  /**
   * Log an authorization check event
   */
  async logAuthorizationEvent(event: {
    user: MissionCommandUser;
    permission: string;
    resource?: string;
    resourceId?: string;
    granted: boolean;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<AuditLogEntry> {
    const logEvent: AuditEvent = {
      userId: event.user.sub,
      action: event.granted ? 'auth.permission.check' : 'auth.permission.denied',
      details: {
        permission: event.permission,
        userEmail: event.user.email,
        userRole: event.user.role,
      },
      resource: event.resource,
      resourceId: event.resourceId,
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
      success: event.granted,
      errorMessage: event.granted ? undefined : `Permission denied: ${event.permission}`,
    };

    return this.logEvent(logEvent);
  }

  /**
   * Log a user management event
   */
  async logUserManagementEvent(event: {
    user: MissionCommandUser;
    action: 'user.created' | 'user.updated' | 'user.deleted' | 'user.role.changed' | 'user.sessions.revoked';
    targetUserId?: string;
    targetUserEmail?: string;
    oldRole?: string;
    newRole?: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<AuditLogEntry> {
    const logEvent: AuditEvent = {
      userId: event.user.sub,
      action: event.action,
      resource: 'user',
      resourceId: event.targetUserId,
      details: {
        actorEmail: event.user.email,
        actorRole: event.user.role,
        targetUserEmail: event.targetUserEmail,
        oldRole: event.oldRole,
        newRole: event.newRole,
      },
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
      success: true,
    };

    return this.logEvent(logEvent);
  }

  /**
   * Log a workflow event
   */
  async logWorkflowEvent(event: {
    user?: MissionCommandUser;
    action: 'workflow.approved' | 'workflow.declined' | 'workflow.started' | 'workflow.failed' | 'workflow.resumed';
    workflowId: string;
    runId?: string;
    reason?: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<AuditLogEntry> {
    const logEvent: AuditEvent = {
      userId: event.user?.sub,
      action: event.action,
      resource: 'workflow',
      resourceId: event.workflowId,
      details: {
        runId: event.runId,
        reason: event.reason,
        userEmail: event.user?.email,
        userRole: event.user?.role,
      },
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
      success: event.action !== 'workflow.declined' && event.action !== 'workflow.failed',
      errorMessage: event.action === 'workflow.failed' ? event.reason : undefined,
    };

    return this.logEvent(logEvent);
  }

  /**
   * Generic event logger
   */
  async logEvent(event: AuditEvent): Promise<AuditLogEntry> {
    const startTime = Date.now();

    try {
      // Sanitize event details to prevent log injection
      const sanitizedDetails = event.details ? this.sanitizeDetails(event.details) : undefined;

      // Create log entry
      const logEntry = await this.storage.logAuditEvent?.({
        userId: event.userId,
        action: event.action,
        resource: event.resource,
        resourceId: event.resourceId,
        details: sanitizedDetails,
        ipAddress: event.ipAddress,
        success: event.success,
        errorMessage: event.errorMessage,
        createdAt: new Date(),
      });

      const duration = Date.now() - startTime;
      if (duration > 10) {
        this.logger.warn(`Audit logging took ${duration}ms (exceeds 10ms target)`, {
          action: event.action,
          duration,
        });
      }

      return logEntry!;
    } catch (error) {
      this.logger.error('Failed to log audit event:', error);
      throw error;
    }
  }

  /**
   * Query audit log with filters
   */
  async getAuditLog(
    filters: AuditLogFilters = {},
    page: number = 0,
    pageSize: number = 50
  ): Promise<AuditLogResult> {
    try {
      // Note: This is a simplified implementation
      // The storage layer will need to support complex filtering
      // For now, we use the basic getAuditLogs method

      const logs = await this.storage.getAuditLogs?.(
        filters.userId || '',
        pageSize,
        page * pageSize
      ) || [];

      // Filter client-side (will be improved with proper storage query support)
      let filtered = logs;

      if (filters.action) {
        const actions = Array.isArray(filters.action) ? filters.action : [filters.action];
        filtered = filtered.filter(log => actions.includes(log.action as AuditEventType));
      }

      if (filters.resource) {
        filtered = filtered.filter(log => log.resource === filters.resource);
      }

      if (filters.resourceId) {
        filtered = filtered.filter(log => log.details?.resourceId === filters.resourceId);
      }

      if (filters.success !== undefined) {
        filtered = filtered.filter(log => {
          // Determine success from action or details
          if (log.action.includes('failed') || log.action.includes('denied')) {
            return !filters.success;
          }
          return filters.success;
        });
      }

      if (filters.startDate) {
        filtered = filtered.filter(log => log.createdAt >= filters.startDate!);
      }

      if (filters.endDate) {
        filtered = filtered.filter(log => log.createdAt <= filters.endDate!);
      }

      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        filtered = filtered.filter(log =>
          log.action.toLowerCase().includes(searchLower) ||
          log.resource?.toLowerCase().includes(searchLower) ||
          JSON.stringify(log.details).toLowerCase().includes(searchLower)
        );
      }

      return {
        logs: filtered,
        total: filtered.length,
        page,
        pageSize,
      };
    } catch (error) {
      this.logger.error('Failed to query audit log:', error);
      throw error;
    }
  }

  /**
   * Get audit trail for a specific user
   */
  async getAuditLogForUser(
    userId: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<AuditLogEntry[]> {
    try {
      const logs = await this.storage.getAuditLogs?.(userId, limit, offset) || [];
      return logs;
    } catch (error) {
      this.logger.error(`Failed to get audit log for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get a specific audit log entry by ID
   */
  async getAuditLogById(logId: string): Promise<AuditLogEntry | null> {
    try {
      const log = await this.storage.getAuditLogById?.(logId);
      return log || null;
    } catch (error) {
      this.logger.error(`Failed to get audit log ${logId}:`, error);
      throw error;
    }
  }

  /**
   * Get retention period in days
   */
  getRetentionDays(): number {
    return this.retentionDays;
  }

  /**
   * Calculate cutoff date for retention
   */
  getRetentionCutoff(): Date {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - this.retentionDays);
    return cutoff;
  }

  /**
   * Sanitize event details to prevent log injection attacks
   *
   * Log injection attacks can occur when untrusted input is logged directly,
   * potentially allowing attackers to:
   * - Inject fake log entries via newline characters
   * - Execute code via terminal escape sequences
   * - Corrupt log file parsing
   *
   * This function removes:
   * - Newline characters (which could create fake log entries)
   * - Control characters (which could execute commands)
   * - Terminal escape sequences (ANSI codes)
   * - Other potentially dangerous characters
   */
  private sanitizeDetails(details: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};

    for (const [key, value] of Object.entries(details)) {
      if (value === null || value === undefined) {
        continue;
      }

      // Handle nested objects recursively
      if (typeof value === 'object' && !Array.isArray(value)) {
        sanitized[key] = this.sanitizeDetails(value);
        continue;
      }

      // Handle arrays
      if (Array.isArray(value)) {
        sanitized[key] = value.map(item =>
          typeof item === 'object' && item !== null
            ? this.sanitizeDetails(item)
            : this.sanitizeValue(String(item))
        );
        continue;
      }

      // Sanitize string values
      const strValue = String(value);
      sanitized[key] = this.sanitizeValue(strValue);
    }

    return sanitized;
  }

  /**
   * Sanitize a single string value to prevent log injection
   */
  private sanitizeValue(strValue: string): string {
    return strValue
      // Remove newline and carriage return (log injection)
      .replace(/[\n\r]/g, ' ')
      // Remove tab characters
      .replace(/\t/g, ' ')
      // Remove ANSI escape sequences (terminal command injection)
      .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
      // Remove other control characters (0x00-0x1F)
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      // Remove potentially dangerous Unicode characters
      .replace(/[\u2028-\u2029\uFFFE\uFFFF]/g, '')
      // Sanitize against CRLF injection in headers
      .replace(/%0D%0A/gi, '')
      .replace(/%0A/gi, '')
      .replace(/%0D/gi, '');
  }
}

/**
 * Create an audit service instance
 */
export function createAuditService(config: AuditServiceConfig): AuditService {
  return new AuditService(config);
}

/**
 * Helper: Extract IP address from request
 */
export function extractIpAddress(c: any): string | undefined {
  // Check various headers for IP address
  const headers = c.req?.header();
  if (!headers) return undefined;

  return (
    headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    headers['x-real-ip'] ||
    headers['cf-connecting-ip'] ||
    c.req?.remoteAddress
  );
}

/**
 * Helper: Extract user agent from request
 */
export function extractUserAgent(c: any): string | undefined {
  const headers = c.req?.header();
  return headers?.['user-agent'];
}

/**
 * Helper: Redact PII from audit details
 */
export function redactPII(details: Record<string, any>): Record<string, any> {
  const redacted: Record<string, any> = { ...details };

  // Redact email addresses (keep domain)
  if (redacted.userEmail) {
    const [local, domain] = redacted.userEmail.split('@');
    redacted.userEmail = `${local[0]}***@${domain}`;
  }

  // Redact other PII fields
  if (redacted.password) redacted.password = '***REDACTED***';
  if (redacted.token) redacted.token = '***REDACTED***';
  if (redacted.secret) redacted.secret = '***REDACTED***';

  return redacted;
}
