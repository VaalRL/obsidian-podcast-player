/**
 * PlaybackEngine - Core audio playback engine
 *
 * Handles HTML5 Audio API integration, audio loading, and playback control.
 * Provides low-level audio playback functionality.
 */

import { logger } from '../utils/Logger';
import { AudioPlaybackError } from '../utils/errorUtils';
import { validatePlaybackSpeed, validateVolume } from '../utils/audioUtils';

/**
 * Playback state
 */
export type PlaybackStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'ended' | 'error';

/**
 * Audio metadata
 */
export interface AudioMetadata {
	duration: number;
	currentTime: number;
	buffered: number;
	volume: number;
	playbackRate: number;
	muted: boolean;
}

/**
 * Playback event handlers
 */
export interface PlaybackEventHandlers {
	onPlay?: () => void;
	onPause?: () => void;
	onEnded?: () => void;
	onTimeUpdate?: (currentTime: number) => void;
	onDurationChange?: (duration: number) => void;
	onLoadStart?: () => void;
	onLoadedMetadata?: () => void;
	onCanPlay?: () => void;
	onError?: (error: Error) => void;
	onVolumeChange?: (volume: number, muted: boolean) => void;
	onRateChange?: (playbackRate: number) => void;
	onProgress?: (buffered: number) => void;
}

/**
 * Playback Engine
 */
export class PlaybackEngine {
	private audio: HTMLAudioElement | null = null;
	private currentUrl: string | null = null;
	private status: PlaybackStatus = 'idle';
	private eventHandlers: PlaybackEventHandlers = {};
	private progressInterval: number | null = null;

	constructor() {
		logger.methodEntry('PlaybackEngine', 'constructor');
		this.initializeAudioElement();
		logger.methodExit('PlaybackEngine', 'constructor');
	}

	/**
	 * Initialize audio element
	 */
	private initializeAudioElement(): void {
		this.audio = new Audio();
		this.audio.preload = 'metadata';
		this.attachEventListeners();
	}

	/**
	 * Attach event listeners to audio element
	 */
	private attachEventListeners(): void {
		if (!this.audio) return;

		this.audio.addEventListener('play', () => {
			logger.debug('Audio play event');
			this.status = 'playing';
			this.eventHandlers.onPlay?.();
			this.startProgressTracking();
		});

		this.audio.addEventListener('pause', () => {
			logger.debug('Audio pause event');
			this.status = 'paused';
			this.eventHandlers.onPause?.();
			this.stopProgressTracking();
		});

		this.audio.addEventListener('ended', () => {
			logger.debug('Audio ended event');
			this.status = 'ended';
			this.eventHandlers.onEnded?.();
			this.stopProgressTracking();
		});

		this.audio.addEventListener('timeupdate', () => {
			if (this.audio) {
				this.eventHandlers.onTimeUpdate?.(this.audio.currentTime);
			}
		});

		this.audio.addEventListener('durationchange', () => {
			if (this.audio && !isNaN(this.audio.duration)) {
				logger.debug('Duration changed', this.audio.duration);
				this.eventHandlers.onDurationChange?.(this.audio.duration);
			}
		});

		this.audio.addEventListener('loadstart', () => {
			logger.debug('Audio load start');
			this.status = 'loading';
			this.eventHandlers.onLoadStart?.();
		});

		this.audio.addEventListener('loadedmetadata', () => {
			logger.debug('Audio metadata loaded');
			this.eventHandlers.onLoadedMetadata?.();
		});

		this.audio.addEventListener('canplay', () => {
			logger.debug('Audio can play');
			this.eventHandlers.onCanPlay?.();
		});

		this.audio.addEventListener('error', (event) => {
			logger.error('Audio playback error', this.audio?.error);
			this.status = 'error';

			const error = new AudioPlaybackError(
				this.audio?.error?.message || 'Unknown playback error',
				this.currentUrl || undefined
			);

			this.eventHandlers.onError?.(error);
		});

		this.audio.addEventListener('volumechange', () => {
			if (this.audio) {
				this.eventHandlers.onVolumeChange?.(this.audio.volume, this.audio.muted);
			}
		});

		this.audio.addEventListener('ratechange', () => {
			if (this.audio) {
				this.eventHandlers.onRateChange?.(this.audio.playbackRate);
			}
		});

		this.audio.addEventListener('progress', () => {
			if (this.audio && this.audio.buffered.length > 0) {
				const buffered = this.audio.buffered.end(this.audio.buffered.length - 1);
				this.eventHandlers.onProgress?.(buffered);
			}
		});
	}

	/**
	 * Set event handlers
	 */
	setEventHandlers(handlers: PlaybackEventHandlers): void {
		this.eventHandlers = { ...this.eventHandlers, ...handlers };
	}

	/**
	 * Load audio from URL
	 */
	async load(url: string): Promise<void> {
		logger.methodEntry('PlaybackEngine', 'load', url);

		if (!this.audio) {
			throw new AudioPlaybackError('Audio element not initialized');
		}

		try {
			// Stop current playback
			if (this.status === 'playing') {
				this.pause();
			}

			// Load new audio
			this.currentUrl = url;
			this.audio.src = url;
			this.audio.load();

			logger.info('Audio loaded', url);
			logger.methodExit('PlaybackEngine', 'load');
		} catch (error) {
			logger.error('Failed to load audio', error);
			this.status = 'error';
			throw new AudioPlaybackError('Failed to load audio', url, error);
		}
	}

	/**
	 * Play audio
	 */
	async play(): Promise<void> {
		logger.methodEntry('PlaybackEngine', 'play');

		if (!this.audio) {
			throw new AudioPlaybackError('Audio element not initialized');
		}

		if (!this.currentUrl) {
			throw new AudioPlaybackError('No audio loaded');
		}

		try {
			await this.audio.play();
			logger.info('Audio playing');
			logger.methodExit('PlaybackEngine', 'play');
		} catch (error) {
			logger.error('Failed to play audio', error);
			this.status = 'error';
			throw new AudioPlaybackError('Failed to play audio', this.currentUrl, error);
		}
	}

	/**
	 * Pause audio
	 */
	pause(): void {
		logger.methodEntry('PlaybackEngine', 'pause');

		if (!this.audio) {
			throw new AudioPlaybackError('Audio element not initialized');
		}

		this.audio.pause();
		logger.info('Audio paused');
		logger.methodExit('PlaybackEngine', 'pause');
	}

	/**
	 * Stop audio (pause and reset to beginning)
	 */
	stop(): void {
		logger.methodEntry('PlaybackEngine', 'stop');

		if (!this.audio) {
			throw new AudioPlaybackError('Audio element not initialized');
		}

		this.audio.pause();
		this.audio.currentTime = 0;
		this.status = 'idle';
		logger.info('Audio stopped');
		logger.methodExit('PlaybackEngine', 'stop');
	}

	/**
	 * Seek to position (in seconds)
	 */
	seek(position: number): void {
		logger.methodEntry('PlaybackEngine', 'seek', position);

		if (!this.audio) {
			throw new AudioPlaybackError('Audio element not initialized');
		}

		if (isNaN(this.audio.duration)) {
			logger.warn('Cannot seek: duration not available');
			return;
		}

		// Clamp position to valid range
		const clampedPosition = Math.max(0, Math.min(position, this.audio.duration));
		this.audio.currentTime = clampedPosition;

		logger.debug('Seeked to', clampedPosition);
		logger.methodExit('PlaybackEngine', 'seek');
	}

	/**
	 * Set volume (0.0 to 1.0)
	 */
	setVolume(volume: number): void {
		logger.methodEntry('PlaybackEngine', 'setVolume', volume);

		if (!this.audio) {
			throw new AudioPlaybackError('Audio element not initialized');
		}

		const validVolume = validateVolume(volume);
		this.audio.volume = validVolume;

		logger.debug('Volume set to', validVolume);
		logger.methodExit('PlaybackEngine', 'setVolume');
	}

	/**
	 * Set playback rate (speed)
	 */
	setPlaybackRate(rate: number): void {
		logger.methodEntry('PlaybackEngine', 'setPlaybackRate', rate);

		if (!this.audio) {
			throw new AudioPlaybackError('Audio element not initialized');
		}

		const validRate = validatePlaybackSpeed(rate);
		this.audio.playbackRate = validRate;

		logger.debug('Playback rate set to', validRate);
		logger.methodExit('PlaybackEngine', 'setPlaybackRate');
	}

	/**
	 * Set muted state
	 */
	setMuted(muted: boolean): void {
		logger.methodEntry('PlaybackEngine', 'setMuted', muted);

		if (!this.audio) {
			throw new AudioPlaybackError('Audio element not initialized');
		}

		this.audio.muted = muted;

		logger.debug('Muted set to', muted);
		logger.methodExit('PlaybackEngine', 'setMuted');
	}

	/**
	 * Get current playback status
	 */
	getStatus(): PlaybackStatus {
		return this.status;
	}

	/**
	 * Get current audio metadata
	 */
	getMetadata(): AudioMetadata | null {
		if (!this.audio) {
			return null;
		}

		const buffered = this.audio.buffered.length > 0
			? this.audio.buffered.end(this.audio.buffered.length - 1)
			: 0;

		return {
			duration: this.audio.duration || 0,
			currentTime: this.audio.currentTime || 0,
			buffered,
			volume: this.audio.volume,
			playbackRate: this.audio.playbackRate,
			muted: this.audio.muted,
		};
	}

	/**
	 * Get current time
	 */
	getCurrentTime(): number {
		return this.audio?.currentTime || 0;
	}

	/**
	 * Get duration
	 */
	getDuration(): number {
		return this.audio?.duration || 0;
	}

	/**
	 * Get volume
	 */
	getVolume(): number {
		return this.audio?.volume || 1.0;
	}

	/**
	 * Get playback rate
	 */
	getPlaybackRate(): number {
		return this.audio?.playbackRate || 1.0;
	}

	/**
	 * Get muted state
	 */
	isMuted(): boolean {
		return this.audio?.muted || false;
	}

	/**
	 * Check if audio is playing
	 */
	isPlaying(): boolean {
		return this.status === 'playing';
	}

	/**
	 * Check if audio is paused
	 */
	isPaused(): boolean {
		return this.status === 'paused';
	}

	/**
	 * Check if audio is loading
	 */
	isLoading(): boolean {
		return this.status === 'loading';
	}

	/**
	 * Start tracking progress (for periodic updates)
	 */
	private startProgressTracking(): void {
		if (this.progressInterval !== null) {
			return;
		}

		// Update progress every 100ms
		this.progressInterval = window.setInterval(() => {
			if (this.audio && this.status === 'playing') {
				this.eventHandlers.onTimeUpdate?.(this.audio.currentTime);
			}
		}, 100);
	}

	/**
	 * Stop tracking progress
	 */
	private stopProgressTracking(): void {
		if (this.progressInterval !== null) {
			clearInterval(this.progressInterval);
			this.progressInterval = null;
		}
	}

	/**
	 * Cleanup and destroy audio element
	 */
	destroy(): void {
		logger.methodEntry('PlaybackEngine', 'destroy');

		this.stopProgressTracking();

		if (this.audio) {
			this.audio.pause();
			this.audio.src = '';
			this.audio.load();
			this.audio = null;
		}

		this.currentUrl = null;
		this.status = 'idle';
		this.eventHandlers = {};

		logger.info('PlaybackEngine destroyed');
		logger.methodExit('PlaybackEngine', 'destroy');
	}
}
