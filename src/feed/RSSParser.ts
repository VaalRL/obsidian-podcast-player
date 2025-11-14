/**
 * RSSParser - Parses RSS 2.0 podcast feeds
 *
 * Supports standard RSS 2.0 format and iTunes podcast extensions.
 * Converts RSS feed data into our Podcast and Episode data models.
 */

import Parser from 'rss-parser';
import { logger } from '../utils/Logger';
import { FeedParseError } from '../utils/errorUtils';
import { Podcast, Episode } from '../model';

/**
 * Extended RSS feed parser with custom fields for iTunes namespace
 */
interface RSSFeed {
	title?: string;
	description?: string;
	link?: string;
	language?: string;
	image?: {
		url?: string;
		title?: string;
		link?: string;
	};
	itunes?: {
		image?: string;
		author?: string;
		summary?: string;
		categories?: string[];
		owner?: {
			name?: string;
			email?: string;
		};
	};
	items: RSSItem[];
}

interface RSSItem {
	title?: string;
	description?: string;
	content?: string;
	link?: string;
	pubDate?: string;
	guid?: string;
	enclosure?: {
		url: string;
		length?: string;
		type?: string;
	};
	itunes?: {
		image?: string;
		duration?: string;
		episode?: string;
		season?: string;
		episodeType?: string;
		author?: string;
		summary?: string;
	};
}

/**
 * RSS Parser for podcast feeds
 */
export class RSSParser {
	private parser: Parser<RSSFeed, RSSItem>;

	constructor() {
		this.parser = new Parser<RSSFeed, RSSItem>({
			customFields: {
				feed: [
					'itunes:image',
					'itunes:author',
					'itunes:summary',
					'itunes:category',
					'itunes:owner',
				],
				item: [
					'itunes:image',
					'itunes:duration',
					'itunes:episode',
					'itunes:season',
					'itunes:episodeType',
					'itunes:author',
					'itunes:summary',
				],
			},
		} as any);
	}

	/**
	 * Parse RSS feed from XML string
	 */
	async parseFromString(xml: string, feedUrl: string): Promise<{ podcast: Podcast; episodes: Episode[] }> {
		logger.methodEntry('RSSParser', 'parseFromString', feedUrl);

		try {
			const feed = await this.parser.parseString(xml);
			const podcast = this.extractPodcastData(feed, feedUrl);
			const episodes = this.extractEpisodesData(feed, podcast.id);

			logger.info(`Parsed RSS feed: ${podcast.title}, ${episodes.length} episodes`);
			logger.methodExit('RSSParser', 'parseFromString');

			return { podcast, episodes };
		} catch (error) {
			logger.error('Failed to parse RSS feed', error);
			throw new FeedParseError('Failed to parse RSS feed', feedUrl, error);
		}
	}

	/**
	 * Parse RSS feed from URL
	 */
	async parseFromUrl(feedUrl: string): Promise<{ podcast: Podcast; episodes: Episode[] }> {
		logger.methodEntry('RSSParser', 'parseFromUrl', feedUrl);

		try {
			const feed = await this.parser.parseURL(feedUrl);
			const podcast = this.extractPodcastData(feed, feedUrl);
			const episodes = this.extractEpisodesData(feed, podcast.id);

			logger.info(`Parsed RSS feed: ${podcast.title}, ${episodes.length} episodes`);
			logger.methodExit('RSSParser', 'parseFromUrl');

			return { podcast, episodes };
		} catch (error) {
			logger.error('Failed to parse RSS feed from URL', error);
			throw new FeedParseError('Failed to parse RSS feed from URL', feedUrl, error);
		}
	}

	/**
	 * Extract podcast metadata from RSS feed
	 */
	private extractPodcastData(feed: RSSFeed, feedUrl: string): Podcast {
		const id = this.generatePodcastId(feedUrl);

		// Get title
		const title = feed.title?.trim() || 'Untitled Podcast';

		// Get author (prefer iTunes author)
		const author =
			feed.itunes?.author?.trim() ||
			feed.itunes?.owner?.name?.trim() ||
			'Unknown Author';

		// Get description (prefer iTunes summary)
		const description =
			feed.itunes?.summary?.trim() ||
			feed.description?.trim() ||
			'No description available';

		// Get image URL (prefer iTunes image)
		let imageUrl: string | undefined;
		if (typeof feed.itunes?.image === 'string') {
			imageUrl = feed.itunes.image;
		} else if (feed.itunes?.image && typeof feed.itunes.image === 'object' && 'href' in feed.itunes.image) {
			imageUrl = (feed.itunes.image as any).href;
		} else if (feed.image?.url) {
			imageUrl = feed.image.url;
		}

		// Get website URL
		const websiteUrl = feed.link?.trim();

		// Get categories
		const categories = feed.itunes?.categories?.filter((c): c is string => typeof c === 'string');

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
			categories,
			language,
			subscribedAt: new Date(),
			lastFetchedAt: new Date(),
		};

		return podcast;
	}

	/**
	 * Extract episodes from RSS feed
	 */
	private extractEpisodesData(feed: RSSFeed, podcastId: string): Episode[] {
		if (!feed.items || feed.items.length === 0) {
			logger.warn('No episodes found in RSS feed');
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
	 * Extract episode data from RSS item
	 */
	private extractEpisodeData(item: RSSItem, podcastId: string): Episode | null {
		// Audio URL is required
		if (!item.enclosure?.url) {
			logger.warn('Episode missing audio URL, skipping');
			return null;
		}

		const audioUrl = item.enclosure.url.trim();

		// Generate episode ID from GUID or audio URL
		const id = this.generateEpisodeId(item.guid || audioUrl);

		// Get title
		const title = item.title?.trim() || 'Untitled Episode';

		// Get description (prefer iTunes summary or content)
		const description =
			item.itunes?.summary?.trim() ||
			item.content?.trim() ||
			item.description?.trim() ||
			'No description available';

		// Get duration
		const duration = this.parseDuration(item.itunes?.duration);

		// Get publish date
		const publishDate = item.pubDate ? new Date(item.pubDate) : new Date();

		// Get episode number
		const episodeNumber = item.itunes?.episode ? parseInt(item.itunes.episode, 10) : undefined;

		// Get season number
		const seasonNumber = item.itunes?.season ? parseInt(item.itunes.season, 10) : undefined;

		// Get episode type
		let episodeType: 'full' | 'trailer' | 'bonus' | undefined;
		if (item.itunes?.episodeType) {
			const type = item.itunes.episodeType.toLowerCase();
			if (type === 'full' || type === 'trailer' || type === 'bonus') {
				episodeType = type as 'full' | 'trailer' | 'bonus';
			}
		}

		// Get image URL (prefer iTunes image)
		let imageUrl: string | undefined;
		if (typeof item.itunes?.image === 'string') {
			imageUrl = item.itunes.image;
		} else if (item.itunes?.image && typeof item.itunes.image === 'object' && 'href' in item.itunes.image) {
			imageUrl = (item.itunes.image as any).href;
		}

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
			episodeNumber,
			seasonNumber,
			episodeType,
			imageUrl,
			fileSize,
			mimeType,
			guid: item.guid?.trim(),
		};

		return episode;
	}

	/**
	 * Parse iTunes duration string to seconds
	 * Supports formats: "HH:MM:SS", "MM:SS", or just seconds
	 */
	private parseDuration(durationStr?: string): number {
		if (!durationStr) {
			return 0;
		}

		const trimmed = durationStr.trim();

		// Check if it's just a number (seconds)
		const asNumber = parseInt(trimmed, 10);
		if (!isNaN(asNumber) && trimmed === asNumber.toString()) {
			return asNumber;
		}

		// Parse HH:MM:SS or MM:SS format
		const parts = trimmed.split(':').map(p => parseInt(p, 10));

		if (parts.some(isNaN)) {
			logger.warn(`Invalid duration format: ${durationStr}`);
			return 0;
		}

		if (parts.length === 3) {
			// HH:MM:SS
			const [hours, minutes, seconds] = parts;
			return hours * 3600 + minutes * 60 + seconds;
		} else if (parts.length === 2) {
			// MM:SS
			const [minutes, seconds] = parts;
			return minutes * 60 + seconds;
		} else if (parts.length === 1) {
			// Just seconds
			return parts[0];
		}

		logger.warn(`Invalid duration format: ${durationStr}`);
		return 0;
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
	 * Generate a unique episode ID from GUID or URL
	 */
	private generateEpisodeId(guid: string): string {
		// Use a simple hash of the GUID
		let hash = 0;
		for (let i = 0; i < guid.length; i++) {
			const char = guid.charCodeAt(i);
			hash = (hash << 5) - hash + char;
			hash = hash & hash; // Convert to 32-bit integer
		}
		return `episode-${Math.abs(hash).toString(36)}`;
	}

	/**
	 * Validate RSS feed XML
	 */
	static validateXML(xml: string): boolean {
		if (!xml || typeof xml !== 'string') {
			return false;
		}

		const trimmed = xml.trim();

		// Check if it starts with XML declaration or RSS tag
		if (!trimmed.startsWith('<?xml') && !trimmed.startsWith('<rss')) {
			return false;
		}

		// Check if it contains RSS tag
		if (!trimmed.includes('<rss')) {
			return false;
		}

		return true;
	}
}
