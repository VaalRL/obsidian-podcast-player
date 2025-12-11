/**
 * PodcastSidebarView - Sidebar view for podcast management
 *
 * Provides a sidebar interface for:
 * - Browsing subscribed podcasts
 * - Viewing episodes
 * - Quick playback controls
 */

import { ItemView, WorkspaceLeaf, Menu, Notice, setIcon, Events } from 'obsidian';
import type PodcastPlayerPlugin from '../../main';
import { Podcast, Episode, Playlist, Queue } from '../model';
import { EpisodeStatistics } from '../podcast/EpisodeManager';
import { AddToQueueModal } from './AddToQueueModal';
import { AddToPlaylistModal } from './AddToPlaylistModal';
import { RenameModal } from './RenameModal';
import { SubscribePodcastModal } from './SubscribePodcastModal';
import { PodcastSettingsModal } from './PodcastSettingsModal';
import { EpisodeDetailModal } from './EpisodeDetailModal';
import { TextInputModal } from './TextInputModal';

export const PODCAST_SIDEBAR_VIEW_TYPE = 'podcast-sidebar-view';

// Type-safe event registration helper
type PodcastEvents = Events & {
	on(name: 'podcast:queue-updated', callback: (queueId: string) => void): ReturnType<Events['on']>;
	on(name: 'podcast:player-state-updated', callback: () => void): ReturnType<Events['on']>;
	on(name: 'podcast:episode-changed', callback: () => void): ReturnType<Events['on']>;
	on(name: 'podcast:playlist-updated', callback: (playlistId: string) => void): ReturnType<Events['on']>;
	on(name: 'podcast:queue-changed', callback: () => void): ReturnType<Events['on']>;
};

/**
 * PodcastSidebarView - Main sidebar for podcast browsing
 */
export class PodcastSidebarView extends ItemView {
	plugin: PodcastPlayerPlugin;
	private sidebarContentEl: HTMLElement;
	private viewMode: 'podcasts' | 'playlists' = 'podcasts';
	private selectedPodcast: Podcast | null = null;
	private selectedPlaylist: Playlist | null = null;
	private selectedQueue: Queue | null = null;
	private searchQuery: string = '';
	private podcastSortBy: 'title' | 'author' | 'date' | 'count' | 'unplayed' | 'latest' = 'title';
	private episodeSortBy: 'title' | 'date' | 'duration' = 'date';
	private playlistSortBy: 'name' | 'date' | 'count' = 'date';
	private podcastSortDirection: 'asc' | 'desc' = 'asc';
	private episodeSortDirection: 'asc' | 'desc' = 'desc';
	private playlistSortDirection: 'asc' | 'desc' = 'asc';
	private podcastStats: Map<string, EpisodeStatistics> = new Map();
	private feedsViewMode: 'feeds' | 'episodes' = 'feeds'; // Toggle between feeds list and all episodes

	// Drag and drop state
	private dragStartIndex: number = -1;
	private dragType: 'playlist' | 'queue' | null = null;
	private dragTargetId: string | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: PodcastPlayerPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	onload() {
		super.onload();

		// Listen for queue/playlist updates
		this.registerEvent(
			(this.app.workspace as unknown as PodcastEvents).on('podcast:queue-updated', (queueId: string) => {
				void (async () => {
					if (this.selectedQueue && this.selectedQueue.id === queueId) {
						this.selectedQueue = await this.plugin.getQueueManager().getQueue(queueId);
						await this.render();
					}
				})();
			})
		);

		// Listen for player state updates to refresh UI (e.g. play/pause icons)
		this.registerEvent(
			(this.app.workspace as unknown as PodcastEvents).on('podcast:player-state-updated', () => {
				this.updateListIcons();
			})
		);

		this.registerEvent(
			(this.app.workspace as unknown as PodcastEvents).on('podcast:episode-changed', () => {
				this.updateListIcons();
			})
		);

		this.registerEvent(
			(this.app.workspace as unknown as PodcastEvents).on('podcast:playlist-updated', (playlistId: string) => {
				void (async () => {
					if (this.selectedPlaylist && this.selectedPlaylist.id === playlistId) {
						this.selectedPlaylist = await this.plugin.getPlaylistManager().getPlaylist(playlistId);
						await this.render();
					}
				})();
			})
		);
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
	async onOpen(): Promise<void> {
		const container = this.containerEl.children[1];
		container.empty();
		container.addClass('podcast-sidebar-view');

		this.sidebarContentEl = container.createDiv({ cls: 'podcast-sidebar-content' });

		await this.render();
	}

	/**
	 * Called when the view is closed
	 */
	async onClose(): Promise<void> {
		// Cleanup if needed
	}

	/**
	 * Render the sidebar view
	 */
	private async render(): Promise<void> {
		this.sidebarContentEl.empty();

		// Header with actions
		this.renderHeader();

		// Search box (includes sort button)
		this.renderSearchBox();

		// Render content based on current view
		if (this.selectedPodcast) {
			await this.renderEpisodeList();
		} else if (this.selectedPlaylist) {
			await this.renderPlaylistDetails();
		} else if (this.selectedQueue) {
			await this.renderQueueDetails();
		} else if (this.viewMode === 'podcasts') {
			// Check feeds view mode
			if (this.feedsViewMode === 'episodes') {
				await this.renderAllEpisodes();
			} else {
				await this.renderPodcastList();
			}
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

		const searchBtn = searchContainer.createEl('button', {
			cls: 'sidebar-search-button',
			attr: { 'aria-label': 'Search' }
		});
		setIcon(searchBtn, 'search');

		const performSearch = () => {

			this.searchQuery = searchInput.value;
			void this.render();
		};

		// Handle search button click
		searchBtn.addEventListener('click', (e) => {

			performSearch();
		});

		// Handle Enter key
		searchInput.addEventListener('keydown', (e) => {
			if (e.key === 'Enter') {
				e.preventDefault(); // Prevent default form submission if any

				performSearch();
			}
		});

		// Clear button (if there's a search query)
		if (this.searchQuery) {
			const clearBtn = searchContainer.createEl('button', {
				cls: 'sidebar-search-clear',
				attr: { 'aria-label': 'Clear search' }
			});
			setIcon(clearBtn, 'x');
			clearBtn.addEventListener('click', () => {

				this.searchQuery = '';
				void this.render();
			});
		}

		// Sort button (added to search container)
		// Determine current context
		let currentDirection: 'asc' | 'desc' = 'asc';
		let currentSortBy = '';

		if (this.selectedPodcast || this.selectedPlaylist) {
			currentDirection = this.episodeSortDirection;
			currentSortBy = this.episodeSortBy;
		} else if (this.viewMode === 'playlists') {
			currentDirection = this.playlistSortDirection;
			currentSortBy = this.playlistSortBy;
		} else {
			currentDirection = this.podcastSortDirection;
			currentSortBy = this.podcastSortBy;
		}

		// Sort button (Icon only)
		const sortBtn = searchContainer.createEl('button', {
			cls: 'sort-direction-button',
			attr: { 'aria-label': 'Sort options' }
		});
		setIcon(sortBtn, currentDirection === 'asc' ? 'arrow-up' : 'arrow-down');

		sortBtn.addEventListener('click', (event) => {
			const menu = new Menu();

			menu.addItem((item) => item.setIsLabel(true).setTitle('Sort by'));

			if (this.selectedPodcast || this.selectedPlaylist) {
				// Episode sort options
				menu.addItem((item) => item.setTitle('Title').setChecked(currentSortBy === 'title').onClick(() => { this.episodeSortBy = 'title'; void this.render(); }));
				menu.addItem((item) => item.setTitle('Date').setChecked(currentSortBy === 'date').onClick(() => { this.episodeSortBy = 'date'; void this.render(); }));
				menu.addItem((item) => item.setTitle('Duration').setChecked(currentSortBy === 'duration').onClick(() => { this.episodeSortBy = 'duration'; void this.render(); }));
			} else if (this.viewMode === 'playlists') {
				// Playlist sort options
				menu.addItem((item) => item.setTitle('Name').setChecked(currentSortBy === 'name').onClick(() => { this.playlistSortBy = 'name'; void this.render(); }));
				menu.addItem((item) => item.setTitle('Date').setChecked(currentSortBy === 'date').onClick(() => { this.playlistSortBy = 'date'; void this.render(); }));
				menu.addItem((item) => item.setTitle('Episode Count').setChecked(currentSortBy === 'count').onClick(() => { this.playlistSortBy = 'count'; void this.render(); }));
			} else {
				// Podcast sort options
				menu.addItem((item) => item.setTitle('Title').setChecked(currentSortBy === 'title').onClick(() => { this.podcastSortBy = 'title'; void this.render(); }));
				menu.addItem((item) => item.setTitle('Author').setChecked(currentSortBy === 'author').onClick(() => { this.podcastSortBy = 'author'; void this.render(); }));
				menu.addItem((item) => item.setTitle('Subscribed Date').setChecked(currentSortBy === 'date').onClick(() => { this.podcastSortBy = 'date'; void this.render(); }));
				menu.addItem((item) => item.setTitle('Latest Episode').setChecked(currentSortBy === 'latest').onClick(() => { this.podcastSortBy = 'latest'; void this.render(); }));
				menu.addItem((item) => item.setTitle('Total Episodes').setChecked(currentSortBy === 'count').onClick(() => { this.podcastSortBy = 'count'; void this.render(); }));
				menu.addItem((item) => item.setTitle('Unplayed Count').setChecked(currentSortBy === 'unplayed').onClick(() => { this.podcastSortBy = 'unplayed'; void this.render(); }));
			}

			menu.addSeparator();
			menu.addItem((item) => item.setIsLabel(true).setTitle('Order'));

			menu.addItem((item) => item
				.setTitle('Ascending')
				.setChecked(currentDirection === 'asc')
				.onClick(() => this.setSortDirection('asc')));

			menu.addItem((item) => item
				.setTitle('Descending')
				.setChecked(currentDirection === 'desc')
				.onClick(() => this.setSortDirection('desc')));

			menu.showAtMouseEvent(event);
		});
	}



	private setSortDirection(dir: 'asc' | 'desc'): void {
		if (this.selectedPodcast || this.selectedPlaylist) {
			this.episodeSortDirection = dir;
		} else if (this.viewMode === 'playlists') {
			this.playlistSortDirection = dir;
		} else {
			this.podcastSortDirection = dir;
		}
		void this.render();
	}




	/**
	 * Render the header with action buttons
	 */
	private renderHeader(): void {
		// Header container with title and actions
		const header = this.sidebarContentEl.createDiv({ cls: 'sidebar-header' });

		// Back button (if viewing details) - now inside header
		if (this.selectedPodcast || this.selectedPlaylist || this.selectedQueue) {
			const backBtn = header.createEl('button', {
				cls: 'sidebar-back-button',
				attr: { 'aria-label': 'Back to list' }
			});
			setIcon(backBtn, 'arrow-left');
			backBtn.createSpan({ text: ' Back' });
			backBtn.addEventListener('click', (e) => {
				e.preventDefault();
				e.stopPropagation();

				this.selectedPodcast = null;
				this.selectedPlaylist = null;
				this.selectedQueue = null;
				void this.render();
			});
		}

		// Title
		let title = '';
		if (this.selectedPodcast) {
			title = this.selectedPodcast.title;
		} else if (this.selectedPlaylist) {
			title = this.selectedPlaylist.name;
		} else if (this.selectedQueue) {
			title = this.selectedQueue.name;
		} else if (this.viewMode === 'podcasts') {
			title = this.feedsViewMode === 'feeds' ? 'My Feeds' : 'All Episodes';
		} else {
			title = 'My Lists';
		}

		header.createEl('h2', { text: title, cls: 'sidebar-title' });

		// Action buttons
		const actions = header.createDiv({ cls: 'sidebar-actions' });

		if (!this.selectedPodcast && !this.selectedPlaylist && !this.selectedQueue) {
			if (this.viewMode === 'podcasts') {
				// Toggle view mode button (feeds vs all episodes)
				const toggleViewBtn = actions.createEl('button', {
					cls: 'sidebar-action-button',
					attr: { 'aria-label': this.feedsViewMode === 'feeds' ? 'Show all episodes' : 'Show feeds' }
				});
				setIcon(toggleViewBtn, this.feedsViewMode === 'feeds' ? 'list' : 'rss');
				toggleViewBtn.addEventListener('click', () => {
					this.feedsViewMode = this.feedsViewMode === 'feeds' ? 'episodes' : 'feeds';
					void this.render();
				});

				// Add podcast button
				const addBtn = actions.createEl('button', {
					cls: 'sidebar-action-button',
					attr: { 'aria-label': 'Subscribe to podcast' }
				});
				setIcon(addBtn, 'plus');
				addBtn.addEventListener('click', () => this.handleAddPodcast());

				// Refresh button
				const refreshBtn = actions.createEl('button', {
					cls: 'sidebar-action-button',
					attr: { 'aria-label': 'Refresh feeds' }
				});
				setIcon(refreshBtn, 'refresh-cw');
				refreshBtn.addEventListener('click', () => this.handleRefreshFeeds());
			} else {
				// Create new (queue or playlist) button
				const addBtn = actions.createEl('button', {
					cls: 'sidebar-action-button',
					attr: { 'aria-label': 'Create new' }
				});
				setIcon(addBtn, 'plus');
				addBtn.addEventListener('click', (e) => {
					const menu = new Menu();

					menu.addItem((item) =>
						item
							.setTitle('New Queue')
							.setIcon('list-ordered')
							.onClick(() => this.handleCreateQueue())
					);

					menu.addItem((item) =>
						item
							.setTitle('New Playlist')
							.setIcon('folder-plus')
							.onClick(() => this.handleCreatePlaylist())
					);

					menu.showAtMouseEvent(e);
				});
			}
		} else if (this.selectedPodcast) {
			// Settings button (for selected podcast)
			const settingsBtn = actions.createEl('button', {
				cls: 'sidebar-action-button',
				attr: { 'aria-label': 'Podcast settings' }
			});
			setIcon(settingsBtn, 'settings');
			settingsBtn.addEventListener('click', () => this.handlePodcastSettings());
		} else if (this.selectedPlaylist) {
			// Rename button (for selected playlist)
			const renameBtn = actions.createEl('button', {
				cls: 'sidebar-action-button',
				attr: { 'aria-label': 'Rename playlist' }
			});
			setIcon(renameBtn, 'pencil');
			renameBtn.addEventListener('click', () => this.handleRenamePlaylist());
		} else if (this.selectedQueue) {
			// Rename button (for selected queue)
			const renameBtn = actions.createEl('button', {
				cls: 'sidebar-action-button',
				attr: { 'aria-label': 'Rename queue' }
			});
			setIcon(renameBtn, 'pencil');
			renameBtn.addEventListener('click', () => this.handleRenameQueue());
		}

		// Mode toggle - always visible to allow quick switching
		const modeToggle = this.sidebarContentEl.createDiv({ cls: 'sidebar-mode-toggle' });

		const podcastsBtn = modeToggle.createEl('button', {
			text: 'Feeds',
			cls: this.viewMode === 'podcasts' && !this.selectedPlaylist && !this.selectedQueue ? 'mode-active' : 'mode-inactive'
		});
		podcastsBtn.addEventListener('click', () => {
			// Clear selection to go back to main list
			this.selectedPodcast = null;
			this.selectedPlaylist = null;
			this.selectedQueue = null;

			this.viewMode = 'podcasts';
			void this.render();
		});

		const playlistsBtn = modeToggle.createEl('button', {
			text: 'Lists',
			cls: this.viewMode === 'playlists' || this.selectedPlaylist || this.selectedQueue ? 'mode-active' : 'mode-inactive'
		});
		playlistsBtn.addEventListener('click', () => {
			// Clear selection to go back to main list
			this.selectedPodcast = null;
			this.selectedPlaylist = null;
			this.selectedQueue = null;

			this.viewMode = 'playlists';
			void this.render();
		});
	}

	/**
	 * Render the list of podcasts
	 */
	private async renderPodcastList(): Promise<void> {
		const listContainer = this.sidebarContentEl.createDiv({ cls: 'podcast-list-container' });

		// Load podcasts from store
		let podcasts = await this.loadPodcasts();

		// Load statistics for sorting
		await this.loadPodcastStats(podcasts);

		// Filter podcasts based on search query
		if (this.searchQuery) {
			podcasts = this.filterPodcasts(podcasts, this.searchQuery);
		}

		// Sort podcasts
		podcasts = this.sortPodcasts(podcasts, this.podcastSortBy, this.podcastSortDirection);

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
	 * Render all episodes from all podcasts in a single list
	 */
	private async renderAllEpisodes(): Promise<void> {
		const listContainer = this.sidebarContentEl.createDiv({ cls: 'episode-list-container' });

		// Gather all episodes from all podcasts
		const subscriptionStore = this.plugin.getSubscriptionStore();
		const podcasts = await subscriptionStore.getAllPodcasts();

		let allEpisodes: Episode[] = [];
		const podcastMap = new Map<string, Podcast>();

		for (const podcast of podcasts) {
			podcastMap.set(podcast.id, podcast);
			if (podcast.episodes) {
				allEpisodes = allEpisodes.concat(podcast.episodes);
			}
		}

		// Filter episodes based on search query
		if (this.searchQuery) {
			allEpisodes = this.filterEpisodes(allEpisodes, this.searchQuery);
		}

		// Sort episodes
		allEpisodes = this.sortEpisodes(allEpisodes, this.episodeSortBy, this.episodeSortDirection);

		if (allEpisodes.length === 0) {
			const empty = listContainer.createDiv({ cls: 'empty-state' });
			if (this.searchQuery) {
				empty.createEl('p', { text: 'No episodes found' });
				empty.createEl('p', {
					text: `No episodes match "${this.searchQuery}"`,
					cls: 'empty-state-hint'
				});
			} else {
				empty.createEl('p', { text: 'No episodes yet' });
				empty.createEl('p', {
					text: 'Subscribe to podcasts to see episodes here',
					cls: 'empty-state-hint'
				});
			}
			return;
		}

		// Render each episode with podcast info
		for (const episode of allEpisodes) {
			const podcast = podcastMap.get(episode.podcastId);
			this.renderAllEpisodesItem(listContainer, episode, podcast);
		}
	}

	/**
	 * Render a single episode item in the all episodes view
	 */
	private renderAllEpisodesItem(container: HTMLElement, episode: Episode, podcast?: Podcast): void {
		const item = container.createDiv({ cls: 'episode-item all-episodes-item' });

		// Episode info
		const info = item.createDiv({ cls: 'episode-info' });

		// Episode title
		info.createEl('div', {
			text: episode.title,
			cls: 'episode-title'
		});

		// Podcast name and date row
		const meta = info.createDiv({ cls: 'episode-meta' });
		if (podcast) {
			meta.createSpan({ text: podcast.title, cls: 'episode-podcast-name' });
			meta.createSpan({ text: ' • ', cls: 'episode-meta-separator' });
		}
		meta.createSpan({
			text: this.formatDate(new Date(episode.publishDate)),
			cls: 'episode-date'
		});
		if (episode.duration) {
			meta.createSpan({ text: ' • ', cls: 'episode-meta-separator' });
			meta.createSpan({
				text: this.formatDuration(episode.duration),
				cls: 'episode-duration'
			});
		}

		// Action buttons container
		const actions = item.createDiv({ cls: 'episode-actions' });

		// Play button
		const playBtn = actions.createEl('button', {
			cls: 'episode-action-button',
			attr: { 'aria-label': 'Play episode' }
		});
		setIcon(playBtn, 'play');
		playBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			this.handlePlayEpisode(episode);
		});

		// Add to button
		const addBtn = actions.createEl('button', {
			cls: 'episode-action-button',
			attr: { 'aria-label': 'Add to queue or playlist' }
		});
		setIcon(addBtn, 'plus');
		addBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			this.showAddToPlaylistMenu(episode, e);
		});

		// Click to show details
		item.addEventListener('click', () => this.handleEpisodeClick(episode));

		// Context menu
		item.addEventListener('contextmenu', (e) => {
			e.preventDefault();
			this.showEpisodeContextMenu(episode, e);
		});
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
			setIcon(placeholder, 'mic');
		}

		// Podcast info
		const info = item.createDiv({ cls: 'podcast-info' });
		info.createEl('h3', { text: podcast.title, cls: 'podcast-title' });
		info.createEl('p', { text: podcast.author, cls: 'podcast-author' });

		// Stats
		const stats = this.podcastStats.get(podcast.id);
		if (stats) {
			const statsText = [];
			statsText.push(`${stats.totalEpisodes} eps`);
			if (stats.unplayedEpisodes > 0) {
				statsText.push(`${stats.unplayedEpisodes} new`);
			}

			info.createDiv({
				text: statsText.join(' • '),
				cls: 'podcast-episode-count'
			});
		} else {
			const episodeCount = podcast.episodes?.length || 0;
			info.createDiv({
				text: `${episodeCount} episodes`,
				cls: 'podcast-episode-count'
			});
		}

		// Click to view episodes
		item.addEventListener('click', () => {
			this.selectedPodcast = podcast;
			// Reset sort to Newest First (Date Descending)
			this.episodeSortBy = 'date';
			this.episodeSortDirection = 'desc';
			void this.render();
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
	private renderEpisodeList(): void {
		if (!this.selectedPodcast) return;

		const listContainer = this.sidebarContentEl.createDiv({ cls: 'episode-list-container' });

		let episodes = this.selectedPodcast.episodes || [];

		// Filter episodes based on search query
		if (this.searchQuery) {
			episodes = this.filterEpisodes(episodes, this.searchQuery);
		}

		// Sort episodes
		episodes = this.sortEpisodes(episodes, this.episodeSortBy, this.episodeSortDirection);

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

		// Actions container
		const actions = item.createDiv({ cls: 'episode-item-actions' });

		// Play button
		const playBtn = actions.createEl('button', {
			cls: 'episode-action-button',
			attr: { 'aria-label': 'Play' }
		});
		setIcon(playBtn, 'play');
		playBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			this.handlePlayEpisode(episode, true);
		});

		// Add button
		const addBtn = actions.createEl('button', {
			cls: 'episode-action-button',
			attr: { 'aria-label': 'Add to playlist' }
		});
		setIcon(addBtn, 'plus');
		addBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			this.showAddToPlaylistMenu(episode, e);
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
	private handleAddPodcast(): void {
		new SubscribePodcastModal(
			this.app,
			this.plugin,
			async (podcastId) => {
				// Callback after successful subscription

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
			async (settings, autoAddRule) => {
				// Save the settings to the podcast
				try {
					const subscriptionStore = this.plugin.getSubscriptionStore();
					this.selectedPodcast!.settings = settings;
					this.selectedPodcast!.autoAddRule = autoAddRule;
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
	 * Show add to playlist menu
	 */
	private async showAddToPlaylistMenu(episode: Episode, event: MouseEvent): Promise<void> {
		const menu = new Menu();
		const playlistManager = this.plugin.getPlaylistManager();
		const queueManager = this.plugin.getQueueManager();

		// Queues Section
		menu.addItem((item) => item.setTitle('Queues').setIsLabel(true));

		const queues = await queueManager.getAllQueues();
		queues.forEach(queue => {
			menu.addItem((item) =>
				item
					.setTitle(queue.name)
					.setIcon('list-ordered')
					.onClick(async () => {
						try {
							await queueManager.addEpisode(queue.id, episode.id);
							new Notice(`Added to queue: ${queue.name}`);
						} catch (e) {
							console.error(e);
							new Notice('Failed to add to queue');
						}
					})
			);
		});

		// New Queue Option
		menu.addItem((item) =>
			item
				.setTitle('New Queue...')
				.setIcon('plus')
				.onClick(async () => {
					const name = await this.promptForInput('New Queue', 'Enter queue name:');
					if (name) {
						const newQueue = await queueManager.createQueue(name);
						await queueManager.addEpisode(newQueue.id, episode.id);
						new Notice(`Created queue "${name}" and added episode`);
						await this.render();
					}
				})
		);

		menu.addSeparator();

		// Playlists Section
		menu.addItem((item) => item.setTitle('Playlists').setIsLabel(true));

		const playlists = await playlistManager.getAllPlaylists();
		playlists.forEach(playlist => {
			menu.addItem((item) =>
				item
					.setTitle(playlist.name)
					.setIcon('list')
					.onClick(async () => {
						try {
							await playlistManager.addEpisode(playlist.id, episode.id);
							new Notice(`Added to playlist: ${playlist.name}`);
						} catch (e) {
							console.error(e);
							new Notice('Failed to add to playlist');
						}
					})
			);
		});

		// New Playlist Option
		menu.addItem((item) =>
			item
				.setTitle('New Playlist...')
				.setIcon('plus')
				.onClick(async () => {
					const name = await this.promptForInput('New Playlist', 'Enter playlist name:');
					if (name) {
						const newPlaylist = await playlistManager.createPlaylist(name);
						await playlistManager.addEpisode(newPlaylist.id, episode.id);
						new Notice(`Created playlist "${name}" and added episode`);
						await this.render();
					}
				})
		);

		menu.showAtMouseEvent(event);
	}

	/**
	 * Handle play playlist - starts from beginning
	 */
	private async handlePlayPlaylist(playlist: Playlist): Promise<void> {
		if (playlist.episodeIds.length === 0) {
			new Notice('Playlist is empty');
			return;
		}

		const episodeManager = this.plugin.getEpisodeManager();

		// Start from the first episode
		const episodeId = playlist.episodeIds[0];
		const episode = await episodeManager.getEpisodeWithProgress(episodeId);

		if (episode) {
			await this.handlePlayEpisode(episode, false, playlist);
		} else {
			new Notice('Failed to load episode from playlist');
		}
	}

	/**
	 * Handle play episode button click
	 */
	private async handlePlayEpisode(episode: Episode, addToQueue = false, fromPlaylist?: Playlist): Promise<void> {
		try {
			const playerController = this.plugin.playerController;
			const queueManager = this.plugin.getQueueManager();

			// If playing from a playlist, play directly without creating a queue
			if (fromPlaylist) {
				// Find the index of the episode in the playlist
				const episodeIndex = fromPlaylist.episodeIds.indexOf(episode.id);

				// Set the playlist in PlayerController for prev/next navigation
				playerController.setCurrentPlaylist(fromPlaylist, episodeIndex >= 0 ? episodeIndex : 0);

				// Load and play the episode - no queue creation
				await playerController.loadEpisode(episode, true, true);
				new Notice(`Now playing: ${episode.title}`);
				return;
			} else if (addToQueue) {
				// Get or create default queue
				let queue = await queueManager.getCurrentQueue();
				if (!queue) {
					const queues = await queueManager.getAllQueues();
					if (queues.length > 0) {
						queue = queues[0];
					} else {
						queue = await queueManager.createQueue('Default Queue');
					}
					queueManager.setCurrentQueue(queue.id);
				}

				// Add to front (insert at 0)
				await queueManager.insertEpisode(queue.id, episode.id, 0);
				// Update current index to 0 so the queue continues from here
				await queueManager.jumpTo(queue.id, 0);
			} else {
				// Playing from podcast list - create queue with all visible episodes
				if (this.selectedPodcast) {
					const queueName = `Podcast: ${this.selectedPodcast.title}`;

					// Get episodes and apply current filter/sort
					let episodes = this.selectedPodcast.episodes || [];

					if (this.searchQuery) {
						episodes = this.filterEpisodes(episodes, this.searchQuery);
					}

					episodes = this.sortEpisodes(episodes, this.episodeSortBy, this.episodeSortDirection);

					// Find or create queue
					const allQueues = await queueManager.getAllQueues();
					let queue = allQueues.find(q => q.name === queueName);

					if (!queue) {
						queue = await queueManager.createQueue(queueName);
					}

					// Update queue episodes
					await queueManager.clearQueue(queue.id);
					const episodeIds = episodes.map(e => e.id);
					await queueManager.addEpisodes(queue.id, episodeIds);

					// Jump to clicked episode
					const index = episodeIds.indexOf(episode.id);
					if (index !== -1) {
						await queueManager.jumpTo(queue.id, index);
					}

					// Set as current queue
					queueManager.setCurrentQueue(queue.id);
				}
			}

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
					void this.render();
				})
		);

		menu.addItem((item) =>
			item
				.setTitle('Refresh Feed')
				.setIcon('refresh-cw')
				.onClick(async () => {
					try {
						const feedSyncManager = this.plugin.getFeedSyncManager();
						new Notice('Refreshing feed...');
						await feedSyncManager.syncPodcast(podcast.id);
						new Notice('Feed refreshed');
						await this.render();
					} catch (error) {
						console.error('Failed to refresh feed:', error);
						new Notice('Failed to refresh feed');
					}
				})
		);

		menu.addSeparator();

		menu.addItem((item) =>
			item
				.setTitle('Unsubscribe')
				.setIcon('trash')
				.onClick(async () => {
					try {
						const podcastService = this.plugin.getPodcastService();
						await podcastService.unsubscribe(podcast.id);
						new Notice(`Unsubscribed from ${podcast.title}`);
						await this.render();
					} catch (error) {
						console.error('Failed to unsubscribe:', error);
						new Notice('Failed to unsubscribe');
					}
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
	 * Load statistics for podcasts
	 */
	private async loadPodcastStats(podcasts: Podcast[]): Promise<void> {
		const episodeManager = this.plugin.getEpisodeManager();
		for (const podcast of podcasts) {
			if (!this.podcastStats.has(podcast.id)) {
				const stats = await episodeManager.getPodcastStatistics(podcast.id);
				this.podcastStats.set(podcast.id, stats);
			}
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
		sortBy: 'title' | 'author' | 'date' | 'count' | 'unplayed' | 'latest',
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
				case 'date': {
					const aDate = new Date(a.subscribedAt).getTime();
					const bDate = new Date(b.subscribedAt).getTime();
					comparison = aDate - bDate;
					break;
				}
				case 'latest': {
					// Sort by most recent episode publish date
					const aLatest = this.getLatestEpisodeDate(a);
					const bLatest = this.getLatestEpisodeDate(b);
					comparison = aLatest - bLatest;
					break;
				}
				case 'count': {
					const aCount = this.podcastStats.get(a.id)?.totalEpisodes || 0;
					const bCount = this.podcastStats.get(b.id)?.totalEpisodes || 0;
					comparison = aCount - bCount;
					break;
				}
				case 'unplayed': {
					const aUnplayed = this.podcastStats.get(a.id)?.unplayedEpisodes || 0;
					const bUnplayed = this.podcastStats.get(b.id)?.unplayedEpisodes || 0;
					comparison = aUnplayed - bUnplayed;
					break;
				}
			}

			return direction === 'asc' ? comparison : -comparison;
		});

		return sorted;
	}

	/**
	 * Get the latest episode publish date for a podcast
	 */
	private getLatestEpisodeDate(podcast: Podcast): number {
		if (!podcast.episodes || podcast.episodes.length === 0) {
			return 0;
		}

		const dates = podcast.episodes.map(ep => new Date(ep.publishDate).getTime());
		return Math.max(...dates);
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
				case 'date': {
					const aDate = new Date(a.publishDate).getTime();
					const bDate = new Date(b.publishDate).getTime();
					comparison = aDate - bDate;
					break;
				}
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

		// Get default queue first
		const queueManager = this.plugin.getQueueManager();
		const allQueues = await queueManager.getAllQueues();

		// Render default queue section if there are queues
		if (allQueues.length > 0 && !this.searchQuery) {
			const queueSection = listContainer.createDiv({ cls: 'queue-section-sidebar' });
			queueSection.createEl('h4', { text: 'Queues', cls: 'section-title' });

			for (const queue of allQueues) {
				this.renderQueueAsPlaylistItem(queueSection, queue);
			}
		}

		const playlistManager = this.plugin.getPlaylistManager();
		let playlists = await playlistManager.getAllPlaylists();

		// Filter playlists based on search query
		if (this.searchQuery) {
			playlists = this.filterPlaylists(playlists, this.searchQuery);
		}

		// Sort playlists
		playlists = this.sortPlaylists(playlists, this.playlistSortBy, this.playlistSortDirection);

		// Add section header for playlists
		if (playlists.length > 0 || this.searchQuery) {
			const playlistSection = listContainer.createDiv({ cls: 'playlist-section-sidebar' });
			if (!this.searchQuery) {
				playlistSection.createEl('h4', { text: 'Playlists', cls: 'section-title' });
			}

			if (playlists.length === 0) {
				const empty = playlistSection.createDiv({ cls: 'empty-state' });
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
			} else {
				for (const playlist of playlists) {
					this.renderPlaylistItem(playlistSection, playlist);
				}
			}
		} else if (allQueues.length === 0) {
			// No queues and no playlists
			const empty = listContainer.createDiv({ cls: 'empty-state' });
			empty.createEl('p', { text: 'No playlists yet' });
			empty.createEl('p', {
				text: 'Click the + button to create a playlist',
				cls: 'empty-state-hint'
			});
		}
	}

	/**
	 * Render a queue as a playlist item
	 */
	private renderQueueAsPlaylistItem(container: HTMLElement, queue: Queue): void {
		const item = container.createDiv({ cls: 'playlist-item queue-item' });

		// Info section
		const info = item.createDiv({ cls: 'playlist-info' });
		info.createEl('h3', { text: queue.name, cls: 'playlist-title' });

		// Metadata
		const metadata = info.createDiv({ cls: 'playlist-metadata' });
		metadata.createSpan({ text: `${queue.episodeIds.length} episodes`, cls: 'playlist-count' });
		metadata.createSpan({ text: ` • Updated ${this.formatDate(queue.updatedAt)}`, cls: 'playlist-date' });

		// Play button
		const playBtn = item.createEl('button', {
			cls: 'playlist-play-button',
			attr: { 'aria-label': 'Play queue' }
		});
		setIcon(playBtn, 'play');
		playBtn.addEventListener('click', async (e) => {
			e.stopPropagation();
			await this.handlePlayQueue(queue);
		});

		// Click to view details
		item.addEventListener('click', () => {
			this.showQueueDetails(queue);
		});

		// Context menu (limited options for queues)
		item.addEventListener('contextmenu', (e) => {
			e.preventDefault();
			this.showQueueContextMenu(queue, e);
		});
	}

	/**
	 * Handle play queue
	 */
	private async handlePlayQueue(queue: Queue): Promise<void> {
		if (queue.episodeIds.length === 0) {
			new Notice('Queue is empty');
			return;
		}

		try {
			const queueManager = this.plugin.getQueueManager();
			queueManager.setCurrentQueue(queue.id);

			// Get the first episode
			const episodeManager = this.plugin.getEpisodeManager();
			const firstEpisodeId = queue.episodeIds[queue.currentIndex] || queue.episodeIds[0];
			const episode = await episodeManager.getEpisodeWithProgress(firstEpisodeId);

			if (episode) {
				await this.plugin.playerController.loadEpisode(episode, true, true);
			}
		} catch (error) {
			console.error('Failed to play queue:', error);
			new Notice('Failed to play queue');
		}
	}

	/**
	 * Show queue details
	 */
	private async showQueueDetails(queue: Queue): Promise<void> {
		this.selectedQueue = queue;
		await this.render();
	}

	/**
	 * Show context menu for queue (limited options)
	 */
	private showQueueContextMenu(queue: Queue, event: MouseEvent): void {
		const menu = new Menu();

		menu.addItem((item) =>
			item
				.setTitle('View Details')
				.setIcon('list')
				.onClick(() => {
					this.showQueueDetails(queue);
				})
		);

		menu.addItem((item) =>
			item
				.setTitle('Play')
				.setIcon('play')
				.onClick(async () => {
					await this.handlePlayQueue(queue);
				})
		);

		menu.addItem((item) =>
			item
				.setTitle('Rename')
				.setIcon('pencil')
				.onClick(async () => {
					const newName = await this.promptForInput('Rename Queue', 'Enter new name:', queue.name);
					if (!newName || newName === queue.name) return;

					try {
						const queueManager = this.plugin.getQueueManager();
						await queueManager.updateQueue(queue.id, { name: newName });
						new Notice('Queue renamed');
						await this.render();
					} catch (error) {
						console.error('Failed to rename queue:', error);
						new Notice('Failed to rename queue');
					}
				})
		);

		menu.addSeparator();

		menu.addItem((item) =>
			item
				.setTitle('Clear Queue')
				.setIcon('eraser')
				.onClick(async () => {
					try {
						const queueManager = this.plugin.getQueueManager();
						await queueManager.clearQueue(queue.id);
						new Notice('Queue cleared');
						await this.render();
					} catch (error) {
						console.error('Failed to clear queue:', error);
						new Notice('Failed to clear queue');
					}
				})
		);

		menu.addItem((item) =>
			item
				.setTitle('Delete Queue')
				.setIcon('trash')
				.onClick(async () => {
					// Confirm deletion
					// For now just delete
					try {
						const queueManager = this.plugin.getQueueManager();
						await queueManager.deleteQueue(queue.id);
						new Notice('Queue deleted');
						await this.render();
					} catch (error) {
						console.error('Failed to delete queue:', error);
						new Notice('Failed to delete queue');
					}
				})
		);

		menu.showAtMouseEvent(event);
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

		// Play button
		const playBtn = item.createEl('button', {
			cls: 'playlist-play-button',
			attr: { 'aria-label': 'Play playlist' }
		});
		setIcon(playBtn, 'play');
		playBtn.addEventListener('click', (e) => {
			e.stopPropagation(); // Prevent triggering item click
			this.handlePlayPlaylist(playlist);
		});

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
	 * Update play state icons without rebuilding the DOM
	 */
	private updateListIcons(): void {
		try {
			const playerController = this.plugin.playerController;
			const state = playerController.getState();
			const currentId = state.currentEpisode?.id;
			const isPlaying = state.status === 'playing';

			// Target both playlist and queue items
			const items = this.sidebarContentEl.querySelectorAll('.playlist-episode-item');
			items.forEach((item) => {
				const id = item.getAttribute('data-episode-id');

				// Find action container - it might be .queue-episode-action
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
			console.error('Failed to update list icons:', error);
		}
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
		// Check if this episode is current and playing
		const playerController = this.plugin.playerController;
		const playerState = playerController.getState();
		const isCurrent = playerState.currentEpisode?.id === episode.id;
		const isPlaying = isCurrent && playerState.status === 'playing';

		const item = container.createDiv({
			cls: isCurrent ? 'playlist-episode-item current' : 'playlist-episode-item',
			attr: { 'data-episode-id': episode.id }
		});

		// Drag and Drop
		item.draggable = true;
		item.addEventListener('dragstart', (e) => {
			if (this.selectedPlaylist) {
				this.handleDragStart(e, index, 'playlist', this.selectedPlaylist.id);
			}
		});
		item.addEventListener('dragover', (e) => this.handleDragOver(e));
		item.addEventListener('dragenter', (e) => this.handleDragEnter(e));
		item.addEventListener('dragleave', (e) => this.handleDragLeave(e));
		item.addEventListener('drop', (e) => {
			if (this.selectedPlaylist) {
				this.handleDrop(e, index, 'playlist', this.selectedPlaylist.id);
			}
		});

		// Action Icon (Drag/Play/Pause) - same as PlayerView queue
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
		const info = item.createDiv({ cls: 'playlist-episode-info' });
		info.createEl('h4', { text: episode.title, cls: 'playlist-episode-title' });

		// Metadata
		const metadata = info.createDiv({ cls: 'playlist-episode-metadata' });
		if (episode.duration) {
			metadata.createSpan({ text: this.formatDuration(episode.duration), cls: 'playlist-episode-duration' });
		}

		// Delete button
		const deleteBtn = item.createEl('button', {
			cls: 'playlist-episode-delete',
			attr: { 'aria-label': 'Remove from playlist' }
		});
		setIcon(deleteBtn, 'trash');
		deleteBtn.addEventListener('click', async (e) => {
			e.stopPropagation();
			if (this.selectedPlaylist) {
				const playlistManager = this.plugin.getPlaylistManager();
				await playlistManager.removeEpisode(this.selectedPlaylist.id, episode.id);

				// Update local state
				this.selectedPlaylist = await playlistManager.getPlaylist(this.selectedPlaylist.id);
				await this.render();
			}
		});

		// Click to play/pause
		item.addEventListener('click', async (e) => {
			e.stopPropagation();
			try {
				const currentState = this.plugin.playerController.getState();
				const isCurrentlyPlaying = currentState.currentEpisode?.id === episode.id;

				if (isCurrentlyPlaying) {
					// Current episode - toggle play/pause
					if (currentState.status === 'playing') {
						await this.plugin.playerController.pause();
					} else {
						await this.plugin.playerController.play();
					}
				} else {
					// Other episodes - play the episode
					this.handlePlayEpisode(episode, false, this.selectedPlaylist || undefined);
				}
			} catch (error) {
				console.error('Failed to play/pause episode:', error);
			}
		});

		// Context menu
		item.addEventListener('contextmenu', (e) => {
			e.preventDefault();
			this.showPlaylistEpisodeContextMenu(episode, index, e);
		});
	}

	/**
	 * Render a single episode item in queue
	 */
	private renderQueueEpisodeItem(container: HTMLElement, episode: Episode, index: number): void {
		// Check if this episode is current and playing
		const playerController = this.plugin.playerController;
		const playerState = playerController.getState();
		const isCurrent = playerState.currentEpisode?.id === episode.id;
		const isPlaying = isCurrent && playerState.status === 'playing';

		const item = container.createDiv({
			cls: isCurrent ? 'playlist-episode-item current' : 'playlist-episode-item',
			attr: { 'data-episode-id': episode.id }
		});

		// Drag and Drop
		item.draggable = true;
		item.addEventListener('dragstart', (e) => {
			if (this.selectedQueue) {
				this.handleDragStart(e, index, 'queue', this.selectedQueue.id);
			}
		});
		item.addEventListener('dragover', (e) => this.handleDragOver(e));
		item.addEventListener('dragenter', (e) => this.handleDragEnter(e));
		item.addEventListener('dragleave', (e) => this.handleDragLeave(e));
		item.addEventListener('drop', (e) => {
			if (this.selectedQueue) {
				this.handleDrop(e, index, 'queue', this.selectedQueue.id);
			}
		});

		// Action Icon (Drag/Play/Pause) - same as PlayerView queue
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
		const info = item.createDiv({ cls: 'playlist-episode-info' });
		info.createEl('h4', { text: episode.title, cls: 'playlist-episode-title' });

		// Metadata
		const metadata = info.createDiv({ cls: 'playlist-episode-metadata' });
		if (episode.duration) {
			metadata.createSpan({ text: this.formatDuration(episode.duration), cls: 'playlist-episode-duration' });
		}

		// Delete button
		const deleteBtn = item.createEl('button', {
			cls: 'playlist-episode-delete',
			attr: { 'aria-label': 'Remove from queue' }
		});
		setIcon(deleteBtn, 'trash');
		deleteBtn.addEventListener('click', async (e) => {
			e.stopPropagation();
			if (this.selectedQueue) {
				const queueManager = this.plugin.getQueueManager();
				await queueManager.removeEpisode(this.selectedQueue.id, episode.id);

				// Update local state
				this.selectedQueue = await queueManager.getQueue(this.selectedQueue.id);
				await this.render();
			}
		});

		// Click to play/pause
		item.addEventListener('click', async (e) => {
			e.stopPropagation();
			try {
				const currentState = this.plugin.playerController.getState();
				const isCurrentlyPlaying = currentState.currentEpisode?.id === episode.id;

				if (isCurrentlyPlaying) {
					// Current episode - toggle play/pause
					if (currentState.status === 'playing') {
						await this.plugin.playerController.pause();
					} else {
						await this.plugin.playerController.play();
					}
				} else {
					// Other episodes - play the episode
					if (this.selectedQueue) {
						const queueManager = this.plugin.getQueueManager();
						// Ensure this is the current queue
						queueManager.setCurrentQueue(this.selectedQueue.id);
						await queueManager.jumpTo(this.selectedQueue.id, index);
						await this.plugin.playerController.loadEpisode(episode, true);
					} else {
						this.handlePlayEpisode(episode);
					}
				}
			} catch (error) {
				console.error('Failed to play/pause episode:', error);
			}
		});

		// Context menu
		item.addEventListener('contextmenu', (e) => {
			e.preventDefault();
			this.showEpisodeContextMenu(episode, e);
		});
	}

	// Drag and Drop Handlers

	private handleDragStart(e: DragEvent, index: number, type: 'playlist' | 'queue', id: string) {
		this.dragStartIndex = index;
		this.dragType = type;
		this.dragTargetId = id;

		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = 'move';
			e.dataTransfer.setData('text/plain', JSON.stringify({ index, type, id }));
		}

		// Add dragging class for styling
		(e.target as HTMLElement).addClass('dragging');
	}

	private handleDragOver(e: DragEvent) {
		if (e.preventDefault) {
			e.preventDefault(); // Necessary. Allows us to drop.
		}
		if (e.dataTransfer) {
			e.dataTransfer.dropEffect = 'move';
		}
		return false;
	}

	private handleDragEnter(e: DragEvent) {
		(e.target as HTMLElement).closest('.playlist-episode-item')?.addClass('drag-over');
	}

	private handleDragLeave(e: DragEvent) {
		(e.target as HTMLElement).closest('.playlist-episode-item')?.removeClass('drag-over');
	}

	private async handleDrop(e: DragEvent, dropIndex: number, type: 'playlist' | 'queue', id: string) {
		e.stopPropagation(); // stops the browser from redirecting.

		(e.target as HTMLElement).closest('.playlist-episode-item')?.removeClass('drag-over');

		// Don't do anything if dropping on same item or different list
		if (this.dragStartIndex === dropIndex ||
			this.dragType !== type ||
			this.dragTargetId !== id) {
			return;
		}

		try {
			if (type === 'playlist') {
				const playlistManager = this.plugin.getPlaylistManager();
				const playlist = await playlistManager.getPlaylist(id);
				if (playlist) {
					// Reorder
					const episodeId = playlist.episodeIds[this.dragStartIndex];
					playlist.episodeIds.splice(this.dragStartIndex, 1);
					playlist.episodeIds.splice(dropIndex, 0, episodeId);

					await playlistManager.updatePlaylist(id, { episodeIds: playlist.episodeIds });

					// Update local state
					this.selectedPlaylist = playlist;
				}
			} else if (type === 'queue') {
				const queueManager = this.plugin.getQueueManager();
				const queue = await queueManager.getQueue(id);
				if (queue) {
					// Reorder
					const episodeId = queue.episodeIds[this.dragStartIndex];
					queue.episodeIds.splice(this.dragStartIndex, 1);
					queue.episodeIds.splice(dropIndex, 0, episodeId);

					await queueManager.updateQueue(id, { episodeIds: queue.episodeIds });

					// Update local state
					this.selectedQueue = queue;
				}
			}

			await this.render();
		} catch (error) {
			console.error('Failed to reorder:', error);
			new Notice('Failed to reorder items');
		} finally {
			// Cleanup
			document.querySelectorAll('.dragging').forEach(el => el.removeClass('dragging'));
			this.dragStartIndex = -1;
			this.dragType = null;
			this.dragTargetId = null;
		}

		return false;
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
	 * Handle create queue button click
	 */
	private async handleCreateQueue(): Promise<void> {
		try {
			// Prompt for queue name
			const name = await this.promptForInput('Create Queue', 'Enter queue name:');
			if (!name) return;

			const queueManager = this.plugin.getQueueManager();
			await queueManager.createQueue(name);

			new Notice(`Queue "${name}" created`);

			// Refresh the view
			await this.render();
		} catch (error) {
			console.error('Failed to create queue:', error);
			new Notice('Failed to create queue');
		}
	}

	/**
	 * Handle rename playlist button click
	 */
	private handleRenamePlaylist(): void {
		if (!this.selectedPlaylist) return;

		new RenameModal(
			this.app,
			'Rename Playlist',
			this.selectedPlaylist.name,
			'Enter new playlist name',
			async (newName) => {
				if (!this.selectedPlaylist || !newName || newName === this.selectedPlaylist.name) return;

				try {
					const playlistManager = this.plugin.getPlaylistManager();
					await playlistManager.updatePlaylist(this.selectedPlaylist.id, { name: newName });

					new Notice(`Playlist renamed to "${newName}"`);

					// Update selected playlist and refresh the view
					this.selectedPlaylist = await playlistManager.getPlaylist(this.selectedPlaylist.id);
					await this.render();
				} catch (error) {
					console.error('Failed to rename playlist:', error);
					new Notice('Failed to rename playlist');
				}
			},
			async () => {
				// Delete handler
				if (!this.selectedPlaylist) return;

				try {
					const playlistManager = this.plugin.getPlaylistManager();
					await playlistManager.deletePlaylist(this.selectedPlaylist.id);

					new Notice('Playlist deleted');
					this.selectedPlaylist = null;
					await this.render();
				} catch (error) {
					console.error('Failed to delete playlist:', error);
					new Notice('Failed to delete playlist');
				}
			}
		).open();
	}

	/**
	 * Render queue details (episodes)
	 */
	private async renderQueueDetails(): Promise<void> {
		if (!this.selectedQueue) return;

		const detailsContainer = this.sidebarContentEl.createDiv({ cls: 'playlist-details-container' });

		// Header section with metadata and play button
		const header = detailsContainer.createDiv({ cls: 'playlist-details-header podcast-sidebar-header-flex' });

		// Metadata section
		const metadata = header.createDiv({ cls: 'playlist-details-metadata' });
		metadata.createEl('p', {
			text: `${this.selectedQueue.episodeIds.length} episodes`,
			cls: 'playlist-details-count'
		});

		// Play All button
		const playAllBtn = header.createEl('button', {
			text: 'Play queue',
			cls: 'playlist-play-all-button'
		});
		setIcon(playAllBtn, 'play');
		playAllBtn.addEventListener('click', () => {
			if (this.selectedQueue) {
				this.handlePlayQueue(this.selectedQueue);
			}
		});

		// Episodes list
		const listContainer = detailsContainer.createDiv({ cls: 'episode-list-container' });

		if (this.selectedQueue.episodeIds.length === 0) {
			const empty = listContainer.createDiv({ cls: 'empty-state' });
			empty.createEl('p', { text: 'Queue is empty' });
			return;
		}

		// Load episodes
		const episodeManager = this.plugin.getEpisodeManager();
		const episodes: Episode[] = [];

		for (const episodeId of this.selectedQueue.episodeIds) {
			const episode = await episodeManager.getEpisodeWithProgress(episodeId);
			if (episode) {
				episodes.push(episode);
			}
		}

		// Render episodes
		episodes.forEach((episode, index) => {
			this.renderQueueEpisodeItem(listContainer, episode, index);
		});
	}

	/**
	 * Handle rename queue button click
	 */
	private handleRenameQueue(): void {
		if (!this.selectedQueue) return;

		new RenameModal(
			this.app,
			'Rename Queue',
			this.selectedQueue.name,
			'Enter new queue name',
			async (newName) => {
				if (!this.selectedQueue || !newName || newName === this.selectedQueue.name) return;

				try {
					const queueManager = this.plugin.getQueueManager();
					await queueManager.updateQueue(this.selectedQueue.id, { name: newName });

					// Update local state
					this.selectedQueue.name = newName;

					new Notice('Queue renamed');
					await this.render();
				} catch (error) {
					console.error('Failed to rename queue:', error);
					new Notice('Failed to rename queue');
				}
			},
			async () => {
				// Delete handler
				if (!this.selectedQueue) return;

				try {
					const queueManager = this.plugin.getQueueManager();
					await queueManager.deleteQueue(this.selectedQueue.id);

					new Notice('Queue deleted');
					this.selectedQueue = null;
					await this.render();
				} catch (error) {
					console.error('Failed to delete queue:', error);
					new Notice('Failed to delete queue');
				}
			}
		).open();
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
				.onClick(() => this.handlePlayEpisode(episode, false, this.selectedPlaylist || undefined))
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
				case 'date': {
					const aDate = new Date(a.createdAt).getTime();
					const bDate = new Date(b.createdAt).getTime();
					comparison = aDate - bDate;
					break;
				}
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
			const modal = new TextInputModal(
				this.app,
				title,
				message,
				defaultValue || '',
				(result) => resolve(result)
			);
			modal.open();
		});
	}

	/**
	 * Refresh the view
	 */
	public async refresh(): Promise<void> {
		await this.render();
	}
}
