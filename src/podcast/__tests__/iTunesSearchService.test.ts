/**
 * Unit tests for iTunesSearchService
 */

import { iTunesSearchService } from '../iTunesSearchService';
import { NetworkError } from '../../utils/errorUtils';

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

// Sample iTunes API response
const sampleiTunesResponse = {
	resultCount: 2,
	results: [
		{
			collectionId: 123456,
			collectionName: 'Test Podcast',
			artistName: 'Test Author',
			feedUrl: 'https://example.com/feed.xml',
			artworkUrl30: 'https://example.com/artwork30.jpg',
			artworkUrl60: 'https://example.com/artwork60.jpg',
			artworkUrl100: 'https://example.com/artwork100.jpg',
			artworkUrl600: 'https://example.com/artwork600.jpg',
			trackCount: 100,
			primaryGenreName: 'Technology',
			genres: ['Technology', 'Science'],
		},
		{
			collectionId: 789012,
			collectionName: 'Another Podcast',
			artistName: 'Another Author',
			feedUrl: 'https://example.com/feed2.xml',
			artworkUrl100: 'https://example.com/artwork2.jpg',
			trackCount: 50,
			genres: ['Comedy'],
		},
	],
};

describe('iTunesSearchService', () => {
	let service: iTunesSearchService;

	beforeEach(() => {
		service = new iTunesSearchService();
		mockRequestUrl.mockReset();
		jest.clearAllMocks();
	});

	describe('constructor', () => {
		it('should create service instance', () => {
			expect(service).toBeInstanceOf(iTunesSearchService);
		});
	});

	describe('searchPodcasts', () => {
		it('should search podcasts successfully', async () => {
			mockRequestUrl.mockResolvedValue({
				status: 200,
				json: sampleiTunesResponse,
				text: JSON.stringify(sampleiTunesResponse),
				headers: {},
				arrayBuffer: new ArrayBuffer(0),
			});

			const results = await service.searchPodcasts('test podcast');

			expect(results).toHaveLength(2);
			expect(results[0]).toEqual({
				title: 'Test Podcast',
				author: 'Test Author',
				feedUrl: 'https://example.com/feed.xml',
				artworkUrl: 'https://example.com/artwork600.jpg',
				collectionId: '123456',
				episodeCount: 100,
				genres: ['Technology', 'Science'],
			});
			expect(mockRequestUrl).toHaveBeenCalledTimes(1);
		});

		it('should return empty array for empty query', async () => {
			const results = await service.searchPodcasts('');
			expect(results).toEqual([]);
			expect(mockRequestUrl).not.toHaveBeenCalled();
		});

		it('should return empty array for whitespace query', async () => {
			const results = await service.searchPodcasts('   ');
			expect(results).toEqual([]);
			expect(mockRequestUrl).not.toHaveBeenCalled();
		});

		it('should use default options', async () => {
			mockRequestUrl.mockResolvedValue({
				status: 200,
				json: { resultCount: 0, results: [] },
				text: '{"resultCount":0,"results":[]}',
				headers: {},
				arrayBuffer: new ArrayBuffer(0),
			});

			await service.searchPodcasts('test');

			const callArg = mockRequestUrl.mock.calls[0][0];
			const callUrl = typeof callArg === 'string' ? callArg : callArg.url;
			expect(callUrl).toContain('limit=10'); // Default limit
			expect(callUrl).toContain('country=US'); // Default country
		});

		it('should respect custom limit', async () => {
			mockRequestUrl.mockResolvedValue({
				status: 200,
				json: { resultCount: 0, results: [] },
				text: '{"resultCount":0,"results":[]}',
				headers: {},
				arrayBuffer: new ArrayBuffer(0),
			});

			await service.searchPodcasts('test', { limit: 25 });

			const callArg = mockRequestUrl.mock.calls[0][0];
			const callUrl = typeof callArg === 'string' ? callArg : callArg.url;
			expect(callUrl).toContain('limit=25');
		});

		it('should cap limit at maximum', async () => {
			mockRequestUrl.mockResolvedValue({
				status: 200,
				json: { resultCount: 0, results: [] },
				text: '{"resultCount":0,"results":[]}',
				headers: {},
				arrayBuffer: new ArrayBuffer(0),
			});

			await service.searchPodcasts('test', { limit: 500 });

			const callArg = mockRequestUrl.mock.calls[0][0];
			const callUrl = typeof callArg === 'string' ? callArg : callArg.url;
			expect(callUrl).toContain('limit=200'); // Capped at MAX_LIMIT
		});

		it('should use custom country', async () => {
			mockRequestUrl.mockResolvedValue({
				status: 200,
				json: { resultCount: 0, results: [] },
				text: '{"resultCount":0,"results":[]}',
				headers: {},
				arrayBuffer: new ArrayBuffer(0),
			});

			await service.searchPodcasts('test', { country: 'TW' });

			const callArg = mockRequestUrl.mock.calls[0][0];
			const callUrl = typeof callArg === 'string' ? callArg : callArg.url;
			expect(callUrl).toContain('country=TW');
		});

		it('should filter explicit content when requested', async () => {
			mockRequestUrl.mockResolvedValue({
				status: 200,
				json: { resultCount: 0, results: [] },
				text: '{"resultCount":0,"results":[]}',
				headers: {},
				arrayBuffer: new ArrayBuffer(0),
			});

			await service.searchPodcasts('test', { includeExplicit: false });

			const callArg = mockRequestUrl.mock.calls[0][0];
			const callUrl = typeof callArg === 'string' ? callArg : callArg.url;
			expect(callUrl).toContain('explicit=No');
		});

		it('should handle 404 error', async () => {
			mockRequestUrl.mockResolvedValue({
				status: 404,
				json: {},
				text: 'Not Found',
				headers: {},
				arrayBuffer: new ArrayBuffer(0),
			});

			const results = await service.searchPodcasts('test');

			expect(results).toEqual([]);
		});

		it('should handle network error', async () => {
			mockRequestUrl.mockRejectedValue(new NetworkError('Network timeout', 'https://itunes.apple.com/search'));

			await expect(service.searchPodcasts('test')).rejects.toThrow(NetworkError);
		});

		it('should handle invalid response format', async () => {
			mockRequestUrl.mockResolvedValue({
				status: 200,
				json: { invalid: 'format' },
				text: '{"invalid":"format"}',
				headers: {},
				arrayBuffer: new ArrayBuffer(0),
			});

			const results = await service.searchPodcasts('test');

			expect(results).toEqual([]);
		});

		it('should handle null response', async () => {
			mockRequestUrl.mockResolvedValue({
				status: 200,
				json: null as any,
				text: 'null',
				headers: {},
				arrayBuffer: new ArrayBuffer(0),
			});

			const results = await service.searchPodcasts('test');

			expect(results).toEqual([]);
		});

		it('should prefer higher resolution artwork', async () => {
			mockRequestUrl.mockResolvedValue({
				status: 200,
				json: {
					resultCount: 1,
					results: [
						{
							collectionId: 123,
							collectionName: 'Test',
							artistName: 'Author',
							feedUrl: 'https://example.com/feed.xml',
							artworkUrl30: 'https://example.com/30.jpg',
							artworkUrl600: 'https://example.com/600.jpg',
						},
					],
				},
				text: '',
				headers: {},
				arrayBuffer: new ArrayBuffer(0),
			});

			const results = await service.searchPodcasts('test');

			expect(results[0].artworkUrl).toBe('https://example.com/600.jpg');
		});

		it('should handle missing optional fields', async () => {
			mockRequestUrl.mockResolvedValue({
				status: 200,
				json: {
					resultCount: 1,
					results: [
						{
							collectionId: 123,
							collectionName: 'Test',
							feedUrl: 'https://example.com/feed.xml',
						},
					],
				},
				text: '',
				headers: {},
				arrayBuffer: new ArrayBuffer(0),
			});

			const results = await service.searchPodcasts('test');

			expect(results).toHaveLength(1);
			expect(results[0].title).toBe('Test');
			expect(results[0].author).toBeUndefined();
			expect(results[0].artworkUrl).toBeUndefined();
		});

		it('should extract genres correctly', async () => {
			mockRequestUrl.mockResolvedValue({
				status: 200,
				json: {
					resultCount: 1,
					results: [
						{
							collectionId: 123,
							collectionName: 'Test',
							feedUrl: 'https://example.com/feed.xml',
							primaryGenreName: 'Technology',
							genres: ['Technology', 'Science', 'Education'],
						},
					],
				},
				text: '',
				headers: {},
				arrayBuffer: new ArrayBuffer(0),
			});

			const results = await service.searchPodcasts('test');

			expect(results[0].genres).toEqual(['Technology', 'Science', 'Education']);
		});

		it('should handle empty results', async () => {
			mockRequestUrl.mockResolvedValue({
				status: 200,
				json: {
					resultCount: 0,
					results: [],
				},
				text: '',
				headers: {},
				arrayBuffer: new ArrayBuffer(0),
			});

			const results = await service.searchPodcasts('nonexistent podcast xyz123');

			expect(results).toEqual([]);
		});
	});

	describe('isAppleUrl', () => {
		it('should identify Apple URLs', () => {
			expect(iTunesSearchService.isAppleUrl('https://podcasts.apple.com/podcast/123')).toBe(true);
			expect(iTunesSearchService.isAppleUrl('https://itunes.apple.com/podcast/123')).toBe(true);
			expect(iTunesSearchService.isAppleUrl('https://music.apple.com/podcast/123')).toBe(true);
		});

		it('should reject non-Apple URLs', () => {
			expect(iTunesSearchService.isAppleUrl('https://example.com/feed.xml')).toBe(false);
			expect(iTunesSearchService.isAppleUrl('https://spotify.com/podcast/123')).toBe(false);
		});

		it('should handle invalid URLs', () => {
			expect(iTunesSearchService.isAppleUrl('not a url')).toBe(false);
			expect(iTunesSearchService.isAppleUrl('')).toBe(false);
		});
	});
});
