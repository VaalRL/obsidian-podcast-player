/**
 * PlayerView - Podcast Player UI Component
 *
 * Provides a user interface for podcast playback control.
 * Displays current episode, playback controls, and progress.
 */

import { ItemView, WorkspaceLeaf, setIcon } from 'obsidian';
import type PodcastPlayerPlugin from '../../main';
import { PlaybackState, Queue, Episode } from '../model';
import type { EpisodeWithProgress } from '../podcast';

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

		await this.renderPlayer();

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
	private async renderPlayer(): Promise<void> {
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

		// Queue section
		await this.renderQueueSection(playerContainer);
	}

	/**
	 * Render episode information
	 */
	private renderEpisodeInfo(container: HTMLElement): void {
		const infoSection = container.createDiv({ cls: 'episode-info-section' });

		// Podcast thumbnail
		const thumbnail = infoSection.createEl('img', {
			cls: 'player-podcast-thumbnail',
			attr: { src: '', alt: 'Podcast Artwork' }
		});
		thumbnail.style.display = 'none';

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
		setIcon(prevBtn, 'skip-back');
		prevBtn.addEventListener('click', () => this.handlePrevious());

		// Skip backward button
		const skipBackBtn = controlsSection.createEl('button', {
			cls: 'player-button player-button-skip-back',
			attr: { 'aria-label': 'Skip backward 15s' }
		});
		setIcon(skipBackBtn, 'rewind');
		skipBackBtn.addEventListener('click', () => this.handleSkipBackward());

		// Play/Pause button
		const playPauseBtn = controlsSection.createEl('button', {
			cls: 'player-button player-button-play-pause',
			attr: { 'aria-label': 'Play/Pause' }
		});
		setIcon(playPauseBtn, 'play');
		playPauseBtn.addEventListener('click', () => this.handlePlayPause());

		// Skip forward button
		const skipForwardBtn = controlsSection.createEl('button', {
			cls: 'player-button player-button-skip-forward',
			attr: { 'aria-label': 'Skip forward 30s' }
		});
		setIcon(skipForwardBtn, 'fast-forward');
		skipForwardBtn.addEventListener('click', () => this.handleSkipForward());

		// Next button
		const nextBtn = controlsSection.createEl('button', {
			cls: 'player-button player-button-next',
			attr: { 'aria-label': 'Next episode' }
		});
		setIcon(nextBtn, 'skip-forward');
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
		const volIcon = volumeControl.createSpan({ cls: 'volume-icon' });
		setIcon(volIcon, 'volume-2');
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
		console.log('PlayerView: Play/Pause clicked');
		try {
			if (!this.plugin) {
				console.error('PlayerView: Plugin instance is missing');
				return;
			}
			if (!this.plugin.playerController) {
				console.error('PlayerView: PlayerController is missing');
				return;
			}

			const playerController = this.plugin.playerController;
			const state = playerController.getState();
			console.log('PlayerView: Current state', state);

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
			const thumbnailEl = this.playerContentEl.querySelector('.player-podcast-thumbnail') as HTMLImageElement;

			if (state.currentEpisode) {
				if (titleEl) titleEl.textContent = state.currentEpisode.title;
				if (durationEl) durationEl.textContent = this.formatTime(state.currentEpisode.duration);

				// Update thumbnail and podcast title
				const podcastId = state.currentEpisode.podcastId;
				if (podcastId) {
					this.plugin.getSubscriptionStore().getPodcast(podcastId).then(podcast => {
						if (podcast) {
							if (podcastEl) podcastEl.textContent = podcast.title;
							if (thumbnailEl && podcast.imageUrl) {
								thumbnailEl.src = podcast.imageUrl;
								thumbnailEl.style.display = 'block';
							} else if (thumbnailEl) {
								thumbnailEl.style.display = 'none';
							}
						}
					});
				} else {
					if (podcastEl) podcastEl.textContent = 'Unknown Podcast';
					if (thumbnailEl) thumbnailEl.style.display = 'none';
				}
			} else {
				if (titleEl) titleEl.textContent = 'No episode playing';
				if (podcastEl) podcastEl.textContent = 'Select a podcast to start';
				if (durationEl) durationEl.textContent = '--:--';
				if (thumbnailEl) thumbnailEl.style.display = 'none';
			}

			// Update play/pause button
			// Update play/pause button
			const playPauseBtn = this.playerContentEl.querySelector('.player-button-play-pause') as HTMLElement;
			if (playPauseBtn) {
				setIcon(playPauseBtn, state.status === 'playing' ? 'pause' : 'play');
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

	/**
	 * Render current queue section
	 */
	private async renderQueueSection(container: HTMLElement): Promise<void> {
		const queueSection = container.createDiv({ cls: 'queue-section' });

		// Section header
		const header = queueSection.createDiv({ cls: 'queue-header' });
		header.createEl('h3', { text: 'Current Queue', cls: 'queue-title' });

		try {
			// Get current queue
			const queue = await this.getCurrentQueue();

			if (!queue || queue.episodeIds.length === 0) {
				const emptyState = queueSection.createDiv({ cls: 'queue-empty-state' });
				emptyState.createEl('p', { text: 'No queue active' });
				emptyState.createEl('p', {
					text: 'Add episodes to queue to see them here',
					cls: 'queue-empty-hint'
				});
				return;
			}

			// Episode list (removed shuffle and repeat controls)
			await this.renderQueueEpisodeList(queueSection, queue);

		} catch (error) {
			console.error('Failed to render queue section:', error);
			const errorState = queueSection.createDiv({ cls: 'queue-error-state' });
			errorState.createEl('p', { text: 'Failed to load queue' });
		}
	}

	/**
	 * Get the current queue
	 */
	private async getCurrentQueue(): Promise<Queue | null> {
		try {
			const queueManager = this.plugin.getQueueManager();

			// Try to get queue from current queue ID
			if (this.currentQueueId) {
				const queue = await queueManager.getQueue(this.currentQueueId);
				if (queue) return queue;
			}

			// Otherwise, get the first available queue (or default queue)
			const allQueues = await queueManager.getAllQueues();
			if (allQueues.length > 0) {
				this.currentQueueId = allQueues[0].id;
				return allQueues[0];
			}

			return null;
		} catch (error) {
			console.error('Failed to get current queue:', error);
			return null;
		}
	}

	/**
	 * Render queue episode list
	 */
	private async renderQueueEpisodeList(container: HTMLElement, queue: Queue): Promise<void> {
		const listContainer = container.createDiv({ cls: 'queue-episode-list' });

		if (queue.episodeIds.length === 0) {
			listContainer.createEl('p', {
				text: 'Queue is empty',
				cls: 'queue-empty-text'
			});
			return;
		}

		const episodeManager = this.plugin.getEpisodeManager();

		// Info bar
		const info = listContainer.createDiv({ cls: 'queue-info' });
		info.createSpan({
			text: `${queue.episodeIds.length} episodes`,
			cls: 'queue-count'
		});
		info.createSpan({
			text: ` • Current: ${queue.currentIndex + 1}`,
			cls: 'queue-current'
		});

		// Episodes
		const episodesContainer = listContainer.createDiv({ cls: 'queue-episodes' });

		for (let i = 0; i < Math.min(queue.episodeIds.length, 10); i++) {
			const episodeId = queue.episodeIds[i];
			try {
				const episode = await episodeManager.getEpisodeWithProgress(episodeId);
				if (episode) {
					this.renderQueueEpisodeItem(episodesContainer, episode, i, queue.currentIndex === i);
				}
			} catch (error) {
				console.error(`Failed to load episode: ${episodeId}`, error);
			}
		}

		// Show "more" indicator if queue is longer
		if (queue.episodeIds.length > 10) {
			const more = episodesContainer.createDiv({ cls: 'queue-more' });
			more.createEl('span', {
				text: `+ ${queue.episodeIds.length - 10} more episodes`,
				cls: 'queue-more-text'
			});
		}
	}

	/**
	 * Render a queue episode item
	 */
	private renderQueueEpisodeItem(
		container: HTMLElement,
		episode: EpisodeWithProgress,
		index: number,
		isCurrent: boolean
	): void {
		const item = container.createDiv({
			cls: isCurrent ? 'queue-episode-item current' : 'queue-episode-item'
		});

		// Index
		const indexEl = item.createDiv({ cls: 'queue-episode-index' });
		indexEl.textContent = `${index + 1}`;
		if (isCurrent) {
			indexEl.empty();
			setIcon(indexEl, 'play');
		}

		// Info
		const info = item.createDiv({ cls: 'queue-episode-info' });

		const title = info.createEl('div', {
			text: episode.title,
			cls: 'queue-episode-title'
		});

		// Truncate long titles
		if (episode.title.length > 40) {
			title.textContent = episode.title.substring(0, 40) + '...';
			title.setAttribute('title', episode.title);
		}

		// Duration
		if (episode.duration) {
			info.createEl('div', {
				text: this.formatDuration(episode.duration),
				cls: 'queue-episode-duration'
			});
		}

		// Click to play
		item.addEventListener('click', async () => {
			try {
				const queueManager = this.plugin.getQueueManager();
				if (this.currentQueueId) {
					// Jump to this episode in the queue
					await queueManager.jumpTo(this.currentQueueId, index);

					// Load and play the episode
					await this.plugin.playerController.loadEpisode(episode, true, true);

					// Refresh UI
					await this.renderPlayer();
				}
			} catch (error) {
				console.error('Failed to play episode from queue:', error);
			}
		});
	}

	/**
	 * Format repeat mode
	 */
	private formatRepeatMode(mode: 'none' | 'one' | 'all'): string {
		switch (mode) {
			case 'none': return 'Off';
			case 'one': return 'One';
			case 'all': return 'All';
		}
	}

	/**
	 * Format duration in seconds to human-readable string
	 */
	private formatDuration(seconds: number): string {
		const hours = Math.floor(seconds / 3600);
		const minutes = Math.floor((seconds % 3600) / 60);

		if (hours > 0) {
			return `${hours}h ${minutes}m`;
		} else {
			return `${minutes}m`;
		}
	}
}
