/**
 * EpisodeDetailModal - Modal for viewing episode details
 *
 * Displays comprehensive information about an episode:
 * - Episode metadata (title, description, duration, publish date)
 * - Podcast information
 * - Playback progress
 * - Action buttons (play, add to queue/playlist)
 */

import { App, Modal, Notice, setIcon } from 'obsidian';
import type PodcastPlayerPlugin from '../../main';
import { Episode, Podcast, PlayProgress } from '../model';
import { AddToQueueModal } from './AddToQueueModal';
import { AddToPlaylistModal } from './AddToPlaylistModal';

/**
 * Modal for viewing episode details
 */
export class EpisodeDetailModal extends Modal {
	plugin: PodcastPlayerPlugin;
	episode: Episode;
	podcast: Podcast | null = null;
	progress: PlayProgress | undefined;

	constructor(app: App, plugin: PodcastPlayerPlugin, episode: Episode) {
		super(app);
		this.plugin = plugin;
		this.episode = episode;
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('episode-detail-modal');
		this.modalEl.addClass('episode-detail-modal-container');

		// Load additional data
		await this.loadData();

		// Render the modal content
		this.render();
	}

	/**
	 * Load podcast and progress data
	 */
	private async loadData(): Promise<void> {
		try {
			// Load podcast information
			const subscriptionStore = this.plugin.getSubscriptionStore();
			this.podcast = await subscriptionStore.getPodcast(this.episode.podcastId);

			// Load progress information
			const episodeManager = this.plugin.getEpisodeManager();
			const episodeWithProgress = await episodeManager.getEpisodeWithProgress(this.episode.id);
			this.progress = episodeWithProgress?.progress;
		} catch (error) {
			console.error('Failed to load episode data:', error);
		}
	}

	/**
	 * Render the modal content
	 */
	private render(): void {
		const { contentEl } = this;
		contentEl.empty();

		// Header section
		this.renderHeader();

		// Episode information section
		this.renderEpisodeInfo();

		// Podcast information section
		if (this.podcast) {
			this.renderPodcastInfo();
		}

		// Progress information section
		if (this.progress) {
			this.renderProgressInfo();
		}

		// Action buttons section
		this.renderActions();
	}

	/**
	 * Render header
	 */
	private renderHeader(): void {
		const { contentEl } = this;
		const header = contentEl.createDiv({ cls: 'episode-detail-header' });

		// Episode image
		if (this.episode.imageUrl || this.podcast?.imageUrl) {
			const imageUrl = this.episode.imageUrl || this.podcast?.imageUrl || '';
			if (imageUrl) {
				const img = header.createEl('img', {
					cls: 'episode-detail-image',
					attr: { src: imageUrl, alt: this.episode.title }
				});
			}
		}

		// Episode title
		header.createEl('h2', { text: this.episode.title, cls: 'episode-detail-title' });
	}

	/**
	 * Render episode information
	 */
	private renderEpisodeInfo(): void {
		const { contentEl } = this;
		const section = contentEl.createDiv({ cls: 'episode-detail-section' });

		section.createEl('h3', { text: 'Episode Information' });

		// Duration
		if (this.episode.duration) {
			const durationRow = section.createDiv({ cls: 'episode-detail-row' });
			durationRow.createSpan({ text: 'Duration: ', cls: 'episode-detail-label' });
			durationRow.createSpan({ text: this.formatDuration(this.episode.duration) });
		}

		// Publish date
		const dateRow = section.createDiv({ cls: 'episode-detail-row' });
		dateRow.createSpan({ text: 'Published: ', cls: 'episode-detail-label' });
		dateRow.createSpan({ text: this.formatDate(this.episode.publishDate) });

		// Episode number
		if (this.episode.episodeNumber) {
			const episodeRow = section.createDiv({ cls: 'episode-detail-row' });
			episodeRow.createSpan({ text: 'Episode: ', cls: 'episode-detail-label' });
			episodeRow.createSpan({ text: `#${this.episode.episodeNumber}` });
		}

		// Season number
		if (this.episode.seasonNumber) {
			const seasonRow = section.createDiv({ cls: 'episode-detail-row' });
			seasonRow.createSpan({ text: 'Season: ', cls: 'episode-detail-label' });
			seasonRow.createSpan({ text: `${this.episode.seasonNumber}` });
		}

		// Description
		if (this.episode.description) {
			section.createEl('h4', { text: 'Description', cls: 'episode-detail-subsection' });
			const descriptionEl = section.createDiv({ cls: 'episode-detail-description' });
			descriptionEl.innerHTML = this.formatDescription(this.episode.description);
		}
	}

	/**
	 * Render podcast information
	 */
	private renderPodcastInfo(): void {
		if (!this.podcast) return;

		const { contentEl } = this;
		const section = contentEl.createDiv({ cls: 'episode-detail-section' });

		section.createEl('h3', { text: 'Podcast' });

		// Podcast title
		const titleRow = section.createDiv({ cls: 'episode-detail-row' });
		titleRow.createSpan({ text: 'Show: ', cls: 'episode-detail-label' });
		titleRow.createSpan({ text: this.podcast.title });

		// Podcast author
		if (this.podcast.author) {
			const authorRow = section.createDiv({ cls: 'episode-detail-row' });
			authorRow.createSpan({ text: 'Author: ', cls: 'episode-detail-label' });
			authorRow.createSpan({ text: this.podcast.author });
		}
	}

	/**
	 * Render progress information
	 */
	private renderProgressInfo(): void {
		if (!this.progress) return;

		const { contentEl } = this;
		const section = contentEl.createDiv({ cls: 'episode-detail-section' });

		section.createEl('h3', { text: 'Playback Progress' });

		// Current position
		const positionRow = section.createDiv({ cls: 'episode-detail-row' });
		positionRow.createSpan({ text: 'Position: ', cls: 'episode-detail-label' });
		positionRow.createSpan({
			text: `${this.formatDuration(this.progress.position)} / ${this.formatDuration(this.episode.duration)}`
		});

		// Progress bar
		const progressBarContainer = section.createDiv({ cls: 'episode-detail-progress-container' });
		const progressBar = progressBarContainer.createDiv({ cls: 'episode-detail-progress-bar' });
		const progressFill = progressBar.createDiv({ cls: 'episode-detail-progress-fill' });
		const percentage = (this.progress.position / this.episode.duration) * 100;
		progressFill.style.width = `${percentage}%`;

		// Completion percentage
		const percentageText = progressBarContainer.createSpan({
			text: `${Math.round(percentage)}%`,
			cls: 'episode-detail-progress-text'
		});

		// Completed status
		const completedRow = section.createDiv({ cls: 'episode-detail-row' });
		const completedSpan = completedRow.createSpan({ cls: 'episode-detail-completed' });
		setIcon(completedSpan, 'check');
		completedSpan.createSpan({ text: ' Completed' });

		// Last played
		if (this.progress.lastPlayedAt) {
			const lastPlayedRow = section.createDiv({ cls: 'episode-detail-row' });
			lastPlayedRow.createSpan({ text: 'Last played: ', cls: 'episode-detail-label' });
			lastPlayedRow.createSpan({ text: this.formatDate(this.progress.lastPlayedAt) });
		}
	}

	/**
	 * Render action buttons
	 */
	private renderActions(): void {
		const { contentEl } = this;
		const actions = contentEl.createDiv({ cls: 'episode-detail-actions' });

		// Play button
		const playBtn = actions.createEl('button', {
			cls: 'mod-cta'
		});
		setIcon(playBtn, 'play');
		playBtn.createSpan({ text: ' Play' });
		playBtn.addEventListener('click', () => this.handlePlay());

		// Add to Queue button
		const queueBtn = actions.createEl('button');
		setIcon(queueBtn, 'list-plus');
		queueBtn.createSpan({ text: ' Add to Queue' });
		queueBtn.addEventListener('click', () => this.handleAddToQueue());

		// Add to Playlist button
		const playlistBtn = actions.createEl('button');
		setIcon(playlistBtn, 'folder-plus');
		playlistBtn.createSpan({ text: ' Add to Playlist' });
		playlistBtn.addEventListener('click', () => this.handleAddToPlaylist());

		// Close button
		const closeBtn = actions.createEl('button', {
			text: 'Close'
		});
		closeBtn.addEventListener('click', () => this.close());
	}

	/**
	 * Handle play button click
	 */
	private async handlePlay(): Promise<void> {
		try {
			const playerController = this.plugin.playerController;
			await playerController.loadEpisode(this.episode, true, true);
			new Notice(`Now playing: ${this.episode.title}`);
			this.close();
		} catch (error) {
			console.error('Failed to play episode:', error);
			new Notice('Failed to start playback');
		}
	}

	/**
	 * Handle add to queue button click
	 */
	private handleAddToQueue(): void {
		new AddToQueueModal(
			this.app,
			this.plugin,
			[this.episode],
			(queueId) => {
				new Notice('Episode added to queue');
			}
		).open();
	}

	/**
	 * Handle add to playlist button click
	 */
	private handleAddToPlaylist(): void {
		new AddToPlaylistModal(
			this.app,
			this.plugin,
			[this.episode],
			(playlistId) => {
				new Notice('Episode added to playlist');
			}
		).open();
	}

	/**
	 * Format duration in seconds to human-readable string
	 */
	private formatDuration(seconds: number): string {
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
	 * Format date to readable string
	 */
	private formatDate(date: Date): string {
		const d = new Date(date);
		return d.toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
	}

	/**
	 * Format description (convert HTML to safe display)
	 */
	private formatDescription(description: string): string {
		// Basic HTML sanitization - keep only safe tags
		// In production, you might want to use a proper HTML sanitizer library
		return description
			.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
			.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
