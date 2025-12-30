/**
 * Stale Run Cleanup Job
 *
 * Automatically cleans up expired/abandoned suspended workflow runs.
 * Can be run as a cron job or manually via API endpoint.
 */

import type { SuspendedRunsStorage } from './suspended-runs-storage';

/**
 * Cleanup job configuration
 */
export interface CleanupJobConfig {
  /** Storage instance for suspended runs */
  storage: SuspendedRunsStorage;
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
}

/**
 * Cleanup job class
 */
export class CleanupJob {
  private storage: SuspendedRunsStorage;
  private intervalMs: number;
  private logger: typeof console;
  private onCleanup?: (result: CleanupResult) => void;
  private intervalId?: NodeJS.Timeout;

  constructor(config: CleanupJobConfig) {
    this.storage = config.storage;
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
      this.logger.info('Starting cleanup of expired suspended runs...');

      // Clean up expired runs
      const cleaned = await this.storage.cleanupExpiredRuns();

      // Get remaining count
      const remaining = (await this.storage.listSuspendedRuns()).length;

      const duration = Date.now() - startTime;
      const result: CleanupResult = {
        timestamp,
        cleaned,
        remaining,
        duration,
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
