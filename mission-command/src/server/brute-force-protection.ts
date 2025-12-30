/**
 * Brute Force Protection Middleware
 *
 * Protects authentication endpoints against brute force attacks by tracking
 * failed login attempts and implementing exponential backoff and temporary lockouts.
 *
 * Features:
 * - Per-IP and per-account attempt tracking
 * - Exponential backoff for repeated failures
 * - Temporary account lockouts
 * - Permanent bans after repeated violations
 * - Automatic cleanup of expired records
 * - Audit logging for security events
 *
 * @see https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html
 */

import type { Context, Next } from 'hono';

/**
 * Failed login attempt record
 */
interface FailedAttempt {
  count: number;
  lastAttempt: Date;
  lockUntil?: Date;
  isPermanentlyBanned: boolean;
}

/**
 * Storage for failed attempts
 * In production, use Redis or a database for distributed systems
 */
const failedAttempts = new Map<string, FailedAttempt>();

/**
 * Brute force protection configuration
 */
export interface BruteForceConfig {
  /** Maximum failed attempts before temporary lockout */
  maxAttempts?: number;
  /** Initial lockout duration in milliseconds */
  initialLockoutDuration?: number;
  /** Lockout duration multiplier per offense (exponential backoff) */
  lockoutMultiplier?: number;
  /** Maximum lockout duration (caps exponential backoff) */
  maxLockoutDuration?: number;
  /** Number of lockout cycles before permanent ban */
  maxLockoutCycles?: number;
  /** How long to keep attempt records in milliseconds */
  attemptExpiration?: number;
}

const DEFAULT_CONFIG: Required<BruteForceConfig> = {
  maxAttempts: 5,
  initialLockoutDuration: 15 * 60 * 1000, // 15 minutes
  lockoutMultiplier: 2,
  maxLockoutDuration: 24 * 60 * 60 * 1000, // 24 hours
  maxLockoutCycles: 3,
  attemptExpiration: 7 * 24 * 60 * 60 * 1000, // 7 days
};

/**
 * Extract IP address from request headers
 *
 * Handles proxies, CDNs, and load balancers
 */
function extractIp(c: Context): string {
  return (
    c.req.header('x-forwarded-for')?.split(',')[0].trim() ||
    c.req.header('cf-connecting-ip') ||
    c.req.header('x-real-ip') ||
    c.req.header('x-client-ip') ||
    'unknown'
  );
}

/**
 * Extract account identifier from request
 *
 * For login endpoints, this would be the email/username
 */
function extractAccount(c: Context): string | null {
  try {
    // Try to get email from request body
    const body = c.req.raw.body;
    if (body) {
      // For JSON requests
      if (c.req.header('content-type')?.includes('application/json')) {
        return JSON.parse(body as any)?.email || null;
      }
    }
  } catch {
    // Ignore parsing errors
  }
  return null;
}

/**
 * Calculate lockout duration with exponential backoff
 *
 * Duration increases with each offense: 15min → 30min → 1hr → 2hr → 4hr → 24hr (max)
 */
function calculateLockoutDuration(
  offenseCount: number,
  config: Required<BruteForceConfig>
): number {
  const duration = config.initialLockoutDuration * Math.pow(config.lockoutMultiplier, offenseCount);
  return Math.min(duration, config.maxLockoutDuration);
}

/**
 * Check if account/IP is currently locked out
 */
function isLockedOut(record: FailedAttempt, now: Date): boolean {
  if (record.isPermanentlyBanned) {
    return true;
  }

  if (record.lockUntil) {
    return now < record.lockUntil;
  }

  return false;
}

/**
 * Get time remaining in lockout (human-readable)
 */
function getLockoutRemaining(record: FailedAttempt, now: Date): string {
  if (record.isPermanentlyBanned) {
    return 'Permanently banned';
  }

  if (!record.lockUntil || record.lockUntil <= now) {
    return '';
  }

  const minutes = Math.ceil((record.lockUntil.getTime() - now.getTime()) / (1000 * 60));

  if (minutes < 60) {
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours < 24) {
    return `${hours} hour${hours !== 1 ? 's' : ''}` +
           (remainingMinutes > 0 ? ` ${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}` : '');
  }

  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;

  return `${days} day${days !== 1 ? 's' : ''}` +
         (remainingHours > 0 ? ` ${remainingHours} hour${remainingHours !== 1 ? 's' : ''}` : '');
}

/**
 * Log security event for audit purposes
 *
 * In production, send to dedicated security logging system
 */
function logSecurityEvent(
  type: 'failed_attempt' | 'lockout' | 'permanent_ban' | 'successful_login',
  details: {
    ip: string;
    account?: string;
    attemptCount?: number;
    lockoutDuration?: string;
    timestamp: Date;
  }
): void {
  // In production, send to security monitoring system
  const event = {
    type,
    severity: type === 'permanent_ban' ? 'critical' : type === 'lockout' ? 'high' : 'medium',
    ...details,
  };

  console.warn('[Security Event]', JSON.stringify(event));
}

/**
 * Brute force protection middleware
 *
 * Tracks failed login attempts per IP and per account (email).
 * Implements exponential backoff and temporary lockouts.
 * Permanently bans accounts/IPs after 3 lockout cycles.
 *
 * @example
 * ```typescript
 * app.post('/api/auth/login', bruteForceProtection(), loginHandler);
 * ```
 */
export function bruteForceProtection(config?: BruteForceConfig) {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  return async (c: Context, next: Next) => {
    const ip = extractIp(c);
    const account = extractAccount(c);
    const now = new Date();

    // Create keys for IP and account tracking
    const ipKey = `ip:${ip}`;
    const accountKey = account ? `account:${account}` : null;

    // Get or create records
    let ipRecord = failedAttempts.get(ipKey);
    let accountRecord = accountKey ? failedAttempts.get(accountKey) : null;

    // Check if locked out
    const ipLocked = ipRecord && isLockedOut(ipRecord, now);
    const accountLocked = accountRecord && isLockedOut(accountRecord, now);

    if (ipLocked || accountLocked) {
      const lockedRecord = ipLocked && ipRecord ? ipRecord : accountRecord!;
      const remaining = getLockoutRemaining(lockedRecord, now);

      return c.json(
        {
          error: 'Too many failed attempts',
          message: `Account temporarily locked due to repeated failed login attempts. Please try again later.`,
          lockedUntil: lockedRecord.lockUntil?.toISOString(),
          isPermanentlyBanned: lockedRecord.isPermanentlyBanned,
          retryAfter: remaining,
        },
        429
      );
    }

    // Store original json method to intercept responses
    const originalJson = c.json.bind(c);

    // Override json method to detect failed logins
    c.json = (data: any, status: number = 200, headers?: any) => {
      // Detect failed login (status 401 or error in response)
      const isFailedLogin = status === 401 ||
                           (data as any)?.error === 'Invalid credentials' ||
                           (data as any)?.error === 'Authentication failed';

      if (isFailedLogin) {
        // Increment failed attempt counters
        if (!ipRecord) {
          ipRecord = {
            count: 0,
            lastAttempt: now,
            isPermanentlyBanned: false,
          };
          failedAttempts.set(ipKey, ipRecord);
        }

        ipRecord.count++;
        ipRecord.lastAttempt = now;

        if (accountKey) {
          if (!accountRecord) {
            accountRecord = {
              count: 0,
              lastAttempt: now,
              isPermanentlyBanned: false,
            };
            failedAttempts.set(accountKey, accountRecord);
          }

          accountRecord.count++;
          accountRecord.lastAttempt = now;
        }

        // Check if threshold exceeded
        const offenseCount = Math.floor(ipRecord.count / cfg.maxAttempts);
        if (ipRecord.count >= cfg.maxAttempts) {
          // Calculate lockout duration with exponential backoff
          const lockoutDuration = calculateLockoutDuration(offenseCount - 1, cfg);

          ipRecord.lockUntil = new Date(now.getTime() + lockoutDuration);

          if (accountRecord) {
            accountRecord.lockUntil = ipRecord.lockUntil;
          }

          // Check if should permanently ban
          if (offenseCount >= cfg.maxLockoutCycles) {
            ipRecord.isPermanentlyBanned = true;
            if (accountRecord) {
              accountRecord.isPermanentlyBanned = true;
            }

            logSecurityEvent('permanent_ban', {
              ip,
              account: account || undefined,
              attemptCount: ipRecord.count,
              timestamp: now,
            });
          } else {
            logSecurityEvent('lockout', {
              ip,
              account: account || undefined,
              attemptCount: ipRecord.count,
              lockoutDuration: getLockoutRemaining(ipRecord, now),
              timestamp: now,
            });
          }
        } else {
          logSecurityEvent('failed_attempt', {
            ip,
            account: account || undefined,
            attemptCount: ipRecord.count,
            timestamp: now,
          });
        }
      } else if (status === 200 || status === 204) {
        // Successful login - clear failed attempts for this account
        if (accountKey) {
          failedAttempts.delete(accountKey);
        }

        logSecurityEvent('successful_login', {
          ip,
          account: account || undefined,
          timestamp: now,
        });
      }

      return originalJson(data, status, headers);
    };

    await next();
  };
}

/**
 * Cleanup expired failed attempt records
 *
 * Should be run periodically to prevent memory leaks
 *
 * @example
 * ```typescript
 * const cleanupInterval = startBruteForceCleanup(60 * 60 * 1000); // Every hour
 * ```
 */
export function cleanupExpiredAttempts(config?: BruteForceConfig): void {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const now = new Date();
  const cutoff = new Date(now.getTime() - cfg.attemptExpiration);

  let cleaned = 0;

  for (const [key, record] of failedAttempts.entries()) {
    // Remove old records that aren't permanently banned
    if (!record.isPermanentlyBanned && record.lastAttempt < cutoff) {
      failedAttempts.delete(key);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.info(`[BruteForce] Cleaned up ${cleaned} expired records`);
  }
}

/**
 * Start periodic cleanup of expired attempts
 *
 * @param intervalMs - Cleanup interval in milliseconds (default: 1 hour)
 * @returns Interval timer ID (pass to clearInterval to stop)
 */
export function startBruteForceCleanup(
  intervalMs: number = 60 * 60 * 1000
): NodeJS.Timeout {
  return setInterval(cleanupExpiredAttempts, intervalMs);
}

/**
 * Get current brute force protection statistics
 *
 * Useful for monitoring and dashboards
 *
 * @example
 * ```typescript
 * app.get('/api/admin/security/stats', requireRole('admin'), (c) => {
 *   return c.json(getBruteForceStats());
 * });
 * ```
 */
export function getBruteForceStats(): {
  totalRecords: number;
  permanentlyBanned: number;
  currentlyLocked: number;
  ipRecords: number;
  accountRecords: number;
} {
  const now = new Date();
  let permanentlyBanned = 0;
  let currentlyLocked = 0;
  let ipRecords = 0;
  let accountRecords = 0;

  for (const [key, record] of failedAttempts.entries()) {
    if (record.isPermanentlyBanned) {
      permanentlyBanned++;
    } else if (isLockedOut(record, now)) {
      currentlyLocked++;
    }

    if (key.startsWith('ip:')) {
      ipRecords++;
    } else if (key.startsWith('account:')) {
      accountRecords++;
    }
  }

  return {
    totalRecords: failedAttempts.size,
    permanentlyBanned,
    currentlyLocked,
    ipRecords,
    accountRecords,
  };
}

/**
 * Manually unban an IP or account
 *
 * Use with caution - only for legitimate users who were incorrectly banned
 *
 * @param identifier - IP address or email to unban
 * @example
 * ```typescript
 * unbanAccount('user@example.com');
 * unbanAccount('192.168.1.1');
 * ```
 */
export function unbanAccount(identifier: string): void {
  const ipKey = `ip:${identifier}`;
  const accountKey = `account:${identifier}`;

  if (failedAttempts.has(ipKey)) {
    failedAttempts.delete(ipKey);
    console.info(`[BruteForce] Unbanned IP: ${identifier}`);
  }

  if (failedAttempts.has(accountKey)) {
    failedAttempts.delete(accountKey);
    console.info(`[BruteForce] Unbanned account: ${identifier}`);
  }
}
