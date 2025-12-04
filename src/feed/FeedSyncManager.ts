/**
 * FeedSyncManager - Manages background feed synchronization
 *
 * Handles automatic feed updates, batch updates, and sync scheduling.
 * Provides incremental update strategies and error handling.
 */

import { logger } from '../utils/Logger';
import { Podcast, FeedUpdateResult } from '../model';
import { FeedService } from './FeedService';
import { SubscriptionStore } from '../storage/SubscriptionStore';
import { QueueManager } from '../queue/QueueManager';
import { PlaylistManager } from '../playlist/PlaylistManager';
import { AutoAddRule, Episode } from '../model';
import { Notice } from 'obsidian';

/**
 * Sync options
 */
export interface SyncOptions {
	/** Force update even if not due */
	force?: boolean;
	/** Update specific podcasts (by ID) */
	podcastIds?: string[];
	/** Parallel updates limit */
	concurrency?: number;
	/** Update interval in milliseconds */
	updateInterval?: number;
}

/**
 * Sync result for a single podcast
 */
export interface PodcastSyncResult {
	podcastId: string;
	success: boolean;
	newEpisodesCount: number;
	error?: string;
}

/**
 * Sync result for batch update
 */
export interface BatchSyncResult {
	totalPodcasts: number;
	successCount: number;
	failureCount: number;
	totalNewEpisodes: number;
	results: PodcastSyncResult[];
	startedAt: Date;
	completedAt: Date;
}

/**
 * Feed Sync Manager
 */
export class FeedSyncManager {
	private feedService: FeedService;
	private subscriptionStore: SubscriptionStore;
	private queueManager: QueueManager;
	private playlistManager: PlaylistManager;
	private syncInterval: number;
	private syncTimer: NodeJS.Timeout | null = null;
	private isSyncing = false;
	private lastSyncTime: Date | null = null;

	constructor(
		feedService: FeedService,
		subscriptionStore: SubscriptionStore,
		queueManager: QueueManager,
		playlistManager: PlaylistManager,
		syncInterval: number = 3600000 // Default: 1 hour
	) {
		this.feedService = feedService;
		this.subscriptionStore = subscriptionStore;
		this.queueManager = queueManager;
		this.playlistManager = playlistManager;
		this.syncInterval = syncInterval;
	}

	/**
	 * Start automatic sync
	 */
	startAutoSync(): void {
		logger.methodEntry('FeedSyncManager', 'startAutoSync');

		if (this.syncTimer) {
			logger.warn('Auto sync already running');
			return;
		}

		// Run initial sync
		this.syncAll({ force: false }).catch(error => {
			logger.error('Initial sync failed', error);
		});

		// Schedule periodic syncs
		this.syncTimer = setInterval(() => {
			this.syncAll({ force: false }).catch(error => {
				logger.error('Auto sync failed', error);
			});
		}, this.syncInterval);

		logger.info(`Auto sync started (interval: ${this.syncInterval}ms)`);
		logger.methodExit('FeedSyncManager', 'startAutoSync');
	}

	/**
	 * Stop automatic sync
	 */
	stopAutoSync(): void {
		logger.methodEntry('FeedSyncManager', 'stopAutoSync');

		if (this.syncTimer) {
			clearInterval(this.syncTimer);
			this.syncTimer = null;
			logger.info('Auto sync stopped');
		}

		logger.methodExit('FeedSyncManager', 'stopAutoSync');
	}

	/**
	 * Sync all subscribed podcasts
	 */
	async syncAll(options: SyncOptions = {}): Promise<BatchSyncResult> {
		logger.methodEntry('FeedSyncManager', 'syncAll');

		if (this.isSyncing) {
			logger.warn('Sync already in progress');
			throw new Error('Sync already in progress');
		}

		this.isSyncing = true;
		const startedAt = new Date();

		try {
			const { force = false, concurrency = 3, updateInterval = this.syncInterval } = options;

			// Get all subscribed podcasts
			const podcasts = await this.subscriptionStore.getAllPodcasts();

			// Filter podcasts that need updating
			const podcastsToUpdate = force
				? podcasts
				: podcasts.filter(p => this.shouldUpdate(p, updateInterval));

			logger.info(`Syncing ${podcastsToUpdate.length} of ${podcasts.length} podcasts`);

			// Batch update with concurrency control
			const results = await this.batchUpdate(podcastsToUpdate, concurrency);

			const completedAt = new Date();

			const batchResult: BatchSyncResult = {
				totalPodcasts: podcastsToUpdate.length,
				successCount: results.filter(r => r.success).length,
				failureCount: results.filter(r => !r.success).length,
				totalNewEpisodes: results.reduce((sum, r) => sum + r.newEpisodesCount, 0),
				results,
				startedAt,
				completedAt,
			};

			this.lastSyncTime = completedAt;

			logger.info(
				`Sync completed: ${batchResult.successCount} succeeded, ${batchResult.failureCount} failed, ${batchResult.totalNewEpisodes} new episodes`
			);
			logger.methodExit('FeedSyncManager', 'syncAll');

			return batchResult;
		} finally {
			this.isSyncing = false;
		}
	}

	/**
	 * Sync specific podcasts
	 */
	async syncPodcasts(podcastIds: string[], options: SyncOptions = {}): Promise<BatchSyncResult> {
		logger.methodEntry('FeedSyncManager', 'syncPodcasts', `count=${podcastIds.length}`);

		if (this.isSyncing) {
			logger.warn('Sync already in progress');
			throw new Error('Sync already in progress');
		}

		this.isSyncing = true;
		const startedAt = new Date();

		try {
			const { concurrency = 3 } = options;

			// Get podcasts by IDs
			const podcasts: Podcast[] = [];
			for (const id of podcastIds) {
				const podcast = await this.subscriptionStore.getPodcast(id);
				if (podcast) {
					podcasts.push(podcast);
				}
			}

			logger.info(`Syncing ${podcasts.length} specific podcasts`);

			// Batch update
			const results = await this.batchUpdate(podcasts, concurrency);

			const completedAt = new Date();

			const batchResult: BatchSyncResult = {
				totalPodcasts: podcasts.length,
				successCount: results.filter(r => r.success).length,
				failureCount: results.filter(r => !r.success).length,
				totalNewEpisodes: results.reduce((sum, r) => sum + r.newEpisodesCount, 0),
				results,
				startedAt,
				completedAt,
			};

			logger.info(
				`Sync completed: ${batchResult.successCount} succeeded, ${batchResult.failureCount} failed`
			);
			logger.methodExit('FeedSyncManager', 'syncPodcasts');

			return batchResult;
		} finally {
			this.isSyncing = false;
		}
	}

	/**
	 * Sync a single podcast
	 */
	async syncPodcast(podcastId: string): Promise<PodcastSyncResult> {
		logger.methodEntry('FeedSyncManager', 'syncPodcast', podcastId);

		const podcast = await this.subscriptionStore.getPodcast(podcastId);

		if (!podcast) {
			throw new Error(`Podcast not found: ${podcastId}`);
		}

		const result = await this.updatePodcast(podcast);

		logger.methodExit('FeedSyncManager', 'syncPodcast');
		return result;
	}

	/**
	 * Batch update podcasts with concurrency control
	 */
	private async batchUpdate(
		podcasts: Podcast[],
		concurrency: number
	): Promise<PodcastSyncResult[]> {
		const results: PodcastSyncResult[] = [];
		const queue = [...podcasts];

		// Process podcasts in batches
		while (queue.length > 0) {
			const batch = queue.splice(0, concurrency);
			const batchResults = await Promise.all(batch.map(p => this.updatePodcast(p)));
			results.push(...batchResults);

			// Small delay between batches to avoid overwhelming the network
			if (queue.length > 0) {
				await this.delay(1000);
			}
		}

		return results;
	}

	/**
	 * Update a single podcast
	 */
	private async updatePodcast(podcast: Podcast): Promise<PodcastSyncResult> {
		logger.debug(`Updating podcast: ${podcast.title}`);

		try {
			const { podcast: updatedPodcast, episodes, newEpisodes } = await this.feedService.updateFeed(podcast);

			// Merge new episodes with existing ones
			const existingEpisodes = podcast.episodes || [];
			const allEpisodes = [...newEpisodes, ...existingEpisodes];

			// Remove duplicates (keep first occurrence)
			const uniqueEpisodes = Array.from(
				new Map(allEpisodes.map(e => [e.id, e])).values()
			);

			// Sort by publish date (newest first)
			// Convert to Date objects in case they were deserialized as strings
			uniqueEpisodes.sort((a, b) => {
				const dateA = a.publishDate instanceof Date ? a.publishDate : new Date(a.publishDate);
				const dateB = b.publishDate instanceof Date ? b.publishDate : new Date(b.publishDate);
				return dateB.getTime() - dateA.getTime();
			});

			updatedPodcast.episodes = uniqueEpisodes;

			// Handle auto-add rule
			if (newEpisodes.length > 0 && podcast.autoAddRule && podcast.autoAddRule.enabled) {
				await this.handleAutoAdd(podcast.autoAddRule, newEpisodes);
			}

			await this.subscriptionStore.updatePodcast(updatedPodcast);

			return {
				podcastId: podcast.id,
				success: true,
				newEpisodesCount: newEpisodes.length,
			};
		} catch (error) {
			logger.error(`Failed to update podcast: ${podcast.title}`, error);

			return {
				podcastId: podcast.id,
				success: false,
				newEpisodesCount: 0,
				error: error instanceof Error ? error.message : 'Unknown error',
			};
		}
	}

	/**
	 * Handle auto-add rule
	 */
	private async handleAutoAdd(rule: AutoAddRule, episodes: Episode[]): Promise<void> {
		try {
			const episodeIds = episodes.map(e => e.id);

			if (rule.targetType === 'queue') {
				const queue = await this.queueManager.getQueue(rule.targetId);
				if (queue) {
					if (rule.position === 'top') {
						// Insert in reverse order to maintain sequence at top
						for (let i = episodes.length - 1; i >= 0; i--) {
							await this.queueManager.insertEpisode(rule.targetId, episodes[i].id, 0);
						}
					} else {
						await this.queueManager.addEpisodes(rule.targetId, episodeIds);
					}
					new Notice(`Auto-added ${episodes.length} episodes to queue: ${queue.name}`);
				}
			} else if (rule.targetType === 'playlist') {
				const playlist = await this.playlistManager.getPlaylist(rule.targetId);
				if (playlist) {
					if (rule.position === 'top') {
						const currentIds = playlist.episodeIds;
						const newIds = [...episodeIds, ...currentIds];
						await this.playlistManager.updatePlaylist(rule.targetId, { episodeIds: newIds });
					} else {
						await this.playlistManager.addEpisodes(rule.targetId, episodeIds);
					}
					new Notice(`Auto-added ${episodes.length} episodes to playlist: ${playlist.name}`);
				}
			}
		} catch (error) {
			logger.error('Failed to auto-add episodes', error);
		}
	}

	/**
	 * Check if a podcast should be updated
	 */
	private shouldUpdate(podcast: Podcast, updateInterval: number): boolean {
		if (!podcast.lastFetchedAt) {
			return true; // Never fetched
		}

		const now = Date.now();
		const lastFetched = new Date(podcast.lastFetchedAt).getTime();
		return now - lastFetched >= updateInterval;
	}

	/**
	 * Utility delay function
	 */
	private delay(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms));
	}

	/**
	 * Get sync status
	 */
	getSyncStatus(): {
		isSyncing: boolean;
		isAutoSyncEnabled: boolean;
		lastSyncTime: Date | null;
		syncInterval: number;
	} {
		return {
			isSyncing: this.isSyncing,
			isAutoSyncEnabled: this.syncTimer !== null,
			lastSyncTime: this.lastSyncTime,
			syncInterval: this.syncInterval,
		};
	}

	/**
	 * Update sync interval
	 */
	setSyncInterval(interval: number): void {
		logger.methodEntry('FeedSyncManager', 'setSyncInterval', interval);

		this.syncInterval = interval;

		// Restart auto sync if it's running
		if (this.syncTimer) {
			this.stopAutoSync();
			this.startAutoSync();
		}

		logger.methodExit('FeedSyncManager', 'setSyncInterval');
	}
}
