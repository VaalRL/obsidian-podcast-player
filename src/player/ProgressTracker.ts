/**
 * ProgressTracker - Tracks and persists playback progress
 *
 * Automatically saves playback progress to ProgressStore at regular intervals.
 * Supports resume playback from last position.
 */

import { logger } from '../utils/Logger';
import { Episode, PlayProgress } from '../model';
import { ProgressStore } from '../storage/ProgressStore';
import { isEpisodeCompleted } from '../utils/audioUtils';

/**
 * Progress tracking options
 */
export interface ProgressTrackingOptions {
	/** Save interval in milliseconds (default: 5000ms / 5 seconds) */
	saveInterval?: number;
	/** Minimum position change (in seconds) to trigger save (default: 2 seconds) */
	minPositionChange?: number;
	/** Auto-mark as completed when within threshold (default: 30 seconds from end) */
	completionThreshold?: number;
}

/**
 * Progress Tracker
 */
export class ProgressTracker {
	private progressStore: ProgressStore;
	private currentEpisode: Episode | null = null;
	private lastSavedPosition = 0;
	private lastSavedTime = 0;
	private saveInterval: number;
	private minPositionChange: number;
	private completionThreshold: number;
	private saveTimer: number | null = null;
	private isTracking = false;

	constructor(
		progressStore: ProgressStore,
		options: ProgressTrackingOptions = {}
	) {
		this.progressStore = progressStore;
		this.saveInterval = options.saveInterval || 5000; // 5 seconds
		this.minPositionChange = options.minPositionChange || 2; // 2 seconds
		this.completionThreshold = options.completionThreshold || 30; // 30 seconds
	}

	/**
	 * Start tracking progress for an episode
	 */
	async startTracking(episode: Episode): Promise<void> {
		logger.methodEntry('ProgressTracker', 'startTracking', episode.id);

		// Stop tracking previous episode if any
		if (this.isTracking) {
			await this.stopTracking();
		}

		this.currentEpisode = episode;
		this.isTracking = true;

		// Load existing progress
		const existingProgress = await this.progressStore.getProgress(episode.id);
		if (existingProgress) {
			this.lastSavedPosition = existingProgress.position;
		} else {
			this.lastSavedPosition = 0;
		}

		this.lastSavedTime = Date.now();

		// Start periodic save
		this.startPeriodicSave();

		logger.info('Started tracking progress', episode.id);
		logger.methodExit('ProgressTracker', 'startTracking');
	}

	/**
	 * Stop tracking progress
	 */
	async stopTracking(saveProgress = true): Promise<void> {
		logger.methodEntry('ProgressTracker', 'stopTracking', `save=${saveProgress}`);

		if (!this.isTracking) {
			logger.methodExit('ProgressTracker', 'stopTracking', 'not tracking');
			return;
		}

		// Stop periodic save
		this.stopPeriodicSave();

		// Save final progress if requested
		if (saveProgress && this.currentEpisode) {
			await this.saveProgress(this.lastSavedPosition, true);
		}

		this.currentEpisode = null;
		this.isTracking = false;
		this.lastSavedPosition = 0;
		this.lastSavedTime = 0;

		logger.info('Stopped tracking progress');
		logger.methodExit('ProgressTracker', 'stopTracking');
	}

	/**
	 * Update current position
	 */
	updatePosition(position: number): void {
		if (!this.isTracking || !this.currentEpisode) {
			return;
		}

		// Update last saved position (will be saved on next interval)
		this.lastSavedPosition = position;
	}

	/**
	 * Force save current progress immediately
	 */
	async forceSave(position?: number): Promise<void> {
		logger.methodEntry('ProgressTracker', 'forceSave');

		if (!this.currentEpisode) {
			logger.warn('No episode to save progress for');
			logger.methodExit('ProgressTracker', 'forceSave', 'no episode');
			return;
		}

		const positionToSave = position !== undefined ? position : this.lastSavedPosition;
		await this.saveProgress(positionToSave, true);

		logger.methodExit('ProgressTracker', 'forceSave');
	}

	/**
	 * Mark current episode as completed
	 */
	async markCompleted(): Promise<void> {
		logger.methodEntry('ProgressTracker', 'markCompleted');

		if (!this.currentEpisode) {
			logger.warn('No episode to mark as completed');
			logger.methodExit('ProgressTracker', 'markCompleted', 'no episode');
			return;
		}

		await this.progressStore.markCompleted(
			this.currentEpisode.id,
			this.currentEpisode.podcastId,
			this.currentEpisode.duration
		);

		logger.info('Episode marked as completed', this.currentEpisode.id);
		logger.methodExit('ProgressTracker', 'markCompleted');
	}

	/**
	 * Get last saved position
	 */
	getLastSavedPosition(): number {
		return this.lastSavedPosition;
	}

	/**
	 * Get resume position for an episode
	 */
	async getResumePosition(episodeId: string): Promise<number> {
		logger.methodEntry('ProgressTracker', 'getResumePosition', episodeId);

		const progress = await this.progressStore.getProgress(episodeId);

		if (!progress) {
			logger.methodExit('ProgressTracker', 'getResumePosition', 'no progress');
			return 0;
		}

		// If completed, start from beginning
		if (progress.completed) {
			logger.methodExit('ProgressTracker', 'getResumePosition', 'completed');
			return 0;
		}

		logger.methodExit('ProgressTracker', 'getResumePosition', progress.position);
		return progress.position;
	}

	/**
	 * Check if episode should resume from saved position
	 */
	async shouldResume(episodeId: string, minPositionForResume = 10): Promise<boolean> {
		const resumePosition = await this.getResumePosition(episodeId);
		return resumePosition >= minPositionForResume;
	}

	/**
	 * Reset progress for an episode
	 */
	async resetProgress(episodeId: string): Promise<void> {
		logger.methodEntry('ProgressTracker', 'resetProgress', episodeId);

		await this.progressStore.resetProgress(episodeId);

		// If resetting current episode, update internal state
		if (this.currentEpisode && this.currentEpisode.id === episodeId) {
			this.lastSavedPosition = 0;
		}

		logger.info('Progress reset', episodeId);
		logger.methodExit('ProgressTracker', 'resetProgress');
	}

	/**
	 * Start periodic save timer
	 */
	private startPeriodicSave(): void {
		if (this.saveTimer !== null) {
			return;
		}

		this.saveTimer = window.setInterval(() => {
			this.periodicSave().catch(error => {
				logger.error('Periodic save failed', error);
			});
		}, this.saveInterval);
	}

	/**
	 * Stop periodic save timer
	 */
	private stopPeriodicSave(): void {
		if (this.saveTimer !== null) {
			clearInterval(this.saveTimer);
			this.saveTimer = null;
		}
	}

	/**
	 * Periodic save handler
	 */
	private async periodicSave(): Promise<void> {
		if (!this.isTracking || !this.currentEpisode) {
			return;
		}

		// Only save if position changed significantly
		const existingProgress = await this.progressStore.getProgress(this.currentEpisode.id);
		const lastPosition = existingProgress?.position || 0;

		if (Math.abs(this.lastSavedPosition - lastPosition) < this.minPositionChange) {
			// Not enough change to save
			return;
		}

		await this.saveProgress(this.lastSavedPosition, false);
	}

	/**
	 * Save progress to store
	 */
	private async saveProgress(position: number, force: boolean): Promise<void> {
		if (!this.currentEpisode) {
			return;
		}

		try {
			// Check if episode is completed
			const isCompleted = isEpisodeCompleted(
				position,
				this.currentEpisode.duration,
				this.completionThreshold
			);

			// Create progress record
			const progress: PlayProgress = {
				episodeId: this.currentEpisode.id,
				podcastId: this.currentEpisode.podcastId,
				position,
				duration: this.currentEpisode.duration,
				lastPlayedAt: new Date(),
				completed: isCompleted,
			};

			await this.progressStore.updateProgress(progress);

			this.lastSavedTime = Date.now();

			logger.debug('Progress saved', {
				episodeId: this.currentEpisode.id,
				position,
				completed: isCompleted,
			});
		} catch (error) {
			logger.error('Failed to save progress', error);
			// Don't throw - we don't want to interrupt playback if save fails
		}
	}

	/**
	 * Get tracking status
	 */
	isCurrentlyTracking(): boolean {
		return this.isTracking;
	}

	/**
	 * Get current tracking episode
	 */
	getCurrentEpisode(): Episode | null {
		return this.currentEpisode;
	}

	/**
	 * Get time since last save (in milliseconds)
	 */
	getTimeSinceLastSave(): number {
		if (this.lastSavedTime === 0) {
			return 0;
		}
		return Date.now() - this.lastSavedTime;
	}
}
