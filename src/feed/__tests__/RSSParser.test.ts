/**
 * Unit tests for RSSParser
 */

import { RSSParser } from '../RSSParser';
import { FeedParseError } from '../../utils/errorUtils';

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

// Sample RSS 2.0 feed XML
const sampleRSSFeed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
	<channel>
		<title>Test Podcast</title>
		<description>A test podcast for unit testing</description>
		<link>https://example.com/podcast</link>
		<language>en-US</language>
		<itunes:author>Test Author</itunes:author>
		<itunes:summary>Detailed podcast summary</itunes:summary>
		<itunes:image href="https://example.com/podcast-image.jpg" />
		<itunes:category text="Technology" />
		<itunes:owner>
			<itunes:name>Test Owner</itunes:name>
			<itunes:email>owner@example.com</itunes:email>
		</itunes:owner>
		<image>
			<url>https://example.com/fallback-image.jpg</url>
			<title>Test Podcast</title>
			<link>https://example.com/podcast</link>
		</image>

		<item>
			<title>Episode 1: Introduction</title>
			<description>First episode description</description>
			<link>https://example.com/episode1</link>
			<pubDate>Mon, 01 Jan 2024 10:00:00 GMT</pubDate>
			<guid>episode-1-guid</guid>
			<enclosure url="https://example.com/episode1.mp3" length="12345678" type="audio/mpeg" />
			<itunes:duration>1:23:45</itunes:duration>
			<itunes:episode>1</itunes:episode>
			<itunes:season>1</itunes:season>
			<itunes:episodeType>full</itunes:episodeType>
			<itunes:image href="https://example.com/episode1-image.jpg" />
			<itunes:author>Episode Author</itunes:author>
			<itunes:summary>Detailed episode summary</itunes:summary>
		</item>

		<item>
			<title>Episode 2: Continuation</title>
			<description>Second episode description</description>
			<pubDate>Mon, 08 Jan 2024 10:00:00 GMT</pubDate>
			<guid>episode-2-guid</guid>
			<enclosure url="https://example.com/episode2.mp3" length="23456789" type="audio/mpeg" />
			<itunes:duration>3600</itunes:duration>
			<itunes:episode>2</itunes:episode>
		</item>

		<item>
			<title>Bonus Episode</title>
			<description>Bonus content</description>
			<pubDate>Mon, 15 Jan 2024 10:00:00 GMT</pubDate>
			<guid>bonus-guid</guid>
			<enclosure url="https://example.com/bonus.mp3" type="audio/mpeg" />
			<itunes:duration>30:15</itunes:duration>
			<itunes:episodeType>bonus</itunes:episodeType>
		</item>
	</channel>
</rss>`;

const minimalRSSFeed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
	<channel>
		<title>Minimal Podcast</title>
		<item>
			<title>Minimal Episode</title>
			<enclosure url="https://example.com/minimal.mp3" type="audio/mpeg" />
		</item>
	</channel>
</rss>`;

const invalidRSSFeed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
	<channel>
		<title>Invalid Podcast</title>
		<item>
			<title>Episode without enclosure</title>
		</item>
	</channel>
</rss>`;

describe('RSSParser', () => {
	let parser: RSSParser;

	beforeEach(() => {
		parser = new RSSParser();
		jest.clearAllMocks();
	});

	describe('parseFromString', () => {
		it('should parse a valid RSS feed', async () => {
			const feedUrl = 'https://example.com/feed.rss';
			const result = await parser.parseFromString(sampleRSSFeed, feedUrl);

			// Check podcast data
			expect(result.podcast).toBeDefined();
			expect(result.podcast.title).toBe('Test Podcast');
			expect(result.podcast.author).toBe('Test Author');
			expect(result.podcast.description).toBe('Detailed podcast summary');
			expect(result.podcast.feedUrl).toBe(feedUrl);
			expect(result.podcast.imageUrl).toBe('https://example.com/podcast-image.jpg');
			expect(result.podcast.websiteUrl).toBe('https://example.com/podcast');
			expect(result.podcast.language).toBe('en-US');
			expect(result.podcast.categories).toContain('Technology');

			// Check episodes data
			expect(result.episodes).toHaveLength(3);

			// Check first episode
			const episode1 = result.episodes[0];
			expect(episode1.title).toBe('Episode 1: Introduction');
			expect(episode1.description).toBe('Detailed episode summary');
			expect(episode1.audioUrl).toBe('https://example.com/episode1.mp3');
			expect(episode1.duration).toBe(5025); // 1:23:45 = 5025 seconds
			expect(episode1.episodeNumber).toBe(1);
			expect(episode1.seasonNumber).toBe(1);
			expect(episode1.episodeType).toBe('full');
			expect(episode1.imageUrl).toBe('https://example.com/episode1-image.jpg');
			expect(episode1.fileSize).toBe(12345678);
			expect(episode1.mimeType).toBe('audio/mpeg');
			expect(episode1.guid).toBe('episode-1-guid');
			expect(episode1.publishDate).toBeInstanceOf(Date);
		});

		it('should parse minimal RSS feed with defaults', async () => {
			const result = await parser.parseFromString(minimalRSSFeed, 'https://example.com/feed.rss');

			expect(result.podcast.title).toBe('Minimal Podcast');
			expect(result.podcast.author).toBe('Unknown Author');
			expect(result.podcast.description).toBe('No description available');

			expect(result.episodes).toHaveLength(1);
			expect(result.episodes[0].title).toBe('Minimal Episode');
			expect(result.episodes[0].duration).toBe(0); // No duration provided
		});

		it('should skip episodes without audio enclosure', async () => {
			const result = await parser.parseFromString(invalidRSSFeed, 'https://example.com/feed.rss');

			expect(result.podcast).toBeDefined();
			expect(result.episodes).toHaveLength(0); // Episode without enclosure should be skipped
		});

		it('should throw FeedParseError for invalid XML', async () => {
			const invalidXML = 'not valid xml at all';

			await expect(
				parser.parseFromString(invalidXML, 'https://example.com/feed.rss')
			).rejects.toThrow(FeedParseError);
		});

		it('should generate consistent podcast IDs from feed URL', async () => {
			const feedUrl = 'https://example.com/feed.rss';
			const result1 = await parser.parseFromString(sampleRSSFeed, feedUrl);
			const result2 = await parser.parseFromString(sampleRSSFeed, feedUrl);

			expect(result1.podcast.id).toBe(result2.podcast.id);
		});

		it('should generate consistent episode IDs from GUID', async () => {
			const result1 = await parser.parseFromString(sampleRSSFeed, 'https://example.com/feed.rss');
			const result2 = await parser.parseFromString(sampleRSSFeed, 'https://example.com/feed.rss');

			expect(result1.episodes[0].id).toBe(result2.episodes[0].id);
		});
	});

	describe('parseDuration', () => {
		it('should parse HH:MM:SS format', async () => {
			const feed = sampleRSSFeed;
			const result = await parser.parseFromString(feed, 'https://example.com/feed.rss');

			// Episode 1 has duration "1:23:45"
			expect(result.episodes[0].duration).toBe(5025);
		});

		it('should parse seconds-only format', async () => {
			const feed = sampleRSSFeed;
			const result = await parser.parseFromString(feed, 'https://example.com/feed.rss');

			// Episode 2 has duration "3600"
			expect(result.episodes[1].duration).toBe(3600);
		});

		it('should parse MM:SS format', async () => {
			const feed = sampleRSSFeed;
			const result = await parser.parseFromString(feed, 'https://example.com/feed.rss');

			// Bonus episode has duration "30:15"
			expect(result.episodes[2].duration).toBe(1815); // 30*60 + 15
		});

		it('should return 0 for missing duration', async () => {
			const result = await parser.parseFromString(minimalRSSFeed, 'https://example.com/feed.rss');

			expect(result.episodes[0].duration).toBe(0);
		});
	});

	describe('extractPodcastData', () => {
		it('should prefer iTunes fields over standard RSS fields', async () => {
			const result = await parser.parseFromString(sampleRSSFeed, 'https://example.com/feed.rss');

			// Should use iTunes author instead of owner
			expect(result.podcast.author).toBe('Test Author');

			// Should use iTunes summary instead of description
			expect(result.podcast.description).toBe('Detailed podcast summary');

			// Should use iTunes image instead of standard image
			expect(result.podcast.imageUrl).toBe('https://example.com/podcast-image.jpg');
		});

		it('should fall back to standard fields when iTunes fields are missing', async () => {
			const result = await parser.parseFromString(minimalRSSFeed, 'https://example.com/feed.rss');

			expect(result.podcast.author).toBe('Unknown Author'); // Default when no author
			expect(result.podcast.description).toBe('No description available'); // Default
		});

		it('should handle missing optional fields', async () => {
			const result = await parser.parseFromString(minimalRSSFeed, 'https://example.com/feed.rss');

			expect(result.podcast.imageUrl).toBeUndefined();
			expect(result.podcast.websiteUrl).toBeUndefined();
			expect(result.podcast.language).toBeUndefined();
			expect(result.podcast.categories).toBeUndefined();
		});
	});

	describe('extractEpisodeData', () => {
		it('should parse all episode types', async () => {
			const result = await parser.parseFromString(sampleRSSFeed, 'https://example.com/feed.rss');

			expect(result.episodes[0].episodeType).toBe('full');
			expect(result.episodes[1].episodeType).toBeUndefined(); // Not specified
			expect(result.episodes[2].episodeType).toBe('bonus');
		});

		it('should parse episode and season numbers', async () => {
			const result = await parser.parseFromString(sampleRSSFeed, 'https://example.com/feed.rss');

			expect(result.episodes[0].episodeNumber).toBe(1);
			expect(result.episodes[0].seasonNumber).toBe(1);
			expect(result.episodes[1].episodeNumber).toBe(2);
			expect(result.episodes[1].seasonNumber).toBeUndefined();
		});

		it('should prefer iTunes summary over content and description', async () => {
			const result = await parser.parseFromString(sampleRSSFeed, 'https://example.com/feed.rss');

			expect(result.episodes[0].description).toBe('Detailed episode summary');
		});

		it('should handle episodes with minimal data', async () => {
			const result = await parser.parseFromString(minimalRSSFeed, 'https://example.com/feed.rss');

			const episode = result.episodes[0];
			expect(episode.title).toBe('Minimal Episode');
			expect(episode.description).toBe('No description available');
			expect(episode.duration).toBe(0);
			expect(episode.episodeNumber).toBeUndefined();
			expect(episode.seasonNumber).toBeUndefined();
			expect(episode.episodeType).toBeUndefined();
		});
	});

	describe('validateXML', () => {
		it('should validate RSS XML starting with xml declaration', () => {
			expect(RSSParser.validateXML(sampleRSSFeed)).toBe(true);
		});

		it('should validate RSS XML starting with rss tag', () => {
			const xml = '<rss version="2.0"><channel><title>Test</title></channel></rss>';
			expect(RSSParser.validateXML(xml)).toBe(true);
		});

		it('should reject non-XML strings', () => {
			expect(RSSParser.validateXML('not xml')).toBe(false);
			expect(RSSParser.validateXML('{"json": "data"}')).toBe(false);
		});

		it('should reject empty or invalid input', () => {
			expect(RSSParser.validateXML('')).toBe(false);
			expect(RSSParser.validateXML(null as any)).toBe(false);
			expect(RSSParser.validateXML(undefined as any)).toBe(false);
			expect(RSSParser.validateXML(123 as any)).toBe(false);
		});

		it('should reject XML without RSS tag', () => {
			const xml = '<?xml version="1.0"?><feed></feed>';
			expect(RSSParser.validateXML(xml)).toBe(false);
		});
	});

	describe('ID generation', () => {
		it('should generate different IDs for different feeds', async () => {
			const result1 = await parser.parseFromString(sampleRSSFeed, 'https://example.com/feed1.rss');
			const result2 = await parser.parseFromString(sampleRSSFeed, 'https://example.com/feed2.rss');

			expect(result1.podcast.id).not.toBe(result2.podcast.id);
		});

		it('should generate different IDs for different episodes', async () => {
			const result = await parser.parseFromString(sampleRSSFeed, 'https://example.com/feed.rss');

			const ids = result.episodes.map(ep => ep.id);
			const uniqueIds = new Set(ids);

			expect(uniqueIds.size).toBe(ids.length); // All IDs should be unique
		});

		it('should generate IDs in the expected format', async () => {
			const result = await parser.parseFromString(sampleRSSFeed, 'https://example.com/feed.rss');

			expect(result.podcast.id).toMatch(/^podcast-[a-z0-9]+$/);
			result.episodes.forEach(episode => {
				expect(episode.id).toMatch(/^episode-[a-z0-9]+$/);
			});
		});
	});

	describe('error handling', () => {
		it('should continue parsing other episodes when one fails', async () => {
			// Create a feed with one valid and one invalid episode
			const mixedFeed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
	<channel>
		<title>Mixed Podcast</title>
		<item>
			<title>Valid Episode</title>
			<enclosure url="https://example.com/valid.mp3" type="audio/mpeg" />
		</item>
		<item>
			<title>Invalid Episode</title>
			<!-- Missing enclosure -->
		</item>
		<item>
			<title>Another Valid Episode</title>
			<enclosure url="https://example.com/valid2.mp3" type="audio/mpeg" />
		</item>
	</channel>
</rss>`;

			const result = await parser.parseFromString(mixedFeed, 'https://example.com/feed.rss');

			// Should have 2 valid episodes, invalid one skipped
			expect(result.episodes).toHaveLength(2);
			expect(result.episodes[0].title).toBe('Valid Episode');
			expect(result.episodes[1].title).toBe('Another Valid Episode');
		});

		it('should handle malformed date strings gracefully', async () => {
			const feedWithBadDate = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
	<channel>
		<title>Test Podcast</title>
		<item>
			<title>Episode</title>
			<pubDate>not a valid date</pubDate>
			<enclosure url="https://example.com/episode.mp3" type="audio/mpeg" />
		</item>
	</channel>
</rss>`;

			const result = await parser.parseFromString(feedWithBadDate, 'https://example.com/feed.rss');

			expect(result.episodes).toHaveLength(1);
			expect(result.episodes[0].publishDate).toBeInstanceOf(Date);
			// Should create a valid date even if parsing fails
		});
	});
});
