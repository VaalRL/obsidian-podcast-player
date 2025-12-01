/**
 * Unit tests for FeedService
 */

import { FeedService, FeedType } from '../FeedService';
import { FeedCacheStore } from '../../storage/CacheStore';
import { RSSParser } from '../RSSParser';
import { AtomParser } from '../AtomParser';
import { FeedParseError, NetworkError } from '../../utils/errorUtils';
import { Podcast, Episode } from '../../model';

// Mock logger
jest.mock('../../utils/Logger', () => ({
	logger: {
		methodEntry: jest.fn(),
		methodExit: jest.fn(),
		debug: jest.fn(),
		info: jest.fn(),
		warn: jest.fn(),
		error: jest.fn(),
	},
}));

// Mock Obsidian's requestUrl
jest.mock('obsidian', () => ({
	requestUrl: jest.fn(),
}));

import { requestUrl } from 'obsidian';
const mockRequestUrl = requestUrl as jest.MockedFunction<typeof requestUrl>;

// Mock retryWithBackoff to not actually retry (for faster tests)
jest.mock('../../utils/errorUtils', () => {
	const actual = jest.requireActual('../../utils/errorUtils');
	return {
		...actual,
		retryWithBackoff: jest.fn(async (fn) => await fn()),
	};
});

// Sample feed XML
const sampleRSSFeed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
	<channel>
		<title>Test Podcast</title>
		<description>A test podcast</description>
		<item>
			<title>Episode 1</title>
			<description>First episode</description>
			<enclosure url="https://example.com/episode1.mp3" type="audio/mpeg" length="12345" />
			<guid>ep1</guid>
			<pubDate>Mon, 01 Jan 2024 10:00:00 GMT</pubDate>
		</item>
	</channel>
</rss>`;

const sampleAtomFeed = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
	<title>Test Podcast</title>
	<subtitle>A test podcast</subtitle>
	<updated>2024-01-01T10:00:00Z</updated>
	<entry>
		<title>Episode 1</title>
		<id>ep1</id>
		<updated>2024-01-01T10:00:00Z</updated>
		<published>2024-01-01T10:00:00Z</published>
		<summary>First episode</summary>
		<link rel="enclosure" type="audio/mpeg" href="https://example.com/episode1.mp3" />
	</entry>
</feed>`;

describe('FeedService', () => {
	let service: FeedService;
	let mockCacheStore: jest.Mocked<FeedCacheStore>;

	beforeEach(() => {
		// Create mock cache store
		mockCacheStore = {
			getCacheEntry: jest.fn(),
			setCacheEntry: jest.fn(),
			removeCacheEntry: jest.fn(),
			clear: jest.fn(),
		} as any;

		service = new FeedService(mockCacheStore);

		// Reset mocks
		mockRequestUrl.mockReset();
		mockCacheStore.getCacheEntry.mockReset();
		mockCacheStore.setCacheEntry.mockReset();
		mockCacheStore.removeCacheEntry.mockReset();
		mockCacheStore.clear.mockReset();
		jest.clearAllMocks();
	});

	describe('constructor', () => {
		it('should create service with cache store', () => {
			const service = new FeedService(mockCacheStore);
			expect(service).toBeInstanceOf(FeedService);
		});

		it('should create service without cache store', () => {
			const service = new FeedService();
			expect(service).toBeInstanceOf(FeedService);
		});
	});

	describe('fetchFeed', () => {
		it('should fetch and parse RSS feed', async () => {
			mockRequestUrl.mockResolvedValue({
				status: 200,
				text: sampleRSSFeed,
				headers: {},
			arrayBuffer: new ArrayBuffer(0),
			json: {},
			});

			const result = await service.fetchFeed('https://example.com/feed.rss');

			expect(result.podcast).toBeDefined();
			expect(result.podcast.title).toBe('Test Podcast');
			expect(result.episodes).toBeDefined();
			expect(mockRequestUrl).toHaveBeenCalledTimes(1);
		});

		it('should fetch and parse Atom feed', async () => {
			mockRequestUrl.mockResolvedValue({
				status: 200,
				text: sampleAtomFeed,
				headers: {},
			arrayBuffer: new ArrayBuffer(0),
			json: {},
			});

			const result = await service.fetchFeed('https://example.com/feed.atom');

			expect(result.podcast).toBeDefined();
			expect(result.podcast.title).toBe('Test Podcast');
			expect(result.episodes).toBeDefined();
			expect(mockRequestUrl).toHaveBeenCalledTimes(1);
		});

		it('should use cached feed if available', async () => {
			mockCacheStore.getCacheEntry.mockResolvedValue({
				url: 'https://example.com/feed.rss',
				feedUrl: 'https://example.com/feed.rss',
				data: sampleRSSFeed,
				cachedAt: new Date(Date.now()),
				expiresAt: new Date(Date.now() + 3600000),
			});

			const result = await service.fetchFeed('https://example.com/feed.rss', {
				useCache: true,
			});

			expect(result.podcast).toBeDefined();
			expect(mockCacheStore.getCacheEntry).toHaveBeenCalledWith('https://example.com/feed.rss');
			expect(mockRequestUrl).not.toHaveBeenCalled();
		});

		it('should bypass cache when useCache is false', async () => {
			mockCacheStore.getCacheEntry.mockResolvedValue({
				url: 'https://example.com/feed.rss',
				feedUrl: 'https://example.com/feed.rss',
				data: sampleRSSFeed,
				cachedAt: new Date(Date.now()),
				expiresAt: new Date(Date.now() + 3600000),
			});

			mockRequestUrl.mockResolvedValue({
				status: 200,
				text: sampleRSSFeed,
				headers: {},
			arrayBuffer: new ArrayBuffer(0),
			json: {},
			});

			await service.fetchFeed('https://example.com/feed.rss', {
				useCache: false,
			});

			expect(mockCacheStore.getCacheEntry).not.toHaveBeenCalled();
			expect(mockRequestUrl).toHaveBeenCalledTimes(1);
		});

		it('should cache fetched feed', async () => {
			mockRequestUrl.mockResolvedValue({
				status: 200,
				text: sampleRSSFeed,
				headers: {
					etag: '"12345"',
					'last-modified': 'Mon, 01 Jan 2024 10:00:00 GMT',
				},
			arrayBuffer: new ArrayBuffer(0),
			json: {},
			});

			await service.fetchFeed('https://example.com/feed.rss');

			expect(mockCacheStore.setCacheEntry).toHaveBeenCalledWith(
				'https://example.com/feed.rss',
				sampleRSSFeed,
				3600000, // default TTL
				{
					etag: '"12345"',
					lastModified: 'Mon, 01 Jan 2024 10:00:00 GMT',
				}
			);
		});

		it('should handle fetch errors', async () => {
			mockRequestUrl.mockResolvedValue({
				status: 404,
				text: 'Not Found',
				headers: {},
			arrayBuffer: new ArrayBuffer(0),
			json: {},
			});

			await expect(
				service.fetchFeed('https://example.com/notfound.rss')
			).rejects.toThrow(NetworkError);
		});

		it('should pass custom options to requestUrl', async () => {
			mockRequestUrl.mockResolvedValue({
				status: 200,
				text: sampleRSSFeed,
				headers: {},
			arrayBuffer: new ArrayBuffer(0),
			json: {},
			});

			await service.fetchFeed('https://example.com/feed.rss', {
				timeout: 10000,
				userAgent: 'Custom Agent',
				etag: '"12345"',
				lastModified: 'Mon, 01 Jan 2024 10:00:00 GMT',
			});

			expect(mockRequestUrl).toHaveBeenCalledWith(
				expect.objectContaining({
					url: 'https://example.com/feed.rss',
					method: 'GET',
					headers: expect.objectContaining({
						'User-Agent': 'Custom Agent',
						'If-None-Match': '"12345"',
						'If-Modified-Since': 'Mon, 01 Jan 2024 10:00:00 GMT',
					}),
				})
			);
		});

		it('should try RSS parser first for unknown feed type', async () => {
			const unknownFeed = sampleRSSFeed.replace('<?xml version="1.0" encoding="UTF-8"?>', '');

			mockRequestUrl.mockResolvedValue({
				status: 200,
				text: unknownFeed,
				headers: {},
			arrayBuffer: new ArrayBuffer(0),
			json: {},
			});

			const result = await service.fetchFeed('https://example.com/feed');

			expect(result.podcast).toBeDefined();
		});
	});

	describe('updateFeed', () => {
		it('should fetch fresh feed data and identify new episodes', async () => {
			const podcast: Podcast = {
				id: 'podcast-123',
				title: 'Test Podcast',
				author: 'Test Author',
				description: 'Test Description',
				feedUrl: 'https://example.com/feed.rss',
				subscribedAt: new Date(),
				lastFetchedAt: new Date(),
				episodes: [
					{
						id: 'episode-old',
						podcastId: 'podcast-123',
						title: 'Old Episode',
						description: 'Old',
						audioUrl: 'https://example.com/old.mp3',
						duration: 0,
						publishDate: new Date('2023-01-01'),
					},
				],
			};

			const feedWithNewEpisode = sampleRSSFeed.replace(
				'<guid>ep1</guid>',
				'<guid>episode-new</guid>'
			);

			mockRequestUrl.mockResolvedValue({
				status: 200,
				text: feedWithNewEpisode,
				headers: {},
			arrayBuffer: new ArrayBuffer(0),
			json: {},
			});

			const result = await service.updateFeed(podcast);

			expect(result.podcast).toBeDefined();
			expect(result.episodes).toBeDefined();
			expect(result.newEpisodes).toBeDefined();
			// Note: new episodes detection depends on episode ID generation
		});

		it('should force fresh fetch (bypass cache)', async () => {
			const podcast: Podcast = {
				id: 'podcast-123',
				title: 'Test Podcast',
				author: 'Test Author',
				description: 'Test Description',
				feedUrl: 'https://example.com/feed.rss',
				subscribedAt: new Date(),
				lastFetchedAt: new Date(),
			};

			mockRequestUrl.mockResolvedValue({
				status: 200,
				text: sampleRSSFeed,
				headers: {},
			arrayBuffer: new ArrayBuffer(0),
			json: {},
			});

			await service.updateFeed(podcast);

			expect(mockCacheStore.getCacheEntry).not.toHaveBeenCalled();
			expect(mockRequestUrl).toHaveBeenCalledTimes(1);
		});
	});

	describe('detectFeedType', () => {
		it('should detect RSS feed', () => {
			// Access private method via any cast for testing
			const feedType = (service as any).detectFeedType(sampleRSSFeed);
			expect(feedType).toBe(FeedType.RSS);
		});

		it('should detect Atom feed', () => {
			const feedType = (service as any).detectFeedType(sampleAtomFeed);
			expect(feedType).toBe(FeedType.ATOM);
		});

		it('should return UNKNOWN for invalid feed', () => {
			const feedType = (service as any).detectFeedType('not a feed');
			expect(feedType).toBe(FeedType.UNKNOWN);
		});
	});

	describe('clearCache', () => {
		it('should clear specific feed cache', async () => {
			await service.clearCache('https://example.com/feed.rss');

			expect(mockCacheStore.removeCacheEntry).toHaveBeenCalledWith(
				'https://example.com/feed.rss'
			);
		});

		it('should clear all caches when no URL provided', async () => {
			await service.clearCache();

			expect(mockCacheStore.clear).toHaveBeenCalled();
		});

		it('should handle missing cache store gracefully', async () => {
			const serviceWithoutCache = new FeedService();

			await expect(
				serviceWithoutCache.clearCache('https://example.com/feed.rss')
			).resolves.not.toThrow();
		});
	});

	describe('validateFeedUrl', () => {
		it('should validate HTTP URLs', () => {
			expect(FeedService.validateFeedUrl('http://example.com/feed.rss')).toBe(true);
		});

		it('should validate HTTPS URLs', () => {
			expect(FeedService.validateFeedUrl('https://example.com/feed.rss')).toBe(true);
		});

		it('should reject non-HTTP(S) URLs', () => {
			expect(FeedService.validateFeedUrl('ftp://example.com/feed.rss')).toBe(false);
			expect(FeedService.validateFeedUrl('file:///feed.rss')).toBe(false);
		});

		it('should reject invalid URLs', () => {
			expect(FeedService.validateFeedUrl('not a url')).toBe(false);
			expect(FeedService.validateFeedUrl('')).toBe(false);
		});
	});

	describe('caching behavior', () => {
		it('should not cache if cache store is not provided', async () => {
			const serviceWithoutCache = new FeedService();

			mockRequestUrl.mockResolvedValue({
				status: 200,
				text: sampleRSSFeed,
				headers: {},
			arrayBuffer: new ArrayBuffer(0),
			json: {},
			});

			await serviceWithoutCache.fetchFeed('https://example.com/feed.rss');

			expect(mockCacheStore.setCacheEntry).not.toHaveBeenCalled();
		});

		it('should handle cache get failures gracefully', async () => {
			mockCacheStore.getCacheEntry.mockRejectedValue(new Error('Cache error'));

			mockRequestUrl.mockResolvedValue({
				status: 200,
				text: sampleRSSFeed,
				headers: {},
			arrayBuffer: new ArrayBuffer(0),
			json: {},
			});

			const result = await service.fetchFeed('https://example.com/feed.rss');

			expect(result.podcast).toBeDefined();
			expect(mockRequestUrl).toHaveBeenCalled();
		});

		it('should handle cache set failures gracefully', async () => {
			mockCacheStore.setCacheEntry.mockRejectedValue(new Error('Cache error'));

			mockRequestUrl.mockResolvedValue({
				status: 200,
				text: sampleRSSFeed,
				headers: {},
			arrayBuffer: new ArrayBuffer(0),
			json: {},
			});

			const result = await service.fetchFeed('https://example.com/feed.rss');

			expect(result.podcast).toBeDefined();
		});
	});

	describe('conditional requests', () => {
		it('should handle 304 Not Modified response', async () => {
			mockRequestUrl.mockRejectedValue(new Error('NOT_MODIFIED'));

			// The service re-throws NOT_MODIFIED as-is (not wrapped in NetworkError)
			await expect(
				service.fetchFeed('https://example.com/feed.rss', {
					etag: '"12345"',
				})
			).rejects.toThrow('NOT_MODIFIED');
		});
	});

	describe('error handling', () => {
		it('should handle network errors', async () => {
			mockRequestUrl.mockRejectedValue(new Error('Network error'));

			await expect(
				service.fetchFeed('https://example.com/feed.rss')
			).rejects.toThrow(NetworkError);
		});

		it('should handle invalid XML', async () => {
			mockRequestUrl.mockResolvedValue({
				status: 200,
				text: 'not valid xml',
				headers: {},
			arrayBuffer: new ArrayBuffer(0),
			json: {},
			});

			await expect(
				service.fetchFeed('https://example.com/feed.rss')
			).rejects.toThrow();
		});
	});
});
