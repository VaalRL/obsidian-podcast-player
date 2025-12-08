/**
 * Core Data Models for Podcast Player Plugin
 *
 * This file contains all the TypeScript interfaces and types used throughout the plugin.
 * Following the Single Source of Truth (SSOT) principle.
 */

/**
 * Podcast Settings - Individual podcast playback settings
 * These settings override global defaults for specific podcasts
 */
export interface PodcastSettings {
	/** Playback volume (0.0 to 1.0) */
	volume: number;
	/** Playback speed (0.5 to 3.0, typically) */
	playbackSpeed: number;
	/** Number of seconds to skip at the beginning of each episode */
	skipIntroSeconds: number;
	/** Number of seconds to skip at the end of each episode */
	skipOutroSeconds?: number;
}

/**
 * Rule for automatically adding new episodes to a playlist or queue
 */
export interface AutoAddRule {
	enabled: boolean;
	targetType: 'playlist' | 'queue';
	targetId: string;
	position: 'top' | 'bottom';
}

/**
 * Podcast - Represents a podcast feed
 */
export interface Podcast {
	/** Unique identifier (generated from feed URL) */
	id: string;
	/** Podcast title */
	title: string;
	/** Author/Creator name */
	author: string;
	/** Podcast description */
	description: string;
	/** RSS/Atom feed URL */
	feedUrl: string;
	/** Podcast cover image URL */
	imageUrl?: string;
	/** Website URL */
	websiteUrl?: string;
	/** List of categories/genres */
	categories?: string[];
	/** Language code (e.g., 'en', 'zh-TW') */
	language?: string;
	/** Date when subscribed */
	subscribedAt: Date;
	/** Last time the feed was fetched */
	lastFetchedAt?: Date;
	/** Custom settings for this podcast (overrides global settings) */
	settings?: PodcastSettings;
	/** Rule for automatically adding new episodes */
	autoAddRule?: AutoAddRule;
	/** Episodes (may be loaded separately) */
	episodes?: Episode[];
}

/**
 * Episode - Represents a podcast episode
 */
export interface Episode {
	/** Unique identifier (generated from episode URL or GUID) */
	id: string;
	/** Parent podcast ID */
	podcastId: string;
	/** Episode title */
	title: string;
	/** Episode description/show notes */
	description: string;
	/** Audio file URL */
	audioUrl: string;
	/** Episode duration in seconds */
	duration: number;
	/** Publication date */
	publishDate: Date;
	/** Episode number (if available) */
	episodeNumber?: number;
	/** Season number (if available) */
	seasonNumber?: number;
	/** Episode type (full, trailer, bonus) */
	episodeType?: 'full' | 'trailer' | 'bonus';
	/** Episode artwork URL (if different from podcast) */
	imageUrl?: string;
	/** File size in bytes */
	fileSize?: number;
	/** MIME type (e.g., 'audio/mpeg') */
	mimeType?: string;
	/** Episode GUID (from RSS feed) */
	guid?: string;
}

/**
 * Play Progress - Tracks playback progress for an episode
 */
export interface PlayProgress {
	/** Episode ID */
	episodeId: string;
	/** Podcast ID */
	podcastId: string;
	/** Current playback position in seconds */
	position: number;
	/** Total duration in seconds */
	duration: number;
	/** Last played timestamp */
	lastPlayedAt: Date;
	/** Whether the episode is completed */
	completed: boolean;
	/** Playback speed when last played */
	playbackSpeed?: number;
}

/**
 * Playlist - A user-created playlist of episodes
 */
export interface Playlist {
	/** Unique identifier */
	id: string;
	/** Playlist name */
	name: string;
	/** Playlist description */
	description?: string;
	/** List of episode IDs in order */
	episodeIds: string[];
	/** Creation timestamp */
	createdAt: Date;
	/** Last modified timestamp */
	updatedAt: Date;
	/** Cover image URL (optional) */
	imageUrl?: string;
}

/**
 * Queue - Playback queue
 */
export interface Queue {
	/** Unique identifier */
	id: string;
	/** Queue name */
	name: string;
	/** List of episode IDs in playback order */
	episodeIds: string[];
	/** Current playing episode index */
	currentIndex: number;
	/** Whether to auto-play next episode */
	autoPlayNext: boolean;
	/** Whether to shuffle episodes */
	shuffle: boolean;
	/** Whether to repeat the queue */
	repeat: 'none' | 'one' | 'all';
	/** Creation timestamp */
	createdAt: Date;
	/** Last modified timestamp */
	updatedAt: Date;
	/** Whether this queue is derived from a playlist */
	isPlaylist?: boolean;
	/** ID of the playlist this queue was created from */
	sourceId?: string;
}

/**
 * Global Plugin Settings
 */
export interface PluginSettings {
	/** Data folder path (relative to vault root) */
	dataFolderPath: string;
	/** Default playback settings */
	defaultPlaybackSettings: PodcastSettings;
	/** Auto-download episodes */
	autoDownload: boolean;
	/** Maximum number of episodes to keep in cache */
	maxCacheEpisodes: number;
	/** Feed update interval in minutes */
	feedUpdateInterval: number;
	/** Enable notifications */
	enableNotifications: boolean;
	/** Default queue ID */
	defaultQueueId?: string;
	/** Position to insert podcast notes in daily note */
	dailyNoteInsertPosition: 'top' | 'bottom' | 'cursor';
	/** Daily note folder path (empty = root) */
	dailyNoteFolderPath: string;
	/** Daily note date format */
	dailyNoteDateFormat: string;
}

/**
 * Default plugin settings
 */
export const DEFAULT_SETTINGS: PluginSettings = {
	dataFolderPath: '.obsidian/plugins/podcast-player/data',
	defaultPlaybackSettings: {
		volume: 1.0,
		playbackSpeed: 1.0,
		skipIntroSeconds: 0,
		skipOutroSeconds: 0,
	},
	autoDownload: false,
	maxCacheEpisodes: 50,
	feedUpdateInterval: 60, // 1 hour
	enableNotifications: true,
	dailyNoteInsertPosition: 'bottom',
	dailyNoteFolderPath: '',
	dailyNoteDateFormat: 'YYYY-MM-DD',
};

/**
 * Playback State - Current player state
 */
export interface PlaybackState {
	/** Currently playing episode (if any) */
	currentEpisode?: Episode;
	/** Playback status */
	status: 'playing' | 'paused' | 'stopped' | 'loading' | 'error';
	/** Current position in seconds */
	position: number;
	/** Current volume (0.0 to 1.0) */
	volume: number;
	/** Current playback speed */
	playbackSpeed: number;
	/** Whether player is muted */
	muted: boolean;
	/** Current queue ID (if playing from queue) */
	queueId?: string;
	/** Error message (if status is 'error') */
	error?: string;
}

/**
 * Feed Update Result - Result of fetching/updating a feed
 */
export interface FeedUpdateResult {
	/** Podcast ID */
	podcastId: string;
	/** Whether update was successful */
	success: boolean;
	/** Number of new episodes found */
	newEpisodesCount: number;
	/** Error message (if failed) */
	error?: string;
	/** Update timestamp */
	updatedAt: Date;
}

/**
 * Podcast Search Result - Result from podcast search API
 */
export interface PodcastSearchResult {
	/** Podcast title */
	title: string;
	/** Author/Creator name */
	author?: string;
	/** Podcast description */
	description?: string;
	/** RSS/Atom feed URL */
	feedUrl: string;
	/** Podcast cover image URL */
	artworkUrl?: string;
	/** iTunes/External collection ID */
	collectionId?: string;
	/** Number of episodes (if available) */
	episodeCount?: number;
	/** List of genres/categories */
	genres?: string[];
}
