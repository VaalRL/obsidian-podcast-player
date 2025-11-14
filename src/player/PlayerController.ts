/**
 * PlayerController - High-level player control
 *
 * Integrates PlaybackEngine and ProgressTracker to provide complete playback control.
 * Handles episode loading, playback control, progress tracking, and settings.
 */

import { logger } from '../utils/Logger';
import { AudioPlaybackError } from '../utils/errorUtils';
import { Episode, PodcastSettings, PlaybackState } from '../model';
import { PlaybackEngine, PlaybackStatus, PlaybackEventHandlers } from './PlaybackEngine';
import { ProgressTracker } from './ProgressTracker';
import { skipForward, skipBackward, getNextPlaybackSpeed } from '../utils/audioUtils';
import { DEFAULT_SETTINGS } from '../model';

/**
 * Player event handlers
 */
export interface PlayerEventHandlers {
	onStateChange?: (state: PlaybackState) => void;
	onEpisodeChange?: (episode: Episode | null) => void;
	onEpisodeEnded?: (episode: Episode) => void;
	onError?: (error: Error) => void;
}

/**
 * Player Controller
 */
export class PlayerController {
	private engine: PlaybackEngine;
	private progressTracker: ProgressTracker;
	private currentEpisode: Episode | null = null;
	private currentSettings: PodcastSettings;
	private eventHandlers: PlayerEventHandlers = {};
	private state: PlaybackState;

	constructor(engine: PlaybackEngine, progressTracker: ProgressTracker) {
		logger.methodEntry('PlayerController', 'constructor');

		this.engine = engine;
		this.progressTracker = progressTracker;
		this.currentSettings = { ...DEFAULT_SETTINGS.defaultPlaybackSettings };

		// Initialize state
		this.state = {
			status: 'stopped',
			position: 0,
			volume: this.currentSettings.volume,
			playbackSpeed: this.currentSettings.playbackSpeed,
			muted: false,
		};

		// Setup engine event handlers
		this.setupEngineHandlers();

		logger.methodExit('PlayerController', 'constructor');
	}

	/**
	 * Setup playback engine event handlers
	 */
	private setupEngineHandlers(): void {
		const handlers: PlaybackEventHandlers = {
			onPlay: () => {
				this.updateState({ status: 'playing' });
			},

			onPause: () => {
				this.updateState({ status: 'paused' });
			},

			onEnded: () => {
				this.handleEpisodeEnded();
			},

			onTimeUpdate: (currentTime: number) => {
				this.updateState({ position: currentTime });
				this.progressTracker.updatePosition(currentTime);
			},

			onDurationChange: (duration: number) => {
				if (this.currentEpisode) {
					this.currentEpisode.duration = duration;
				}
			},

			onLoadStart: () => {
				this.updateState({ status: 'loading' });
			},

			onError: (error: Error) => {
				this.updateState({
					status: 'error',
					error: error.message,
				});
				this.eventHandlers.onError?.(error);
			},

			onVolumeChange: (volume: number, muted: boolean) => {
				this.updateState({ volume, muted });
			},

			onRateChange: (playbackRate: number) => {
				this.updateState({ playbackSpeed: playbackRate });
			},
		};

		this.engine.setEventHandlers(handlers);
	}

	/**
	 * Load and optionally play an episode
	 */
	async loadEpisode(episode: Episode, autoPlay = false, resumeFromSaved = true): Promise<void> {
		logger.methodEntry('PlayerController', 'loadEpisode', episode.id);

		try {
			// Stop tracking previous episode
			if (this.currentEpisode) {
				await this.progressTracker.stopTracking(true);
			}

			// Load audio
			await this.engine.load(episode.audioUrl);

			// Set current episode
			this.currentEpisode = episode;
			this.updateState({
				currentEpisode: episode,
				status: 'paused',
				position: 0,
				error: undefined,
			});

			// Apply podcast-specific settings if available
			if (episode.podcastId) {
				// Settings will be applied from outside (via applyPodcastSettings)
			}

			// Start tracking progress
			await this.progressTracker.startTracking(episode);

			// Resume from saved position if requested
			if (resumeFromSaved) {
				const shouldResume = await this.progressTracker.shouldResume(episode.id);
				if (shouldResume) {
					const resumePosition = await this.progressTracker.getResumePosition(episode.id);
					logger.info('Resuming from saved position', resumePosition);
					this.engine.seek(resumePosition);

					// Skip intro if configured
					const skipIntro = this.currentSettings.skipIntroSeconds || 0;
					if (skipIntro > 0 && resumePosition < skipIntro) {
						this.engine.seek(skipIntro);
					}
				} else {
					// Skip intro for new episodes
					const skipIntro = this.currentSettings.skipIntroSeconds || 0;
					if (skipIntro > 0) {
						this.engine.seek(skipIntro);
					}
				}
			}

			// Notify episode change
			this.eventHandlers.onEpisodeChange?.(episode);

			// Auto play if requested
			if (autoPlay) {
				await this.play();
			}

			logger.info('Episode loaded', episode.title);
			logger.methodExit('PlayerController', 'loadEpisode');
		} catch (error) {
			logger.error('Failed to load episode', error);
			this.updateState({
				status: 'error',
				error: error instanceof Error ? error.message : 'Failed to load episode',
			});
			throw error;
		}
	}

	/**
	 * Play current episode
	 */
	async play(): Promise<void> {
		logger.methodEntry('PlayerController', 'play');

		if (!this.currentEpisode) {
			throw new AudioPlaybackError('No episode loaded');
		}

		await this.engine.play();

		logger.methodExit('PlayerController', 'play');
	}

	/**
	 * Pause playback
	 */
	pause(): void {
		logger.methodEntry('PlayerController', 'pause');

		this.engine.pause();

		logger.methodExit('PlayerController', 'pause');
	}

	/**
	 * Toggle play/pause
	 */
	async togglePlayPause(): Promise<void> {
		if (this.engine.isPlaying()) {
			this.pause();
		} else {
			await this.play();
		}
	}

	/**
	 * Stop playback
	 */
	async stop(): Promise<void> {
		logger.methodEntry('PlayerController', 'stop');

		this.engine.stop();

		// Save progress and stop tracking
		if (this.currentEpisode) {
			await this.progressTracker.stopTracking(true);
		}

		this.currentEpisode = null;
		this.updateState({
			currentEpisode: undefined,
			status: 'stopped',
			position: 0,
		});

		this.eventHandlers.onEpisodeChange?.(null);

		logger.methodExit('PlayerController', 'stop');
	}

	/**
	 * Seek to position (in seconds)
	 */
	seek(position: number): void {
		logger.methodEntry('PlayerController', 'seek', position);

		this.engine.seek(position);
		this.progressTracker.updatePosition(position);

		logger.methodExit('PlayerController', 'seek');
	}

	/**
	 * Skip forward
	 */
	skipForward(amount?: number): void {
		const currentTime = this.engine.getCurrentTime();
		const duration = this.engine.getDuration();
		const newPosition = skipForward(currentTime, duration, amount);
		this.seek(newPosition);
	}

	/**
	 * Skip backward
	 */
	skipBackward(amount?: number): void {
		const currentTime = this.engine.getCurrentTime();
		const newPosition = skipBackward(currentTime, amount);
		this.seek(newPosition);
	}

	/**
	 * Set volume
	 */
	setVolume(volume: number): void {
		logger.methodEntry('PlayerController', 'setVolume', volume);

		this.engine.setVolume(volume);
		this.currentSettings.volume = volume;

		logger.methodExit('PlayerController', 'setVolume');
	}

	/**
	 * Set playback speed
	 */
	setPlaybackSpeed(speed: number): void {
		logger.methodEntry('PlayerController', 'setPlaybackSpeed', speed);

		this.engine.setPlaybackRate(speed);
		this.currentSettings.playbackSpeed = speed;

		logger.methodExit('PlayerController', 'setPlaybackSpeed');
	}

	/**
	 * Cycle to next playback speed
	 */
	cyclePlaybackSpeed(): void {
		const currentSpeed = this.engine.getPlaybackRate();
		const nextSpeed = getNextPlaybackSpeed(currentSpeed);
		this.setPlaybackSpeed(nextSpeed);
	}

	/**
	 * Set muted state
	 */
	setMuted(muted: boolean): void {
		logger.methodEntry('PlayerController', 'setMuted', muted);

		this.engine.setMuted(muted);

		logger.methodExit('PlayerController', 'setMuted');
	}

	/**
	 * Toggle mute
	 */
	toggleMute(): void {
		const currentMuted = this.engine.isMuted();
		this.setMuted(!currentMuted);
	}

	/**
	 * Apply podcast-specific settings
	 */
	applyPodcastSettings(settings: PodcastSettings): void {
		logger.methodEntry('PlayerController', 'applyPodcastSettings');

		this.currentSettings = { ...settings };

		// Apply settings to engine
		this.engine.setVolume(settings.volume);
		this.engine.setPlaybackRate(settings.playbackSpeed);

		logger.info('Podcast settings applied', settings);
		logger.methodExit('PlayerController', 'applyPodcastSettings');
	}

	/**
	 * Get current playback state
	 */
	getState(): PlaybackState {
		return { ...this.state };
	}

	/**
	 * Get current episode
	 */
	getCurrentEpisode(): Episode | null {
		return this.currentEpisode;
	}

	/**
	 * Get current position
	 */
	getCurrentPosition(): number {
		return this.engine.getCurrentTime();
	}

	/**
	 * Get duration
	 */
	getDuration(): number {
		return this.engine.getDuration();
	}

	/**
	 * Check if playing
	 */
	isPlaying(): boolean {
		return this.engine.isPlaying();
	}

	/**
	 * Check if paused
	 */
	isPaused(): boolean {
		return this.engine.isPaused();
	}

	/**
	 * Set event handlers
	 */
	setEventHandlers(handlers: PlayerEventHandlers): void {
		this.eventHandlers = { ...this.eventHandlers, ...handlers };
	}

	/**
	 * Mark current episode as completed
	 */
	async markEpisodeCompleted(): Promise<void> {
		if (!this.currentEpisode) {
			return;
		}

		await this.progressTracker.markCompleted();
		logger.info('Episode marked as completed', this.currentEpisode.id);
	}

	/**
	 * Handle episode ended
	 */
	private async handleEpisodeEnded(): Promise<void> {
		logger.methodEntry('PlayerController', 'handleEpisodeEnded');

		if (!this.currentEpisode) {
			return;
		}

		// Mark as completed
		await this.progressTracker.markCompleted();

		// Update state
		this.updateState({ status: 'stopped' });

		// Notify
		this.eventHandlers.onEpisodeEnded?.(this.currentEpisode);

		logger.info('Episode ended', this.currentEpisode.title);
		logger.methodExit('PlayerController', 'handleEpisodeEnded');
	}

	/**
	 * Update playback state
	 */
	private updateState(updates: Partial<PlaybackState>): void {
		this.state = {
			...this.state,
			...updates,
		};

		// Notify state change
		this.eventHandlers.onStateChange?.(this.state);
	}

	/**
	 * Cleanup
	 */
	async destroy(): Promise<void> {
		logger.methodEntry('PlayerController', 'destroy');

		// Stop tracking
		await this.progressTracker.stopTracking(true);

		// Destroy engine
		this.engine.destroy();

		this.currentEpisode = null;
		this.eventHandlers = {};

		logger.info('PlayerController destroyed');
		logger.methodExit('PlayerController', 'destroy');
	}
}
