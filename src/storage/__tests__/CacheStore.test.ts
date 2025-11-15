/**
 * Unit tests for CacheStore (FeedCacheStore and ImageCacheStore)
 */

import { FeedCacheStore, ImageCacheStore, FeedCacheEntry, ImageCacheEntry } from '../CacheStore';
import { Vault } from 'obsidian';
import { DataPathManager } from '../DataPathManager';
import { StorageError } from '../../utils/errorUtils';

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

// Mock the parent class
jest.mock('../FileSystemStore', () => {
	const itemsStore = new Map<string, any>();

	return {
		MultiFileStore: class {
			protected dirPath: string;

			constructor(vault: any, pathManager: any, dirPath: string) {
				this.dirPath = dirPath;
			}

			async listItemIds(): Promise<string[]> {
				return Array.from(itemsStore.keys());
			}

			async loadItem(id: string, defaultValue: any): Promise<any> {
				return itemsStore.get(id) || defaultValue;
			}

			async saveItem(id: string, data: any): Promise<void> {
				itemsStore.set(id, data);
			}

			async deleteItem(id: string): Promise<void> {
				itemsStore.delete(id);
			}

			async clear(): Promise<void> {
				itemsStore.clear();
			}
		},
	};
});

describe('FeedCacheStore', () => {
	let store: FeedCacheStore;
	let mockVault: jest.Mocked<Vault>;
	let mockPathManager: jest.Mocked<DataPathManager>;

	const sampleFeedEntry: FeedCacheEntry = {
		data: '<rss>feed data</rss>',
		cachedAt: new Date('2024-01-01T10:00:00Z'),
		expiresAt: new Date('2024-01-01T11:00:00Z'),
		url: 'https://example.com/feed.rss',
		feedUrl: 'https://example.com/feed.rss',
		etag: '"12345"',
		lastModified: 'Wed, 01 Jan 2024 10:00:00 GMT',
	};

	beforeEach(() => {
		jest.clearAllMocks();
		// Clear the mock store
		const { MultiFileStore } = require('../FileSystemStore');
		const instance = new MultiFileStore({}, {}, '');
		instance.clear();

		mockVault = {} as any;
		mockPathManager = {
			getStructure: jest.fn().mockReturnValue({
				cacheFeed: 'cache/feed',
			}),
		} as any;

		store = new FeedCacheStore(mockVault, mockPathManager);
	});

	describe('constructor', () => {
		it('should create store with default TTL', () => {
			const freshStore = new FeedCacheStore(mockVault, mockPathManager);
			expect(freshStore).toBeInstanceOf(FeedCacheStore);
			expect(mockPathManager.getStructure).toHaveBeenCalled();
		});

		it('should create store with custom TTL', () => {
			const customTTL = 7200000; // 2 hours
			const freshStore = new FeedCacheStore(mockVault, mockPathManager, customTTL);
			expect(freshStore).toBeInstanceOf(FeedCacheStore);
		});
	});

	describe('validation', () => {
		it('should validate correct cache data', () => {
			const validData = [sampleFeedEntry];
			const result = (store as any).validate(validData);
			expect(result).toBe(true);
		});

		it('should reject non-array data', () => {
			const result = (store as any).validate('not an array');
			expect(result).toBe(false);
		});

		it('should reject data with invalid entry', () => {
			const invalidData = [{ data: 'test' }]; // Missing required fields
			const result = (store as any).validate(invalidData);
			expect(result).toBe(false);
		});

		it('should validate individual entry', () => {
			const result = (store as any).validateEntry(sampleFeedEntry);
			expect(result).toBe(true);
		});

		it('should reject entry missing required fields', () => {
			const invalidEntry = {
				data: 'test',
				cachedAt: new Date(),
			};
			const result = (store as any).validateEntry(invalidEntry);
			expect(result).toBe(false);
		});

		it('should reject non-object entry', () => {
			const result = (store as any).validateEntry('not an object');
			expect(result).toBe(false);
		});
	});

	describe('getDefaultValue', () => {
		it('should return empty array', () => {
			const result = (store as any).getDefaultValue();
			expect(result).toEqual([]);
		});
	});

	describe('getFeedCacheId', () => {
		it('should generate consistent ID for same URL', () => {
			const url = 'https://example.com/feed.rss';
			const id1 = (store as any).getFeedCacheId(url);
			const id2 = (store as any).getFeedCacheId(url);
			expect(id1).toBe(id2);
		});

		it('should generate different IDs for different URLs', () => {
			const id1 = (store as any).getFeedCacheId('https://example.com/feed1.rss');
			const id2 = (store as any).getFeedCacheId('https://example.com/feed2.rss');
			expect(id1).not.toBe(id2);
		});

		it('should generate ID with feed- prefix', () => {
			const id = (store as any).getFeedCacheId('https://example.com/feed.rss');
			expect(id).toMatch(/^feed-/);
		});
	});

	describe('setCacheEntry and getCacheEntry', () => {
		it('should set and get cache entry', async () => {
			const feedUrl = 'https://example.com/feed.rss';
			const data = '<rss>feed data</rss>';

			await store.setCacheEntry(feedUrl, data);

			const entry = await store.getCacheEntry(feedUrl);
			expect(entry).not.toBeNull();
			expect(entry?.data).toBe(data);
			expect(entry?.feedUrl).toBe(feedUrl);
		});

		it('should set cache entry with metadata', async () => {
			const feedUrl = 'https://example.com/feed.rss';
			const data = '<rss>feed data</rss>';
			const metadata = {
				etag: '"12345"',
				lastModified: 'Wed, 01 Jan 2024 10:00:00 GMT',
			};

			await store.setCacheEntry(feedUrl, data, 3600000, metadata);

			const entry = await store.getCacheEntry(feedUrl);
			expect(entry?.etag).toBe(metadata.etag);
			expect(entry?.lastModified).toBe(metadata.lastModified);
		});

		it('should use custom TTL', async () => {
			const feedUrl = 'https://example.com/feed.rss';
			const data = '<rss>feed data</rss>';
			const customTTL = 7200000; // 2 hours

			await store.setCacheEntry(feedUrl, data, customTTL);

			const entry = await store.getCacheEntry(feedUrl);
			expect(entry).not.toBeNull();

			const ttl = new Date(entry!.expiresAt).getTime() - new Date(entry!.cachedAt).getTime();
			expect(ttl).toBe(customTTL);
		});

		it('should return null for non-existent entry', async () => {
			const entry = await store.getCacheEntry('https://example.com/nonexistent.rss');
			expect(entry).toBeNull();
		});

		it('should return null for expired entry', async () => {
			const feedUrl = 'https://example.com/feed.rss';
			const expiredEntry: FeedCacheEntry = {
				...sampleFeedEntry,
				feedUrl,
				expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
			};

			const id = (store as any).getFeedCacheId(feedUrl);
			await (store as any).saveItem(id, expiredEntry);

			const result = await store.getCacheEntry(feedUrl);
			expect(result).toBeNull();
		});

		it('should return null for invalid entry', async () => {
			const feedUrl = 'https://example.com/feed.rss';
			const invalidEntry = { data: 'test' }; // Missing required fields

			const id = (store as any).getFeedCacheId(feedUrl);
			await (store as any).saveItem(id, invalidEntry);

			const result = await store.getCacheEntry(feedUrl);
			expect(result).toBeNull();
		});
	});

	describe('removeCacheEntry', () => {
		it('should remove cache entry', async () => {
			const feedUrl = 'https://example.com/feed.rss';
			await store.setCacheEntry(feedUrl, '<rss>data</rss>');

			await store.removeCacheEntry(feedUrl);

			const entry = await store.getCacheEntry(feedUrl);
			expect(entry).toBeNull();
		});

		it('should not throw error when removing non-existent entry', async () => {
			await expect(store.removeCacheEntry('https://example.com/nonexistent.rss')).resolves.not.toThrow();
		});
	});

	describe('load', () => {
		it('should load all cache entries', async () => {
			await store.setCacheEntry('https://example.com/feed1.rss', '<rss>1</rss>');
			await store.setCacheEntry('https://example.com/feed2.rss', '<rss>2</rss>');

			const entries = await store.load();

			expect(entries).toHaveLength(2);
			expect(entries.some(e => e.feedUrl === 'https://example.com/feed1.rss')).toBe(true);
			expect(entries.some(e => e.feedUrl === 'https://example.com/feed2.rss')).toBe(true);
		});

		it('should return empty array when no entries', async () => {
			const entries = await store.load();
			expect(entries).toEqual([]);
		});

		it('should skip invalid entries', async () => {
			await store.setCacheEntry('https://example.com/feed1.rss', '<rss>1</rss>');

			// Add an invalid entry
			const id = (store as any).getFeedCacheId('https://example.com/invalid.rss');
			await (store as any).saveItem(id, { data: 'invalid' });

			const entries = await store.load();

			// Should only load the valid entry
			expect(entries).toHaveLength(1);
			expect(entries[0].feedUrl).toBe('https://example.com/feed1.rss');
		});
	});

	describe('save', () => {
		it('should save all cache entries', async () => {
			const entries: FeedCacheEntry[] = [
				{
					...sampleFeedEntry,
					feedUrl: 'https://example.com/feed1.rss',
					url: 'https://example.com/feed1.rss',
				},
				{
					...sampleFeedEntry,
					feedUrl: 'https://example.com/feed2.rss',
					url: 'https://example.com/feed2.rss',
				},
			];

			await store.save(entries);

			const loaded = await store.load();
			expect(loaded).toHaveLength(2);
		});

		it('should clear existing cache before saving', async () => {
			await store.setCacheEntry('https://example.com/old.rss', '<rss>old</rss>');

			const newEntries: FeedCacheEntry[] = [
				{
					...sampleFeedEntry,
					feedUrl: 'https://example.com/new.rss',
					url: 'https://example.com/new.rss',
				},
			];

			await store.save(newEntries);

			const loaded = await store.load();
			expect(loaded).toHaveLength(1);
			expect(loaded[0].feedUrl).toBe('https://example.com/new.rss');
		});

		it('should throw error for invalid data', async () => {
			const invalidData = [{ data: 'test' }] as any;
			await expect(store.save(invalidData)).rejects.toThrow(StorageError);
		});
	});

	describe('cleanupExpired', () => {
		it('should remove expired entries', async () => {
			// Add expired entry
			const expiredEntry: FeedCacheEntry = {
				...sampleFeedEntry,
				feedUrl: 'https://example.com/expired.rss',
				expiresAt: new Date(Date.now() - 1000),
			};
			const id = (store as any).getFeedCacheId(expiredEntry.feedUrl);
			await (store as any).saveItem(id, expiredEntry);

			// Add valid entry
			await store.setCacheEntry('https://example.com/valid.rss', '<rss>valid</rss>');

			await store.cleanupExpired();

			const entries = await store.load();
			expect(entries).toHaveLength(1);
			expect(entries[0].feedUrl).toBe('https://example.com/valid.rss');
		});

		it('should not remove non-expired entries', async () => {
			await store.setCacheEntry('https://example.com/feed1.rss', '<rss>1</rss>');
			await store.setCacheEntry('https://example.com/feed2.rss', '<rss>2</rss>');

			await store.cleanupExpired();

			const entries = await store.load();
			expect(entries).toHaveLength(2);
		});
	});

	describe('getCacheStats', () => {
		it('should return cache statistics', async () => {
			await store.setCacheEntry('https://example.com/feed1.rss', '<rss>data1</rss>');
			await store.setCacheEntry('https://example.com/feed2.rss', '<rss>data2</rss>');

			const stats = await store.getCacheStats();

			expect(stats.totalEntries).toBe(2);
			expect(stats.expiredEntries).toBe(0);
			expect(stats.totalSize).toBeGreaterThan(0);
		});

		it('should count expired entries', async () => {
			const expiredEntry: FeedCacheEntry = {
				...sampleFeedEntry,
				feedUrl: 'https://example.com/expired.rss',
				expiresAt: new Date(Date.now() - 1000),
			};
			const id = (store as any).getFeedCacheId(expiredEntry.feedUrl);
			await (store as any).saveItem(id, expiredEntry);

			await store.setCacheEntry('https://example.com/valid.rss', '<rss>valid</rss>');

			const stats = await store.getCacheStats();

			expect(stats.totalEntries).toBe(2);
			expect(stats.expiredEntries).toBe(1);
		});

		it('should calculate total size', async () => {
			const data1 = '<rss>data1</rss>';
			const data2 = '<rss>data2</rss>';

			await store.setCacheEntry('https://example.com/feed1.rss', data1);
			await store.setCacheEntry('https://example.com/feed2.rss', data2);

			const stats = await store.getCacheStats();

			expect(stats.totalSize).toBe(data1.length + data2.length);
		});
	});
});

describe('ImageCacheStore', () => {
	let store: ImageCacheStore;
	let mockVault: jest.Mocked<Vault>;
	let mockPathManager: jest.Mocked<DataPathManager>;
	let mockAdapter: any;

	beforeEach(() => {
		jest.clearAllMocks();

		mockAdapter = {
			exists: jest.fn(),
			read: jest.fn(),
			write: jest.fn(),
			writeBinary: jest.fn(),
			remove: jest.fn(),
		};

		mockVault = {
			adapter: mockAdapter,
		} as any;

		mockPathManager = {
			getFilePath: jest.fn((type: string, filename: string) => {
				if (type === 'cache') {
					return 'cache/image-index.json';
				}
				return `cache/images/${filename}`;
			}),
		} as any;

		store = new ImageCacheStore(mockVault, mockPathManager);
	});

	describe('constructor', () => {
		it('should create store with vault and path manager', () => {
			const freshStore = new ImageCacheStore(mockVault, mockPathManager);
			expect(freshStore).toBeInstanceOf(ImageCacheStore);
			expect(mockPathManager.getFilePath).toHaveBeenCalledWith('cache', 'image-index.json');
		});
	});

	describe('index management', () => {
		it('should load index from file', async () => {
			const index = {
				images: [],
				version: 1,
			};

			mockAdapter.exists.mockResolvedValue(true);
			mockAdapter.read.mockResolvedValue(JSON.stringify(index));

			const result = await (store as any).loadIndex();

			expect(result).toEqual(index);
		});

		it('should return default index when file does not exist', async () => {
			mockAdapter.exists.mockResolvedValue(false);

			const result = await (store as any).loadIndex();

			expect(result).toEqual({
				images: [],
				version: 1,
			});
		});

		it('should return default index for invalid data', async () => {
			mockAdapter.exists.mockResolvedValue(true);
			mockAdapter.read.mockResolvedValue('invalid json');

			const result = await (store as any).loadIndex();

			expect(result).toEqual({
				images: [],
				version: 1,
			});
		});

		it('should save index to file', async () => {
			const index = {
				images: [],
				version: 1,
			};

			await (store as any).saveIndex(index);

			expect(mockAdapter.write).toHaveBeenCalledWith(
				'cache/image-index.json',
				JSON.stringify(index, null, 2)
			);
		});

		it('should throw error when save fails', async () => {
			mockAdapter.write.mockRejectedValue(new Error('Write failed'));

			const index = { images: [], version: 1 };

			await expect((store as any).saveIndex(index)).rejects.toThrow(StorageError);
		});

		it('should validate correct index', () => {
			const validIndex = {
				images: [],
				version: 1,
			};

			const result = (store as any).validateIndex(validIndex);
			expect(result).toBe(true);
		});

		it('should reject invalid index', () => {
			expect((store as any).validateIndex(null)).toBe(false);
			expect((store as any).validateIndex('not an object')).toBe(false);
			expect((store as any).validateIndex({ images: 'not an array' })).toBe(false);
			expect((store as any).validateIndex({ images: [], version: 'not a number' })).toBe(false);
		});

		it('should return default index', () => {
			const result = (store as any).getDefaultIndex();

			expect(result).toEqual({
				images: [],
				version: 1,
			});
		});
	});

	describe('getImageCacheFilename', () => {
		it('should generate filename with extension from URL', () => {
			const filename = (store as any).getImageCacheFilename('https://example.com/image.jpg');
			expect(filename).toMatch(/^image-.*\.jpg$/);
		});

		it('should use jpg as default extension', () => {
			const filename = (store as any).getImageCacheFilename('https://example.com/image');
			expect(filename).toMatch(/^image-.*\.jpg$/);
		});

		it('should generate consistent filename for same URL', () => {
			const url = 'https://example.com/image.png';
			const filename1 = (store as any).getImageCacheFilename(url);
			const filename2 = (store as any).getImageCacheFilename(url);
			expect(filename1).toBe(filename2);
		});

		it('should generate different filenames for different URLs', () => {
			const filename1 = (store as any).getImageCacheFilename('https://example.com/image1.jpg');
			const filename2 = (store as any).getImageCacheFilename('https://example.com/image2.jpg');
			expect(filename1).not.toBe(filename2);
		});

		it('should handle various image extensions', () => {
			expect((store as any).getImageCacheFilename('https://example.com/image.png')).toMatch(/\.png$/);
			expect((store as any).getImageCacheFilename('https://example.com/image.gif')).toMatch(/\.gif$/);
			expect((store as any).getImageCacheFilename('https://example.com/image.webp')).toMatch(/\.webp$/);
		});
	});

	describe('getCachedImage', () => {
		it('should return cached image path', async () => {
			const imageUrl = 'https://example.com/image.jpg';
			const localPath = 'cache/images/image-abc.jpg';

			const index = {
				images: [
					{
						imageUrl,
						localPath,
						cachedAt: new Date(),
						size: 1024,
					},
				],
				version: 1,
			};

			mockAdapter.exists.mockResolvedValueOnce(true); // Index exists
			mockAdapter.read.mockResolvedValue(JSON.stringify(index));
			mockAdapter.exists.mockResolvedValueOnce(true); // Image file exists

			const result = await store.getCachedImage(imageUrl);

			expect(result).toBe(localPath);
		});

		it('should return null for non-existent image', async () => {
			mockAdapter.exists.mockResolvedValue(true);
			mockAdapter.read.mockResolvedValue(JSON.stringify({ images: [], version: 1 }));

			const result = await store.getCachedImage('https://example.com/nonexistent.jpg');

			expect(result).toBeNull();
		});

		it('should remove from index if file is missing', async () => {
			const imageUrl = 'https://example.com/image.jpg';
			const localPath = 'cache/images/image-abc.jpg';

			const index = {
				images: [
					{
						imageUrl,
						localPath,
						cachedAt: new Date(),
						size: 1024,
					},
				],
				version: 1,
			};

			// Setup mocks for getCachedImage and subsequent removeCachedImage call
			mockAdapter.exists.mockResolvedValueOnce(true); // Index exists (first call)
			mockAdapter.read.mockResolvedValueOnce(JSON.stringify(index)); // Load index (first time)
			mockAdapter.exists.mockResolvedValueOnce(false); // Image file missing
			mockAdapter.exists.mockResolvedValueOnce(true); // Index exists (removeCachedImage call)
			mockAdapter.read.mockResolvedValueOnce(JSON.stringify(index)); // Load index (removeCachedImage)

			const result = await store.getCachedImage(imageUrl);

			expect(result).toBeNull();
			expect(mockAdapter.remove).toHaveBeenCalledWith(localPath);
			expect(mockAdapter.write).toHaveBeenCalled(); // Index updated
		});
	});

	describe('cacheImage', () => {
		it('should cache image and update index', async () => {
			const imageUrl = 'https://example.com/image.jpg';
			const imageData = new ArrayBuffer(1024);

			mockAdapter.exists.mockResolvedValue(false);

			const result = await store.cacheImage(imageUrl, imageData);

			expect(result).toMatch(/^cache\/images\/image-.*\.jpg$/);
			expect(mockAdapter.writeBinary).toHaveBeenCalledWith(result, imageData);
			expect(mockAdapter.write).toHaveBeenCalled(); // Index updated
		});

		it('should replace existing image', async () => {
			const imageUrl = 'https://example.com/image.jpg';
			const oldPath = 'cache/images/old.jpg';

			const index = {
				images: [
					{
						imageUrl,
						localPath: oldPath,
						cachedAt: new Date('2024-01-01'),
						size: 512,
					},
				],
				version: 1,
			};

			mockAdapter.exists.mockResolvedValue(true);
			mockAdapter.read.mockResolvedValue(JSON.stringify(index));

			const imageData = new ArrayBuffer(1024);
			await store.cacheImage(imageUrl, imageData);

			// Should write new file
			expect(mockAdapter.writeBinary).toHaveBeenCalled();

			// Should update index (old entry removed, new entry added)
			expect(mockAdapter.write).toHaveBeenCalled();
		});
	});

	describe('removeCachedImage', () => {
		it('should remove image and update index', async () => {
			const imageUrl = 'https://example.com/image.jpg';
			const localPath = 'cache/images/image-abc.jpg';

			const index = {
				images: [
					{
						imageUrl,
						localPath,
						cachedAt: new Date(),
						size: 1024,
					},
				],
				version: 1,
			};

			mockAdapter.exists.mockResolvedValue(true);
			mockAdapter.read.mockResolvedValue(JSON.stringify(index));

			await store.removeCachedImage(imageUrl);

			expect(mockAdapter.remove).toHaveBeenCalledWith(localPath);
			expect(mockAdapter.write).toHaveBeenCalled();
		});

		it('should not throw if image does not exist', async () => {
			mockAdapter.exists.mockResolvedValue(true);
			mockAdapter.read.mockResolvedValue(JSON.stringify({ images: [], version: 1 }));

			await expect(store.removeCachedImage('https://example.com/nonexistent.jpg')).resolves.not.toThrow();
		});

		it('should continue if file deletion fails', async () => {
			const imageUrl = 'https://example.com/image.jpg';
			const localPath = 'cache/images/image-abc.jpg';

			const index = {
				images: [
					{
						imageUrl,
						localPath,
						cachedAt: new Date(),
						size: 1024,
					},
				],
				version: 1,
			};

			mockAdapter.exists.mockResolvedValue(true);
			mockAdapter.read.mockResolvedValue(JSON.stringify(index));
			mockAdapter.remove.mockRejectedValue(new Error('Remove failed'));

			await expect(store.removeCachedImage(imageUrl)).resolves.not.toThrow();
			expect(mockAdapter.write).toHaveBeenCalled(); // Index still updated
		});
	});

	describe('clearAll', () => {
		it('should remove all cached images', async () => {
			const index = {
				images: [
					{
						imageUrl: 'https://example.com/image1.jpg',
						localPath: 'cache/images/image1.jpg',
						cachedAt: new Date(),
						size: 1024,
					},
					{
						imageUrl: 'https://example.com/image2.jpg',
						localPath: 'cache/images/image2.jpg',
						cachedAt: new Date(),
						size: 2048,
					},
				],
				version: 1,
			};

			mockAdapter.exists.mockResolvedValue(true);
			mockAdapter.read.mockResolvedValue(JSON.stringify(index));

			await store.clearAll();

			expect(mockAdapter.remove).toHaveBeenCalledTimes(2);
			expect(mockAdapter.write).toHaveBeenCalled(); // Index reset
		});

		it('should continue if file deletion fails', async () => {
			const index = {
				images: [
					{
						imageUrl: 'https://example.com/image.jpg',
						localPath: 'cache/images/image.jpg',
						cachedAt: new Date(),
						size: 1024,
					},
				],
				version: 1,
			};

			mockAdapter.exists.mockResolvedValue(true);
			mockAdapter.read.mockResolvedValue(JSON.stringify(index));
			mockAdapter.remove.mockRejectedValue(new Error('Remove failed'));

			await expect(store.clearAll()).resolves.not.toThrow();
			expect(mockAdapter.write).toHaveBeenCalled(); // Index still reset
		});
	});

	describe('getCacheStats', () => {
		it('should return cache statistics', async () => {
			const index = {
				images: [
					{
						imageUrl: 'https://example.com/image1.jpg',
						localPath: 'cache/images/image1.jpg',
						cachedAt: new Date(),
						size: 1024,
					},
					{
						imageUrl: 'https://example.com/image2.jpg',
						localPath: 'cache/images/image2.jpg',
						cachedAt: new Date(),
						size: 2048,
					},
				],
				version: 1,
			};

			mockAdapter.exists.mockResolvedValue(true);
			mockAdapter.read.mockResolvedValue(JSON.stringify(index));

			const stats = await store.getCacheStats();

			expect(stats.totalImages).toBe(2);
			expect(stats.totalSize).toBe(3072);
		});

		it('should return zero stats for empty cache', async () => {
			mockAdapter.exists.mockResolvedValue(false);

			const stats = await store.getCacheStats();

			expect(stats.totalImages).toBe(0);
			expect(stats.totalSize).toBe(0);
		});
	});

	describe('cleanupOldImages', () => {
		it('should keep only most recent images', async () => {
			const now = new Date();
			const index = {
				images: [
					{
						imageUrl: 'https://example.com/old.jpg',
						localPath: 'cache/images/old.jpg',
						cachedAt: new Date(now.getTime() - 3600000), // 1 hour ago
						size: 1024,
					},
					{
						imageUrl: 'https://example.com/recent.jpg',
						localPath: 'cache/images/recent.jpg',
						cachedAt: now,
						size: 2048,
					},
				],
				version: 1,
			};

			mockAdapter.exists.mockResolvedValue(true);
			mockAdapter.read.mockResolvedValue(JSON.stringify(index));

			await store.cleanupOldImages(1); // Keep only 1 image

			expect(mockAdapter.remove).toHaveBeenCalledWith('cache/images/old.jpg');
			expect(mockAdapter.write).toHaveBeenCalled(); // Index updated
		});

		it('should not cleanup if within limit', async () => {
			const index = {
				images: [
					{
						imageUrl: 'https://example.com/image.jpg',
						localPath: 'cache/images/image.jpg',
						cachedAt: new Date(),
						size: 1024,
					},
				],
				version: 1,
			};

			mockAdapter.exists.mockResolvedValue(true);
			mockAdapter.read.mockResolvedValue(JSON.stringify(index));

			await store.cleanupOldImages(100);

			expect(mockAdapter.remove).not.toHaveBeenCalled();
		});

		it('should continue if file deletion fails', async () => {
			const now = new Date();
			const index = {
				images: [
					{
						imageUrl: 'https://example.com/old.jpg',
						localPath: 'cache/images/old.jpg',
						cachedAt: new Date(now.getTime() - 3600000),
						size: 1024,
					},
					{
						imageUrl: 'https://example.com/recent.jpg',
						localPath: 'cache/images/recent.jpg',
						cachedAt: now,
						size: 2048,
					},
				],
				version: 1,
			};

			mockAdapter.exists.mockResolvedValue(true);
			mockAdapter.read.mockResolvedValue(JSON.stringify(index));
			mockAdapter.remove.mockRejectedValue(new Error('Remove failed'));

			await expect(store.cleanupOldImages(1)).resolves.not.toThrow();
			expect(mockAdapter.write).toHaveBeenCalled(); // Index still updated
		});
	});
});
