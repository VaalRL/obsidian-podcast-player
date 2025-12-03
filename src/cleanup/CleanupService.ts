/**
 * CleanupService - Manages automatic cleanup of completed episodes
 *
 * Provides automatic cleanup of:
 * - Completed episode progress records (after retention period)
 * - Expired cache entries
 * - Old episode data
 */

import { logger } from '../utils/Logger';
import { ProgressStore } from '../storage/ProgressStore';
import { FeedCacheStore, ImageCacheStore } from '../storage/CacheStore';
import { EpisodeManager } from '../podcast/EpisodeManager';

/**
 * Cleanup configuration
 */
export interface CleanupConfig {
    // Auto cleanup enabled
    enabled: boolean;
    // Cleanup interval in milliseconds (default: 24 hours)
    intervalMs: number;
    // Keep completed episodes for N days (default: 30 days)
    completedRetentionDays: number;
    // Keep in-progress episodes for N days (default: 90 days)
    inProgressRetentionDays: number;
    // Maximum cache size in MB (default: 100 MB)
    maxCacheSizeMB: number;
}

/**
 * Default cleanup configuration
 */
export const DEFAULT_CLEANUP_CONFIG: CleanupConfig = {
    enabled: true,
    intervalMs: 24 * 60 * 60 * 1000, // 24 hours
    completedRetentionDays: 30,
    inProgressRetentionDays: 90,
    maxCacheSizeMB: 100
};

/**
 * Cleanup statistics
 */
export interface CleanupStats {
    lastCleanupAt?: Date;
    completedRecordsRemoved: number;
    cacheEntriesRemoved: number;
    bytesFreed: number;
}

/**
 * Cleanup Service
 */
export class CleanupService {
    private progressStore: ProgressStore;
    private feedCacheStore: FeedCacheStore;
    private imageCacheStore: ImageCacheStore;
    private episodeManager: EpisodeManager;
    private config: CleanupConfig;
    private intervalId: number | null = null;
    private stats: CleanupStats = {
        completedRecordsRemoved: 0,
        cacheEntriesRemoved: 0,
        bytesFreed: 0
    };

    constructor(
        progressStore: ProgressStore,
        feedCacheStore: FeedCacheStore,
        imageCacheStore: ImageCacheStore,
        episodeManager: EpisodeManager,
        config: Partial<CleanupConfig> = {}
    ) {
        this.progressStore = progressStore;
        this.feedCacheStore = feedCacheStore;
        this.imageCacheStore = imageCacheStore;
        this.episodeManager = episodeManager;
        this.config = { ...DEFAULT_CLEANUP_CONFIG, ...config };
    }

    /**
     * Start automatic cleanup
     */
    start(): void {
        if (!this.config.enabled) {
            logger.info('Cleanup service is disabled');
            return;
        }

        if (this.intervalId !== null) {
            logger.warn('Cleanup service is already running');
            return;
        }

        logger.info(`Starting cleanup service with interval: ${this.config.intervalMs}ms`);

        // Run initial cleanup
        this.runCleanup().catch(error => {
            logger.error('Initial cleanup failed:', error);
        });

        // Schedule periodic cleanup
        this.intervalId = window.setInterval(() => {
            this.runCleanup().catch(error => {
                logger.error('Scheduled cleanup failed:', error);
            });
        }, this.config.intervalMs);
    }

    /**
     * Stop automatic cleanup
     */
    stop(): void {
        if (this.intervalId !== null) {
            window.clearInterval(this.intervalId);
            this.intervalId = null;
            logger.info('Cleanup service stopped');
        }
    }

    /**
     * Run cleanup manually
     */
    async runCleanup(): Promise<CleanupStats> {
        logger.info('Running cleanup...');

        const startTime = Date.now();
        const stats: CleanupStats = {
            lastCleanupAt: new Date(),
            completedRecordsRemoved: 0,
            cacheEntriesRemoved: 0,
            bytesFreed: 0
        };

        try {
            // 1. Clean up old completed episode progress
            const completedStats = await this.cleanupCompletedProgress();
            stats.completedRecordsRemoved += completedStats.removed;

            // 2. Clean up expired cache entries
            const cacheStats = await this.cleanupExpiredCache();
            stats.cacheEntriesRemoved += cacheStats.removed;
            stats.bytesFreed += cacheStats.bytesFreed;

            // 3. Clean up old images if cache is too large
            const imageCacheStats = await this.cleanupImageCache();
            stats.cacheEntriesRemoved += imageCacheStats.removed;
            stats.bytesFreed += imageCacheStats.bytesFreed;

            // Update internal stats
            this.stats = stats;

            const duration = Date.now() - startTime;
            logger.info(`Cleanup completed in ${duration}ms:`, stats);

            return stats;
        } catch (error) {
            logger.error('Cleanup failed:', error);
            throw error;
        }
    }

    /**
     * Clean up old completed episode progress
     */
    private async cleanupCompletedProgress(): Promise<{ removed: number }> {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - this.config.completedRetentionDays);

            logger.debug(`Cleaning up completed episodes older than ${cutoffDate.toISOString()}`);

            // Get all completed episodes
            const completedEpisodes = await this.episodeManager.getCompletedEpisodes();

            let removed = 0;
            for (const episode of completedEpisodes) {
                if (!episode.progress) continue;

                // Check if the episode was completed before the cutoff date
                const completedAt = episode.progress.lastPlayedAt;
                if (completedAt && new Date(completedAt) < cutoffDate) {
                    // Remove the progress record
                    await this.progressStore.removeProgress(episode.id);
                    removed++;
                    logger.debug(`Removed progress for completed episode: ${episode.title}`);
                }
            }

            logger.info(`Removed ${removed} old completed episode progress records`);
            return { removed };
        } catch (error) {
            logger.error('Failed to cleanup completed progress:', error);
            return { removed: 0 };
        }
    }

    /**
     * Clean up expired cache entries
     */
    private async cleanupExpiredCache(): Promise<{ removed: number; bytesFreed: number }> {
        try {
            // Get cache stats before cleanup
            const beforeStats = await this.feedCacheStore.getCacheStats();

            // Clean up expired feed cache
            await this.feedCacheStore.cleanupExpired();

            // Get cache stats after cleanup
            const afterStats = await this.feedCacheStore.getCacheStats();

            const removed = beforeStats.totalEntries - afterStats.totalEntries;
            const bytesFreed = beforeStats.totalSize - afterStats.totalSize;

            logger.info(`Removed ${removed} expired cache entries, freed ${bytesFreed} bytes`);
            return { removed, bytesFreed };
        } catch (error) {
            logger.error('Failed to cleanup expired cache:', error);
            return { removed: 0, bytesFreed: 0 };
        }
    }

    /**
     * Clean up image cache if it exceeds size limit
     */
    private async cleanupImageCache(): Promise<{ removed: number; bytesFreed: number }> {
        try {
            const stats = await this.imageCacheStore.getCacheStats();
            const maxSizeBytes = this.config.maxCacheSizeMB * 1024 * 1024;

            if (stats.totalSize <= maxSizeBytes) {
                logger.debug(`Image cache size (${stats.totalSize} bytes) is within limit (${maxSizeBytes} bytes)`);
                return { removed: 0, bytesFreed: 0 };
            }

            logger.info(`Image cache size (${stats.totalSize} bytes) exceeds limit (${maxSizeBytes} bytes), cleaning up...`);

            const beforeSize = stats.totalSize;
            const beforeCount = stats.totalImages;

            // Keep only the most recent images (half of current count or 100, whichever is larger)
            const keepCount = Math.max(Math.floor(stats.totalImages / 2), 100);
            await this.imageCacheStore.cleanupOldImages(keepCount);

            const afterStats = await this.imageCacheStore.getCacheStats();
            const removed = beforeCount - afterStats.totalImages;
            const bytesFreed = beforeSize - afterStats.totalSize;

            logger.info(`Removed ${removed} old images, freed ${bytesFreed} bytes`);
            return { removed, bytesFreed };
        } catch (error) {
            logger.error('Failed to cleanup image cache:', error);
            return { removed: 0, bytesFreed: 0 };
        }
    }

    /**
     * Update cleanup configuration
     */
    updateConfig(config: Partial<CleanupConfig>): void {
        const wasEnabled = this.config.enabled;
        this.config = { ...this.config, ...config };

        // Restart if enabled status changed
        if (wasEnabled !== this.config.enabled) {
            if (this.config.enabled) {
                this.start();
            } else {
                this.stop();
            }
        } else if (this.config.enabled && this.intervalId !== null) {
            // Restart with new interval if running
            this.stop();
            this.start();
        }
    }

    /**
     * Get cleanup statistics
     */
    getStats(): CleanupStats {
        return { ...this.stats };
    }

    /**
     * Get cleanup configuration
     */
    getConfig(): CleanupConfig {
        return { ...this.config };
    }
}
