/**
 * PlayerView - Podcast Player UI Component
 *
 * Provides a user interface for podcast playback control.
 * Displays current episode, playback controls, and progress.
 */

import { ItemView, WorkspaceLeaf } from 'obsidian';
import type PodcastPlayerPlugin from '../../main';
import { PlaybackState } from '../model';

export const PLAYER_VIEW_TYPE = 'podcast-player-view';

/**
 * PlayerView - Main player control UI
 */
export class PlayerView extends ItemView {
	plugin: PodcastPlayerPlugin;
	private playerContentEl: HTMLElement;
	private updateInterval: number | null = null;
	private currentQueueId: string | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: PodcastPlayerPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	/**
	 * Get the view type identifier
	 */
	getViewType(): string {
		return PLAYER_VIEW_TYPE;
	}

	/**
	 * Get the display text for the view
	 */
	getDisplayText(): string {
		return 'Podcast Player';
	}

	/**
	 * Get the icon for the view
	 */
	getIcon(): string {
		return 'podcast';
	}

	/**
	 * Called when the view is opened
	 */
	async onOpen() {
		const container = this.containerEl.children[1];
		container.empty();
		container.addClass('podcast-player-view');

		this.playerContentEl = container.createDiv({ cls: 'podcast-player-content' });

		this.renderPlayer();

		// Start periodic UI updates
		this.startUpdateInterval();
	}

	/**
	 * Called when the view is closed
	 */
	async onClose() {
		this.stopUpdateInterval();
	}

	/**
	 * Render the player UI
	 */
	private renderPlayer(): void {
		this.playerContentEl.empty();

		// Player container
		const playerContainer = this.playerContentEl.createDiv({ cls: 'player-container' });

		// Episode info section
		this.renderEpisodeInfo(playerContainer);

		// Playback controls section
		this.renderPlaybackControls(playerContainer);

		// Progress section
		this.renderProgressSection(playerContainer);

		// Advanced controls section
		this.renderAdvancedControls(playerContainer);
	}

	/**
	 * Render episode information
	 */
	private renderEpisodeInfo(container: HTMLElement): void {
		const infoSection = container.createDiv({ cls: 'episode-info-section' });

		// Placeholder for now - will integrate with PlayerController later
		const title = infoSection.createEl('h3', {
			text: 'No episode playing',
			cls: 'episode-title'
		});

		const podcast = infoSection.createEl('p', {
			text: 'Select a podcast to start',
			cls: 'podcast-name'
		});

		const metadata = infoSection.createDiv({ cls: 'episode-metadata' });
		metadata.createSpan({ text: '--:--', cls: 'episode-duration' });
	}

	/**
	 * Render playback controls (play/pause, skip, etc.)
	 */
	private renderPlaybackControls(container: HTMLElement): void {
		const controlsSection = container.createDiv({ cls: 'playback-controls-section' });

		// Previous button
		const prevBtn = controlsSection.createEl('button', {
			cls: 'player-button player-button-prev',
			attr: { 'aria-label': 'Previous episode' }
		});
		prevBtn.innerHTML = '⏮';
		prevBtn.addEventListener('click', () => this.handlePrevious());

		// Skip backward button
		const skipBackBtn = controlsSection.createEl('button', {
			cls: 'player-button player-button-skip-back',
			attr: { 'aria-label': 'Skip backward 15s' }
		});
		skipBackBtn.innerHTML = '⏪';
		skipBackBtn.addEventListener('click', () => this.handleSkipBackward());

		// Play/Pause button
		const playPauseBtn = controlsSection.createEl('button', {
			cls: 'player-button player-button-play-pause',
			attr: { 'aria-label': 'Play/Pause' }
		});
		playPauseBtn.innerHTML = '▶️';
		playPauseBtn.addEventListener('click', () => this.handlePlayPause());

		// Skip forward button
		const skipForwardBtn = controlsSection.createEl('button', {
			cls: 'player-button player-button-skip-forward',
			attr: { 'aria-label': 'Skip forward 30s' }
		});
		skipForwardBtn.innerHTML = '⏩';
		skipForwardBtn.addEventListener('click', () => this.handleSkipForward());

		// Next button
		const nextBtn = controlsSection.createEl('button', {
			cls: 'player-button player-button-next',
			attr: { 'aria-label': 'Next episode' }
		});
		nextBtn.innerHTML = '⏭';
		nextBtn.addEventListener('click', () => this.handleNext());
	}

	/**
	 * Render progress section (progress bar and time)
	 */
	private renderProgressSection(container: HTMLElement): void {
		const progressSection = container.createDiv({ cls: 'progress-section' });

		// Time display
		const timeDisplay = progressSection.createDiv({ cls: 'time-display' });
		timeDisplay.createSpan({ text: '0:00', cls: 'current-time' });
		timeDisplay.createSpan({ text: ' / ', cls: 'time-separator' });
		timeDisplay.createSpan({ text: '0:00', cls: 'total-time' });

		// Progress bar container
		const progressBarContainer = progressSection.createDiv({ cls: 'progress-bar-container' });
		const progressBar = progressBarContainer.createDiv({ cls: 'progress-bar' });
		const progressFill = progressBar.createDiv({ cls: 'progress-fill' });
		progressFill.style.width = '0%';

		// Make progress bar clickable for seeking
		progressBar.addEventListener('click', (e) => this.handleSeek(e, progressBar));
	}

	/**
	 * Render advanced controls (volume, speed)
	 */
	private renderAdvancedControls(container: HTMLElement): void {
		const advancedSection = container.createDiv({ cls: 'advanced-controls-section' });

		// Volume control
		const volumeControl = advancedSection.createDiv({ cls: 'volume-control' });
		volumeControl.createSpan({ text: '🔊', cls: 'volume-icon' });
		const volumeSlider = volumeControl.createEl('input', {
			type: 'range',
			cls: 'volume-slider',
			attr: {
				min: '0',
				max: '100',
				value: '100'
			}
		});
		volumeSlider.addEventListener('input', (e) => {
			const target = e.target as HTMLInputElement;
			this.handleVolumeChange(parseInt(target.value));
		});

		// Speed control
		const speedControl = advancedSection.createDiv({ cls: 'speed-control' });
		speedControl.createSpan({ text: 'Speed:', cls: 'speed-label' });
		const speedBtn = speedControl.createEl('button', {
			text: '1.0x',
			cls: 'speed-button'
		});
		speedBtn.addEventListener('click', () => this.handleSpeedChange());
	}

	/**
	 * Handle play/pause button click
	 */
	private async handlePlayPause(): Promise<void> {
		try {
			const playerController = this.plugin.playerController;
			const state = playerController.getState();

			if (state.status === 'playing') {
				await playerController.pause();
			} else if (state.status === 'paused' || state.status === 'stopped') {
				await playerController.play();
			}
		} catch (error) {
			console.error('Failed to toggle playback:', error);
		}
	}

	/**
	 * Handle previous episode button click
	 */
	private async handlePrevious(): Promise<void> {
		try {
			if (!this.currentQueueId) {
				console.log('No queue selected');
				return;
			}

			const queueManager = this.plugin.getQueueManager();
			const previousEpisodeId = await queueManager.previous(this.currentQueueId);

			if (previousEpisodeId) {
				// Load the episode from subscription store
				await this.loadEpisodeById(previousEpisodeId);
			}
		} catch (error) {
			console.error('Failed to go to previous episode:', error);
		}
	}

	/**
	 * Handle next episode button click
	 */
	private async handleNext(): Promise<void> {
		try {
			if (!this.currentQueueId) {
				console.log('No queue selected');
				return;
			}

			const queueManager = this.plugin.getQueueManager();
			const nextEpisodeId = await queueManager.next(this.currentQueueId);

			if (nextEpisodeId) {
				// Load the episode from subscription store
				await this.loadEpisodeById(nextEpisodeId);
			}
		} catch (error) {
			console.error('Failed to go to next episode:', error);
		}
	}

	/**
	 * Load episode by ID and start playing
	 */
	private async loadEpisodeById(episodeId: string): Promise<void> {
		try {
			const episodeManager = this.plugin.getEpisodeManager();
			const episodeWithProgress = await episodeManager.getEpisodeWithProgress(episodeId);

			if (episodeWithProgress) {
				const playerController = this.plugin.playerController;
				// EpisodeWithProgress extends Episode, so we can use it directly
				await playerController.loadEpisode(episodeWithProgress, true, true);
			}
		} catch (error) {
			console.error('Failed to load episode:', error);
		}
	}

	/**
	 * Handle skip backward button click (15 seconds)
	 */
	private async handleSkipBackward(): Promise<void> {
		try {
			const playerController = this.plugin.playerController;
			await playerController.skipBackward(15);
		} catch (error) {
			console.error('Failed to skip backward:', error);
		}
	}

	/**
	 * Handle skip forward button click (30 seconds)
	 */
	private async handleSkipForward(): Promise<void> {
		try {
			const playerController = this.plugin.playerController;
			await playerController.skipForward(30);
		} catch (error) {
			console.error('Failed to skip forward:', error);
		}
	}

	/**
	 * Handle seek bar click
	 */
	private async handleSeek(event: MouseEvent, progressBar: HTMLElement): Promise<void> {
		try {
			const playerController = this.plugin.playerController;
			const state = playerController.getState();

			if (!state.currentEpisode) {
				return;
			}

			const rect = progressBar.getBoundingClientRect();
			const clickX = event.clientX - rect.left;
			const percentage = clickX / rect.width;

			// Calculate target position in seconds
			const duration = state.currentEpisode.duration;
			const targetPosition = duration * percentage;

			await playerController.seek(targetPosition);
		} catch (error) {
			console.error('Failed to seek:', error);
		}
	}

	/**
	 * Handle volume change
	 */
	private async handleVolumeChange(volume: number): Promise<void> {
		try {
			const playerController = this.plugin.playerController;
			// Convert percentage (0-100) to decimal (0-1)
			await playerController.setVolume(volume / 100);
		} catch (error) {
			console.error('Failed to change volume:', error);
		}
	}

	/**
	 * Handle speed change (cycle through speeds)
	 */
	private async handleSpeedChange(): Promise<void> {
		try {
			const playerController = this.plugin.playerController;
			const state = playerController.getState();
			const currentSpeed = state.playbackSpeed;

			// Cycle through common speeds: 1.0x → 1.25x → 1.5x → 2.0x → 1.0x
			const speeds = [1.0, 1.25, 1.5, 2.0];
			const currentIndex = speeds.indexOf(currentSpeed);
			const nextIndex = (currentIndex + 1) % speeds.length;
			const nextSpeed = speeds[nextIndex];

			await playerController.setPlaybackSpeed(nextSpeed);
		} catch (error) {
			console.error('Failed to change playback speed:', error);
		}
	}

	/**
	 * Start the update interval for UI refresh
	 */
	private startUpdateInterval(): void {
		// Update UI every second
		this.updateInterval = window.setInterval(() => {
			this.updatePlayerState();
		}, 1000);
	}

	/**
	 * Stop the update interval
	 */
	private stopUpdateInterval(): void {
		if (this.updateInterval !== null) {
			window.clearInterval(this.updateInterval);
			this.updateInterval = null;
		}
	}

	/**
	 * Update the player state in the UI
	 * This will be called periodically to keep the UI in sync
	 */
	private updatePlayerState(): void {
		try {
			const playerController = this.plugin.playerController;
			const state = playerController.getState();

			// Update episode info
			const titleEl = this.playerContentEl.querySelector('.episode-title') as HTMLElement;
			const podcastEl = this.playerContentEl.querySelector('.podcast-name') as HTMLElement;
			const durationEl = this.playerContentEl.querySelector('.episode-duration') as HTMLElement;

			if (state.currentEpisode) {
				if (titleEl) titleEl.textContent = state.currentEpisode.title;
				if (podcastEl) podcastEl.textContent = 'Playing...';
				if (durationEl) durationEl.textContent = this.formatTime(state.currentEpisode.duration);
			} else {
				if (titleEl) titleEl.textContent = 'No episode playing';
				if (podcastEl) podcastEl.textContent = 'Select a podcast to start';
				if (durationEl) durationEl.textContent = '--:--';
			}

			// Update play/pause button
			const playPauseBtn = this.playerContentEl.querySelector('.player-button-play-pause') as HTMLElement;
			if (playPauseBtn) {
				playPauseBtn.innerHTML = state.status === 'playing' ? '⏸' : '▶️';
			}

			// Update time display
			const currentTimeEl = this.playerContentEl.querySelector('.current-time') as HTMLElement;
			const totalTimeEl = this.playerContentEl.querySelector('.total-time') as HTMLElement;

			if (currentTimeEl) currentTimeEl.textContent = this.formatTime(state.position);
			if (totalTimeEl && state.currentEpisode) {
				totalTimeEl.textContent = this.formatTime(state.currentEpisode.duration);
			}

			// Update progress bar
			const progressFill = this.playerContentEl.querySelector('.progress-fill') as HTMLElement;
			if (progressFill && state.currentEpisode) {
				const percentage = (state.position / state.currentEpisode.duration) * 100;
				progressFill.style.width = `${percentage}%`;
			}

			// Update volume slider
			const volumeSlider = this.playerContentEl.querySelector('.volume-slider') as HTMLInputElement;
			if (volumeSlider) {
				volumeSlider.value = String(state.volume * 100);
			}

			// Update speed button
			const speedBtn = this.playerContentEl.querySelector('.speed-button') as HTMLElement;
			if (speedBtn) {
				speedBtn.textContent = `${state.playbackSpeed.toFixed(2)}x`;
			}
		} catch (error) {
			console.error('Failed to update player state:', error);
		}
	}

	/**
	 * Format seconds to MM:SS or HH:MM:SS
	 */
	private formatTime(seconds: number): string {
		const hours = Math.floor(seconds / 3600);
		const minutes = Math.floor((seconds % 3600) / 60);
		const secs = Math.floor(seconds % 60);

		if (hours > 0) {
			return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
		} else {
			return `${minutes}:${secs.toString().padStart(2, '0')}`;
		}
	}
}
