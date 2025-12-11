/**
 * PlayerView - Podcast Player UI Component
 *
 * Provides a user interface for podcast playback control.
 * Displays current episode, playback controls, and progress.
 */

import { ItemView, WorkspaceLeaf, setIcon, Notice, Events } from 'obsidian';
import type PodcastPlayerPlugin from '../../main';
import { Queue, Playlist } from '../model';
import type { EpisodeWithProgress } from '../podcast';
import { EpisodeDetailModal } from './EpisodeDetailModal';
import { AddNoteModal } from './AddNoteModal';
import { logger } from '../utils/Logger';

export const PLAYER_VIEW_TYPE = 'podcast-player-view';

// Type-safe event registration helper
type PodcastEvents = Events & {
	on(name: 'podcast:queue-updated', callback: (queueId: string) => void): ReturnType<Events['on']>;
	on(name: 'podcast:player-state-updated', callback: () => void): ReturnType<Events['on']>;
	on(name: 'podcast:episode-changed', callback: () => void): ReturnType<Events['on']>;
	on(name: 'podcast:playlist-updated', callback: (playlistId: string) => void): ReturnType<Events['on']>;
	on(name: 'podcast:queue-changed', callback: () => void): ReturnType<Events['on']>;
};

/**
 * PlayerView - Main player control UI
 */
export class PlayerView extends ItemView {
	plugin: PodcastPlayerPlugin;
	private playerContentEl: HTMLElement;
	private updateInterval: number | null = null;
	private currentQueueId: string | null = null;
	private isDraggingProgress: boolean = false;
	private lastPlaylistStateKey: string = 'queue';

	constructor(leaf: WorkspaceLeaf, plugin: PodcastPlayerPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	private lastQueueEpisodeIds: string[] = [];

	onload() {
		super.onload();

		// Listen for queue updates
		this.registerEvent(
			(this.app.workspace as unknown as PodcastEvents).on('podcast:queue-updated', (queueId: string) => {
				void (async () => {
					// If current queue is updated
					const currentQueue = await this.plugin.getQueueManager().getCurrentQueue();

					if (currentQueue && currentQueue.id === queueId) {
						// Check if episodes list actually changed
						const idsChanged = JSON.stringify(currentQueue.episodeIds) !== JSON.stringify(this.lastQueueEpisodeIds);

						if (idsChanged) {
							// Content changed - full re-render
							this.lastQueueEpisodeIds = [...currentQueue.episodeIds];
							await this.renderPlayer();
						} else {
							// Only index/meta changed - just update icons to reflect new current index
							this.updatePlayState();
						}
					}
				})();
			})
		);

		this.registerEvent(
			(this.app.workspace as unknown as PodcastEvents).on('podcast:player-state-updated', () => this.updatePlayState())
		);

		this.registerEvent(
			(this.app.workspace as unknown as PodcastEvents).on('podcast:episode-changed', () => this.updatePlayState())
		);
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
		return 'Podcast player';
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
	async onOpen(): Promise<void> {
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
	 * Note: async is required to match ItemView.onClose() signature even without await
	 */
	// eslint-disable-next-line @typescript-eslint/require-await
	async onClose(): Promise<void> {
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

		// Update UI initially
		void this.updatePlayerState();

		// Title container with info button
		const titleContainer = infoSection.createDiv({ cls: 'episode-title-container' });

		titleContainer.createEl('h3', {
			text: 'No episode playing',
			cls: 'episode-title'
		});

		// Info button to view episode details
		const infoBtn = titleContainer.createEl('button', {
			cls: 'player-info-button clickable-icon podcast-display-none',
			attr: { 'aria-label': 'View episode details' }
		});
		setIcon(infoBtn, 'info');
		infoBtn.addEventListener('click', () => this.handleShowEpisodeDetails());

		infoSection.createEl('p', {
			text: 'Select a podcast to start',
			cls: 'podcast-name'
		});

		const metadata = infoSection.createDiv({ cls: 'episode-metadata' });
		metadata.createSpan({ text: '--:--', cls: 'episode-duration' });
	}

	/**
	 * Handle showing episode details modal
	 */
	private handleShowEpisodeDetails(): void {
		const playerController = this.plugin.playerController;
		const currentEpisode = playerController.getCurrentEpisode();

		if (currentEpisode) {
			new EpisodeDetailModal(this.app, this.plugin, currentEpisode).open();
		}
	}

	/**
	 * Render playback controls (play/pause, skip, etc.)
	 */
	private renderPlaybackControls(container: HTMLElement): void {
		const controlsSection = container.createDiv({ cls: 'playback-controls-section' });

		// Previous button
		const prevBtn = controlsSection.createEl('button', {
			cls: 'player-button player-button-prev clickable-icon',
			attr: { 'aria-label': 'Previous episode' }
		});
		setIcon(prevBtn, 'skip-back');
		prevBtn.addEventListener('click', () => void this.handlePrevious());

		// Skip backward button
		const skipBackBtn = controlsSection.createEl('button', {
			cls: 'player-button player-button-skip-back clickable-icon',
			attr: { 'aria-label': 'Skip backward 15s' }
		});
		setIcon(skipBackBtn, 'rewind');
		skipBackBtn.addEventListener('click', () => void this.handleSkipBackward());

		// Play/Pause button
		const playPauseBtn = controlsSection.createEl('button', {
			cls: 'player-button player-button-play-pause clickable-icon',
			attr: { 'aria-label': 'Play/pause' }
		});
		setIcon(playPauseBtn, 'play');
		playPauseBtn.addEventListener('click', () => void this.handlePlayPause());

		// Skip forward button
		const skipForwardBtn = controlsSection.createEl('button', {
			cls: 'player-button player-button-skip-forward clickable-icon',
			attr: { 'aria-label': 'Skip forward 30s' }
		});
		setIcon(skipForwardBtn, 'fast-forward');
		skipForwardBtn.addEventListener('click', () => void this.handleSkipForward());

		// Next button
		const nextBtn = controlsSection.createEl('button', {
			cls: 'player-button player-button-next clickable-icon',
			attr: { 'aria-label': 'Next episode' }
		});
		setIcon(nextBtn, 'skip-forward');
		nextBtn.addEventListener('click', () => void this.handleNext());

		// Add to Note button
		const addNoteBtn = controlsSection.createEl('button', {
			cls: 'player-button player-button-add-note clickable-icon',
			attr: { 'aria-label': 'Add note to daily note' }
		});
		setIcon(addNoteBtn, 'file-plus');
		addNoteBtn.addEventListener('click', () => void this.handleAddNote());
	}


	/**
	 * Render progress section (progress bar and time)
	 */
	private renderProgressSection(container: HTMLElement): void {
		const progressSection = container.createDiv({ cls: 'progress-section' });

		// Current time (Start)
		progressSection.createSpan({ text: '0:00', cls: 'current-time' });

		// Progress bar container
		const progressBarContainer = progressSection.createDiv({ cls: 'progress-bar-container' });
		progressBarContainer.setAttribute('tabindex', '0'); // Make focusable
		progressBarContainer.setAttribute('aria-label', 'Seek slider');
		progressBarContainer.setAttribute('role', 'slider');

		const progressBar = progressBarContainer.createDiv({ cls: 'progress-bar' });
		progressBar.createDiv({ cls: 'progress-fill podcast-progress-width-0' });

		// Thumb element for precise positioning
		progressBar.createDiv({ cls: 'progress-bar-thumb podcast-progress-left-0' });

		// Tooltip
		const tooltip = progressBarContainer.createDiv({ cls: 'progress-tooltip' });
		tooltip.textContent = '0:00';

		// Make progress bar draggable and clickable
		progressBarContainer.addEventListener('mousedown', (e) => {
			e.preventDefault(); // Prevent text selection
			progressBarContainer.focus(); // Ensure focus for keyboard controls

			const playerController = this.plugin.playerController;
			const state = playerController.getState();
			if (!state.currentEpisode) return;

			this.isDraggingProgress = true;
			const duration = state.currentEpisode.duration;

			const updateUI = (evt: MouseEvent) => {
				const rect = progressBarContainer.getBoundingClientRect();
				const clickX = evt.clientX - rect.left;
				const percentage = Math.max(0, Math.min(1, clickX / rect.width));

				// Update UI
				const progressFill = progressBarContainer.querySelector('.progress-fill') as HTMLElement;
				const progressThumb = progressBarContainer.querySelector('.progress-bar-thumb') as HTMLElement;
				const currentTimeEl = this.playerContentEl.querySelector('.current-time') as HTMLElement;

				if (progressFill) progressFill.setCssProps({ 'width': `${percentage * 100}%` });
				if (progressThumb) progressThumb.setCssProps({ 'left': `${percentage * 100}%` });
				if (currentTimeEl) currentTimeEl.textContent = this.formatTime(duration * percentage);

				return percentage;
			};

			// Initial update on mousedown
			let finalPercentage = updateUI(e);

			const onMouseMove = (moveEvent: MouseEvent) => {
				if (this.isDraggingProgress) {
					finalPercentage = updateUI(moveEvent);
				}
			};

			const onMouseUp = () => {
				this.isDraggingProgress = false;
				document.removeEventListener('mousemove', onMouseMove);
				document.removeEventListener('mouseup', onMouseUp);

				// Commit seek
				playerController.seek(duration * finalPercentage);
			};

			document.addEventListener('mousemove', onMouseMove);
			document.addEventListener('mouseup', onMouseUp);
		});

		// Keyboard controls
		progressBarContainer.addEventListener('keydown', (e) => {
			const playerController = this.plugin.playerController;
			const state = playerController.getState();
			if (!state.currentEpisode) return;

			const duration = state.currentEpisode.duration;
			const currentPosition = state.position;
			let newPosition = currentPosition;

			switch (e.key) {
				case 'ArrowLeft':
					e.preventDefault();
					newPosition = Math.max(0, currentPosition - 5); // Seek back 5s
					break;
				case 'ArrowRight':
					e.preventDefault();
					newPosition = Math.min(duration, currentPosition + 5); // Seek forward 5s
					break;
				case 'Home':
					e.preventDefault();
					newPosition = 0;
					break;
				case 'End':
					e.preventDefault();
					newPosition = duration;
					break;
				default:
					return;
			}

			playerController.seek(newPosition);
		});

		// Tooltip behavior
		progressBarContainer.addEventListener('mousemove', (e) => {
			const playerController = this.plugin.playerController;
			const state = playerController.getState();
			if (!state.currentEpisode) return;

			const rect = progressBarContainer.getBoundingClientRect();
			const hoverX = e.clientX - rect.left;
			const percentage = Math.max(0, Math.min(1, hoverX / rect.width));
			const duration = state.currentEpisode.duration;

			tooltip.textContent = this.formatTime(duration * percentage);
			tooltip.setCssProps({ 'left': `${percentage * 100}%` });
		});

		// Total time (End)
		progressSection.createSpan({ text: '0:00', cls: 'total-time' });
	}

	/**
	 * Render advanced controls (volume, speed)
	 */
	private renderAdvancedControls(container: HTMLElement): void {
		const advancedSection = container.createDiv({ cls: 'advanced-controls-section' });

		// Volume control
		const volumeControl = advancedSection.createDiv({ cls: 'control-group volume-control' });
		const volIcon = volumeControl.createSpan({ cls: 'control-icon volume-icon' });
		setIcon(volIcon, 'volume-2');

		const volumeSlider = volumeControl.createEl('input', {
			type: 'range',
			cls: 'control-slider volume-slider',
			attr: {
				min: '0',
				max: '100',
				value: '100',
				title: 'Volume'
			}
		});

		const volumeLabel = volumeControl.createSpan({ cls: 'control-value-label volume-value', text: '100' });

		volumeSlider.addEventListener('input', (e) => {
			const target = e.target as HTMLInputElement;
			const volume = parseInt(target.value);
			volumeLabel.textContent = String(volume);
			void this.handleVolumeChange(volume);
		});

		// Speed control
		const speedControl = advancedSection.createDiv({ cls: 'control-group speed-control' });
		const speedIcon = speedControl.createSpan({ cls: 'control-icon speed-icon' });
		setIcon(speedIcon, 'zap'); // Use a suitable icon for speed

		const speedSlider = speedControl.createEl('input', {
			type: 'range',
			cls: 'control-slider speed-slider',
			attr: {
				min: '0.5',
				max: '3.0',
				step: '0.1',
				value: '1.0',
				title: 'Playback speed'
			}
		});

		const speedLabel = speedControl.createSpan({ cls: 'control-value-label speed-value', text: '1.0x' });

		speedSlider.addEventListener('input', (e) => {
			const target = e.target as HTMLInputElement;
			const speed = parseFloat(target.value);
			speedLabel.textContent = `${speed.toFixed(1)}x`;
			void this.handleSpeedChange(speed);
		});
	}

	/**
	 * Handle play/pause button click
	 */
	private async handlePlayPause(): Promise<void> {

		try {
			if (!this.plugin) {
				logger.error('PlayerView: Plugin instance is missing');
				return;
			}
			if (!this.plugin.playerController) {
				logger.error('PlayerView: PlayerController is missing');
				return;
			}

			const playerController = this.plugin.playerController;
			const state = playerController.getState();


			if (state.status === 'playing') {
				void playerController.pause();
			} else if (state.status === 'paused') {
				void playerController.play();
			} else if (state.status === 'stopped' && !state.currentEpisode) {
				// No episode loaded - try to play from first queue's first episode
				await this.playFromFirstQueue();
			} else if (state.status === 'stopped') {
				void playerController.play();
			}
		} catch (error) {
			logger.error('Failed to toggle playback', error);
		}
	}

	/**
	 * Try to play from the first queue's first episode
	 */
	private async playFromFirstQueue(): Promise<void> {
		try {
			const queueManager = this.plugin.getQueueManager();
			const allQueues = await queueManager.getAllQueues();

			if (allQueues.length === 0) {

				return;
			}

			// Find the first queue with episodes
			for (const queue of allQueues) {
				if (queue.episodeIds.length > 0) {
					const firstEpisodeId = queue.episodeIds[0];

					// Set this queue as current
					queueManager.setCurrentQueue(queue.id);
					await queueManager.jumpTo(queue.id, 0);
					this.currentQueueId = queue.id;

					// Load and play the episode
					await this.loadEpisodeById(firstEpisodeId);
					return;
				}
			}


		} catch (error) {
			logger.error('Failed to play from first queue', error);
		}
	}

	/**
	 * Handle previous episode button click
	 */
	private async handlePrevious(): Promise<void> {
		try {
			const playerController = this.plugin.playerController;

			// Check if playing from playlist first
			if (playerController.isPlayingFromPlaylist()) {
				const previousEpisodeId = playerController.getPreviousPlaylistEpisodeId();
				if (previousEpisodeId) {
					await this.loadEpisodeById(previousEpisodeId);
				}
				return;
			}

			// Fallback to queue navigation
			if (!this.currentQueueId) {

				return;
			}

			const queueManager = this.plugin.getQueueManager();
			const previousEpisodeId = await queueManager.previous(this.currentQueueId);

			if (previousEpisodeId) {
				// Load the episode from subscription store
				await this.loadEpisodeById(previousEpisodeId);
			}
		} catch (error) {
			logger.error('Failed to go to previous episode', error);
		}
	}

	/**
	 * Handle next episode button click
	 */
	private async handleNext(): Promise<void> {
		try {
			const playerController = this.plugin.playerController;

			// Check if playing from playlist first
			if (playerController.isPlayingFromPlaylist()) {
				const nextEpisodeId = playerController.getNextPlaylistEpisodeId();
				if (nextEpisodeId) {
					await this.loadEpisodeById(nextEpisodeId);
				}
				return;
			}

			// Fallback to queue navigation
			if (!this.currentQueueId) {

				return;
			}

			const queueManager = this.plugin.getQueueManager();
			const nextEpisodeId = await queueManager.next(this.currentQueueId);

			if (nextEpisodeId) {
				// Load the episode from subscription store
				await this.loadEpisodeById(nextEpisodeId);
			}
		} catch (error) {
			logger.error('Failed to go to next episode', error);
		}
	}

	/**
	 * Handle add note button click
	 */
	private async handleAddNote(): Promise<void> {
		const playerController = this.plugin.playerController;
		const currentEpisode = playerController.getCurrentEpisode();

		if (!currentEpisode) {
			new Notice('No episode is currently playing');
			return;
		}

		// Get current playback position
		const currentPosition = playerController.getCurrentPosition();

		// Get podcast info
		let podcast = null;
		try {
			podcast = await this.plugin.getSubscriptionStore().getPodcast(currentEpisode.podcastId);
		} catch (error) {
			logger.error('Failed to get podcast info', error);
		}

		// Open the add note modal
		new AddNoteModal(
			this.app,
			this.plugin,
			currentEpisode,
			podcast,
			currentPosition,
			(note: string) => {

			}
		).open();
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
			logger.error('Failed to load episode', error);
		}
	}

	/**
	 * Handle skip backward button click (15 seconds)
	 */
	private handleSkipBackward(): void {
		try {
			const playerController = this.plugin.playerController;
			playerController.skipBackward(15);
		} catch (error) {
			logger.error('Failed to skip backward', error);
		}
	}

	/**
	 * Handle skip forward button click (30 seconds)
	 */
	private handleSkipForward(): void {
		try {
			const playerController = this.plugin.playerController;
			playerController.skipForward(30);
		} catch (error) {
			logger.error('Failed to skip forward', error);
		}
	}

	/**
	 * Handle seek bar click
	 */
	private handleSeek(event: MouseEvent, progressBar: HTMLElement): void {
		try {
			const playerController = this.plugin.playerController;
			const state = playerController.getState();

			if (!state.currentEpisode) {
				return;
			}

			const rect = progressBar.getBoundingClientRect();
			const clickX = event.clientX - rect.left;
			// Ensure percentage is between 0 and 1
			const percentage = Math.max(0, Math.min(1, clickX / rect.width));

			// Calculate target position in seconds
			const duration = state.currentEpisode.duration;
			const targetPosition = duration * percentage;

			playerController.seek(targetPosition);
		} catch (error) {
			logger.error('Failed to seek', error);
		}
	}

	/**
	 * Handle volume change
	 */
	private handleVolumeChange(volume: number): void {
		try {
			const playerController = this.plugin.playerController;
			// Convert percentage (0-100) to decimal (0-1)
			playerController.setVolume(volume / 100);
		} catch (error) {
			logger.error('Failed to change volume', error);
		}
	}

	/**
	 * Handle speed change (cycle through speeds)
	 */
	private handleSpeedChange(speed: number): void {
		try {
			const playerController = this.plugin.playerController;
			playerController.setPlaybackSpeed(speed);
		} catch (error) {
			logger.error('Failed to change playback speed', error);
		}
	}

	/**
	 * Start the update interval for UI refresh
	 */
	private startUpdateInterval(): void {
		// Update UI every second
		this.updateInterval = window.setInterval(() => {
			void this.updatePlayerState();
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

	private lastQueueUpdatedAt: number = 0;

	/**
	 * Update the player state in the UI
	 * This will be called periodically to keep the UI in sync
	 */
	private async updatePlayerState(): Promise<void> {
		try {
			const playerController = this.plugin.playerController;
			const state = playerController.getState();

			// Update episode info
			const titleEl = this.playerContentEl.querySelector('.episode-title') as HTMLElement;
			const podcastEl = this.playerContentEl.querySelector('.podcast-name') as HTMLElement;
			const durationEl = this.playerContentEl.querySelector('.episode-duration') as HTMLElement;
			const thumbnailEl = this.playerContentEl.querySelector('.player-podcast-thumbnail') as HTMLImageElement;
			const infoBtnEl = this.playerContentEl.querySelector('.player-info-button') as HTMLElement;

			if (state.currentEpisode) {
				if (titleEl) titleEl.textContent = state.currentEpisode.title;
				if (durationEl) durationEl.textContent = this.formatTime(state.currentEpisode.duration);
				if (infoBtnEl) {
					infoBtnEl.removeClass('podcast-hidden');
					infoBtnEl.addClass('podcast-flex-visible');
				}

				// Update thumbnail and podcast title
				const podcastId = state.currentEpisode.podcastId;
				if (podcastId) {
					void this.plugin.getSubscriptionStore().getPodcast(podcastId).then(podcast => {
						if (podcast) {
							if (podcastEl) podcastEl.textContent = podcast.title;
							if (thumbnailEl && podcast.imageUrl) {
								thumbnailEl.src = podcast.imageUrl;
								thumbnailEl.removeClass('podcast-hidden');
								thumbnailEl.addClass('podcast-visible');
							} else if (thumbnailEl) {
								thumbnailEl.removeClass('podcast-visible');
								thumbnailEl.addClass('podcast-hidden');
							}
						}
					});
				} else {
					if (podcastEl) podcastEl.textContent = 'Unknown podcast';
					if (thumbnailEl) {
						thumbnailEl.removeClass('podcast-visible');
						thumbnailEl.addClass('podcast-hidden');
					}
				}
			} else {
				if (titleEl) titleEl.textContent = 'No episode playing';
				if (podcastEl) podcastEl.textContent = 'Select a podcast to start';
				if (durationEl) durationEl.textContent = '--:--';
				if (thumbnailEl) {
					thumbnailEl.removeClass('podcast-visible');
					thumbnailEl.addClass('podcast-hidden');
				}
				if (infoBtnEl) {
					infoBtnEl.removeClass('podcast-flex-visible');
					infoBtnEl.addClass('podcast-hidden');
				}
			}

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

			// Update progress bar and thumb
			const progressFill = this.playerContentEl.querySelector('.progress-fill') as HTMLElement;
			const progressThumb = this.playerContentEl.querySelector('.progress-bar-thumb') as HTMLElement;
			if (progressFill && !this.isDraggingProgress) {
				if (state.currentEpisode && state.currentEpisode.duration > 0) {
					const percentage = Math.min(100, Math.max(0, (state.position / state.currentEpisode.duration) * 100));
					progressFill.setCssProps({ 'width': `${percentage}%` });
					if (progressThumb) progressThumb.setCssProps({ 'left': `${percentage}%` });
				} else {
					// No episode or invalid duration, reset to 0
					progressFill.setCssProps({ 'width': '0%' });
					if (progressThumb) progressThumb.setCssProps({ 'left': '0%' });
				}
			}

			// Update volume slider
			const volumeSlider = this.playerContentEl.querySelector('.volume-slider') as HTMLInputElement;
			if (volumeSlider) {
				volumeSlider.value = String(state.volume * 100);
			}

			// Update speed slider and label
			const speedSlider = this.playerContentEl.querySelector('.speed-slider') as HTMLInputElement;
			const speedLabel = this.playerContentEl.querySelector('.speed-value') as HTMLElement;
			if (speedSlider) {
				// Only update if not being dragged (optional check, but simple assignment is usually fine)
				if (document.activeElement !== speedSlider) {
					speedSlider.value = String(state.playbackSpeed);
				}
			}
			if (speedLabel) {
				speedLabel.textContent = `${state.playbackSpeed.toFixed(1)}x`;
			}

			// Check for queue/playlist updates
			const isPlayingFromPlaylist = playerController.isPlayingFromPlaylist();
			const currentPlaylist = playerController.getCurrentPlaylist();
			const currentPlaylistIndex = playerController.getCurrentPlaylistIndex();

			// Rerender if playlist state changed (switched to/from playlist, or playlist content changed)
			const playlistStateKey = isPlayingFromPlaylist
				? `playlist:${currentPlaylist?.id}:${currentPlaylistIndex}`
				: 'queue';

			if (this.lastPlaylistStateKey !== playlistStateKey) {
				this.lastPlaylistStateKey = playlistStateKey;
				const playerContainer = this.playerContentEl.querySelector('.player-container') as HTMLElement;
				if (playerContainer) {
					const oldQueueSection = playerContainer.querySelector('.queue-section');
					if (oldQueueSection) {
						oldQueueSection.remove();
					}
					await this.renderQueueSection(playerContainer);
				}
				return; // Already re-rendered, skip queue check
			}

			// Only check queue updates if not playing from playlist
			if (!isPlayingFromPlaylist) {
				const queueManager = this.plugin.getQueueManager();
				const currentQueue = await queueManager.getCurrentQueue();

				if (currentQueue) {
					const updatedAt = currentQueue.updatedAt instanceof Date ? currentQueue.updatedAt.getTime() : new Date(currentQueue.updatedAt).getTime();

					// If queue ID changed OR queue was updated
					if (currentQueue.id !== this.currentQueueId || updatedAt > this.lastQueueUpdatedAt) {
						this.currentQueueId = currentQueue.id;
						this.lastQueueUpdatedAt = updatedAt;

						const playerContainer = this.playerContentEl.querySelector('.player-container') as HTMLElement;
						if (playerContainer) {
							const oldQueueSection = playerContainer.querySelector('.queue-section');
							if (oldQueueSection) {
								oldQueueSection.remove();
							}
							await this.renderQueueSection(playerContainer);
						}
					}
				}
			}
		} catch (error) {
			logger.error('Failed to update player state', error);
		}
	}

	/**
	 * Update play state icons without rebuilding the DOM
	 */
	private updatePlayState(): void {
		try {
			const playerController = this.plugin.playerController;
			const state = playerController.getState();
			const currentId = state.currentEpisode?.id;
			const isPlaying = state.status === 'playing';

			const items = this.playerContentEl.querySelectorAll('.queue-episode-item');
			items.forEach((item) => {
				const id = item.getAttribute('data-episode-id');
				const actionEl = item.querySelector('.queue-episode-action');
				if (!actionEl) return;

				if (id === currentId) {
					item.addClass('current');
					actionEl.empty();

					if (isPlaying) {
						const pauseIcon = actionEl.createDiv({ cls: 'icon-current' });
						setIcon(pauseIcon, 'pause');
					} else {
						// Current but paused - show play icon
						const playIcon = actionEl.createDiv({ cls: 'icon-current' });
						setIcon(playIcon, 'play');
					}
				} else {
					item.removeClass('current');
					actionEl.empty();

					const dragIcon = actionEl.createDiv({ cls: 'icon-drag' });
					setIcon(dragIcon, 'grip-vertical');

					const playIcon = actionEl.createDiv({ cls: 'icon-play' });
					setIcon(playIcon, 'play');
				}
			});
		} catch (error) {
			logger.error('Failed to update play state', error);
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
	private async renderQueueSection(container: HTMLElement): Promise<void> {
		const queueSection = container.createDiv({ cls: 'queue-section' });

		try {
			const playerController = this.plugin.playerController;

			// Check if playing from a playlist
			if (playerController.isPlayingFromPlaylist()) {
				const playlist = playerController.getCurrentPlaylist();
				if (playlist) {
					// Render playlist section
					await this.renderPlaylistSection(queueSection, playlist);
					return;
				}
			}

			// Otherwise, render queue section
			const queue = await this.getCurrentQueue();

			// Section header with queue name
			const header = queueSection.createDiv({ cls: 'queue-header' });

			let titleText = 'Current Queue';
			if (queue) {
				if (queue.isPlaylist) {
					// Remove "Playlist: " prefix if present for cleaner display
					const name = queue.name.startsWith('Playlist: ') ? queue.name.substring(10) : queue.name;
					titleText = `Current Playlist: ${name}`;
				} else {
					titleText = `Current Queue: ${queue.name}`;
				}
			}

			header.createEl('h3', { text: titleText, cls: 'queue-title' });

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
			logger.error('Failed to render queue section', error);
			const errorState = queueSection.createDiv({ cls: 'queue-error-state' });
			errorState.createEl('p', { text: 'Failed to load queue' });
		}
	}

	/**
	 * Render playlist section (when playing from playlist)
	 */
	private async renderPlaylistSection(container: HTMLElement, playlist: Playlist): Promise<void> {
		// Section header
		const header = container.createDiv({ cls: 'queue-header' });
		header.createEl('h3', { text: `Current Playlist: ${playlist.name}`, cls: 'queue-title' });

		if (playlist.episodeIds.length === 0) {
			const emptyState = container.createDiv({ cls: 'queue-empty-state' });
			emptyState.createEl('p', { text: 'Playlist is empty' });
			return;
		}

		// Episode list container
		const listContainer = container.createDiv({ cls: 'queue-episode-list' });

		const episodeManager = this.plugin.getEpisodeManager();
		const playerController = this.plugin.playerController;
		const currentIndex = playerController.getCurrentPlaylistIndex();
		const playerState = playerController.getState();
		const isCurrentlyPlaying = playerState.status === 'playing';

		// Info bar
		const info = listContainer.createDiv({ cls: 'queue-info' });
		info.createSpan({
			text: `${playlist.episodeIds.length} episodes`,
			cls: 'queue-count'
		});
		info.createSpan({
			text: ` • Playing ${currentIndex + 1} of ${playlist.episodeIds.length}`,
			cls: 'queue-position'
		});

		// Episodes list
		const episodesContainer = listContainer.createDiv({ cls: 'queue-episodes' });

		for (let i = 0; i < playlist.episodeIds.length; i++) {
			const episodeId = playlist.episodeIds[i];
			const episode = await episodeManager.getEpisodeWithProgress(episodeId);

			if (episode) {
				const isCurrent = i === currentIndex;
				this.renderPlaylistEpisodeItem(episodesContainer, episode, i, isCurrent, isCurrentlyPlaying);
			}
		}
	}

	/**
	 * Render a single playlist episode item
	 */
	private renderPlaylistEpisodeItem(
		container: HTMLElement,
		episode: EpisodeWithProgress,
		index: number,
		isCurrent: boolean,
		isPlaying: boolean
	): void {
		const item = container.createDiv({ cls: `queue-episode-item ${isCurrent ? 'current' : ''}` });
		item.setAttribute('data-episode-id', episode.id);
		item.setAttribute('data-index', String(index));

		// Action icon
		const actionEl = item.createDiv({ cls: 'queue-episode-action' });

		if (isCurrent) {
			const icon = actionEl.createDiv({ cls: 'icon-current' });
			setIcon(icon, isPlaying ? 'pause' : 'play');
		} else {
			const playIcon = actionEl.createDiv({ cls: 'icon-play' });
			setIcon(playIcon, 'play');
		}

		// Episode info
		const info = item.createDiv({ cls: 'queue-episode-info' });
		info.createEl('span', { text: episode.title, cls: 'queue-episode-title' });

		if (episode.duration) {
			info.createEl('span', {
				text: this.formatTime(episode.duration),
				cls: 'queue-episode-duration'
			});
		}

		// Click to play this episode
		item.addEventListener('click', () => {
			void (async () => {
				const playerController = this.plugin.playerController;
				const playlist = playerController.getCurrentPlaylist();

				if (playlist) {
					// Update the playlist index and load the episode
					playerController.setCurrentPlaylist(playlist, index);
					await playerController.loadEpisode(episode, true, true);
				}
			})();
		});
	}

	/**
	 * Get the current queue
	 */
	private async getCurrentQueue(): Promise<Queue | null> {
		try {
			const queueManager = this.plugin.getQueueManager();

			// Always try to get the current queue from QueueManager first
			const currentQueue = await queueManager.getCurrentQueue();
			if (currentQueue) {
				this.currentQueueId = currentQueue.id;
				return currentQueue;
			}

			// If QueueManager doesn't have a current queue, try to use our local ID
			if (this.currentQueueId) {
				const queue = await queueManager.getQueue(this.currentQueueId);
				if (queue) {
					// Sync back to QueueManager
					queueManager.setCurrentQueue(queue.id);
					return queue;
				}
			}

			// Otherwise, get the first available queue (or default queue)
			const allQueues = await queueManager.getAllQueues();
			if (allQueues.length > 0) {
				this.currentQueueId = allQueues[0].id;
				queueManager.setCurrentQueue(allQueues[0].id);
				return allQueues[0];
			}

			return null;
		} catch (error) {
			logger.error('Failed to get current queue', error);
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

		// Get current playback state
		const playerController = this.plugin.playerController;
		const playerState = playerController.getState();
		const isCurrentlyPlaying = playerState.status === 'playing';

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
					const isCurrent = queue.currentIndex === i;
					this.renderQueueEpisodeItem(episodesContainer, episode, i, isCurrent, isCurrent && isCurrentlyPlaying);
				}
			} catch (error) {
				logger.error(`Failed to load episode: ${episodeId}`, error);
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
		isCurrent: boolean,
		isPlaying: boolean = false
	): void {
		const item = container.createDiv({
			cls: isCurrent ? 'queue-episode-item current' : 'queue-episode-item',
			attr: { 'data-episode-id': episode.id }
		});

		// Make item draggable
		item.draggable = true;

		// Drag events
		item.addEventListener('dragstart', (e) => {
			e.dataTransfer?.setData('text/plain', index.toString());
			item.addClass('dragging');
			// Set drag effect
			if (e.dataTransfer) {
				e.dataTransfer.effectAllowed = 'move';
			}
		});

		item.addEventListener('dragend', () => {
			item.removeClass('dragging');
			container.querySelectorAll('.queue-episode-item').forEach(el => el.removeClass('drag-over'));
		});

		item.addEventListener('dragover', (e) => {
			e.preventDefault();
			if (e.dataTransfer) {
				e.dataTransfer.dropEffect = 'move';
			}
			item.addClass('drag-over');
		});

		item.addEventListener('dragleave', () => {
			item.removeClass('drag-over');
		});

		item.addEventListener('drop', (e) => {
			e.preventDefault();
			item.removeClass('drag-over');

			const fromIndex = parseInt(e.dataTransfer?.getData('text/plain') || '-1');
			const queueId = this.currentQueueId;
			if (fromIndex !== -1 && fromIndex !== index && queueId) {
				void (async () => {
					try {
						const queueManager = this.plugin.getQueueManager();
						await queueManager.moveEpisode(queueId, fromIndex, index);

						// Force refresh immediately to show new order
						await this.renderPlayer();
					} catch (error) {
						logger.error('Failed to move episode', error);
					}
				})();
			}
		});

		// Action Icon (Drag/Play/Pause)
		const actionEl = item.createDiv({ cls: 'queue-episode-action' });

		if (isCurrent && isPlaying) {
			// Currently playing episode - show pause icon only
			const pauseIcon = actionEl.createDiv({ cls: 'icon-current' });
			setIcon(pauseIcon, 'pause');
		} else {
			// All other episodes (including current but paused) - show drag handle, swap to play on hover
			const dragIcon = actionEl.createDiv({ cls: 'icon-drag' });
			setIcon(dragIcon, 'grip-vertical');

			const playIcon = actionEl.createDiv({ cls: 'icon-play' });
			setIcon(playIcon, 'play');
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

		// Click to play/pause
		item.addEventListener('click', () => {
			void (async () => {
				try {
					const playerController = this.plugin.playerController;
					const playerState = playerController.getState();

					if (isCurrent) {
						// Current episode - toggle play/pause
						if (playerState.status === 'playing') {
							await playerController.pause();
						} else {
							await playerController.play();
						}
					} else {
						// Other episodes - jump to and play
						const queueManager = this.plugin.getQueueManager();
						if (this.currentQueueId) {
							// Jump to this episode in the queue
							await queueManager.jumpTo(this.currentQueueId, index);

							// Load and play the episode
							await playerController.loadEpisode(episode, true, true);

							// Refresh UI
							await this.renderPlayer();
						}
					}
				} catch (error) {
					logger.error('Failed to play/pause episode from queue', error);
				}
			})();
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
