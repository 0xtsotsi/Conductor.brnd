/**
 * Audit Service Tests
 *
 * Tests for the comprehensive audit logging system.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createAuditService,
  AuditService,
  redactPII,
  extractIpAddress,
  extractUserAgent,
} from '../audit-service';
import type { OAuthStorage } from '../../server/oauth-handler';
import type { MissionCommandUser } from '@mastra/auth';

// Mock storage
const mockStorage: OAuthStorage = {
  findUserByProvider: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  logAuditEvent: vi.fn(),
  getAuditLogs: vi.fn(),
  getAllAuditLogs: vi.fn(),
};

describe('AuditService', () => {
  let auditService: AuditService;

  beforeEach(() => {
    vi.clearAllMocks();
    auditService = createAuditService({
      storage: mockStorage,
      retentionDays: 90,
    });
  });

  describe('logAuthEvent', () => {
    it('should log authentication events', async () => {
      const mockLogEntry = {
        id: '123',
        userId: 'user-123',
        action: 'user.login',
        resource: 'auth',
        details: {},
        ipAddress: '127.0.0.1',
        createdAt: new Date(),
      };

      vi.mocked(mockStorage.logAuditEvent).mockResolvedValue(mockLogEntry);

      const result = await auditService.logAuthEvent({
        userId: 'user-123',
        action: 'user.login',
        resource: 'auth',
        ipAddress: '127.0.0.1',
        success: true,
      });

      expect(result).toEqual(mockLogEntry);
      expect(mockStorage.logAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          action: 'user.login',
          resource: 'auth',
          ipAddress: '127.0.0.1',
        })
      );
    });

    it('should sanitize details to prevent log injection', async () => {
      const maliciousDetails = {
        message: 'Test\nInjected\rLine\tBreak',
        data: '\x00Control\x1FCharacters',
      };

      const mockLogEntry = {
        id: '123',
        userId: 'user-123',
        action: 'user.login',
        resource: 'auth',
        details: {},
        ipAddress: '127.0.0.1',
        createdAt: new Date(),
      };

      vi.mocked(mockStorage.logAuditEvent).mockResolvedValue(mockLogEntry);

      await auditService.logAuthEvent({
        userId: 'user-123',
        action: 'user.login',
        details: maliciousDetails,
        ipAddress: '127.0.0.1',
        success: true,
      });

      const callArgs = vi.mocked(mockStorage.logAuditEvent).mock.calls[0][0];

      // Check that newlines and control characters are removed
      expect(callArgs.details?.message).not.toContain('\n');
      expect(callArgs.details?.message).not.toContain('\r');
      expect(callArgs.details?.message).not.toContain('\t');
    });
  });

  describe('logAuthorizationEvent', () => {
    it('should log successful authorization', async () => {
      const user: MissionCommandUser = {
        sub: 'user-123',
        email: 'test@example.com',
        role: 'admin',
        provider: 'github',
      };

      const mockLogEntry = {
        id: '123',
        userId: 'user-123',
        action: 'auth.permission.check',
        resource: 'workflow',
        details: {
          permission: 'workflows:create',
          userEmail: 'test@example.com',
          userRole: 'admin',
        },
        ipAddress: '127.0.0.1',
        createdAt: new Date(),
      };

      vi.mocked(mockStorage.logAuditEvent).mockResolvedValue(mockLogEntry);

      const result = await auditService.logAuthorizationEvent({
        user,
        permission: 'workflows:create',
        resource: 'workflow',
        granted: true,
        ipAddress: '127.0.0.1',
      });

      expect(result).toEqual(mockLogEntry);
      expect(mockStorage.logAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'auth.permission.check',
          details: expect.objectContaining({
            permission: 'workflows:create',
            userEmail: 'test@example.com',
            userRole: 'admin',
          }),
        })
      );
    });

    it('should log failed authorization', async () => {
      const user: MissionCommandUser = {
        sub: 'user-123',
        email: 'test@example.com',
        role: 'viewer',
        provider: 'github',
      };

      const mockLogEntry = {
        id: '123',
        userId: 'user-123',
        action: 'auth.permission.denied',
        details: {
          permission: 'workflows:delete',
          userEmail: 'test@example.com',
          userRole: 'viewer',
        },
        ipAddress: '127.0.0.1',
        createdAt: new Date(),
      };

      vi.mocked(mockStorage.logAuditEvent).mockResolvedValue(mockLogEntry);

      const result = await auditService.logAuthorizationEvent({
        user,
        permission: 'workflows:delete',
        resource: 'workflow',
        granted: false,
        ipAddress: '127.0.0.1',
      });

      expect(result).toEqual(mockLogEntry);
      expect(mockStorage.logAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'auth.permission.denied',
          success: false,
          errorMessage: 'Permission denied: workflows:delete',
        })
      );
    });
  });

  describe('logUserManagementEvent', () => {
    it('should log role changes', async () => {
      const user: MissionCommandUser = {
        sub: 'admin-123',
        email: 'admin@example.com',
        role: 'admin',
        provider: 'github',
      };

      const mockLogEntry = {
        id: '123',
        userId: 'admin-123',
        action: 'user.role.changed',
        resource: 'user',
        resourceId: 'user-456',
        details: {
          actorEmail: 'admin@example.com',
          actorRole: 'admin',
          targetUserEmail: 'user@example.com',
          oldRole: 'viewer',
          newRole: 'operator',
        },
        ipAddress: '127.0.0.1',
        createdAt: new Date(),
      };

      vi.mocked(mockStorage.logAuditEvent).mockResolvedValue(mockLogEntry);

      const result = await auditService.logUserManagementEvent({
        user,
        action: 'user.role.changed',
        targetUserId: 'user-456',
        targetUserEmail: 'user@example.com',
        oldRole: 'viewer',
        newRole: 'operator',
        ipAddress: '127.0.0.1',
      });

      expect(result).toEqual(mockLogEntry);
      expect(mockStorage.logAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'user.role.changed',
          resource: 'user',
          resourceId: 'user-456',
          details: expect.objectContaining({
            actorEmail: 'admin@example.com',
            targetUserEmail: 'user@example.com',
            oldRole: 'viewer',
            newRole: 'operator',
          }),
        })
      );
    });
  });

  describe('logWorkflowEvent', () => {
    it('should log workflow approval', async () => {
      const user: MissionCommandUser = {
        sub: 'user-123',
        email: 'approver@example.com',
        role: 'operator',
        provider: 'github',
      };

      const mockLogEntry = {
        id: '123',
        userId: 'user-123',
        action: 'workflow.approved',
        resource: 'workflow',
        resourceId: 'workflow-abc',
        details: {
          runId: 'run-xyz',
          userEmail: 'approver@example.com',
          userRole: 'operator',
        },
        ipAddress: '127.0.0.1',
        createdAt: new Date(),
      };

      vi.mocked(mockStorage.logAuditEvent).mockResolvedValue(mockLogEntry);

      const result = await auditService.logWorkflowEvent({
        user,
        action: 'workflow.approved',
        workflowId: 'workflow-abc',
        runId: 'run-xyz',
        ipAddress: '127.0.0.1',
      });

      expect(result).toEqual(mockLogEntry);
      expect(mockStorage.logAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'workflow.approved',
          resource: 'workflow',
          resourceId: 'workflow-abc',
          success: true,
        })
      );
    });

    it('should log workflow failure', async () => {
      const mockLogEntry = {
        id: '123',
        action: 'workflow.failed',
        resource: 'workflow',
        resourceId: 'workflow-abc',
        details: {
          runId: 'run-xyz',
          reason: 'Invalid input data',
        },
        ipAddress: '127.0.0.1',
        createdAt: new Date(),
      };

      vi.mocked(mockStorage.logAuditEvent).mockResolvedValue(mockLogEntry);

      const result = await auditService.logWorkflowEvent({
        action: 'workflow.failed',
        workflowId: 'workflow-abc',
        runId: 'run-xyz',
        reason: 'Invalid input data',
        ipAddress: '127.0.0.1',
      });

      expect(result).toEqual(mockLogEntry);
      expect(mockStorage.logAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'workflow.failed',
          success: false,
          errorMessage: 'Invalid input data',
        })
      );
    });
  });

  describe('getAuditLog', () => {
    it('should return filtered audit logs', async () => {
      const mockLogs = [
        {
          id: '1',
          userId: 'user-123',
          action: 'user.login',
          resource: 'auth',
          details: {},
          createdAt: new Date('2025-01-01T10:00:00Z'),
        },
        {
          id: '2',
          userId: 'user-123',
          action: 'user.logout',
          resource: 'auth',
          details: {},
          createdAt: new Date('2025-01-01T11:00:00Z'),
        },
      ];

      vi.mocked(mockStorage.getAuditLogs).mockResolvedValue(mockLogs);

      const result = await auditService.getAuditLog(
        {
          userId: 'user-123',
          action: 'user.login',
        },
        0,
        50
      );

      expect(result.logs).toHaveLength(1);
      expect(result.logs[0].action).toBe('user.login');
      expect(result.total).toBe(1);
    });

    it('should support date range filtering', async () => {
      const mockLogs = [
        {
          id: '1',
          userId: 'user-123',
          action: 'user.login',
          resource: 'auth',
          details: {},
          createdAt: new Date('2025-01-01T10:00:00Z'),
        },
        {
          id: '2',
          userId: 'user-123',
          action: 'user.login',
          resource: 'auth',
          details: {},
          createdAt: new Date('2025-01-15T10:00:00Z'),
        },
      ];

      vi.mocked(mockStorage.getAuditLogs).mockResolvedValue(mockLogs);

      const result = await auditService.getAuditLog(
        {
          userId: 'user-123',
          startDate: new Date('2025-01-01T00:00:00Z'),
          endDate: new Date('2025-01-10T00:00:00Z'),
        },
        0,
        50
      );

      expect(result.logs).toHaveLength(1);
      expect(result.logs[0].id).toBe('1');
    });
  });

  describe('getAuditLogForUser', () => {
    it('should return audit trail for specific user', async () => {
      const mockLogs = [
        {
          id: '1',
          userId: 'user-123',
          action: 'user.login',
          resource: 'auth',
          details: {},
          ipAddress: '127.0.0.1',
          createdAt: new Date('2025-01-01T10:00:00Z'),
        },
        {
          id: '2',
          userId: 'user-123',
          action: 'workflow.approved',
          resource: 'workflow',
          details: {},
          ipAddress: '127.0.0.1',
          createdAt: new Date('2025-01-01T11:00:00Z'),
        },
      ];

      vi.mocked(mockStorage.getAuditLogs).mockResolvedValue(mockLogs);

      const result = await auditService.getAuditLogForUser('user-123', 100, 0);

      expect(result).toHaveLength(2);
      expect(result[0].userId).toBe('user-123');
      expect(result[1].userId).toBe('user-123');
      expect(mockStorage.getAuditLogs).toHaveBeenCalledWith('user-123', 100, 0);
    });
  });

  describe('getRetentionCutoff', () => {
    it('should calculate retention cutoff date', () => {
      const service = createAuditService({
        storage: mockStorage,
        retentionDays: 90,
      });

      const cutoff = service.getRetentionCutoff();
      const expected = new Date();
      expected.setDate(expected.getDate() - 90);

      // Allow 1 second tolerance for test execution time
      expect(Math.abs(cutoff.getTime() - expected.getTime())).toBeLessThan(1000);
    });

    it('should use default 90 day retention', () => {
      const service = createAuditService({
        storage: mockStorage,
      });

      expect(service.getRetentionDays()).toBe(90);
    });

    it('should use custom retention period', () => {
      const service = createAuditService({
        storage: mockStorage,
        retentionDays: 30,
      });

      expect(service.getRetentionDays()).toBe(30);
    });
  });
});

describe('Helper Functions', () => {
  describe('redactPII', () => {
    it('should redact email addresses', () => {
      const details = {
        userEmail: 'john.doe@example.com',
        other: 'data',
      };

      const redacted = redactPII(details);

      expect(redacted.userEmail).toBe('j***@example.com');
      expect(redacted.other).toBe('data');
    });

    it('should redact passwords', () => {
      const details = {
        password: 'supersecret123',
        other: 'data',
      };

      const redacted = redactPII(details);

      expect(redacted.password).toBe('***REDACTED***');
      expect(redacted.other).toBe('data');
    });

    it('should redact tokens', () => {
      const details = {
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        other: 'data',
      };

      const redacted = redactPII(details);

      expect(redacted.token).toBe('***REDACTED***');
    });
  });

  describe('extractIpAddress', () => {
    it('should extract IP from x-forwarded-for header', () => {
      const c = {
        req: {
          header: vi.fn((key: string) => {
            if (key === 'x-forwarded-for') return '192.168.1.1, 10.0.0.1';
            return undefined;
          }),
        },
      };

      const ip = extractIpAddress(c);
      expect(ip).toBe('192.168.1.1');
    });

    it('should extract IP from x-real-ip header', () => {
      const c = {
        req: {
          header: vi.fn((key: string) => {
            if (key === 'x-real-ip') return '192.168.1.1';
            return undefined;
          }),
        },
      };

      const ip = extractIpAddress(c);
      expect(ip).toBe('192.168.1.1');
    });

    it('should return undefined if no IP found', () => {
      const c = {
        req: {
          header: vi.fn(() => undefined),
        },
      };

      const ip = extractIpAddress(c);
      expect(ip).toBeUndefined();
    });
  });

  describe('extractUserAgent', () => {
    it('should extract user agent from header', () => {
      const c = {
        req: {
          header: vi.fn((key: string) => {
            if (key === 'user-agent') return 'Mozilla/5.0 ...';
            return undefined;
          }),
        },
      };

      const userAgent = extractUserAgent(c);
      expect(userAgent).toBe('Mozilla/5.0 ...');
    });

    it('should return undefined if no user agent found', () => {
      const c = {
        req: {
          header: vi.fn(() => undefined),
        },
      };

      const userAgent = extractUserAgent(c);
      expect(userAgent).toBeUndefined();
    });
  });
});
