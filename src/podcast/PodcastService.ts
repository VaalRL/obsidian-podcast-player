/**
 * PodcastService - Core service for managing podcasts
 *
 * Handles podcast subscription, updates, and management.
 * Integrates with FeedService for fetching and SubscriptionStore for persistence.
 */

import { logger } from '../utils/Logger';
import { FeedParseError, NetworkError, StorageError, handleError } from '../utils/errorUtils';
import { Podcast, Episode, PodcastSettings, PodcastSearchResult } from '../model';
import { FeedService } from '../feed/FeedService';
import { SubscriptionStore } from '../storage/SubscriptionStore';
import { ImageCacheStore } from '../storage/CacheStore';
import { iTunesSearchService, SearchOptions } from './iTunesSearchService';

/**
 * Subscription result
 */
export interface SubscriptionResult {
	success: boolean;
	podcast?: Podcast;
	error?: string;
}

/**
 * Podcast Service
 */
export class PodcastService {
	private feedService: FeedService;
	private subscriptionStore: SubscriptionStore;
	private imageCache: ImageCacheStore | null = null;
	private searchService: iTunesSearchService;

	constructor(
		feedService: FeedService,
		subscriptionStore: SubscriptionStore,
		imageCache?: ImageCacheStore
	) {
		this.feedService = feedService;
		this.subscriptionStore = subscriptionStore;
		this.imageCache = imageCache || null;
		this.searchService = new iTunesSearchService();
	}

	/**
	 * Subscribe to a podcast by feed URL
	 */
	async subscribe(feedUrl: string): Promise<SubscriptionResult> {
		logger.methodEntry('PodcastService', 'subscribe', feedUrl);

		try {
			// Validate feed URL
			if (!FeedService.validateFeedUrl(feedUrl)) {
				return {
					success: false,
					error: 'Invalid feed URL',
				};
			}

			// Check if already subscribed
			const existingPodcast = await this.subscriptionStore.getPodcastByFeedUrl(feedUrl);
			if (existingPodcast) {
				logger.info('Already subscribed to this podcast');
				return {
					success: true,
					podcast: existingPodcast,
				};
			}

			// Fetch and parse feed
			const { podcast, episodes } = await this.feedService.fetchFeed(feedUrl, {
				useCache: false, // Don't use cache for new subscriptions
			});

			// Set episodes
			podcast.episodes = episodes;

			// Cache podcast image if available
			if (podcast.imageUrl && this.imageCache) {
				await this.cacheImage(podcast.imageUrl).catch(error => {
					logger.warn('Failed to cache podcast image', error);
					// Don't fail subscription if image caching fails
				});
			}

			// Save subscription
			await this.subscriptionStore.addPodcast(podcast);

			logger.info(`Subscribed to podcast: ${podcast.title}`);
			logger.methodExit('PodcastService', 'subscribe');

			return {
				success: true,
				podcast,
			};
		} catch (error) {
			logger.error('Failed to subscribe to podcast', error);

			let errorMessage = 'Failed to subscribe to podcast';
			if (error instanceof FeedParseError) {
				errorMessage = 'Failed to parse podcast feed';
			} else if (error instanceof NetworkError) {
				errorMessage = 'Failed to fetch podcast feed';
			}

			logger.methodExit('PodcastService', 'subscribe', 'failed');

			return {
				success: false,
				error: errorMessage,
			};
		}
	}

	/**
	 * Unsubscribe from a podcast
	 */
	async unsubscribe(podcastId: string): Promise<void> {
		logger.methodEntry('PodcastService', 'unsubscribe', podcastId);

		const podcast = await this.subscriptionStore.getPodcast(podcastId);

		if (!podcast) {
			throw new Error(`Podcast not found: ${podcastId}`);
		}

		// Remove subscription
		await this.subscriptionStore.removePodcast(podcastId);

		// Clear feed cache
		await this.feedService.clearCache(podcast.feedUrl);

		logger.info(`Unsubscribed from podcast: ${podcast.title}`);
		logger.methodExit('PodcastService', 'unsubscribe');
	}

	/**
	 * Get a podcast by ID
	 */
	async getPodcast(podcastId: string): Promise<Podcast | null> {
		logger.methodEntry('PodcastService', 'getPodcast', podcastId);

		const podcast = await this.subscriptionStore.getPodcast(podcastId);

		logger.methodExit('PodcastService', 'getPodcast');
		return podcast;
	}

	/**
	 * Get a podcast by feed URL
	 */
	async getPodcastByFeedUrl(feedUrl: string): Promise<Podcast | null> {
		logger.methodEntry('PodcastService', 'getPodcastByFeedUrl', feedUrl);

		const podcast = await this.subscriptionStore.getPodcastByFeedUrl(feedUrl);

		logger.methodExit('PodcastService', 'getPodcastByFeedUrl');
		return podcast;
	}

	/**
	 * Get all subscribed podcasts
	 */
	async getAllPodcasts(): Promise<Podcast[]> {
		logger.methodEntry('PodcastService', 'getAllPodcasts');

		const podcasts = await this.subscriptionStore.getAllPodcasts();

		logger.methodExit('PodcastService', 'getAllPodcasts');
		return podcasts;
	}

	/**
	 * Get subscription count
	 */
	async getSubscriptionCount(): Promise<number> {
		return await this.subscriptionStore.getSubscriptionCount();
	}

	/**
	 * Check if subscribed to a podcast
	 */
	async isSubscribed(podcastId: string): Promise<boolean> {
		return await this.subscriptionStore.isSubscribed(podcastId);
	}

	/**
	 * Check if subscribed to a feed URL
	 */
	async isSubscribedByFeedUrl(feedUrl: string): Promise<boolean> {
		return await this.subscriptionStore.isSubscribedByFeedUrl(feedUrl);
	}

	/**
	 * Search podcasts by title or author
	 */
	async searchPodcasts(query: string): Promise<Podcast[]> {
		logger.methodEntry('PodcastService', 'searchPodcasts', query);

		const podcasts = await this.subscriptionStore.searchPodcasts(query);

		logger.methodExit('PodcastService', 'searchPodcasts');
		return podcasts;
	}

	/**
	 * Update podcast metadata (without fetching feed)
	 */
	async updatePodcastMetadata(podcastId: string, updates: Partial<Podcast>): Promise<void> {
		logger.methodEntry('PodcastService', 'updatePodcastMetadata', podcastId);

		const podcast = await this.subscriptionStore.getPodcast(podcastId);

		if (!podcast) {
			throw new Error(`Podcast not found: ${podcastId}`);
		}

		// Merge updates
		const updatedPodcast: Podcast = {
			...podcast,
			...updates,
			id: podcast.id, // Preserve ID
			feedUrl: podcast.feedUrl, // Preserve feed URL
			subscribedAt: podcast.subscribedAt, // Preserve subscription date
		};

		await this.subscriptionStore.updatePodcast(updatedPodcast);

		logger.methodExit('PodcastService', 'updatePodcastMetadata');
	}

	/**
	 * Update podcast settings
	 */
	async updatePodcastSettings(podcastId: string, settings: PodcastSettings): Promise<void> {
		logger.methodEntry('PodcastService', 'updatePodcastSettings', podcastId);

		await this.subscriptionStore.updatePodcastSettings(podcastId, settings);

		logger.methodExit('PodcastService', 'updatePodcastSettings');
	}

	/**
	 * Get podcast settings (returns custom settings or undefined)
	 */
	async getPodcastSettings(podcastId: string): Promise<PodcastSettings | undefined> {
		const podcast = await this.subscriptionStore.getPodcast(podcastId);
		return podcast?.settings;
	}

	/**
	 * Clear podcast settings (use global defaults)
	 */
	async clearPodcastSettings(podcastId: string): Promise<void> {
		logger.methodEntry('PodcastService', 'clearPodcastSettings', podcastId);

		await this.subscriptionStore.updatePodcastSettings(podcastId, undefined);

		logger.methodExit('PodcastService', 'clearPodcastSettings');
	}

	/**
	 * Get episodes for a podcast
	 */
	async getEpisodes(podcastId: string): Promise<Episode[]> {
		logger.methodEntry('PodcastService', 'getEpisodes', podcastId);

		const podcast = await this.subscriptionStore.getPodcast(podcastId);

		if (!podcast) {
			throw new Error(`Podcast not found: ${podcastId}`);
		}

		logger.methodExit('PodcastService', 'getEpisodes');
		return podcast.episodes || [];
	}

	/**
	 * Get a specific episode
	 */
	async getEpisode(podcastId: string, episodeId: string): Promise<Episode | null> {
		logger.methodEntry('PodcastService', 'getEpisode', episodeId);

		const episodes = await this.getEpisodes(podcastId);
		const episode = episodes.find(e => e.id === episodeId) || null;

		logger.methodExit('PodcastService', 'getEpisode');
		return episode;
	}

	/**
	 * Get latest episodes across all podcasts
	 */
	async getLatestEpisodes(limit = 20): Promise<Episode[]> {
		logger.methodEntry('PodcastService', 'getLatestEpisodes', `limit=${limit}`);

		const podcasts = await this.subscriptionStore.getAllPodcasts();
		const allEpisodes: Episode[] = [];

		for (const podcast of podcasts) {
			if (podcast.episodes) {
				allEpisodes.push(...podcast.episodes);
			}
		}

		// Sort by publish date (newest first)
		allEpisodes.sort((a, b) => b.publishDate.getTime() - a.publishDate.getTime());

		// Return limited results
		const latestEpisodes = allEpisodes.slice(0, limit);

		logger.methodExit('PodcastService', 'getLatestEpisodes');
		return latestEpisodes;
	}

	/**
	 * Get podcasts that need updating
	 */
	async getPodcastsNeedingUpdate(updateIntervalMs: number): Promise<Podcast[]> {
		return await this.subscriptionStore.getPodcastsNeedingUpdate(updateIntervalMs);
	}

	/**
	 * Cache podcast image
	 */
	private async cacheImage(imageUrl: string): Promise<void> {
		if (!this.imageCache) {
			return;
		}

		try {
			// Check if already cached
			const cached = await this.imageCache.getCachedImage(imageUrl);
			if (cached) {
				logger.debug('Image already cached', imageUrl);
				return;
			}

			// Fetch image
			const response = await fetch(imageUrl);
			if (!response.ok) {
				throw new Error(`Failed to fetch image: ${response.status}`);
			}

			const imageData = await response.arrayBuffer();

			// Cache image
			await this.imageCache.cacheImage(imageUrl, imageData);

			logger.debug('Image cached successfully', imageUrl);
		} catch (error) {
			logger.warn('Failed to cache image', error);
			throw error;
		}
	}

	/**
	 * Get cached image path
	 */
	async getCachedImagePath(imageUrl: string): Promise<string | null> {
		if (!this.imageCache) {
			return null;
		}

		return await this.imageCache.getCachedImage(imageUrl);
	}

	/**
	 * Export all subscriptions
	 */
	async exportSubscriptions(): Promise<any> {
		logger.methodEntry('PodcastService', 'exportSubscriptions');

		const data = await this.subscriptionStore.exportSubscriptions();

		logger.methodExit('PodcastService', 'exportSubscriptions');
		return data;
	}

	/**
	 * Import subscriptions
	 */
	async importSubscriptions(data: any, replace = false): Promise<void> {
		logger.methodEntry('PodcastService', 'importSubscriptions', `replace=${replace}`);

		await this.subscriptionStore.importSubscriptions(data, replace);

		logger.methodExit('PodcastService', 'importSubscriptions');
	}

	/**
	 * Search for podcasts online using iTunes Search API
	 *
	 * @param query - Search query string
	 * @param options - Search options (limit, country, etc.)
	 * @returns Array of podcast search results from iTunes
	 */
	async searchOnline(
		query: string,
		options?: SearchOptions
	): Promise<PodcastSearchResult[]> {
		logger.methodEntry('PodcastService', 'searchOnline', query);

		const results = await this.searchService.searchPodcasts(query, options);

		logger.methodExit('PodcastService', 'searchOnline', `count=${results.length}`);
		return results;
	}

	/**
	 * Search and subscribe to a podcast in one step
	 *
	 * @param query - Search query
	 * @param resultIndex - Index of search result to subscribe to (default: 0)
	 * @param searchOptions - Search options
	 * @returns Subscription result
	 */
	async searchAndSubscribe(
		query: string,
		resultIndex = 0,
		searchOptions?: SearchOptions
	): Promise<SubscriptionResult> {
		logger.methodEntry('PodcastService', 'searchAndSubscribe', query);

		try {
			// Search for podcasts online
			const results = await this.searchOnline(query, searchOptions);

			if (results.length === 0) {
				return {
					success: false,
					error: 'No podcasts found matching your search',
				};
			}

			// Validate result index
			if (resultIndex < 0 || resultIndex >= results.length) {
				return {
					success: false,
					error: `Invalid result index: ${resultIndex}`,
				};
			}

			// Subscribe to the selected result
			const selectedResult = results[resultIndex];
			const subscriptionResult = await this.subscribe(selectedResult.feedUrl);

			logger.methodExit('PodcastService', 'searchAndSubscribe');
			return subscriptionResult;

		} catch (error) {
			logger.error('Search and subscribe failed', error);

			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error',
			};
		}
	}
}
