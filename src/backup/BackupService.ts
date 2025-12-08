/**
 * BackupService - Handles backup and restore operations
 *
 * Features:
 * 1. OPML export/import - Standard podcast subscription format
 * 2. Full backup - Complete data export including settings
 * 3. Daily auto-backup with cleanup (30 days retention)
 */

import { Vault, normalizePath } from 'obsidian';
import { logger } from '../utils/Logger';
import { DataPathManager } from '../storage/DataPathManager';
import { SubscriptionStore } from '../storage/SubscriptionStore';
import { ProgressStore } from '../storage/ProgressStore';
import { PlaylistStore } from '../playlist/PlaylistStore';
import { QueueStore } from '../queue/QueueStore';
import { Podcast, Playlist, Queue, PlayProgress, PluginSettings } from '../model';

/**
 * OPML document structure
 */
interface OPMLOutline {
	text: string;
	title?: string;
	type?: string;
	xmlUrl?: string;
	htmlUrl?: string;
}

/**
 * Full backup data structure
 */
export interface FullBackupData {
	version: string;
	createdAt: string;
	settings: PluginSettings;
	podcasts: Podcast[];
	progress: PlayProgress[];
	playlists: Playlist[];
	queues: Queue[];
}

/**
 * Backup configuration
 */
export interface BackupConfig {
	autoBackupEnabled: boolean;
	autoBackupIntervalMs: number;
	retentionDays: number;
}

const DEFAULT_BACKUP_CONFIG: BackupConfig = {
	autoBackupEnabled: true,
	autoBackupIntervalMs: 24 * 60 * 60 * 1000, // 24 hours
	retentionDays: 30
};

/**
 * BackupService - Manages backup and restore operations
 */
export class BackupService {
	private vault: Vault;
	private pathManager: DataPathManager;
	private subscriptionStore: SubscriptionStore;
	private progressStore: ProgressStore;
	private playlistStore: PlaylistStore;
	private queueStore: QueueStore;
	private config: BackupConfig;
	private autoBackupInterval: NodeJS.Timeout | null = null;
	private lastBackupDate: string | null = null;

	constructor(
		vault: Vault,
		pathManager: DataPathManager,
		subscriptionStore: SubscriptionStore,
		progressStore: ProgressStore,
		playlistStore: PlaylistStore,
		queueStore: QueueStore,
		config: Partial<BackupConfig> = {}
	) {
		this.vault = vault;
		this.pathManager = pathManager;
		this.subscriptionStore = subscriptionStore;
		this.progressStore = progressStore;
		this.playlistStore = playlistStore;
		this.queueStore = queueStore;
		this.config = { ...DEFAULT_BACKUP_CONFIG, ...config };
	}

	/**
	 * Start auto-backup service (runs daily, cleans up old backups)
	 */
	start(): void {
		if (this.autoBackupInterval) {
			return; // Already running
		}

		logger.info('Starting backup service');

		// Run initial check
		this.checkAndRunDailyBackup();

		// Set up interval for checking (every hour)
		this.autoBackupInterval = setInterval(() => {
			this.checkAndRunDailyBackup();
		}, 60 * 60 * 1000); // Check every hour
	}

	/**
	 * Stop auto-backup service
	 */
	stop(): void {
		if (this.autoBackupInterval) {
			clearInterval(this.autoBackupInterval);
			this.autoBackupInterval = null;
			logger.info('Backup service stopped');
		}
	}

	/**
	 * Check if daily backup should run and execute if needed
	 */
	private async checkAndRunDailyBackup(): Promise<void> {
		if (!this.config.autoBackupEnabled) {
			return;
		}

		const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

		if (this.lastBackupDate === today) {
			return; // Already backed up today
		}

		try {
			logger.info('Running daily auto-backup');
			await this.createDailyBackup();
			await this.cleanupOldBackups();
			this.lastBackupDate = today;
			logger.info('Daily auto-backup completed');
		} catch (error) {
			logger.error('Daily auto-backup failed', error);
		}
	}

	/**
	 * Export subscriptions to OPML format
	 */
	async exportOPML(): Promise<string> {
		logger.methodEntry('BackupService', 'exportOPML');

		const podcasts = await this.subscriptionStore.getAllPodcasts();

		const outlines = podcasts.map(podcast => {
			return `      <outline text="${this.escapeXml(podcast.title)}" title="${this.escapeXml(podcast.title)}" type="rss" xmlUrl="${this.escapeXml(podcast.feedUrl)}"${podcast.websiteUrl ? ` htmlUrl="${this.escapeXml(podcast.websiteUrl)}"` : ''} />`;
		}).join('\n');

		const opml = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>Podcast Subscriptions</title>
    <dateCreated>${new Date().toUTCString()}</dateCreated>
    <docs>http://opml.org/spec2.opml</docs>
  </head>
  <body>
    <outline text="Podcasts" title="Podcasts">
${outlines}
    </outline>
  </body>
</opml>`;

		logger.methodExit('BackupService', 'exportOPML');
		return opml;
	}

	/**
	 * Parse OPML and return feed URLs
	 */
	parseOPML(opmlContent: string): string[] {
		logger.methodEntry('BackupService', 'parseOPML');

		const feedUrls: string[] = [];

		// Simple regex-based parsing for xmlUrl attributes
		const xmlUrlRegex = /xmlUrl\s*=\s*["']([^"']+)["']/gi;
		let match;

		while ((match = xmlUrlRegex.exec(opmlContent)) !== null) {
			const url = this.unescapeXml(match[1]);
			if (url && !feedUrls.includes(url)) {
				feedUrls.push(url);
			}
		}

		logger.methodExit('BackupService', 'parseOPML');
		return feedUrls;
	}

	/**
	 * Create full backup of all data
	 */
	async createFullBackup(settings: PluginSettings): Promise<FullBackupData> {
		logger.methodEntry('BackupService', 'createFullBackup');

		const podcasts = await this.subscriptionStore.getAllPodcasts();
		const progress = await this.progressStore.getAllProgress();
		const playlists = await this.playlistStore.load();
		const queues = await this.queueStore.load();

		const backupData: FullBackupData = {
			version: '1.0.0',
			createdAt: new Date().toISOString(),
			settings,
			podcasts,
			progress,
			playlists,
			queues
		};

		logger.methodExit('BackupService', 'createFullBackup');
		return backupData;
	}

	/**
	 * Export full backup as JSON string
	 */
	async exportFullBackupJSON(settings: PluginSettings): Promise<string> {
		const backupData = await this.createFullBackup(settings);
		return JSON.stringify(backupData, null, 2);
	}

	/**
	 * Validate backup data structure
	 */
	validateBackupData(data: unknown): data is FullBackupData {
		if (!data || typeof data !== 'object') {
			return false;
		}

		const backup = data as Record<string, unknown>;

		return (
			typeof backup.version === 'string' &&
			typeof backup.createdAt === 'string' &&
			typeof backup.settings === 'object' &&
			Array.isArray(backup.podcasts) &&
			Array.isArray(backup.progress) &&
			Array.isArray(backup.playlists) &&
			Array.isArray(backup.queues)
		);
	}

	/**
	 * Create daily backup file in backups folder
	 */
	async createDailyBackup(): Promise<string> {
		logger.methodEntry('BackupService', 'createDailyBackup');

		const today = new Date().toISOString().split('T')[0];
		const filename = `daily-backup-${today}.json`;
		const backupPath = this.pathManager.getFilePath('backups', filename);

		// Check if today's backup already exists
		const adapter = this.vault.adapter;
		if (await adapter.exists(backupPath)) {
			logger.info('Daily backup already exists', backupPath);
			return backupPath;
		}

		// Get all data for backup
		const podcasts = await this.subscriptionStore.getAllPodcasts();
		const progress = await this.progressStore.getAllProgress();
		const playlists = await this.playlistStore.load();
		const queues = await this.queueStore.load();

		const backupData = {
			version: '1.0.0',
			createdAt: new Date().toISOString(),
			type: 'daily-auto',
			podcasts,
			progress,
			playlists,
			queues
		};

		await adapter.write(backupPath, JSON.stringify(backupData, null, 2));
		logger.info('Daily backup created', backupPath);

		logger.methodExit('BackupService', 'createDailyBackup');
		return backupPath;
	}

	/**
	 * Clean up backups older than retention period
	 */
	async cleanupOldBackups(): Promise<number> {
		logger.methodEntry('BackupService', 'cleanupOldBackups');

		const backupFiles = await this.pathManager.listFiles('backups');
		const cutoffDate = new Date();
		cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);
		const cutoffTime = cutoffDate.getTime();

		let deletedCount = 0;
		const adapter = this.vault.adapter;

		for (const filePath of backupFiles) {
			// Only clean up daily-backup files
			const filename = filePath.split('/').pop() || '';
			if (!filename.startsWith('daily-backup-')) {
				continue;
			}

			try {
				const stat = await adapter.stat(filePath);
				if (stat && stat.mtime < cutoffTime) {
					await adapter.remove(filePath);
					deletedCount++;
					logger.debug('Deleted old backup', filePath);
				}
			} catch (error) {
				logger.warn('Failed to check/delete backup file', error);
			}
		}

		if (deletedCount > 0) {
			logger.info(`Cleaned up ${deletedCount} old backup(s)`);
		}

		logger.methodExit('BackupService', 'cleanupOldBackups');
		return deletedCount;
	}

	/**
	 * Get list of available backups
	 */
	async getAvailableBackups(): Promise<{ filename: string; date: Date; size: number }[]> {
		const backupFiles = await this.pathManager.listFiles('backups');
		const backups: { filename: string; date: Date; size: number }[] = [];

		const adapter = this.vault.adapter;
		for (const filePath of backupFiles) {
			const filename = filePath.split('/').pop() || '';
			const stat = await adapter.stat(filePath);
			if (stat) {
				backups.push({
					filename,
					date: new Date(stat.mtime),
					size: stat.size
				});
			}
		}

		// Sort by date, newest first
		backups.sort((a, b) => b.date.getTime() - a.date.getTime());
		return backups;
	}

	/**
	 * Delete all plugin data (subscriptions, progress, playlists, queues, cache, backups)
	 * WARNING: This is destructive and cannot be undone!
	 */
	async deleteAllData(): Promise<{ success: boolean; deletedItems: number; errors: string[] }> {
		logger.methodEntry('BackupService', 'deleteAllData');

		const errors: string[] = [];
		let deletedItems = 0;

		// Clear subscriptions (podcasts and episodes)
		try {
			const podcasts = await this.subscriptionStore.getAllPodcasts();
			for (const podcast of podcasts) {
				await this.subscriptionStore.removePodcast(podcast.id);
				deletedItems++;
			}
			logger.info('Cleared all subscriptions');
		} catch (error) {
			const msg = 'Failed to clear subscriptions';
			logger.error(msg, error);
			errors.push(msg);
		}

		// Also clear any remaining files in subscriptions folder
		try {
			const subscriptionFiles = await this.pathManager.listFiles('subscriptions');
			for (const filePath of subscriptionFiles) {
				await this.vault.adapter.remove(filePath);
				deletedItems++;
			}
			logger.info('Cleared subscription files');
		} catch (error) {
			const msg = 'Failed to clear subscription files';
			logger.error(msg, error);
			errors.push(msg);
		}

		// Clear progress
		try {
			await this.progressStore.clearAll();
			deletedItems++;
			logger.info('Cleared all progress');
		} catch (error) {
			const msg = 'Failed to clear progress';
			logger.error(msg, error);
			errors.push(msg);
		}

		// Also clear any remaining files in progress folder
		try {
			const progressFiles = await this.pathManager.listFiles('progress');
			for (const filePath of progressFiles) {
				await this.vault.adapter.remove(filePath);
				deletedItems++;
			}
			logger.info('Cleared progress files');
		} catch (error) {
			const msg = 'Failed to clear progress files';
			logger.error(msg, error);
			errors.push(msg);
		}

		// Clear playlists
		try {
			await this.playlistStore.clear();
			deletedItems++;
			logger.info('Cleared all playlists');
		} catch (error) {
			const msg = 'Failed to clear playlists';
			logger.error(msg, error);
			errors.push(msg);
		}

		// Clear queues
		try {
			await this.queueStore.clear();
			deletedItems++;
			logger.info('Cleared all queues');
		} catch (error) {
			const msg = 'Failed to clear queues';
			logger.error(msg, error);
			errors.push(msg);
		}

		// Clear backups
		try {
			const backupFiles = await this.pathManager.listFiles('backups');
			for (const filePath of backupFiles) {
				await this.vault.adapter.remove(filePath);
				deletedItems++;
			}
			logger.info('Cleared all backups');
		} catch (error) {
			const msg = 'Failed to clear backups';
			logger.error(msg, error);
			errors.push(msg);
		}

		// Clear cache (feeds and images)
		try {
			const cacheFeeds = await this.pathManager.listFiles('cacheFeed');
			for (const filePath of cacheFeeds) {
				await this.vault.adapter.remove(filePath);
				deletedItems++;
			}
			logger.info('Cleared feed cache');
		} catch (error) {
			const msg = 'Failed to clear feed cache';
			logger.error(msg, error);
			errors.push(msg);
		}

		try {
			const cacheImages = await this.pathManager.listFiles('cacheImages');
			for (const filePath of cacheImages) {
				await this.vault.adapter.remove(filePath);
				deletedItems++;
			}
			logger.info('Cleared image cache');
		} catch (error) {
			const msg = 'Failed to clear image cache';
			logger.error(msg, error);
			errors.push(msg);
		}

		logger.methodExit('BackupService', 'deleteAllData');
		return {
			success: errors.length === 0,
			deletedItems,
			errors
		};
	}

	/**
	 * Escape special XML characters
	 */
	private escapeXml(str: string): string {
		return str
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&apos;');
	}

	/**
	 * Unescape XML entities
	 */
	private unescapeXml(str: string): string {
		return str
			.replace(/&amp;/g, '&')
			.replace(/&lt;/g, '<')
			.replace(/&gt;/g, '>')
			.replace(/&quot;/g, '"')
			.replace(/&apos;/g, "'");
	}
}
