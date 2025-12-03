/**
 * PlaylistQueueView - Playlist and Queue Management View
 *
 * Provides a unified interface for managing:
 * - Playlists (curated collections)
 * - Queues (playback queues)
 */

import { ItemView, WorkspaceLeaf, Menu, Notice, setIcon } from 'obsidian';
import type PodcastPlayerPlugin from '../../main';
import { Playlist, Queue, Episode } from '../model';
import { EpisodeDetailModal } from './EpisodeDetailModal';

export const PLAYLIST_QUEUE_VIEW_TYPE = 'playlist-queue-view';

/**
 * View mode: playlists or queues
 */
type ViewMode = 'playlists' | 'queues';

/**
 * PlaylistQueueView - Main view for playlist and queue management
 */
export class PlaylistQueueView extends ItemView {
	plugin: PodcastPlayerPlugin;
	private pqContentEl: HTMLElement;
	private viewMode: ViewMode = 'playlists';
	private selectedPlaylist: Playlist | null = null;
	private selectedQueue: Queue | null = null;
	private searchQuery: string = '';
	private sortBy: 'name' | 'date' | 'count' = 'date';
	private sortDirection: 'asc' | 'desc' = 'desc';

	constructor(leaf: WorkspaceLeaf, plugin: PodcastPlayerPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	/**
	 * Get the view type identifier
	 */
	getViewType(): string {
		return PLAYLIST_QUEUE_VIEW_TYPE;
	}

	/**
	 * Get the display text for the view
	 */
	getDisplayText(): string {
		return 'Playlists & Queues';
	}

	/**
	 * Get the icon for the view
	 */
	getIcon(): string {
		return 'list-music';
	}

	/**
	 * Called when the view is opened
	 */
	async onOpen() {
		const container = this.containerEl.children[1];
		container.empty();
		container.addClass('playlist-queue-view');

		this.pqContentEl = container.createDiv({ cls: 'playlist-queue-content' });

		await this.render();
	}

	/**
	 * Called when the view is closed
	 */
	async onClose() {
		// Cleanup if needed
	}

	/**
	 * Render the view
	 */
	private async render(): Promise<void> {
		this.pqContentEl.empty();

		// Header with mode toggle
		this.renderHeader();

		// Search box and sort options (only for list view, not details)
		if (!this.selectedPlaylist && !this.selectedQueue) {
			this.renderSearchBox();
			this.renderSortOptions();
		}

		// Content based on current selection
		if (this.selectedPlaylist) {
			await this.renderPlaylistDetails();
		} else if (this.selectedQueue) {
			await this.renderQueueDetails();
		} else if (this.viewMode === 'playlists') {
			await this.renderPlaylistList();
		} else {
			await this.renderQueueList();
		}
	}

	/**
	 * Render the search box
	 */
	private renderSearchBox(): void {
		const searchContainer = this.pqContentEl.createDiv({ cls: 'pq-search-container' });

		const searchInput = searchContainer.createEl('input', {
			type: 'text',
			placeholder: `Search ${this.viewMode}...`,
			cls: 'pq-search-input',
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
				cls: 'pq-search-clear',
				attr: { 'aria-label': 'Clear search' }
			});
			setIcon(clearBtn, 'x');
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
		const sortContainer = this.pqContentEl.createDiv({ cls: 'pq-sort-container' });

		// Sort by dropdown
		const sortByLabel = sortContainer.createSpan({ text: 'Sort: ', cls: 'sort-label' });

		const sortBySelect = sortContainer.createEl('select', { cls: 'sort-select' });

		const nameOption = sortBySelect.createEl('option', { value: 'name', text: 'Name' });
		const dateOption = sortBySelect.createEl('option', { value: 'date', text: 'Date' });
		const countOption = sortBySelect.createEl('option', { value: 'count', text: 'Episode Count' });

		sortBySelect.value = this.sortBy;

		sortBySelect.addEventListener('change', (e) => {
			this.sortBy = (e.target as HTMLSelectElement).value as 'name' | 'date' | 'count';
			this.render();
		});

		// Sort direction toggle
		const directionBtn = sortContainer.createEl('button', {
			cls: 'sort-direction-button',
			attr: { 'aria-label': 'Toggle sort direction' }
		});
		setIcon(directionBtn, this.sortDirection === 'asc' ? 'arrow-up' : 'arrow-down');
		directionBtn.addEventListener('click', () => {
			this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
			this.render();
		});
	}

	/**
	 * Render the header with mode toggle and actions
	 */
	private renderHeader(): void {
		const header = this.pqContentEl.createDiv({ cls: 'pq-header' });

		// Back button (if viewing details)
		if (this.selectedPlaylist || this.selectedQueue) {
			const backBtn = header.createEl('button', {
				cls: 'pq-back-button',
				attr: { 'aria-label': 'Back to list' }
			});
			setIcon(backBtn, 'arrow-left');
			backBtn.createSpan({ text: ' Back' });
			backBtn.addEventListener('click', () => {
				this.selectedPlaylist = null;
				this.selectedQueue = null;
				this.render();
			});
		}

		// Title
		let title = '';
		if (this.selectedPlaylist) {
			title = this.selectedPlaylist.name;
		} else if (this.selectedQueue) {
			title = this.selectedQueue.name;
		} else {
			title = this.viewMode === 'playlists' ? 'Playlists' : 'Queues';
		}

		header.createEl('h2', { text: title, cls: 'pq-title' });

		// Mode toggle (only if not viewing details)
		if (!this.selectedPlaylist && !this.selectedQueue) {
			const modeToggle = header.createDiv({ cls: 'pq-mode-toggle' });

			const playlistBtn = modeToggle.createEl('button', {
				text: 'Playlists',
				cls: this.viewMode === 'playlists' ? 'pq-mode-active' : 'pq-mode-inactive'
			});
			playlistBtn.addEventListener('click', () => {
				this.viewMode = 'playlists';
				this.render();
			});

			const queueBtn = modeToggle.createEl('button', {
				text: 'Queues',
				cls: this.viewMode === 'queues' ? 'pq-mode-active' : 'pq-mode-inactive'
			});
			queueBtn.addEventListener('click', () => {
				this.viewMode = 'queues';
				this.render();
			});
		}

		// Action buttons
		const actions = header.createDiv({ cls: 'pq-actions' });

		if (!this.selectedPlaylist && !this.selectedQueue) {
			// Add new button
			const addBtn = actions.createEl('button', {
				cls: 'pq-action-button',
				attr: { 'aria-label': `Create new ${this.viewMode === 'playlists' ? 'playlist' : 'queue'}` }
			});
			setIcon(addBtn, 'plus');
			addBtn.addEventListener('click', () => this.handleCreate());
		}
	}

	/**
	 * Render the playlist list
	 */
	private async renderPlaylistList(): Promise<void> {
		const listContainer = this.pqContentEl.createDiv({ cls: 'pq-list-container' });

		const playlistManager = this.plugin.getPlaylistManager();
		let playlists = await playlistManager.getAllPlaylists();

		// Filter playlists based on search query
		if (this.searchQuery) {
			playlists = this.filterPlaylists(playlists, this.searchQuery);
		}

		// Sort playlists
		playlists = this.sortPlaylists(playlists, this.sortBy, this.sortDirection);

		if (playlists.length === 0) {
			const empty = listContainer.createDiv({ cls: 'pq-empty-state' });
			if (this.searchQuery) {
				empty.createEl('p', { text: 'No playlists found' });
				empty.createEl('p', {
					text: `No playlists match "${this.searchQuery}"`,
					cls: 'pq-empty-hint'
				});
			} else {
				empty.createEl('p', { text: 'No playlists yet' });
				empty.createEl('p', {
					text: 'Click the + button to create a playlist',
					cls: 'pq-empty-hint'
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
		const item = container.createDiv({ cls: 'pq-item' });

		// Info section
		const info = item.createDiv({ cls: 'pq-item-info' });
		info.createEl('h3', { text: playlist.name, cls: 'pq-item-title' });

		if (playlist.description) {
			info.createEl('p', { text: playlist.description, cls: 'pq-item-description' });
		}

		// Metadata
		const metadata = info.createDiv({ cls: 'pq-item-metadata' });
		metadata.createSpan({ text: `${playlist.episodeIds.length} episodes`, cls: 'pq-item-count' });
		metadata.createSpan({ text: ` • Updated ${this.formatDate(playlist.updatedAt)}`, cls: 'pq-item-date' });

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
	 * Render the queue list
	 */
	private async renderQueueList(): Promise<void> {
		const listContainer = this.pqContentEl.createDiv({ cls: 'pq-list-container' });

		const queueManager = this.plugin.getQueueManager();
		let queues = await queueManager.getAllQueues();

		// Filter queues based on search query
		if (this.searchQuery) {
			queues = this.filterQueues(queues, this.searchQuery);
		}

		// Sort queues
		queues = this.sortQueues(queues, this.sortBy, this.sortDirection);

		if (queues.length === 0) {
			const empty = listContainer.createDiv({ cls: 'pq-empty-state' });
			if (this.searchQuery) {
				empty.createEl('p', { text: 'No queues found' });
				empty.createEl('p', {
					text: `No queues match "${this.searchQuery}"`,
					cls: 'pq-empty-hint'
				});
			} else {
				empty.createEl('p', { text: 'No queues yet' });
				empty.createEl('p', {
					text: 'Click the + button to create a queue',
					cls: 'pq-empty-hint'
				});
			}
			return;
		}

		for (const queue of queues) {
			this.renderQueueItem(listContainer, queue);
		}
	}

	/**
	 * Render a single queue item
	 */
	private renderQueueItem(container: HTMLElement, queue: Queue): void {
		const item = container.createDiv({ cls: 'pq-item' });

		// Info section
		const info = item.createDiv({ cls: 'pq-item-info' });
		info.createEl('h3', { text: queue.name, cls: 'pq-item-title' });

		// Queue status
		const status = info.createDiv({ cls: 'pq-item-status' });
		status.createSpan({ text: `Shuffle: ${queue.shuffle ? 'On' : 'Off'}` });
		status.createSpan({ text: ` • Repeat: ${this.formatRepeatMode(queue.repeat)}` });

		// Metadata
		const metadata = info.createDiv({ cls: 'pq-item-metadata' });
		metadata.createSpan({ text: `${queue.episodeIds.length} episodes`, cls: 'pq-item-count' });
		if (queue.episodeIds.length > 0) {
			metadata.createSpan({ text: ` • Current: ${queue.currentIndex + 1}`, cls: 'pq-item-current' });
		}

		// Click to view details
		item.addEventListener('click', () => {
			this.selectedQueue = queue;
			this.render();
		});

		// Context menu
		item.addEventListener('contextmenu', (e) => {
			e.preventDefault();
			this.showQueueContextMenu(queue, e);
		});
	}

	/**
	 * Render playlist details (episodes)
	 */
	private async renderPlaylistDetails(): Promise<void> {
		if (!this.selectedPlaylist) return;

		const detailsContainer = this.pqContentEl.createDiv({ cls: 'pq-details-container' });

		// Metadata section
		const metadata = detailsContainer.createDiv({ cls: 'pq-details-metadata' });
		if (this.selectedPlaylist.description) {
			metadata.createEl('p', { text: this.selectedPlaylist.description, cls: 'pq-details-description' });
		}
		metadata.createEl('p', {
			text: `${this.selectedPlaylist.episodeIds.length} episodes • Created ${this.formatDate(this.selectedPlaylist.createdAt)}`,
			cls: 'pq-details-info'
		});

		// Episodes list
		await this.renderEpisodeList(detailsContainer, this.selectedPlaylist.episodeIds, 'playlist');
	}

	/**
	 * Render queue details (episodes)
	 */
	private async renderQueueDetails(): Promise<void> {
		if (!this.selectedQueue) return;

		const detailsContainer = this.pqContentEl.createDiv({ cls: 'pq-details-container' });

		// Queue controls
		const controls = detailsContainer.createDiv({ cls: 'pq-queue-controls' });

		// Shuffle toggle
		const shuffleBtn = controls.createEl('button', {
			text: `Shuffle: ${this.selectedQueue.shuffle ? 'On' : 'Off'}`,
			cls: 'pq-control-button'
		});
		shuffleBtn.addEventListener('click', async () => {
			if (this.selectedQueue) {
				const queueManager = this.plugin.getQueueManager();
				await queueManager.toggleShuffle(this.selectedQueue.id);
				this.selectedQueue = await queueManager.getQueue(this.selectedQueue.id);
				await this.render();
			}
		});

		// Repeat mode cycle
		const repeatBtn = controls.createEl('button', {
			text: `Repeat: ${this.formatRepeatMode(this.selectedQueue.repeat)}`,
			cls: 'pq-control-button'
		});
		repeatBtn.addEventListener('click', async () => {
			if (this.selectedQueue) {
				const queueManager = this.plugin.getQueueManager();
				const modes: Array<'none' | 'one' | 'all'> = ['none', 'one', 'all'];
				const currentIndex = modes.indexOf(this.selectedQueue.repeat);
				const nextMode = modes[(currentIndex + 1) % modes.length];
				await queueManager.setRepeat(this.selectedQueue.id, nextMode);
				this.selectedQueue = await queueManager.getQueue(this.selectedQueue.id);
				await this.render();
			}
		});

		// Episodes list
		await this.renderEpisodeList(detailsContainer, this.selectedQueue.episodeIds, 'queue', this.selectedQueue.currentIndex);
	}

	/**
	 * Render episode list
	 */
	private async renderEpisodeList(
		container: HTMLElement,
		episodeIds: string[],
		type: 'playlist' | 'queue',
		currentIndex?: number
	): Promise<void> {
		if (episodeIds.length === 0) {
			const empty = container.createDiv({ cls: 'pq-empty-state' });
			empty.createEl('p', { text: 'No episodes in this ' + type });
			return;
		}

		const episodeManager = this.plugin.getEpisodeManager();
		const listContainer = container.createDiv({ cls: 'pq-episode-list' });

		for (let i = 0; i < episodeIds.length; i++) {
			const episodeId = episodeIds[i];
			try {
				const episodeWithProgress = await episodeManager.getEpisodeWithProgress(episodeId);
				if (episodeWithProgress) {
					this.renderEpisodeItem(listContainer, episodeWithProgress, i, type, i === currentIndex);
				}
			} catch (error) {
				console.error(`Failed to load episode: ${episodeId}`, error);
			}
		}
	}

	/**
	 * Render a single episode item
	 */
	private renderEpisodeItem(
		container: HTMLElement,
		episode: Episode,
		index: number,
		type: 'playlist' | 'queue',
		isCurrent: boolean = false
	): void {
		const item = container.createDiv({ cls: isCurrent ? 'pq-episode-item pq-episode-current' : 'pq-episode-item' });

		// Index
		const indexEl = item.createDiv({ cls: 'pq-episode-index' });
		indexEl.textContent = `${index + 1}`;

		// Info
		const info = item.createDiv({ cls: 'pq-episode-info' });
		info.createEl('h4', { text: episode.title, cls: 'pq-episode-title' });

		// Metadata
		const metadata = info.createDiv({ cls: 'pq-episode-metadata' });
		if (episode.duration) {
			metadata.createSpan({ text: this.formatDuration(episode.duration), cls: 'pq-episode-duration' });
		}

		// Play button
		const playBtn = item.createEl('button', {
			cls: 'pq-episode-play',
			attr: { 'aria-label': 'Play episode' }
		});
		setIcon(playBtn, 'play');
		playBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			this.handlePlayEpisode(episode);
		});

		// Click to show episode details
		item.addEventListener('click', () => {
			new EpisodeDetailModal(this.app, this.plugin, episode).open();
		});

		// Context menu
		item.addEventListener('contextmenu', (e) => {
			e.preventDefault();
			this.showEpisodeContextMenu(episode, index, type, e);
		});
	}

	/**
	 * Handle create new playlist/queue
	 */
	private async handleCreate(): Promise<void> {
		// Placeholder - will show modal for creating new playlist/queue
		new Notice(`Create new ${this.viewMode === 'playlists' ? 'playlist' : 'queue'} - Coming soon!`);
		// TODO: Show modal for name input
	}

	/**
	 * Handle play episode
	 */
	private async handlePlayEpisode(episode: Episode): Promise<void> {
		try {
			const playerController = this.plugin.playerController;
			await playerController.loadEpisode(episode, true, true);
			new Notice(`Now playing: ${episode.title}`);
		} catch (error) {
			console.error('Failed to play episode:', error);
			new Notice('Failed to start playback');
		}
	}

	/**
	 * Show playlist context menu
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
				.onClick(() => {
					new Notice('Rename playlist - Coming soon!');
					// TODO: Show rename modal
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
	 * Show queue context menu
	 */
	private showQueueContextMenu(queue: Queue, event: MouseEvent): void {
		const menu = new Menu();

		menu.addItem((item) =>
			item
				.setTitle('View Details')
				.setIcon('list')
				.onClick(() => {
					this.selectedQueue = queue;
					this.render();
				})
		);

		menu.addItem((item) =>
			item
				.setTitle('Rename')
				.setIcon('pencil')
				.onClick(() => {
					new Notice('Rename queue - Coming soon!');
					// TODO: Show rename modal
				})
		);

		menu.addSeparator();

		menu.addItem((item) =>
			item
				.setTitle('Clear')
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
				.setTitle('Delete')
				.setIcon('trash')
				.onClick(async () => {
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
	 * Show episode context menu
	 */
	private showEpisodeContextMenu(episode: Episode, index: number, type: 'playlist' | 'queue', event: MouseEvent): void {
		const menu = new Menu();

		menu.addItem((item) =>
			item
				.setTitle('View Details')
				.setIcon('info')
				.onClick(() => {
					new EpisodeDetailModal(this.app, this.plugin, episode).open();
				})
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
				.setTitle('Remove from ' + type)
				.setIcon('trash')
				.onClick(async () => {
					try {
						if (type === 'playlist' && this.selectedPlaylist) {
							const playlistManager = this.plugin.getPlaylistManager();
							await playlistManager.removeEpisode(this.selectedPlaylist.id, episode.id);
							this.selectedPlaylist = await playlistManager.getPlaylist(this.selectedPlaylist.id);
							new Notice('Episode removed from playlist');
						} else if (type === 'queue' && this.selectedQueue) {
							const queueManager = this.plugin.getQueueManager();
							await queueManager.removeEpisode(this.selectedQueue.id, episode.id);
							this.selectedQueue = await queueManager.getQueue(this.selectedQueue.id);
							new Notice('Episode removed from queue');
						}
						await this.render();
					} catch (error) {
						console.error('Failed to remove episode:', error);
						new Notice('Failed to remove episode');
					}
				})
		);

		menu.showAtMouseEvent(event);
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
	 * Filter queues based on search query
	 */
	private filterQueues(queues: Queue[], query: string): Queue[] {
		const lowerQuery = query.toLowerCase();
		return queues.filter(queue => {
			// Search in name
			if (queue.name.toLowerCase().includes(lowerQuery)) {
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
	 * Sort queues based on criteria
	 */
	private sortQueues(
		queues: Queue[],
		sortBy: 'name' | 'date' | 'count',
		direction: 'asc' | 'desc'
	): Queue[] {
		const sorted = [...queues].sort((a, b) => {
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
	 * Refresh the view
	 */
	public async refresh(): Promise<void> {
		await this.render();
	}
}
