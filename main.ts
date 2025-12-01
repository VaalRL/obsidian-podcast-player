import { Plugin, Notice, WorkspaceLeaf } from 'obsidian';
import { PluginSettings, DEFAULT_SETTINGS } from './src/model';
import {
	SettingsStore,
	DataPathManager,
	SubscriptionStore,
	ProgressStore,
	FeedCacheStore,
	ImageCacheStore
} from './src/storage';
import {
	PodcastPlayerSettingTab,
	PlayerView,
	PLAYER_VIEW_TYPE,
	PodcastSidebarView,
	PODCAST_SIDEBAR_VIEW_TYPE,
	PlaylistQueueView,
	PLAYLIST_QUEUE_VIEW_TYPE,
	SubscribePodcastModal
} from './src/ui';
import { PlaylistStore, PlaylistManager } from './src/playlist';
import { QueueStore, QueueManager } from './src/queue';
import { FeedService, FeedSyncManager } from './src/feed';
import { PodcastService, EpisodeManager } from './src/podcast';
import { PlaybackEngine, ProgressTracker, PlayerController } from './src/player';
import { NoteExporter } from './src/markdown';
import { logger } from './src/utils/Logger';

/**
 * Podcast Player Plugin for Obsidian
 *
 * A feature-rich podcast player and manager that allows you to:
 * - Subscribe to and manage podcast feeds (RSS/Atom)
 * - Play podcast episodes with custom settings
 * - Manage playlists and playback queues
 * - Export episode information to notes with timestamps
 */
export default class PodcastPlayerPlugin extends Plugin {
	settings: PluginSettings;

	// Core infrastructure
	private pathManager: DataPathManager;
	private settingsStore: SettingsStore;

	// Storage layer
	private subscriptionStore: SubscriptionStore;
	private progressStore: ProgressStore;
	private playlistStore: PlaylistStore;
	private queueStore: QueueStore;
	private feedCacheStore: FeedCacheStore;
	private imageCacheStore: ImageCacheStore;

	// Service layer
	private feedService: FeedService;
	private podcastService: PodcastService;
	private episodeManager: EpisodeManager;
	private feedSyncManager: FeedSyncManager;

	// Management layer
	private playlistManager: PlaylistManager;
	private queueManager: QueueManager;

	// Player layer
	private playbackEngine: PlaybackEngine;
	private progressTracker: ProgressTracker;
	playerController: PlayerController; // Public for UI access

	// Markdown layer
	private noteExporter: NoteExporter;

	/**
	 * Plugin lifecycle: Called when the plugin is loaded
	 */
	async onload() {
		logger.info('Loading Podcast Player plugin');

		// Initialize data path manager with default path
		this.pathManager = new DataPathManager(this.app.vault, DEFAULT_SETTINGS.dataFolderPath);
		this.settingsStore = new SettingsStore(this.app.vault, this.pathManager);

		// Load settings
		await this.loadSettings();

		// Ensure data directories exist
		await this.pathManager.ensureDirectories();

		// Initialize storage layer
		this.subscriptionStore = new SubscriptionStore(this.app.vault, this.pathManager);
		this.progressStore = new ProgressStore(this.app.vault, this.pathManager);
		this.playlistStore = new PlaylistStore(this.app.vault, this.pathManager);
		this.queueStore = new QueueStore(this.app.vault, this.pathManager);
		this.feedCacheStore = new FeedCacheStore(this.app.vault, this.pathManager);
		this.imageCacheStore = new ImageCacheStore(this.app.vault, this.pathManager);

		// Initialize service layer
		this.feedService = new FeedService(this.feedCacheStore);
		this.podcastService = new PodcastService(
			this.feedService,
			this.subscriptionStore,
			this.imageCacheStore
		);
		this.episodeManager = new EpisodeManager(this.progressStore, this.subscriptionStore);
		this.feedSyncManager = new FeedSyncManager(
			this.feedService,
			this.subscriptionStore,
			this.settings.feedUpdateInterval * 60 * 1000 // Convert minutes to milliseconds
		);

		// Initialize management layer
		this.playlistManager = new PlaylistManager(this.playlistStore);
		this.queueManager = new QueueManager(this.queueStore);

		// Initialize player layer
		this.playbackEngine = new PlaybackEngine();
		this.progressTracker = new ProgressTracker(this.progressStore);
		this.playerController = new PlayerController(this.playbackEngine, this.progressTracker);

		// Initialize markdown layer
		this.noteExporter = new NoteExporter(this.app.vault);

		// Register view types
		this.registerView(
			PLAYER_VIEW_TYPE,
			(leaf) => new PlayerView(leaf, this)
		);

		this.registerView(
			PODCAST_SIDEBAR_VIEW_TYPE,
			(leaf) => new PodcastSidebarView(leaf, this)
		);

		this.registerView(
			PLAYLIST_QUEUE_VIEW_TYPE,
			(leaf) => new PlaylistQueueView(leaf, this)
		);

		// Register settings tab
		this.addSettingTab(new PodcastPlayerSettingTab(this.app, this));

		// Add ribbon icon for quick access - opens both left and right panels
		this.addRibbonIcon('podcast', 'Podcast Player', async (evt: MouseEvent) => {
			await this.activateSidebarView(); // Left panel: Podcast management
			await this.activatePlayerView(); // Right panel: Player controls
		});

		// Register commands
		this.addCommand({
			id: 'open-podcast-player',
			name: 'Open Podcast Player',
			callback: async () => {
				await this.activatePlayerView();
			}
		});

		this.addCommand({
			id: 'open-podcast-sidebar',
			name: 'Open Podcast Sidebar',
			callback: async () => {
				await this.activateSidebarView();
			}
		});

		this.addCommand({
			id: 'subscribe-to-podcast',
			name: 'Subscribe to Podcast',
			callback: () => {
				new SubscribePodcastModal(
					this.app,
					this,
					async (podcastId) => {
						// Callback after successful subscription
						logger.info(`Successfully subscribed to podcast: ${podcastId}`);
						// Activate sidebar to show the new podcast
						await this.activateSidebarView();
					}
				).open();
			}
		});

		this.addCommand({
			id: 'open-playlist-queue',
			name: 'Open Playlists & Queues',
			callback: async () => {
				await this.activatePlaylistQueueView();
			}
		});

		logger.info('Podcast Player plugin loaded successfully');
	}

	/**
	 * Plugin lifecycle: Called when the plugin is unloaded
	 */
	onunload() {
		logger.info('Unloading Podcast Player plugin');

		// Stop feed sync manager
		if (this.feedSyncManager) {
			this.feedSyncManager.stopAutoSync();
		}

		// Stop player
		if (this.playerController) {
			this.playerController.stop();
		}

		// Detach all our custom views
		this.app.workspace.detachLeavesOfType(PLAYER_VIEW_TYPE);
		this.app.workspace.detachLeavesOfType(PODCAST_SIDEBAR_VIEW_TYPE);
		this.app.workspace.detachLeavesOfType(PLAYLIST_QUEUE_VIEW_TYPE);
	}

	/**
	 * Load settings from store
	 */
	async loadSettings() {
		logger.methodEntry('PodcastPlayerPlugin', 'loadSettings');
		try {
			this.settings = await this.settingsStore.loadWithMigration();

			// Update path manager with current data folder path
			this.pathManager.updateBasePath(this.settings.dataFolderPath);

			logger.info('Settings loaded successfully');
		} catch (error) {
			logger.error('Failed to load settings, using defaults', error);
			this.settings = { ...DEFAULT_SETTINGS };
		}
		logger.methodExit('PodcastPlayerPlugin', 'loadSettings');
	}

	/**
	 * Save settings to store
	 */
	async saveSettings() {
		logger.methodEntry('PodcastPlayerPlugin', 'saveSettings');
		try {
			await this.settingsStore.updateSettings(this.settings);

			// Update path manager if data folder path changed
			this.pathManager.updateBasePath(this.settings.dataFolderPath);

			logger.info('Settings saved successfully');
		} catch (error) {
			logger.error('Failed to save settings', error);
			new Notice('Failed to save settings');
		}
		logger.methodExit('PodcastPlayerPlugin', 'saveSettings');
	}

	/**
	 * Reset settings to defaults
	 */
	async resetSettings() {
		logger.methodEntry('PodcastPlayerPlugin', 'resetSettings');
		try {
			await this.settingsStore.resetToDefaults();
			this.settings = { ...DEFAULT_SETTINGS };

			// Update path manager
			this.pathManager.updateBasePath(this.settings.dataFolderPath);

			logger.info('Settings reset to defaults');
		} catch (error) {
			logger.error('Failed to reset settings', error);
			new Notice('Failed to reset settings');
		}
		logger.methodExit('PodcastPlayerPlugin', 'resetSettings');
	}

	/**
	 * Activate the player view
	 */
	async activatePlayerView() {
		logger.methodEntry('PodcastPlayerPlugin', 'activatePlayerView');

		const { workspace } = this.app;

		// Check if view is already open
		let leaf: WorkspaceLeaf | null = null;
		const leaves = workspace.getLeavesOfType(PLAYER_VIEW_TYPE);

		if (leaves.length > 0) {
			// View already exists, reveal it
			leaf = leaves[0];
		} else {
			// Create new view in right sidebar
			leaf = workspace.getRightLeaf(false);
			if (leaf) {
				await leaf.setViewState({
					type: PLAYER_VIEW_TYPE,
					active: true
				});
			}
		}

		// Reveal the leaf
		if (leaf) {
			workspace.revealLeaf(leaf);
		}

		logger.methodExit('PodcastPlayerPlugin', 'activatePlayerView');
	}

	/**
	 * Activate the sidebar view
	 */
	async activateSidebarView() {
		logger.methodEntry('PodcastPlayerPlugin', 'activateSidebarView');

		const { workspace } = this.app;

		// Check if view is already open
		let leaf: WorkspaceLeaf | null = null;
		const leaves = workspace.getLeavesOfType(PODCAST_SIDEBAR_VIEW_TYPE);

		if (leaves.length > 0) {
			// View already exists, reveal it
			leaf = leaves[0];
		} else {
			// Create new view in left sidebar
			leaf = workspace.getLeftLeaf(false);
			if (leaf) {
				await leaf.setViewState({
					type: PODCAST_SIDEBAR_VIEW_TYPE,
					active: true
				});
			}
		}

		// Reveal the leaf
		if (leaf) {
			workspace.revealLeaf(leaf);
		}

		logger.methodExit('PodcastPlayerPlugin', 'activateSidebarView');
	}

	/**
	 * Get the subscription store (for UI components)
	 */
	getSubscriptionStore(): SubscriptionStore {
		return this.subscriptionStore;
	}

	/**
	 * Get the podcast service (for UI components)
	 */
	getPodcastService(): PodcastService {
		return this.podcastService;
	}

	/**
	 * Get the episode manager (for UI components)
	 */
	getEpisodeManager(): EpisodeManager {
		return this.episodeManager;
	}

	/**
	 * Get the playlist manager (for UI components)
	 */
	getPlaylistManager(): PlaylistManager {
		return this.playlistManager;
	}

	/**
	 * Get the queue manager (for UI components)
	 */
	getQueueManager(): QueueManager {
		return this.queueManager;
	}

	/**
	 * Get the feed sync manager (for UI components)
	 */
	getFeedSyncManager(): FeedSyncManager {
		return this.feedSyncManager;
	}

	/**
	 * Get the note exporter (for UI components)
	 */
	getNoteExporter(): NoteExporter {
		return this.noteExporter;
	}

	/**
	 * Activate the playlist/queue view
	 */
	async activatePlaylistQueueView() {
		logger.methodEntry('PodcastPlayerPlugin', 'activatePlaylistQueueView');

		const { workspace } = this.app;

		// Check if view is already open
		let leaf: WorkspaceLeaf | null = null;
		const leaves = workspace.getLeavesOfType(PLAYLIST_QUEUE_VIEW_TYPE);

		if (leaves.length > 0) {
			// View already exists, reveal it
			leaf = leaves[0];
		} else {
			// Create new view in right sidebar
			leaf = workspace.getRightLeaf(false);
			if (leaf) {
				await leaf.setViewState({
					type: PLAYLIST_QUEUE_VIEW_TYPE,
					active: true
				});
			}
		}

		// Reveal the leaf
		if (leaf) {
			workspace.revealLeaf(leaf);
		}

		logger.methodExit('PodcastPlayerPlugin', 'activatePlaylistQueueView');
	}
}
