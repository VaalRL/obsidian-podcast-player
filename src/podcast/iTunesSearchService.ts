/**
 * iTunesSearchService - iTunes Search API integration
 *
 * Provides podcast search functionality using the iTunes Search API.
 * Reference: https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/
 */

import { logger } from '../utils/Logger';
import { NetworkError, handleError, retryWithBackoff } from '../utils/errorUtils';
import { PodcastSearchResult } from '../model';
import { requestUrl } from 'obsidian';

/**
 * iTunes API response interface
 */
interface iTunesResult {
	collectionId: number;
	collectionName: string;
	artistName: string;
	feedUrl: string;
	artworkUrl30?: string;
	artworkUrl60?: string;
	artworkUrl100?: string;
	artworkUrl600?: string;
	collectionExplicitness?: string;
	trackCount?: number;
	genres?: string[];
	primaryGenreName?: string;
	contentAdvisoryRating?: string;
}

interface iTunesSearchResponse {
	resultCount: number;
	results: iTunesResult[];
}

/**
 * Search options
 */
export interface SearchOptions {
	/** Maximum number of results (default: 10, max: 200) */
	limit?: number;
	/** Request timeout in milliseconds (default: 15000) */
	timeout?: number;
	/** Country code for search (default: 'US') */
	country?: string;
	/** Whether to include explicit content (default: true) */
	includeExplicit?: boolean;
}

/**
 * iTunes Search Service
 */
export class iTunesSearchService {
	private static readonly API_BASE_URL = 'https://itunes.apple.com/search';
	private static readonly DEFAULT_TIMEOUT = 15000; // 15 seconds
	private static readonly DEFAULT_LIMIT = 10;
	private static readonly MAX_LIMIT = 200;

	/**
	 * Search for podcasts by query string
	 */
	async searchPodcasts(
		query: string,
		options: SearchOptions = {}
	): Promise<PodcastSearchResult[]> {
		logger.methodEntry('iTunesSearchService', 'searchPodcasts', query);

		// Validate query
		if (!query || query.trim().length === 0) {
			logger.warn('Empty search query');
			return [];
		}

		const {
			limit = iTunesSearchService.DEFAULT_LIMIT,
			timeout = iTunesSearchService.DEFAULT_TIMEOUT,
			country = 'US',
			includeExplicit = true,
		} = options;

		// Validate limit
		const validLimit = Math.min(
			Math.max(1, limit),
			iTunesSearchService.MAX_LIMIT
		);

		try {
			// Build search URL
			const url = this.buildSearchUrl(query.trim(), validLimit, country, includeExplicit);

			logger.debug('Searching iTunes API', url);

			// Make request with retry
			const response = await retryWithBackoff(
				async () => {
					try {
						// Try Obsidian requestUrl first (bypasses CORS restrictions in Electron)
						const result = await requestUrl({
							url,
							method: 'GET',
							headers: {
								'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
								'Accept': 'application/json',
							},
							throw: false,
						});

						// Check for HTTP errors
						if (result.status !== 200) {
							// For client errors (4xx), log and return empty to avoid retry
							// For server errors (5xx), throw to trigger retry
							if (result.status >= 400 && result.status < 500) {
								logger.warn(`iTunes API returned status ${result.status}`);
								return { status: result.status, json: { resultCount: 0, results: [] } } as any;
							}
							throw new NetworkError(
								`iTunes API returned status ${result.status}`,
								url
							);
						}

						return result;
					} catch (err) {
						logger.warn('requestUrl failed, trying native fetch fallback', err);

						// Fallback to native fetch (works if API supports CORS)
						try {
							const response = await fetch(url);
							if (!response.ok) {
								throw new Error(`Fetch failed with status ${response.status}`);
							}
							const json = await response.json();
							return { status: 200, json };
						} catch (fetchErr) {
							logger.error('Native fetch also failed', fetchErr);
							throw new NetworkError(
								'Failed to connect to iTunes API via both requestUrl and fetch.',
								url
							);
						}
					}
				},
				{
					maxRetries: 2,
					initialDelay: 1000,
					maxDelay: 5000,
				}
			);

			// Parse response
			const data = response.json as iTunesSearchResponse;

			if (!data || !Array.isArray(data.results)) {
				logger.warn('Invalid iTunes API response format');
				return [];
			}

			logger.info(`Found ${data.resultCount} results`);

			// Transform to our format
			const results = data.results.map(result => this.transformResult(result));

			logger.methodExit('iTunesSearchService', 'searchPodcasts', `count=${results.length}`);
			return results;

		} catch (error) {
			// Log detailed error information
			logger.error('iTunes search failed', error);

			if (error instanceof NetworkError) {
				logger.error('Network error details:', {
					message: error.message,
					url: error.url,
				});
			}

			// Return empty array instead of throwing for better UX
			// The UI will show "No results found" which is better than an error
			return [];
		}
	}

	/**
	 * Build search URL with parameters
	 */
	private buildSearchUrl(
		query: string,
		limit: number,
		country: string,
		includeExplicit: boolean
	): string {
		const url = new URL(iTunesSearchService.API_BASE_URL);

		url.searchParams.append('term', query);
		url.searchParams.append('media', 'podcast');
		url.searchParams.append('entity', 'podcast');
		url.searchParams.append('limit', limit.toString());
		url.searchParams.append('country', country);

		if (!includeExplicit) {
			url.searchParams.append('explicit', 'No');
		}

		return url.href;
	}

	/**
	 * Transform iTunes result to our format
	 */
	private transformResult(result: iTunesResult): PodcastSearchResult {
		return {
			title: result.collectionName || 'Untitled Podcast',
			author: result.artistName,
			feedUrl: result.feedUrl,
			// Prefer higher resolution artwork
			artworkUrl: result.artworkUrl600 ||
				result.artworkUrl100 ||
				result.artworkUrl60 ||
				result.artworkUrl30,
			collectionId: result.collectionId?.toString(),
			episodeCount: result.trackCount,
			genres: this.extractGenres(result),
		};
	}

	/**
	 * Extract genres from iTunes result
	 */
	private extractGenres(result: iTunesResult): string[] | undefined {
		const genres: string[] = [];

		if (result.primaryGenreName) {
			genres.push(result.primaryGenreName);
		}

		if (result.genres && Array.isArray(result.genres)) {
			genres.push(...result.genres.filter(g => g !== result.primaryGenreName));
		}

		return genres.length > 0 ? genres : undefined;
	}

	/**
	 * Validate if URL is from iTunes/Apple
	 */
	static isAppleUrl(url: string): boolean {
		try {
			const urlObj = new URL(url);
			return urlObj.hostname.includes('apple.com') ||
				urlObj.hostname.includes('itunes.com');
		} catch {
			return false;
		}
	}
}
