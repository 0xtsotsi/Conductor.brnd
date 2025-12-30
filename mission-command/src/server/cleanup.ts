/**
 * Cleanup Jobs
 *
 * Automatically cleans up expired/abandoned data.
 * Can be run as cron jobs or manually via API endpoints.
 */
 *
 * Automatically cleans up expired/abandoned suspended workflow runs.
 * Can be run as a cron job or manually via API endpoint.
 */

import type { SuspendedRunsStorage } from './suspended-runs-storage';
import type { OAuthStorage } from './oauth-handler';
import type { OAuthStorage } from './oauth-handler';

/**
 * Cleanup job configuration
 */
export interface CleanupJobConfig {
  /** Storage instance for suspended runs */
  storage: SuspendedRunsStorage;
  /** Storage instance for audit logs */
  auditStorage?: OAuthStorage;
  /** Audit log retention period in days (default: 90) */
  auditRetentionDays?: number;
  /** Cleanup interval in milliseconds (default: 1 hour) */
  intervalMs?: number;
  /** Logger function (default: console) */
  logger?: typeof console;
  /** Callback for cleanup results */
  onCleanup?: (result: CleanupResult) => void;
}

/**
 * Cleanup job result
 */
export interface CleanupResult {
  timestamp: Date;
  cleaned: number;
  remaining: number;
  duration: number;
  /** Audit logs cleaned */
  auditLogsCleaned?: number;
  /** Audit logs remaining */
  auditLogsRemaining?: number;
}

/**
 * Cleanup job class
 */
export class CleanupJob {
  private storage: SuspendedRunsStorage;
  private auditStorage?: OAuthStorage;
  private auditRetentionDays: number;
  private intervalMs: number;
  private logger: typeof console;
  private onCleanup?: (result: CleanupResult) => void;
  private intervalId?: NodeJS.Timeout;

  constructor(config: CleanupJobConfig) {
    this.storage = config.storage;
    this.auditStorage = config.auditStorage;
    this.auditRetentionDays = config.auditRetentionDays || 90;
    this.intervalMs = config.intervalMs || 60 * 60 * 1000; // 1 hour default
    this.logger = config.logger || console;
    this.onCleanup = config.onCleanup;
  }

  /**
   * Run the cleanup job once
   */
  async run(): Promise<CleanupResult> {
    const startTime = Date.now();
    const timestamp = new Date();

    try {
      this.logger.info('Starting cleanup of expired suspended runs and audit logs...');

      // Clean up expired runs
      const cleaned = await this.storage.cleanupExpiredRuns();

      // Get remaining count
      const remaining = (await this.storage.listSuspendedRuns()).length;

      // Clean up old audit logs
      let auditLogsCleaned = 0;
      let auditLogsRemaining = 0;

      if (this.auditStorage) {
        try {
          // Calculate cutoff date
          const cutoffDate = new Date();
          cutoffDate.setDate(cutoffDate.getDate() - this.auditRetentionDays);

          this.logger.info(`Cleaning up audit logs older than ${cutoffDate.toISOString()}...`);

          // Note: This requires auditStorage to support cleanupOldAuditLogs
          // For now, we'll log a placeholder
          // const auditLogsCleaned = await this.auditStorage.cleanupOldAuditLogs(cutoffDate);

          this.logger.info(`Audit log cleanup completed (not yet implemented)`);
        } catch (error) {
          this.logger.warn('Audit log cleanup failed:', error);
        }
      }

      const duration = Date.now() - startTime;
      const result: CleanupResult = {
        timestamp,
        cleaned,
        remaining,
        duration,
        auditLogsCleaned,
        auditLogsRemaining,
      };

      this.logger.info('Cleanup completed:', result);

      // Call callback if provided
      if (this.onCleanup) {
        this.onCleanup(result);
      }

      return result;
    } catch (error) {
      this.logger.error('Cleanup failed:', error);
      throw error;
    }
  } catch (error) {
      this.logger.error('Cleanup failed:', error);
      throw error;
    }
  }

  /**
   * Start the cleanup job (runs periodically)
   */
  start(): void {
    if (this.intervalId) {
      this.logger.warn('Cleanup job is already running');
      return;
    }

    this.logger.info(`Starting cleanup job (interval: ${this.intervalMs}ms)`);

    // Run immediately on start
    this.run().catch(error => {
      this.logger.error('Initial cleanup failed:', error);
    });

    // Then run periodically
    this.intervalId = setInterval(async () => {
      try {
        await this.run();
      } catch (error) {
        this.logger.error('Scheduled cleanup failed:', error);
      }
    }, this.intervalMs);
  }

  /**
   * Stop the cleanup job
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
      this.logger.info('Cleanup job stopped');
    }
  }

  /**
   * Check if the cleanup job is running
   */
  isRunning(): boolean {
    return !!this.intervalId;
  }
}

/**
 * Create and start a cleanup job
 */
export function createCleanupJob(config: CleanupJobConfig): CleanupJob {
  const job = new CleanupJob(config);

  // Auto-start unless explicitly disabled
  if (config.intervalMs !== 0) {
    job.start();
  }

  return job;
}

/**
 * Manual cleanup handler for Hono routes
 */
export function createManualCleanupHandler(storage: SuspendedRunsStorage) {
  return async (c: any) => {
    try {
      const cleanup = new CleanupJob({
        storage,
        logger: c.get('logger') || console,
      });

      const result = await cleanup.run();

      return c.json({
        message: 'Cleanup completed',
        result,
      });
    } catch (error) {
      const logger = c.get('logger') || console;
      logger.error('Manual cleanup failed:', error);

      return c.json({
        error: 'Cleanup failed',
        message: error instanceof Error ? error.message : String(error),
      }, 500);
    }
  };
}
