import { Plugin, Notice, WorkspaceLeaf, Events } from 'obsidian';
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
import { CleanupService } from './src/cleanup/CleanupService';
import { BackupService } from './src/backup';
import { logger } from './src/utils/Logger';

// Type-safe event registration helper for custom podcast events
type PodcastEvents = Events & {
	on(name: 'podcast:queue-updated', callback: (queueId: string) => void): ReturnType<Events['on']>;
	on(name: 'podcast:player-state-updated', callback: () => void): ReturnType<Events['on']>;
	on(name: 'podcast:episode-changed', callback: () => void): ReturnType<Events['on']>;
	on(name: 'podcast:playlist-updated', callback: (playlistId: string) => void): ReturnType<Events['on']>;
	on(name: 'podcast:queue-changed', callback: () => void): ReturnType<Events['on']>;
};

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

	// Cleanup layer
	private cleanupService: CleanupService;

	// Backup layer
	private backupService: BackupService;

	/**
	 * Plugin lifecycle: Called when the plugin is loaded
	 */
	async onload() {
		logger.info('Loading Podcast Player plugin');

		// Initialize data path manager with default path using configDir
		const defaultDataPath = `${this.app.vault.configDir}/${DEFAULT_SETTINGS.dataFolderPath}`;
		this.pathManager = new DataPathManager(this.app.vault, defaultDataPath);
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

		// Initialize management layer
		this.playlistManager = new PlaylistManager(this.playlistStore, this.app);
		this.queueManager = new QueueManager(this.queueStore, this.app);

		this.feedSyncManager = new FeedSyncManager(
			this.feedService,
			this.subscriptionStore,
			this.queueManager,
			this.playlistManager,
			this.settings.feedUpdateInterval * 60 * 1000 // Convert minutes to milliseconds
		);

		// Initialize player layer
		this.playbackEngine = new PlaybackEngine();
		this.progressTracker = new ProgressTracker(this.progressStore);
		this.playerController = new PlayerController(this.playbackEngine, this.progressTracker);

		// Set up settings provider for podcast-specific playback settings
		this.playerController.setSettingsProvider(async (podcastId: string) => {
			try {
				const podcast = await this.subscriptionStore.getPodcast(podcastId);
				if (podcast?.settings) {
					return podcast.settings;
				}
				// Return default settings if no podcast-specific settings
				return this.settings.defaultPlaybackSettings;
			} catch (error) {
				logger.warn('Failed to get podcast settings', error);
				return this.settings.defaultPlaybackSettings;
			}
		});

		// Set up player event handlers
		let lastStatus = 'stopped';
		let lastEpisodeId: string | null = null;
		let lastSpeed = 1;

		this.playerController.setEventHandlers({
			onStateChange: (state) => {
				// Only trigger update if status, episode, or speed changed
				// Ignore position updates to prevent event flooding
				if (state.status !== lastStatus ||
					state.currentEpisode?.id !== lastEpisodeId ||
					state.playbackSpeed !== lastSpeed) {

					lastStatus = state.status;
					lastEpisodeId = state.currentEpisode?.id || null;
					lastSpeed = state.playbackSpeed;

					this.app.workspace.trigger('podcast:player-state-updated', state);
				}
			},
			onEpisodeChange: (episode) => {
				lastEpisodeId = episode?.id || null;
				this.app.workspace.trigger('podcast:episode-changed', episode);
			},
			onEpisodeEnded: (episode) => {
				void (async () => {
					// When an episode ends, try to play the next one from the queue
					// and remove the played episode (queue behavior)
					const currentQueue = await this.queueManager.getCurrentQueue();
					if (currentQueue && currentQueue.autoPlayNext) {
						const nextEpisodeId = await this.queueManager.nextAndRemovePlayed(currentQueue.id);
						if (nextEpisodeId) {
							// Load and play the next episode
							const nextEpisode = await this.episodeManager.getEpisodeWithProgress(nextEpisodeId);
							if (nextEpisode) {
								await this.playerController.loadEpisode(nextEpisode, true, true);
							}
						}
						// Trigger UI refresh
						this.app.workspace.trigger('podcast:queue-changed');
					}
				})();
			}
		});

		// Synchronization Logic

		// Sync Queue -> Playlist
		this.registerEvent(
			(this.app.workspace as unknown as PodcastEvents).on('podcast:queue-updated', (queueId: string) => {
				void (async () => {
					const queue = await this.queueManager.getQueue(queueId);
					if (queue && queue.isPlaylist && queue.sourceId) {
						const playlist = await this.playlistManager.getPlaylist(queue.sourceId);
						if (playlist) {
							// Compare episode IDs
							const queueIds = queue.episodeIds;
							const playlistIds = playlist.episodeIds;

							if (JSON.stringify(queueIds) !== JSON.stringify(playlistIds)) {
								// Update playlist to match queue
								await this.playlistManager.updatePlaylist(playlist.id, { episodeIds: queueIds });
							}
						}
					}
				})();
			})
		);

		// Sync Playlist -> Queue
		this.registerEvent(
			(this.app.workspace as unknown as PodcastEvents).on('podcast:playlist-updated', (playlistId: string) => {
				void (async () => {
					const queues = await this.queueManager.getAllQueues();
					const derivedQueue = queues.find(q => q.sourceId === playlistId);

					if (derivedQueue) {
						const playlist = await this.playlistManager.getPlaylist(playlistId);
						if (playlist) {
							const queueIds = derivedQueue.episodeIds;
							const playlistIds = playlist.episodeIds;

							// Check for name change
							// Note: We use "Playlist: " prefix in PlayerView logic, so we should maintain it or check how it's stored
							// In PodcastSidebarView.ts:966, name is set to `Playlist: ${playlist.name}`
							const expectedName = `Playlist: ${playlist.name}`;
							const nameChanged = derivedQueue.name !== expectedName;
							const episodesChanged = JSON.stringify(queueIds) !== JSON.stringify(playlistIds);

							if (episodesChanged || nameChanged) {
								const updates: Partial<{ episodeIds: string[]; name: string }> = {};

								if (episodesChanged) {
									updates.episodeIds = playlistIds;
								}

								if (nameChanged) {
									updates.name = expectedName;
								}

								await this.queueManager.updateQueue(derivedQueue.id, updates);

								// Try to restore current index only if episodes changed
								if (episodesChanged) {
									const currentEpisodeId = derivedQueue.episodeIds[derivedQueue.currentIndex];
									const newIndex = playlistIds.indexOf(currentEpisodeId);
									if (newIndex !== -1) {
										await this.queueManager.jumpTo(derivedQueue.id, newIndex);
									} else {
										await this.queueManager.jumpTo(derivedQueue.id, 0);
									}
								}
							}
						}
					}
				})();
			})
		);

		// Initialize markdown layer
		this.noteExporter = new NoteExporter(this.app.vault);

		// Initialize cleanup layer
		this.cleanupService = new CleanupService(
			this.progressStore,
			this.feedCacheStore,
			this.imageCacheStore,
			this.episodeManager,
			{
				enabled: true,
				intervalMs: 24 * 60 * 60 * 1000, // 24 hours
				completedRetentionDays: 30,
				inProgressRetentionDays: 90,
				maxCacheSizeMB: 100
			}
		);

		// Start automatic cleanup
		this.cleanupService.start();

		// Initialize backup layer
		this.backupService = new BackupService(
			this.app.vault,
			this.pathManager,
			this.subscriptionStore,
			this.progressStore,
			this.playlistStore,
			this.queueStore,
			{
				autoBackupEnabled: true,
				autoBackupIntervalMs: 24 * 60 * 60 * 1000, // 24 hours
				retentionDays: 30
			}
		);

		// Start automatic backup
		this.backupService.start();

		// Register view types
		try {
			this.registerView(
				PLAYER_VIEW_TYPE,
				(leaf) => new PlayerView(leaf, this)
			);
		} catch (e) {
			logger.warn(`View ${PLAYER_VIEW_TYPE} might be already registered`, e);
		}

		try {
			this.registerView(
				PODCAST_SIDEBAR_VIEW_TYPE,
				(leaf) => new PodcastSidebarView(leaf, this)
			);
		} catch (e) {
			logger.warn(`View ${PODCAST_SIDEBAR_VIEW_TYPE} might be already registered`, e);
		}

		try {
			this.registerView(
				PLAYLIST_QUEUE_VIEW_TYPE,
				(leaf) => new PlaylistQueueView(leaf, this)
			);
		} catch (e) {
			logger.warn(`View ${PLAYLIST_QUEUE_VIEW_TYPE} might be already registered`, e);
		}

		// Register settings tab
		this.addSettingTab(new PodcastPlayerSettingTab(this.app, this));

		// Add ribbon icon for quick access - opens both left and right panels
		this.addRibbonIcon('podcast', 'Podcast player', () => {
			void this.activateSidebarView(); // Left panel: Podcast management
			void this.activatePlayerView(); // Right panel: Player controls
		});

		// Register commands
		this.addCommand({
			id: 'open-player',
			name: 'Open player',
			callback: () => {
				void this.activatePlayerView();
			}
		});

		this.addCommand({
			id: 'open-sidebar',
			name: 'Open sidebar',
			callback: () => {
				void this.activateSidebarView();
			}
		});

		this.addCommand({
			id: 'subscribe',
			name: 'Subscribe',
			callback: () => {
				new SubscribePodcastModal(
					this.app,
					this,
					(podcastId) => {
						// Callback after successful subscription
						logger.info(`Successfully subscribed to podcast: ${podcastId}`);
						// Activate sidebar to show the new podcast
						void this.activateSidebarView();
					}
				).open();
			}
		});

		this.addCommand({
			id: 'open-playlists-queues',
			name: 'Open playlists',
			callback: () => {
				void this.activatePlaylistQueueView();
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
			void this.playerController.stop();
		}

		// Stop cleanup service
		if (this.cleanupService) {
			this.cleanupService.stop();
		}

		// Stop backup service
		if (this.backupService) {
			this.backupService.stop();
		}
	}

	/**
	 * Load settings from store
	 */
	async loadSettings() {
		logger.methodEntry('PodcastPlayerPlugin', 'loadSettings');
		try {
			this.settings = await this.settingsStore.loadWithMigration();

			// Handle data folder path - ensure it uses configDir for default
			let dataPath = this.settings.dataFolderPath;
			if (!dataPath || dataPath === DEFAULT_SETTINGS.dataFolderPath) {
				// Use default path with configDir prefix
				dataPath = `${this.app.vault.configDir}/${DEFAULT_SETTINGS.dataFolderPath}`;
				this.settings.dataFolderPath = dataPath;
			}

			// Update path manager with current data folder path
			this.pathManager.updateBasePath(dataPath);

			logger.info('Settings loaded successfully');
		} catch (error) {
			logger.error('Failed to load settings, using defaults', error);
			this.settings = {
				...DEFAULT_SETTINGS,
				dataFolderPath: `${this.app.vault.configDir}/${DEFAULT_SETTINGS.dataFolderPath}`
			};
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
			this.settings = {
				...DEFAULT_SETTINGS,
				dataFolderPath: `${this.app.vault.configDir}/${DEFAULT_SETTINGS.dataFolderPath}`
			};

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
	 * Get the backup service (for UI components)
	 */
	getBackupService(): BackupService {
		return this.backupService;
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
