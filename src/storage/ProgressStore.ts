/**
 * ProgressStore - Manages episode playback progress
 *
 * Stores playback progress for all episodes in a single JSON file.
 * Provides methods for tracking, updating, and querying playback progress.
 */

import { Vault, normalizePath } from 'obsidian';
import { logger } from '../utils/Logger';
import { StorageError } from '../utils/errorUtils';
import { PlayProgress } from '../model';
import { DataPathManager } from './DataPathManager';
import { SingleFileStore } from './FileSystemStore';
import { isEpisodeCompleted } from '../utils/audioUtils';

/**
 * Progress data structure
 */
export interface ProgressData {
	progress: PlayProgress[];
	version: number;
}

/**
 * ProgressStore - Manages episode playback progress
 */
export class ProgressStore extends SingleFileStore<ProgressData> {
	private static readonly CURRENT_VERSION = 1;

	constructor(vault: Vault, pathManager: DataPathManager) {
		const filePath = pathManager.getFilePath('progress', 'progress.json');
		super(vault, pathManager, filePath);
	}

	/**
	 * Validate progress data
	 */
	protected validate(data: ProgressData): boolean {
		if (!data || typeof data !== 'object') {
			logger.warn('Invalid progress data: not an object');
			return false;
		}

		if (!Array.isArray(data.progress)) {
			logger.warn('Invalid progress data: progress is not an array');
			return false;
		}

		if (typeof data.version !== 'number') {
			logger.warn('Invalid progress data: version is not a number');
			return false;
		}

		// Validate each progress entry
		for (const progress of data.progress) {
			if (!this.validateProgress(progress)) {
				logger.warn('Invalid progress entry in data', progress);
				return false;
			}
		}

		return true;
	}

	/**
	 * Validate a single progress entry
	 */
	private validateProgress(progress: PlayProgress): boolean {
		if (!progress || typeof progress !== 'object') {
			return false;
		}

		const requiredFields = ['episodeId', 'podcastId', 'position', 'duration', 'lastPlayedAt'];
		for (const field of requiredFields) {
			if (!(field in progress)) {
				logger.warn(`Missing required field in progress: ${field}`);
				return false;
			}
		}

		if (typeof progress.position !== 'number' || progress.position < 0) {
			return false;
		}

		if (typeof progress.duration !== 'number' || progress.duration < 0) {
			return false;
		}

		if (typeof progress.completed !== 'boolean') {
			return false;
		}

		return true;
	}

	/**
	 * Get default progress data
	 */
	protected getDefaultValue(): ProgressData {
		return {
			progress: [],
			version: ProgressStore.CURRENT_VERSION,
		};
	}

	/**
	 * Get progress for a specific episode
	 */
	async getProgress(episodeId: string): Promise<PlayProgress | null> {
		logger.methodEntry('ProgressStore', 'getProgress', episodeId);

		const data = await this.load();
		const progress = data.progress.find(p => p.episodeId === episodeId) || null;

		logger.methodExit('ProgressStore', 'getProgress');
		return progress;
	}

	/**
	 * Get all progress entries for a podcast
	 */
	async getPodcastProgress(podcastId: string): Promise<PlayProgress[]> {
		logger.methodEntry('ProgressStore', 'getPodcastProgress', podcastId);

		const data = await this.load();
		const podcastProgress = data.progress.filter(p => p.podcastId === podcastId);

		logger.methodExit('ProgressStore', 'getPodcastProgress');
		return podcastProgress;
	}

	/**
	 * Get all progress entries
	 */
	async getAllProgress(): Promise<PlayProgress[]> {
		logger.methodEntry('ProgressStore', 'getAllProgress');

		const data = await this.load();

		logger.methodExit('ProgressStore', 'getAllProgress');
		return data.progress;
	}

	/**
	 * Update or create progress for an episode
	 */
	async updateProgress(progress: PlayProgress): Promise<void> {
		logger.methodEntry('ProgressStore', 'updateProgress', progress.episodeId);

		if (!this.validateProgress(progress)) {
			throw new StorageError('Invalid progress data', this.filePath);
		}

		const data = await this.load();
		const index = data.progress.findIndex(p => p.episodeId === progress.episodeId);

		// Auto-detect completion status
		progress.completed = isEpisodeCompleted(progress.position, progress.duration);

		if (index !== -1) {
			// Update existing progress
			data.progress[index] = progress;
		} else {
			// Add new progress
			data.progress.push(progress);
		}

		await this.save(data);
		logger.methodExit('ProgressStore', 'updateProgress');
	}

	/**
	 * Update playback position for an episode
	 */
	async updatePosition(
		episodeId: string,
		podcastId: string,
		position: number,
		duration: number
	): Promise<void> {
		logger.methodEntry('ProgressStore', 'updatePosition', episodeId);

		const existingProgress = await this.getProgress(episodeId);

		const progress: PlayProgress = {
			episodeId,
			podcastId,
			position,
			duration,
			lastPlayedAt: new Date(),
			completed: isEpisodeCompleted(position, duration),
		};

		await this.updateProgress(progress);
		logger.methodExit('ProgressStore', 'updatePosition');
	}

	/**
	 * Mark an episode as completed
	 */
	async markCompleted(episodeId: string, podcastId: string, duration: number): Promise<void> {
		logger.methodEntry('ProgressStore', 'markCompleted', episodeId);

		const progress: PlayProgress = {
			episodeId,
			podcastId,
			position: duration,
			duration,
			lastPlayedAt: new Date(),
			completed: true,
		};

		await this.updateProgress(progress);
		logger.methodExit('ProgressStore', 'markCompleted');
	}

	/**
	 * Mark an episode as not started (reset progress)
	 */
	async resetProgress(episodeId: string): Promise<void> {
		logger.methodEntry('ProgressStore', 'resetProgress', episodeId);

		const data = await this.load();
		const index = data.progress.findIndex(p => p.episodeId === episodeId);

		if (index !== -1) {
			data.progress.splice(index, 1);
			await this.save(data);
		}

		logger.methodExit('ProgressStore', 'resetProgress');
	}

	/**
	 * Remove progress for a specific episode
	 */
	async removeProgress(episodeId: string): Promise<void> {
		logger.methodEntry('ProgressStore', 'removeProgress', episodeId);

		const data = await this.load();
		const index = data.progress.findIndex(p => p.episodeId === episodeId);

		if (index !== -1) {
			data.progress.splice(index, 1);
			await this.save(data);
		}

		logger.methodExit('ProgressStore', 'removeProgress');
	}

	/**
	 * Remove all progress for a podcast
	 */
	async removePodcastProgress(podcastId: string): Promise<void> {
		logger.methodEntry('ProgressStore', 'removePodcastProgress', podcastId);

		const data = await this.load();
		data.progress = data.progress.filter(p => p.podcastId !== podcastId);

		await this.save(data);
		logger.methodExit('ProgressStore', 'removePodcastProgress');
	}

	/**
	 * Get in-progress episodes (started but not completed)
	 */
	async getInProgressEpisodes(): Promise<PlayProgress[]> {
		const data = await this.load();
		return data.progress.filter(p => !p.completed && p.position > 0);
	}

	/**
	 * Get completed episodes
	 */
	async getCompletedEpisodes(): Promise<PlayProgress[]> {
		const data = await this.load();
		return data.progress.filter(p => p.completed);
	}

	/**
	 * Get recently played episodes
	 */
	async getRecentlyPlayed(limit = 10): Promise<PlayProgress[]> {
		const data = await this.load();

		// Sort by lastPlayedAt (most recent first)
		const sorted = [...data.progress].sort((a, b) => {
			const dateA = new Date(a.lastPlayedAt).getTime();
			const dateB = new Date(b.lastPlayedAt).getTime();
			return dateB - dateA;
		});

		return sorted.slice(0, limit);
	}

	/**
	 * Get completion percentage for an episode
	 */
	async getCompletionPercentage(episodeId: string): Promise<number> {
		const progress = await this.getProgress(episodeId);

		if (!progress || progress.duration <= 0) {
			return 0;
		}

		return Math.min(100, Math.max(0, (progress.position / progress.duration) * 100));
	}

	/**
	 * Get total listening time (in seconds)
	 */
	async getTotalListeningTime(): Promise<number> {
		const data = await this.load();
		return data.progress.reduce((total, p) => total + p.position, 0);
	}

	/**
	 * Get listening statistics for a podcast
	 */
	async getPodcastStatistics(podcastId: string): Promise<{
		totalEpisodes: number;
		completedEpisodes: number;
		inProgressEpisodes: number;
		totalListeningTime: number;
	}> {
		const podcastProgress = await this.getPodcastProgress(podcastId);

		return {
			totalEpisodes: podcastProgress.length,
			completedEpisodes: podcastProgress.filter(p => p.completed).length,
			inProgressEpisodes: podcastProgress.filter(p => !p.completed && p.position > 0).length,
			totalListeningTime: podcastProgress.reduce((total, p) => total + p.position, 0),
		};
	}

	/**
	 * Clean up old completed episodes (keep only recent N)
	 */
	async cleanupOldProgress(keepRecentCount = 100): Promise<void> {
		logger.methodEntry('ProgressStore', 'cleanupOldProgress', `keepRecentCount=${keepRecentCount}`);

		const data = await this.load();

		// Sort by lastPlayedAt (most recent first)
		const sorted = [...data.progress].sort((a, b) => {
			const dateA = new Date(a.lastPlayedAt).getTime();
			const dateB = new Date(b.lastPlayedAt).getTime();
			return dateB - dateA;
		});

		// Keep only the most recent N
		data.progress = sorted.slice(0, keepRecentCount);

		await this.save(data);
		logger.methodExit('ProgressStore', 'cleanupOldProgress');
	}

	/**
	 * Export all progress data (for backup or migration)
	 */
	async exportProgress(): Promise<ProgressData> {
		logger.methodEntry('ProgressStore', 'exportProgress');
		const data = await this.load();
		logger.methodExit('ProgressStore', 'exportProgress');
		return data;
	}

	/**
	 * Import progress data (for restore or migration)
	 */
	async importProgress(importData: ProgressData, replace = false): Promise<void> {
		logger.methodEntry('ProgressStore', 'importProgress', `replace=${replace}`);

		if (!this.validate(importData)) {
			throw new StorageError('Invalid import data', this.filePath);
		}

		if (replace) {
			// Replace all progress
			await this.save(importData);
		} else {
			// Merge with existing progress
			const currentData = await this.load();
			const mergedProgress = [...currentData.progress];

			for (const importedProgress of importData.progress) {
				const existingIndex = mergedProgress.findIndex(
					p => p.episodeId === importedProgress.episodeId
				);

				if (existingIndex !== -1) {
					// Keep the one with more recent lastPlayedAt
					const existingDate = new Date(mergedProgress[existingIndex].lastPlayedAt).getTime();
					const importedDate = new Date(importedProgress.lastPlayedAt).getTime();

					if (importedDate > existingDate) {
						mergedProgress[existingIndex] = importedProgress;
					}
				} else {
					// Add new progress
					mergedProgress.push(importedProgress);
				}
			}

			await this.save({
				progress: mergedProgress,
				version: ProgressStore.CURRENT_VERSION,
			});
		}

		logger.methodExit('ProgressStore', 'importProgress');
	}

	/**
	 * Clear all progress data
	 */
	async clearAll(): Promise<void> {
		logger.methodEntry('ProgressStore', 'clearAll');

		await this.save({
			progress: [],
			version: ProgressStore.CURRENT_VERSION,
		});

		logger.methodExit('ProgressStore', 'clearAll');
	}
}
