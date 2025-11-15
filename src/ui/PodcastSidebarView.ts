/**
 * PodcastSidebarView - Sidebar view for podcast management
 *
 * Provides a sidebar interface for:
 * - Browsing subscribed podcasts
 * - Viewing episodes
 * - Quick playback controls
 */

import { ItemView, WorkspaceLeaf, Menu, Notice } from 'obsidian';
import type PodcastPlayerPlugin from '../../main';
import { Podcast, Episode } from '../model';
import { AddToQueueModal } from './AddToQueueModal';
import { AddToPlaylistModal } from './AddToPlaylistModal';
import { SubscribePodcastModal } from './SubscribePodcastModal';
import { PodcastSettingsModal } from './PodcastSettingsModal';
import { EpisodeDetailModal } from './EpisodeDetailModal';

export const PODCAST_SIDEBAR_VIEW_TYPE = 'podcast-sidebar-view';

/**
 * PodcastSidebarView - Main sidebar for podcast browsing
 */
export class PodcastSidebarView extends ItemView {
	plugin: PodcastPlayerPlugin;
	private sidebarContentEl: HTMLElement;
	private selectedPodcast: Podcast | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: PodcastPlayerPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	/**
	 * Get the view type identifier
	 */
	getViewType(): string {
		return PODCAST_SIDEBAR_VIEW_TYPE;
	}

	/**
	 * Get the display text for the view
	 */
	getDisplayText(): string {
		return 'Podcasts';
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
		container.addClass('podcast-sidebar-view');

		this.sidebarContentEl = container.createDiv({ cls: 'podcast-sidebar-content' });

		await this.render();
	}

	/**
	 * Called when the view is closed
	 */
	async onClose() {
		// Cleanup if needed
	}

	/**
	 * Render the sidebar view
	 */
	private async render(): Promise<void> {
		this.sidebarContentEl.empty();

		// Header with actions
		this.renderHeader();

		// Podcast list or episode list
		if (this.selectedPodcast) {
			await this.renderEpisodeList();
		} else {
			await this.renderPodcastList();
		}
	}

	/**
	 * Render the header with action buttons
	 */
	private renderHeader(): void {
		const header = this.sidebarContentEl.createDiv({ cls: 'sidebar-header' });

		// Back button (if viewing episodes)
		if (this.selectedPodcast) {
			const backBtn = header.createEl('button', {
				cls: 'sidebar-back-button',
				attr: { 'aria-label': 'Back to podcasts' }
			});
			backBtn.innerHTML = '← Back';
			backBtn.addEventListener('click', () => {
				this.selectedPodcast = null;
				this.render();
			});
		}

		// Title
		const title = header.createEl('h2', {
			text: this.selectedPodcast ? this.selectedPodcast.title : 'My Podcasts',
			cls: 'sidebar-title'
		});

		// Action buttons
		const actions = header.createDiv({ cls: 'sidebar-actions' });

		if (!this.selectedPodcast) {
			// Add podcast button
			const addBtn = actions.createEl('button', {
				cls: 'sidebar-action-button',
				attr: { 'aria-label': 'Subscribe to podcast' }
			});
			addBtn.innerHTML = '➕';
			addBtn.addEventListener('click', () => this.handleAddPodcast());

			// Refresh button
			const refreshBtn = actions.createEl('button', {
				cls: 'sidebar-action-button',
				attr: { 'aria-label': 'Refresh feeds' }
			});
			refreshBtn.innerHTML = '🔄';
			refreshBtn.addEventListener('click', () => this.handleRefreshFeeds());
		} else {
			// Settings button (for selected podcast)
			const settingsBtn = actions.createEl('button', {
				cls: 'sidebar-action-button',
				attr: { 'aria-label': 'Podcast settings' }
			});
			settingsBtn.innerHTML = '⚙️';
			settingsBtn.addEventListener('click', () => this.handlePodcastSettings());
		}
	}

	/**
	 * Render the list of podcasts
	 */
	private async renderPodcastList(): Promise<void> {
		const listContainer = this.sidebarContentEl.createDiv({ cls: 'podcast-list-container' });

		// Load podcasts from store
		const podcasts = await this.loadPodcasts();

		if (podcasts.length === 0) {
			const empty = listContainer.createDiv({ cls: 'empty-state' });
			empty.createEl('p', { text: 'No podcasts yet' });
			empty.createEl('p', {
				text: 'Click the + button to subscribe to a podcast',
				cls: 'empty-state-hint'
			});
			return;
		}

		// Render each podcast
		for (const podcast of podcasts) {
			this.renderPodcastItem(listContainer, podcast);
		}
	}

	/**
	 * Render a single podcast item
	 */
	private renderPodcastItem(container: HTMLElement, podcast: Podcast): void {
		const item = container.createDiv({ cls: 'podcast-item' });

		// Podcast image
		if (podcast.imageUrl) {
			const img = item.createEl('img', {
				cls: 'podcast-image',
				attr: {
					src: podcast.imageUrl,
					alt: podcast.title
				}
			});
		} else {
			const placeholder = item.createDiv({ cls: 'podcast-image-placeholder' });
			placeholder.innerHTML = '🎙️';
		}

		// Podcast info
		const info = item.createDiv({ cls: 'podcast-info' });
		info.createEl('h3', { text: podcast.title, cls: 'podcast-title' });
		info.createEl('p', { text: podcast.author, cls: 'podcast-author' });

		// Episode count
		const episodeCount = podcast.episodes?.length || 0;
		info.createSpan({
			text: `${episodeCount} episodes`,
			cls: 'podcast-episode-count'
		});

		// Click to view episodes
		item.addEventListener('click', () => {
			this.selectedPodcast = podcast;
			this.render();
		});

		// Context menu
		item.addEventListener('contextmenu', (e) => {
			e.preventDefault();
			this.showPodcastContextMenu(podcast, e);
		});
	}

	/**
	 * Render the list of episodes for the selected podcast
	 */
	private async renderEpisodeList(): Promise<void> {
		if (!this.selectedPodcast) return;

		const listContainer = this.sidebarContentEl.createDiv({ cls: 'episode-list-container' });

		const episodes = this.selectedPodcast.episodes || [];

		if (episodes.length === 0) {
			const empty = listContainer.createDiv({ cls: 'empty-state' });
			empty.createEl('p', { text: 'No episodes available' });
			empty.createEl('p', {
				text: 'Try refreshing the feed',
				cls: 'empty-state-hint'
			});
			return;
		}

		// Render each episode
		for (const episode of episodes) {
			this.renderEpisodeItem(listContainer, episode);
		}
	}

	/**
	 * Render a single episode item
	 */
	private renderEpisodeItem(container: HTMLElement, episode: Episode): void {
		const item = container.createDiv({ cls: 'episode-item' });

		// Episode info
		const info = item.createDiv({ cls: 'episode-info' });
		info.createEl('h4', { text: episode.title, cls: 'episode-title' });

		// Episode metadata
		const metadata = info.createDiv({ cls: 'episode-metadata' });

		// Publish date
		const date = new Date(episode.publishDate);
		metadata.createSpan({
			text: date.toLocaleDateString(),
			cls: 'episode-date'
		});

		// Duration
		if (episode.duration) {
			metadata.createSpan({
				text: ` • ${this.formatDuration(episode.duration)}`,
				cls: 'episode-duration'
			});
		}

		// Play button
		const playBtn = item.createEl('button', {
			cls: 'episode-play-button',
			attr: { 'aria-label': 'Play episode' }
		});
		playBtn.innerHTML = '▶️';
		playBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			this.handlePlayEpisode(episode);
		});

		// Click to show episode details
		item.addEventListener('click', () => {
			this.handleEpisodeClick(episode);
		});

		// Context menu
		item.addEventListener('contextmenu', (e) => {
			e.preventDefault();
			this.showEpisodeContextMenu(episode, e);
		});
	}

	/**
	 * Handle add podcast button click
	 */
	private async handleAddPodcast(): Promise<void> {
		new SubscribePodcastModal(
			this.app,
			this.plugin,
			async (podcastId) => {
				// Callback after successful subscription
				console.log(`Successfully subscribed to podcast: ${podcastId}`);
				// Refresh the view to show the new podcast
				await this.render();
			}
		).open();
	}

	/**
	 * Handle refresh feeds button click
	 */
	private async handleRefreshFeeds(): Promise<void> {
		try {
			const feedSyncManager = this.plugin.getFeedSyncManager();
			// Show progress notification
			const notice = new Notice('Refreshing feeds...', 0);

			const result = await feedSyncManager.syncAll();

			notice.hide();

			new Notice(`Refreshed ${result.successCount} feeds. ${result.failureCount} failed.`);

			// Refresh the view to show updated data
			await this.render();
		} catch (error) {
			console.error('Failed to refresh feeds:', error);
			new Notice('Failed to refresh feeds');
		}
	}

	/**
	 * Handle podcast settings button click
	 */
	private handlePodcastSettings(): void {
		if (!this.selectedPodcast) return;

		new PodcastSettingsModal(
			this.app,
			this.plugin,
			this.selectedPodcast,
			async (settings) => {
				// Save the settings to the podcast
				try {
					const subscriptionStore = this.plugin.getSubscriptionStore();
					this.selectedPodcast!.settings = settings;
					await subscriptionStore.updatePodcast(this.selectedPodcast!);

					new Notice('Podcast settings updated');

					// Refresh the view
					await this.render();
				} catch (error) {
					console.error('Failed to save podcast settings:', error);
					new Notice('Failed to save settings');
				}
			}
		).open();
	}

	/**
	 * Handle play episode button click
	 */
	private async handlePlayEpisode(episode: Episode): Promise<void> {
		try {
			const playerController = this.plugin.playerController;

			// Load the episode into the player with autoPlay = true
			await playerController.loadEpisode(episode, true, true);

			new Notice(`Now playing: ${episode.title}`);
		} catch (error) {
			console.error('Failed to play episode:', error);
			new Notice('Failed to start playback');
		}
	}

	/**
	 * Handle episode item click (show details)
	 */
	private handleEpisodeClick(episode: Episode): void {
		new EpisodeDetailModal(this.app, this.plugin, episode).open();
	}

	/**
	 * Show context menu for podcast
	 */
	private showPodcastContextMenu(podcast: Podcast, event: MouseEvent): void {
		const menu = new Menu();

		menu.addItem((item) =>
			item
				.setTitle('View Episodes')
				.setIcon('list')
				.onClick(() => {
					this.selectedPodcast = podcast;
					this.render();
				})
		);

		menu.addItem((item) =>
			item
				.setTitle('Refresh Feed')
				.setIcon('refresh-cw')
				.onClick(() => {
					console.log('Refresh feed:', podcast.title);
					// TODO: Refresh this podcast's feed
				})
		);

		menu.addSeparator();

		menu.addItem((item) =>
			item
				.setTitle('Unsubscribe')
				.setIcon('trash')
				.onClick(() => {
					console.log('Unsubscribe:', podcast.title);
					// TODO: Unsubscribe from podcast
				})
		);

		menu.showAtMouseEvent(event);
	}

	/**
	 * Show context menu for episode
	 */
	private showEpisodeContextMenu(episode: Episode, event: MouseEvent): void {
		const menu = new Menu();

		menu.addItem((item) =>
			item
				.setTitle('View Details')
				.setIcon('info')
				.onClick(() => this.handleEpisodeClick(episode))
		);

		menu.addSeparator();

		menu.addItem((item) =>
			item
				.setTitle('Play')
				.setIcon('play')
				.onClick(() => this.handlePlayEpisode(episode))
		);

		menu.addItem((item) =>
			item
				.setTitle('Add to Queue')
				.setIcon('list-plus')
				.onClick(() => {
					new AddToQueueModal(
						this.app,
						this.plugin,
						[episode],
						(queueId) => {
							// Callback after adding to queue
							console.log(`Added episode to queue: ${queueId}`);
						}
					).open();
				})
		);

		menu.addItem((item) =>
			item
				.setTitle('Add to Playlist')
				.setIcon('folder-plus')
				.onClick(() => {
					new AddToPlaylistModal(
						this.app,
						this.plugin,
						[episode],
						(playlistId) => {
							// Callback after adding to playlist
							console.log(`Added episode to playlist: ${playlistId}`);
						}
					).open();
				})
		);

		menu.addSeparator();

		menu.addItem((item) =>
			item
				.setTitle('Export to Note')
				.setIcon('file-text')
				.onClick(() => {
					this.handleExportToNote(episode);
				})
		);

		menu.showAtMouseEvent(event);
	}

	/**
	 * Handle export to note
	 */
	private async handleExportToNote(episode: Episode): Promise<void> {
		try {
			// Show loading notification
			const loadingNotice = new Notice('Exporting episode to note...', 0);

			// Get the podcast information
			const subscriptionStore = this.plugin.getSubscriptionStore();
			const podcast = await subscriptionStore.getPodcast(episode.podcastId);

			if (!podcast) {
				loadingNotice.hide();
				new Notice('Failed to find podcast information');
				return;
			}

			// Get progress information (if available)
			const episodeManager = this.plugin.getEpisodeManager();
			const episodeWithProgress = await episodeManager.getEpisodeWithProgress(episode.id);
			const progress = episodeWithProgress?.progress;

			// Export the episode
			const noteExporter = this.plugin.getNoteExporter();
			const noteFile = await noteExporter.exportEpisode(episode, podcast, progress);

			// Hide loading notification
			loadingNotice.hide();

			// Show success notification
			new Notice(`Note created: ${noteFile.name}`);

			// Open the note (optional)
			const leaf = this.app.workspace.getLeaf(false);
			await leaf.openFile(noteFile);

		} catch (error) {
			console.error('Failed to export to note:', error);
			new Notice('Failed to export to note');
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

	/**
	 * Load podcasts from store
	 */
	private async loadPodcasts(): Promise<Podcast[]> {
		try {
			const subscriptionStore = this.plugin.getSubscriptionStore();
			return await subscriptionStore.getAllPodcasts();
		} catch (error) {
			console.error('Failed to load podcasts:', error);
			return [];
		}
	}

	/**
	 * Refresh the view
	 */
	public async refresh(): Promise<void> {
		await this.render();
	}
}
