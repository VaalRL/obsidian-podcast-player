/**
 * SubscriptionStore - Manages podcast subscriptions
 *
 * Stores all podcast subscriptions in a single JSON file.
 * Provides methods for adding, removing, updating, and retrieving subscriptions.
 */

import { Vault } from 'obsidian';
import { logger } from '../utils/Logger';
import { StorageError } from '../utils/errorUtils';
import { Podcast } from '../model';
import { DataPathManager } from './DataPathManager';
import { SingleFileStore } from './FileSystemStore';

/**
 * Subscription data structure
 */
export interface SubscriptionData {
	podcasts: Podcast[];
	version: number;
}

/**
 * SubscriptionStore - Manages podcast subscriptions
 */
export class SubscriptionStore extends SingleFileStore<SubscriptionData> {
	private static readonly CURRENT_VERSION = 1;

	constructor(vault: Vault, pathManager: DataPathManager) {
		const filePath = pathManager.getFilePath('subscriptions', 'subscriptions.json');
		super(vault, pathManager, filePath);
	}

	/**
	 * Validate subscription data
	 */
	protected validate(data: SubscriptionData): boolean {
		if (!data || typeof data !== 'object') {
			logger.warn('Invalid subscription data: not an object');
			return false;
		}

		if (!Array.isArray(data.podcasts)) {
			logger.warn('Invalid subscription data: podcasts is not an array');
			return false;
		}

		if (typeof data.version !== 'number') {
			logger.warn('Invalid subscription data: version is not a number');
			return false;
		}

		// Validate each podcast
		for (const podcast of data.podcasts) {
			if (!this.validatePodcast(podcast)) {
				logger.warn('Invalid podcast in subscription data', podcast);
				return false;
			}
		}

		return true;
	}

	/**
	 * Validate a single podcast object
	 */
	private validatePodcast(podcast: Podcast): boolean {
		if (!podcast || typeof podcast !== 'object') {
			return false;
		}

		const requiredFields = ['id', 'title', 'feedUrl', 'subscribedAt'];
		for (const field of requiredFields) {
			if (!(field in podcast)) {
				logger.warn(`Missing required field in podcast: ${field}`);
				return false;
			}
		}

		return true;
	}

	/**
	 * Get default subscription data
	 */
	protected getDefaultValue(): SubscriptionData {
		return {
			podcasts: [],
			version: SubscriptionStore.CURRENT_VERSION,
		};
	}

	/**
	 * Get all subscribed podcasts
	 */
	async getAllPodcasts(): Promise<Podcast[]> {
		logger.methodEntry('SubscriptionStore', 'getAllPodcasts');

		const data = await this.load();
		logger.methodExit('SubscriptionStore', 'getAllPodcasts');

		return data.podcasts;
	}

	/**
	 * Get a podcast by ID
	 */
	async getPodcast(id: string): Promise<Podcast | null> {
		logger.methodEntry('SubscriptionStore', 'getPodcast', id);

		const data = await this.load();
		const podcast = data.podcasts.find(p => p.id === id) || null;

		logger.methodExit('SubscriptionStore', 'getPodcast');
		return podcast;
	}

	/**
	 * Get a podcast by feed URL
	 */
	async getPodcastByFeedUrl(feedUrl: string): Promise<Podcast | null> {
		logger.methodEntry('SubscriptionStore', 'getPodcastByFeedUrl', feedUrl);

		const data = await this.load();
		const podcast = data.podcasts.find(p => p.feedUrl === feedUrl) || null;

		logger.methodExit('SubscriptionStore', 'getPodcastByFeedUrl');
		return podcast;
	}

	/**
	 * Add a new podcast subscription
	 */
	async addPodcast(podcast: Podcast): Promise<void> {
		logger.methodEntry('SubscriptionStore', 'addPodcast', podcast.id);

		if (!this.validatePodcast(podcast)) {
			throw new StorageError('Invalid podcast data', this.filePath);
		}

		const data = await this.load();

		// Check if podcast already exists
		const existingIndex = data.podcasts.findIndex(p => p.id === podcast.id);
		if (existingIndex !== -1) {
			logger.warn('Podcast already exists, updating instead', podcast.id);
			data.podcasts[existingIndex] = podcast;
		} else {
			data.podcasts.push(podcast);
		}

		await this.save(data);
		logger.methodExit('SubscriptionStore', 'addPodcast');
	}

	/**
	 * Update an existing podcast subscription
	 */
	async updatePodcast(podcast: Podcast): Promise<void> {
		logger.methodEntry('SubscriptionStore', 'updatePodcast', podcast.id);

		if (!this.validatePodcast(podcast)) {
			throw new StorageError('Invalid podcast data', this.filePath);
		}

		const data = await this.load();
		const index = data.podcasts.findIndex(p => p.id === podcast.id);

		if (index === -1) {
			throw new StorageError(`Podcast not found: ${podcast.id}`, this.filePath);
		}

		data.podcasts[index] = podcast;
		await this.save(data);

		logger.methodExit('SubscriptionStore', 'updatePodcast');
	}

	/**
	 * Remove a podcast subscription
	 */
	async removePodcast(id: string): Promise<void> {
		logger.methodEntry('SubscriptionStore', 'removePodcast', id);

		const data = await this.load();
		const index = data.podcasts.findIndex(p => p.id === id);

		if (index === -1) {
			logger.warn('Podcast not found, nothing to remove', id);
			return;
		}

		data.podcasts.splice(index, 1);
		await this.save(data);

		logger.methodExit('SubscriptionStore', 'removePodcast');
	}

	/**
	 * Check if a podcast is subscribed
	 */
	async isSubscribed(id: string): Promise<boolean> {
		const data = await this.load();
		return data.podcasts.some(p => p.id === id);
	}

	/**
	 * Check if a feed URL is subscribed
	 */
	async isSubscribedByFeedUrl(feedUrl: string): Promise<boolean> {
		const data = await this.load();
		return data.podcasts.some(p => p.feedUrl === feedUrl);
	}

	/**
	 * Get subscription count
	 */
	async getSubscriptionCount(): Promise<number> {
		const data = await this.load();
		return data.podcasts.length;
	}

	/**
	 * Update podcast episodes (without replacing the whole podcast object)
	 */
	async updatePodcastEpisodes(id: string, episodes: Podcast['episodes']): Promise<void> {
		logger.methodEntry('SubscriptionStore', 'updatePodcastEpisodes', id);

		const data = await this.load();
		const podcast = data.podcasts.find(p => p.id === id);

		if (!podcast) {
			throw new StorageError(`Podcast not found: ${id}`, this.filePath);
		}

		podcast.episodes = episodes;
		podcast.lastFetchedAt = new Date();

		await this.save(data);
		logger.methodExit('SubscriptionStore', 'updatePodcastEpisodes');
	}

	/**
	 * Update podcast settings
	 */
	async updatePodcastSettings(id: string, settings: Podcast['settings']): Promise<void> {
		logger.methodEntry('SubscriptionStore', 'updatePodcastSettings', id);

		const data = await this.load();
		const podcast = data.podcasts.find(p => p.id === id);

		if (!podcast) {
			throw new StorageError(`Podcast not found: ${id}`, this.filePath);
		}

		podcast.settings = settings;

		await this.save(data);
		logger.methodExit('SubscriptionStore', 'updatePodcastSettings');
	}

	/**
	 * Get podcasts that need feed updates
	 * (based on lastFetchedAt and update interval)
	 */
	async getPodcastsNeedingUpdate(updateIntervalMs: number): Promise<Podcast[]> {
		const data = await this.load();
		const now = Date.now();

		return data.podcasts.filter(podcast => {
			if (!podcast.lastFetchedAt) {
				return true; // Never fetched
			}

			const lastFetched = new Date(podcast.lastFetchedAt).getTime();
			return now - lastFetched >= updateIntervalMs;
		});
	}

	/**
	 * Search podcasts by title or author
	 */
	async searchPodcasts(query: string): Promise<Podcast[]> {
		const data = await this.load();
		const lowercaseQuery = query.toLowerCase();

		return data.podcasts.filter(podcast => {
			const titleMatch = podcast.title.toLowerCase().includes(lowercaseQuery);
			const authorMatch = podcast.author?.toLowerCase().includes(lowercaseQuery);
			return titleMatch || authorMatch;
		});
	}

	/**
	 * Export all subscriptions (for backup or migration)
	 */
	async exportSubscriptions(): Promise<SubscriptionData> {
		logger.methodEntry('SubscriptionStore', 'exportSubscriptions');
		const data = await this.load();
		logger.methodExit('SubscriptionStore', 'exportSubscriptions');
		return data;
	}

	/**
	 * Import subscriptions (for restore or migration)
	 * Merges with existing subscriptions by default
	 */
	async importSubscriptions(importData: SubscriptionData, replace = false): Promise<void> {
		logger.methodEntry('SubscriptionStore', 'importSubscriptions', `replace=${replace}`);

		if (!this.validate(importData)) {
			throw new StorageError('Invalid import data', this.filePath);
		}

		if (replace) {
			// Replace all subscriptions
			await this.save(importData);
		} else {
			// Merge with existing subscriptions
			const currentData = await this.load();
			const mergedPodcasts = [...currentData.podcasts];

			for (const importedPodcast of importData.podcasts) {
				const existingIndex = mergedPodcasts.findIndex(p => p.id === importedPodcast.id);
				if (existingIndex !== -1) {
					// Update existing podcast
					mergedPodcasts[existingIndex] = importedPodcast;
				} else {
					// Add new podcast
					mergedPodcasts.push(importedPodcast);
				}
			}

			await this.save({
				podcasts: mergedPodcasts,
				version: SubscriptionStore.CURRENT_VERSION,
			});
		}

		logger.methodExit('SubscriptionStore', 'importSubscriptions');
	}
}
