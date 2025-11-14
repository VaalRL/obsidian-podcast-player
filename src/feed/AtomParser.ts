/**
 * AtomParser - Parses Atom 1.0 podcast feeds
 *
 * Supports Atom 1.0 format with podcast extensions.
 * Converts Atom feed data into our Podcast and Episode data models.
 */

import Parser from 'rss-parser';
import { logger } from '../utils/Logger';
import { FeedParseError } from '../utils/errorUtils';
import { Podcast, Episode } from '../model';

/**
 * Extended Atom feed parser with custom fields
 */
interface AtomFeed {
	title?: string;
	subtitle?: string;
	link?: string;
	language?: string;
	image?: {
		url?: string;
		title?: string;
		link?: string;
	};
	author?: string;
	items: AtomItem[];
}

interface AtomItem {
	title?: string;
	summary?: string;
	content?: string;
	link?: string;
	pubDate?: string;
	id?: string;
	enclosure?: {
		url: string;
		length?: string;
		type?: string;
	};
	author?: string;
}

/**
 * Atom Parser for podcast feeds
 */
export class AtomParser {
	private parser: Parser<AtomFeed, AtomItem>;

	constructor() {
		this.parser = new Parser<AtomFeed, AtomItem>({
			customFields: {
				feed: [
					'subtitle',
					'author',
				],
				item: [
					'summary',
					'author',
				],
			},
		} as any);
	}

	/**
	 * Parse Atom feed from XML string
	 */
	async parseFromString(xml: string, feedUrl: string): Promise<{ podcast: Podcast; episodes: Episode[] }> {
		logger.methodEntry('AtomParser', 'parseFromString', feedUrl);

		try {
			const feed = await this.parser.parseString(xml);
			const podcast = this.extractPodcastData(feed, feedUrl);
			const episodes = this.extractEpisodesData(feed, podcast.id);

			logger.info(`Parsed Atom feed: ${podcast.title}, ${episodes.length} episodes`);
			logger.methodExit('AtomParser', 'parseFromString');

			return { podcast, episodes };
		} catch (error) {
			logger.error('Failed to parse Atom feed', error);
			throw new FeedParseError('Failed to parse Atom feed', feedUrl, error);
		}
	}

	/**
	 * Parse Atom feed from URL
	 */
	async parseFromUrl(feedUrl: string): Promise<{ podcast: Podcast; episodes: Episode[] }> {
		logger.methodEntry('AtomParser', 'parseFromUrl', feedUrl);

		try {
			const feed = await this.parser.parseURL(feedUrl);
			const podcast = this.extractPodcastData(feed, feedUrl);
			const episodes = this.extractEpisodesData(feed, podcast.id);

			logger.info(`Parsed Atom feed: ${podcast.title}, ${episodes.length} episodes`);
			logger.methodExit('AtomParser', 'parseFromUrl');

			return { podcast, episodes };
		} catch (error) {
			logger.error('Failed to parse Atom feed from URL', error);
			throw new FeedParseError('Failed to parse Atom feed from URL', feedUrl, error);
		}
	}

	/**
	 * Extract podcast metadata from Atom feed
	 */
	private extractPodcastData(feed: AtomFeed, feedUrl: string): Podcast {
		const id = this.generatePodcastId(feedUrl);

		// Get title
		const title = feed.title?.trim() || 'Untitled Podcast';

		// Get author
		const author = feed.author?.trim() || 'Unknown Author';

		// Get description (subtitle or summary)
		const description = feed.subtitle?.trim() || 'No description available';

		// Get image URL
		const imageUrl = feed.image?.url?.trim();

		// Get website URL
		const websiteUrl = feed.link?.trim();

		// Get language
		const language = feed.language?.trim();

		const podcast: Podcast = {
			id,
			title,
			author,
			description,
			feedUrl,
			imageUrl,
			websiteUrl,
			language,
			subscribedAt: new Date(),
			lastFetchedAt: new Date(),
		};

		return podcast;
	}

	/**
	 * Extract episodes from Atom feed
	 */
	private extractEpisodesData(feed: AtomFeed, podcastId: string): Episode[] {
		if (!feed.items || feed.items.length === 0) {
			logger.warn('No episodes found in Atom feed');
			return [];
		}

		const episodes: Episode[] = [];

		for (const item of feed.items) {
			try {
				const episode = this.extractEpisodeData(item, podcastId);
				if (episode) {
					episodes.push(episode);
				}
			} catch (error) {
				logger.warn('Failed to parse episode, skipping', error);
				// Continue parsing other episodes
			}
		}

		return episodes;
	}

	/**
	 * Extract episode data from Atom entry
	 */
	private extractEpisodeData(item: AtomItem, podcastId: string): Episode | null {
		// Audio URL is required
		if (!item.enclosure?.url) {
			logger.warn('Episode missing audio URL, skipping');
			return null;
		}

		const audioUrl = item.enclosure.url.trim();

		// Generate episode ID from entry ID or audio URL
		const id = this.generateEpisodeId(item.id || audioUrl);

		// Get title
		const title = item.title?.trim() || 'Untitled Episode';

		// Get description (prefer content over summary)
		const description =
			item.content?.trim() ||
			item.summary?.trim() ||
			'No description available';

		// Duration not typically available in Atom feeds
		const duration = 0;

		// Get publish date
		const publishDate = item.pubDate ? new Date(item.pubDate) : new Date();

		// Get file size
		const fileSize = item.enclosure.length ? parseInt(item.enclosure.length, 10) : undefined;

		// Get MIME type
		const mimeType = item.enclosure.type?.trim();

		const episode: Episode = {
			id,
			podcastId,
			title,
			description,
			audioUrl,
			duration,
			publishDate,
			fileSize,
			mimeType,
			guid: item.id?.trim(),
		};

		return episode;
	}

	/**
	 * Generate a unique podcast ID from feed URL
	 */
	private generatePodcastId(feedUrl: string): string {
		// Use a simple hash of the feed URL
		let hash = 0;
		for (let i = 0; i < feedUrl.length; i++) {
			const char = feedUrl.charCodeAt(i);
			hash = (hash << 5) - hash + char;
			hash = hash & hash; // Convert to 32-bit integer
		}
		return `podcast-${Math.abs(hash).toString(36)}`;
	}

	/**
	 * Generate a unique episode ID from entry ID or URL
	 */
	private generateEpisodeId(id: string): string {
		// Use a simple hash of the ID
		let hash = 0;
		for (let i = 0; i < id.length; i++) {
			const char = id.charCodeAt(i);
			hash = (hash << 5) - hash + char;
			hash = hash & hash; // Convert to 32-bit integer
		}
		return `episode-${Math.abs(hash).toString(36)}`;
	}

	/**
	 * Validate Atom feed XML
	 */
	static validateXML(xml: string): boolean {
		if (!xml || typeof xml !== 'string') {
			return false;
		}

		const trimmed = xml.trim();

		// Check if it starts with XML declaration or feed tag
		if (!trimmed.startsWith('<?xml') && !trimmed.startsWith('<feed')) {
			return false;
		}

		// Check if it contains feed tag with Atom namespace
		if (!trimmed.includes('<feed') || !trimmed.includes('xmlns="http://www.w3.org/2005/Atom"')) {
			return false;
		}

		return true;
	}
}
