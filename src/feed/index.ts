/**
 * Feed Module
 *
 * Provides feed parsing, fetching, and synchronization functionality.
 * Supports both RSS 2.0 and Atom 1.0 formats.
 */

// Export parsers
export { RSSParser } from './RSSParser';
export { AtomParser } from './AtomParser';

// Export feed service
export {
	FeedService,
	FeedType,
	type FeedFetchOptions,
} from './FeedService';

// Export sync manager
export {
	FeedSyncManager,
	type SyncOptions,
	type PodcastSyncResult,
	type BatchSyncResult,
} from './FeedSyncManager';
