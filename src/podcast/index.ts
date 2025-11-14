/**
 * Podcast Module
 *
 * Provides podcast and episode management functionality.
 * Handles subscription, metadata updates, and episode operations.
 */

// Export podcast service
export {
	PodcastService,
	type SubscriptionResult,
} from './PodcastService';

// Export episode manager
export {
	EpisodeManager,
	type EpisodeFilter,
	type EpisodeSortBy,
	type EpisodeSortOrder,
	type EpisodeWithProgress,
	type EpisodeStatistics,
} from './EpisodeManager';
