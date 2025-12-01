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
import { Podcast, Episode, Playlist } from '../model';
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
	private viewMode: 'podcasts' | 'playlists' = 'podcasts';
	private selectedPodcast: Podcast | null = null;
	private selectedPlaylist: Playlist | null = null;
	private searchQuery: string = '';
	private podcastSortBy: 'title' | 'author' | 'date' = 'title';
	private episodeSortBy: 'title' | 'date' | 'duration' = 'date';
	private playlistSortBy: 'name' | 'date' | 'count' = 'date';
	private sortDirection: 'asc' | 'desc' = 'asc';

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

		// Search box
		this.renderSearchBox();

		// Sort options
		this.renderSortOptions();

		// Render content based on current view
		if (this.selectedPodcast) {
			await this.renderEpisodeList();
		} else if (this.selectedPlaylist) {
			await this.renderPlaylistDetails();
		} else if (this.viewMode === 'podcasts') {
			await this.renderPodcastList();
		} else {
			await this.renderPlaylistList();
		}
	}

	/**
	 * Render the search box
	 */
	private renderSearchBox(): void {
		const searchContainer = this.sidebarContentEl.createDiv({ cls: 'sidebar-search-container' });

		const placeholder = this.selectedPodcast ? 'Search episodes...' :
		                    this.selectedPlaylist ? 'Search playlist episodes...' :
		                    this.viewMode === 'podcasts' ? 'Search podcasts...' : 'Search playlists...';

		const searchInput = searchContainer.createEl('input', {
			type: 'text',
			placeholder: placeholder,
			cls: 'sidebar-search-input',
			value: this.searchQuery
		});

		// Handle search input
		searchInput.addEventListener('input', (e) => {
			this.searchQuery = (e.target as HTMLInputElement).value;
			this.render();
		});

		// Clear button (if there's a search query)
		if (this.searchQuery) {
			const clearBtn = searchContainer.createEl('button', {
				cls: 'sidebar-search-clear',
				attr: { 'aria-label': 'Clear search' }
			});
			clearBtn.innerHTML = '✕';
			clearBtn.addEventListener('click', () => {
				this.searchQuery = '';
				this.render();
			});
		}
	}

	/**
	 * Render the sort options
	 */
	private renderSortOptions(): void {
		const sortContainer = this.sidebarContentEl.createDiv({ cls: 'sidebar-sort-container' });

		// Sort by dropdown
		const sortByLabel = sortContainer.createSpan({ text: 'Sort: ', cls: 'sort-label' });

		const sortBySelect = sortContainer.createEl('select', { cls: 'sort-select' });

		if (this.selectedPodcast) {
			// Episode sort options
			const titleOption = sortBySelect.createEl('option', { value: 'title', text: 'Title' });
			const dateOption = sortBySelect.createEl('option', { value: 'date', text: 'Date' });
			const durationOption = sortBySelect.createEl('option', { value: 'duration', text: 'Duration' });

			sortBySelect.value = this.episodeSortBy;

			sortBySelect.addEventListener('change', (e) => {
				this.episodeSortBy = (e.target as HTMLSelectElement).value as 'title' | 'date' | 'duration';
				this.render();
			});
		} else if (this.selectedPlaylist) {
			// Playlist episode sort options (similar to episode sort)
			const titleOption = sortBySelect.createEl('option', { value: 'title', text: 'Title' });
			const dateOption = sortBySelect.createEl('option', { value: 'date', text: 'Date' });
			const durationOption = sortBySelect.createEl('option', { value: 'duration', text: 'Duration' });

			sortBySelect.value = this.episodeSortBy;

			sortBySelect.addEventListener('change', (e) => {
				this.episodeSortBy = (e.target as HTMLSelectElement).value as 'title' | 'date' | 'duration';
				this.render();
			});
		} else if (this.viewMode === 'playlists') {
			// Playlist sort options
			const nameOption = sortBySelect.createEl('option', { value: 'name', text: 'Name' });
			const dateOption = sortBySelect.createEl('option', { value: 'date', text: 'Date' });
			const countOption = sortBySelect.createEl('option', { value: 'count', text: 'Episode Count' });

			sortBySelect.value = this.playlistSortBy;

			sortBySelect.addEventListener('change', (e) => {
				this.playlistSortBy = (e.target as HTMLSelectElement).value as 'name' | 'date' | 'count';
				this.render();
			});
		} else {
			// Podcast sort options
			const titleOption = sortBySelect.createEl('option', { value: 'title', text: 'Title' });
			const authorOption = sortBySelect.createEl('option', { value: 'author', text: 'Author' });
			const dateOption = sortBySelect.createEl('option', { value: 'date', text: 'Subscribed Date' });

			sortBySelect.value = this.podcastSortBy;

			sortBySelect.addEventListener('change', (e) => {
				this.podcastSortBy = (e.target as HTMLSelectElement).value as 'title' | 'author' | 'date';
				this.render();
			});
		}

		// Sort direction toggle
		const directionBtn = sortContainer.createEl('button', {
			cls: 'sort-direction-button',
			attr: { 'aria-label': 'Toggle sort direction' }
		});
		directionBtn.innerHTML = this.sortDirection === 'asc' ? '↑' : '↓';
		directionBtn.addEventListener('click', () => {
			this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
			this.render();
		});
	}

	/**
	 * Render the header with action buttons
	 */
	private renderHeader(): void {
		const header = this.sidebarContentEl.createDiv({ cls: 'sidebar-header' });

		// Back button (if viewing details)
		if (this.selectedPodcast || this.selectedPlaylist) {
			const backBtn = header.createEl('button', {
				cls: 'sidebar-back-button',
				attr: { 'aria-label': 'Back to list' }
			});
			backBtn.innerHTML = '← Back';
			backBtn.addEventListener('click', () => {
				this.selectedPodcast = null;
				this.selectedPlaylist = null;
				this.render();
			});
		}

		// Title
		let title = '';
		if (this.selectedPodcast) {
			title = this.selectedPodcast.title;
		} else if (this.selectedPlaylist) {
			title = this.selectedPlaylist.name;
		} else {
			title = this.viewMode === 'podcasts' ? 'My Podcasts' : 'My Playlists';
		}

		header.createEl('h2', { text: title, cls: 'sidebar-title' });

		// Mode toggle (only if not viewing details)
		if (!this.selectedPodcast && !this.selectedPlaylist) {
			const modeToggle = header.createDiv({ cls: 'sidebar-mode-toggle' });

			const podcastsBtn = modeToggle.createEl('button', {
				text: 'Podcasts',
				cls: this.viewMode === 'podcasts' ? 'mode-active' : 'mode-inactive'
			});
			podcastsBtn.addEventListener('click', () => {
				this.viewMode = 'podcasts';
				this.render();
			});

			const playlistsBtn = modeToggle.createEl('button', {
				text: 'Playlists',
				cls: this.viewMode === 'playlists' ? 'mode-active' : 'mode-inactive'
			});
			playlistsBtn.addEventListener('click', () => {
				this.viewMode = 'playlists';
				this.render();
			});
		}

		// Action buttons
		const actions = header.createDiv({ cls: 'sidebar-actions' });

		if (!this.selectedPodcast && !this.selectedPlaylist) {
			if (this.viewMode === 'podcasts') {
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
				// Create playlist button
				const addBtn = actions.createEl('button', {
					cls: 'sidebar-action-button',
					attr: { 'aria-label': 'Create playlist' }
				});
				addBtn.innerHTML = '➕';
				addBtn.addEventListener('click', () => this.handleCreatePlaylist());
			}
		} else if (this.selectedPodcast) {
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
		let podcasts = await this.loadPodcasts();

		// Filter podcasts based on search query
		if (this.searchQuery) {
			podcasts = this.filterPodcasts(podcasts, this.searchQuery);
		}

		// Sort podcasts
		podcasts = this.sortPodcasts(podcasts, this.podcastSortBy, this.sortDirection);

		if (podcasts.length === 0) {
			const empty = listContainer.createDiv({ cls: 'empty-state' });
			if (this.searchQuery) {
				empty.createEl('p', { text: 'No podcasts found' });
				empty.createEl('p', {
					text: `No podcasts match "${this.searchQuery}"`,
					cls: 'empty-state-hint'
				});
			} else {
				empty.createEl('p', { text: 'No podcasts yet' });
				empty.createEl('p', {
					text: 'Click the + button to subscribe to a podcast',
					cls: 'empty-state-hint'
				});
			}
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

		let episodes = this.selectedPodcast.episodes || [];

		// Filter episodes based on search query
		if (this.searchQuery) {
			episodes = this.filterEpisodes(episodes, this.searchQuery);
		}

		// Sort episodes
		episodes = this.sortEpisodes(episodes, this.episodeSortBy, this.sortDirection);

		if (episodes.length === 0) {
			const empty = listContainer.createDiv({ cls: 'empty-state' });
			if (this.searchQuery) {
				empty.createEl('p', { text: 'No episodes found' });
				empty.createEl('p', {
					text: `No episodes match "${this.searchQuery}"`,
					cls: 'empty-state-hint'
				});
			} else {
				empty.createEl('p', { text: 'No episodes available' });
				empty.createEl('p', {
					text: 'Try refreshing the feed',
					cls: 'empty-state-hint'
				});
			}
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
	 * Filter podcasts based on search query
	 */
	private filterPodcasts(podcasts: Podcast[], query: string): Podcast[] {
		const lowerQuery = query.toLowerCase();
		return podcasts.filter(podcast => {
			// Search in title
			if (podcast.title.toLowerCase().includes(lowerQuery)) {
				return true;
			}
			// Search in author
			if (podcast.author?.toLowerCase().includes(lowerQuery)) {
				return true;
			}
			// Search in description
			if (podcast.description?.toLowerCase().includes(lowerQuery)) {
				return true;
			}
			return false;
		});
	}

	/**
	 * Filter episodes based on search query
	 */
	private filterEpisodes(episodes: Episode[], query: string): Episode[] {
		const lowerQuery = query.toLowerCase();
		return episodes.filter(episode => {
			// Search in title
			if (episode.title.toLowerCase().includes(lowerQuery)) {
				return true;
			}
			// Search in description
			if (episode.description?.toLowerCase().includes(lowerQuery)) {
				return true;
			}
			return false;
		});
	}

	/**
	 * Sort podcasts based on criteria
	 */
	private sortPodcasts(
		podcasts: Podcast[],
		sortBy: 'title' | 'author' | 'date',
		direction: 'asc' | 'desc'
	): Podcast[] {
		const sorted = [...podcasts].sort((a, b) => {
			let comparison = 0;

			switch (sortBy) {
				case 'title':
					comparison = a.title.localeCompare(b.title);
					break;
				case 'author':
					comparison = (a.author || '').localeCompare(b.author || '');
					break;
				case 'date':
					const aDate = new Date(a.subscribedAt).getTime();
					const bDate = new Date(b.subscribedAt).getTime();
					comparison = aDate - bDate;
					break;
			}

			return direction === 'asc' ? comparison : -comparison;
		});

		return sorted;
	}

	/**
	 * Sort episodes based on criteria
	 */
	private sortEpisodes(
		episodes: Episode[],
		sortBy: 'title' | 'date' | 'duration',
		direction: 'asc' | 'desc'
	): Episode[] {
		const sorted = [...episodes].sort((a, b) => {
			let comparison = 0;

			switch (sortBy) {
				case 'title':
					comparison = a.title.localeCompare(b.title);
					break;
				case 'date':
					const aDate = new Date(a.publishDate).getTime();
					const bDate = new Date(b.publishDate).getTime();
					comparison = aDate - bDate;
					break;
				case 'duration':
					comparison = a.duration - b.duration;
					break;
			}

			return direction === 'asc' ? comparison : -comparison;
		});

		return sorted;
	}

	/**
	 * Render the list of playlists
	 */
	private async renderPlaylistList(): Promise<void> {
		const listContainer = this.sidebarContentEl.createDiv({ cls: 'playlist-list-container' });

		const playlistManager = this.plugin.getPlaylistManager();
		let playlists = await playlistManager.getAllPlaylists();

		// Filter playlists based on search query
		if (this.searchQuery) {
			playlists = this.filterPlaylists(playlists, this.searchQuery);
		}

		// Sort playlists
		playlists = this.sortPlaylists(playlists, this.playlistSortBy, this.sortDirection);

		if (playlists.length === 0) {
			const empty = listContainer.createDiv({ cls: 'empty-state' });
			if (this.searchQuery) {
				empty.createEl('p', { text: 'No playlists found' });
				empty.createEl('p', {
					text: `No playlists match "${this.searchQuery}"`,
					cls: 'empty-state-hint'
				});
			} else {
				empty.createEl('p', { text: 'No playlists yet' });
				empty.createEl('p', {
					text: 'Click the + button to create a playlist',
					cls: 'empty-state-hint'
				});
			}
			return;
		}

		for (const playlist of playlists) {
			this.renderPlaylistItem(listContainer, playlist);
		}
	}

	/**
	 * Render a single playlist item
	 */
	private renderPlaylistItem(container: HTMLElement, playlist: Playlist): void {
		const item = container.createDiv({ cls: 'playlist-item' });

		// Info section
		const info = item.createDiv({ cls: 'playlist-info' });
		info.createEl('h3', { text: playlist.name, cls: 'playlist-title' });

		if (playlist.description) {
			info.createEl('p', { text: playlist.description, cls: 'playlist-description' });
		}

		// Metadata
		const metadata = info.createDiv({ cls: 'playlist-metadata' });
		metadata.createSpan({ text: `${playlist.episodeIds.length} episodes`, cls: 'playlist-count' });
		metadata.createSpan({ text: ` • Updated ${this.formatDate(playlist.updatedAt)}`, cls: 'playlist-date' });

		// Click to view details
		item.addEventListener('click', () => {
			this.selectedPlaylist = playlist;
			this.render();
		});

		// Context menu
		item.addEventListener('contextmenu', (e) => {
			e.preventDefault();
			this.showPlaylistContextMenu(playlist, e);
		});
	}

	/**
	 * Render playlist details (episodes)
	 */
	private async renderPlaylistDetails(): Promise<void> {
		if (!this.selectedPlaylist) return;

		const detailsContainer = this.sidebarContentEl.createDiv({ cls: 'playlist-details-container' });

		// Metadata section
		const metadata = detailsContainer.createDiv({ cls: 'playlist-details-metadata' });
		if (this.selectedPlaylist.description) {
			metadata.createEl('p', { text: this.selectedPlaylist.description, cls: 'playlist-details-description' });
		}
		metadata.createEl('p', {
			text: `${this.selectedPlaylist.episodeIds.length} episodes • Created ${this.formatDate(this.selectedPlaylist.createdAt)}`,
			cls: 'playlist-details-info'
		});

		// Episodes list
		await this.renderPlaylistEpisodeList(detailsContainer, this.selectedPlaylist.episodeIds);
	}

	/**
	 * Render episode list for playlist
	 */
	private async renderPlaylistEpisodeList(container: HTMLElement, episodeIds: string[]): Promise<void> {
		if (episodeIds.length === 0) {
			const empty = container.createDiv({ cls: 'empty-state' });
			empty.createEl('p', { text: 'No episodes in this playlist' });
			return;
		}

		const episodeManager = this.plugin.getEpisodeManager();
		const listContainer = container.createDiv({ cls: 'playlist-episode-list' });

		for (let i = 0; i < episodeIds.length; i++) {
			const episodeId = episodeIds[i];
			try {
				const episodeWithProgress = await episodeManager.getEpisodeWithProgress(episodeId);
				if (episodeWithProgress) {
					this.renderPlaylistEpisodeItem(listContainer, episodeWithProgress, i);
				}
			} catch (error) {
				console.error(`Failed to load episode: ${episodeId}`, error);
			}
		}
	}

	/**
	 * Render a single episode item in playlist
	 */
	private renderPlaylistEpisodeItem(container: HTMLElement, episode: Episode, index: number): void {
		const item = container.createDiv({ cls: 'playlist-episode-item' });

		// Index
		const indexEl = item.createDiv({ cls: 'playlist-episode-index' });
		indexEl.textContent = `${index + 1}`;

		// Info
		const info = item.createDiv({ cls: 'playlist-episode-info' });
		info.createEl('h4', { text: episode.title, cls: 'playlist-episode-title' });

		// Metadata
		const metadata = info.createDiv({ cls: 'playlist-episode-metadata' });
		if (episode.duration) {
			metadata.createSpan({ text: this.formatDuration(episode.duration), cls: 'playlist-episode-duration' });
		}

		// Play button
		const playBtn = item.createEl('button', {
			cls: 'playlist-episode-play',
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
			this.showPlaylistEpisodeContextMenu(episode, index, e);
		});
	}

	/**
	 * Handle create playlist button click
	 */
	private async handleCreatePlaylist(): Promise<void> {
		try {
			// Prompt for playlist name
			const name = await this.promptForInput('Create Playlist', 'Enter playlist name:');
			if (!name) return;

			// Optionally prompt for description
			const description = await this.promptForInput('Playlist Description', 'Enter description (optional):');

			const playlistManager = this.plugin.getPlaylistManager();
			const playlist = await playlistManager.createPlaylist(name, description || undefined);

			new Notice(`Playlist "${name}" created`);

			// Refresh the view
			await this.render();
		} catch (error) {
			console.error('Failed to create playlist:', error);
			new Notice('Failed to create playlist');
		}
	}

	/**
	 * Show context menu for playlist
	 */
	private showPlaylistContextMenu(playlist: Playlist, event: MouseEvent): void {
		const menu = new Menu();

		menu.addItem((item) =>
			item
				.setTitle('View Details')
				.setIcon('list')
				.onClick(() => {
					this.selectedPlaylist = playlist;
					this.render();
				})
		);

		menu.addItem((item) =>
			item
				.setTitle('Rename')
				.setIcon('pencil')
				.onClick(async () => {
					const newName = await this.promptForInput('Rename Playlist', 'Enter new name:', playlist.name);
					if (!newName || newName === playlist.name) return;

					try {
						const playlistManager = this.plugin.getPlaylistManager();
						await playlistManager.updatePlaylist(playlist.id, { name: newName });
						new Notice('Playlist renamed');
						await this.render();
					} catch (error) {
						console.error('Failed to rename playlist:', error);
						new Notice('Failed to rename playlist');
					}
				})
		);

		menu.addSeparator();

		menu.addItem((item) =>
			item
				.setTitle('Delete')
				.setIcon('trash')
				.onClick(async () => {
					try {
						const playlistManager = this.plugin.getPlaylistManager();
						await playlistManager.deletePlaylist(playlist.id);
						new Notice('Playlist deleted');
						await this.render();
					} catch (error) {
						console.error('Failed to delete playlist:', error);
						new Notice('Failed to delete playlist');
					}
				})
		);

		menu.showAtMouseEvent(event);
	}

	/**
	 * Show context menu for episode in playlist
	 */
	private showPlaylistEpisodeContextMenu(episode: Episode, index: number, event: MouseEvent): void {
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

		menu.addSeparator();

		menu.addItem((item) =>
			item
				.setTitle('Remove from Playlist')
				.setIcon('trash')
				.onClick(async () => {
					try {
						if (this.selectedPlaylist) {
							const playlistManager = this.plugin.getPlaylistManager();
							await playlistManager.removeEpisode(this.selectedPlaylist.id, episode.id);
							this.selectedPlaylist = await playlistManager.getPlaylist(this.selectedPlaylist.id);
							new Notice('Episode removed from playlist');
							await this.render();
						}
					} catch (error) {
						console.error('Failed to remove episode:', error);
						new Notice('Failed to remove episode');
					}
				})
		);

		menu.showAtMouseEvent(event);
	}

	/**
	 * Filter playlists based on search query
	 */
	private filterPlaylists(playlists: Playlist[], query: string): Playlist[] {
		const lowerQuery = query.toLowerCase();
		return playlists.filter(playlist => {
			// Search in name
			if (playlist.name.toLowerCase().includes(lowerQuery)) {
				return true;
			}
			// Search in description
			if (playlist.description?.toLowerCase().includes(lowerQuery)) {
				return true;
			}
			return false;
		});
	}

	/**
	 * Sort playlists based on criteria
	 */
	private sortPlaylists(
		playlists: Playlist[],
		sortBy: 'name' | 'date' | 'count',
		direction: 'asc' | 'desc'
	): Playlist[] {
		const sorted = [...playlists].sort((a, b) => {
			let comparison = 0;

			switch (sortBy) {
				case 'name':
					comparison = a.name.localeCompare(b.name);
					break;
				case 'date':
					const aDate = new Date(a.createdAt).getTime();
					const bDate = new Date(b.createdAt).getTime();
					comparison = aDate - bDate;
					break;
				case 'count':
					comparison = a.episodeIds.length - b.episodeIds.length;
					break;
			}

			return direction === 'asc' ? comparison : -comparison;
		});

		return sorted;
	}

	/**
	 * Format date to relative time
	 */
	private formatDate(date: Date): string {
		const now = new Date();
		const diffMs = now.getTime() - new Date(date).getTime();
		const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

		if (diffDays === 0) {
			return 'today';
		} else if (diffDays === 1) {
			return 'yesterday';
		} else if (diffDays < 7) {
			return `${diffDays} days ago`;
		} else if (diffDays < 30) {
			const weeks = Math.floor(diffDays / 7);
			return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
		} else {
			const months = Math.floor(diffDays / 30);
			return `${months} month${months > 1 ? 's' : ''} ago`;
		}
	}

	/**
	 * Prompt user for text input
	 */
	private async promptForInput(title: string, message: string, defaultValue?: string): Promise<string | null> {
		return new Promise((resolve) => {
			// Simple prompt using browser's prompt (can be replaced with a custom modal later)
			const result = prompt(message, defaultValue || '');
			resolve(result);
		});
	}

	/**
	 * Refresh the view
	 */
	public async refresh(): Promise<void> {
		await this.render();
	}
}
