/**
 * CacheStore - Manages feed and image caching
 *
 * Provides caching mechanisms for podcast feeds and images to reduce network requests
 * and improve performance. Supports cache expiration and cleanup.
 */

import { Vault } from 'obsidian';
import { logger } from '../utils/Logger';
import { StorageError } from '../utils/errorUtils';
import { DataPathManager } from './DataPathManager';
import { MultiFileStore } from './FileSystemStore';

/**
 * Cache entry metadata
 */
export interface CacheEntry<T> {
	data: T;
	cachedAt: Date;
	expiresAt: Date;
	url: string;
}

/**
 * Feed cache entry
 */
export interface FeedCacheEntry extends CacheEntry<string> {
	feedUrl: string;
	etag?: string;
	lastModified?: string;
}

/**
 * Image cache entry metadata
 */
export interface ImageCacheEntry {
	imageUrl: string;
	localPath: string;
	cachedAt: Date;
	size: number;
	mimeType?: string;
}

/**
 * Feed cache store
 */
export class FeedCacheStore extends MultiFileStore<FeedCacheEntry[], FeedCacheEntry> {
	private defaultTTL: number; // Time to live in milliseconds

	constructor(vault: Vault, pathManager: DataPathManager, ttl = 3600000) {
		// Default TTL: 1 hour
		const dirPath = pathManager.getStructure().cacheFeed;
		super(vault, pathManager, dirPath);
		this.defaultTTL = ttl;
	}

	/**
	 * Validate cache entry
	 */
	protected validate(data: FeedCacheEntry[]): boolean {
		if (!Array.isArray(data)) {
			logger.warn('Invalid feed cache data: not an array');
			return false;
		}

		for (const entry of data) {
			if (!this.validateEntry(entry)) {
				logger.warn('Invalid feed cache entry', entry);
				return false;
			}
		}

		return true;
	}

	/**
	 * Validate a single cache entry
	 */
	private validateEntry(entry: FeedCacheEntry): boolean {
		if (!entry || typeof entry !== 'object') {
			return false;
		}

		const requiredFields = ['data', 'cachedAt', 'expiresAt', 'url', 'feedUrl'];
		for (const field of requiredFields) {
			if (!(field in entry)) {
				logger.warn(`Missing required field in cache entry: ${field}`);
				return false;
			}
		}

		return true;
	}

	/**
	 * Get default value
	 */
	protected getDefaultValue(): FeedCacheEntry[] {
		return [];
	}

	/**
	 * Load all feed cache entries
	 */
	protected async loadAllItems(): Promise<FeedCacheEntry[]> {
		const ids = await this.listItemIds();
		const entries: FeedCacheEntry[] = [];

		for (const id of ids) {
			try {
				const defaultEntry: FeedCacheEntry = {
					data: '',
					cachedAt: new Date(),
					expiresAt: new Date(),
					url: '',
					feedUrl: ''
				};
				const entry = await this.loadItem(id, defaultEntry);
				if (entry && this.validateEntry(entry)) {
					entries.push(entry);
				}
			} catch (error) {
				logger.warn(`Failed to load cache entry: ${id}`, error);
			}
		}

		return entries;
	}

	/**
	 * Load all feed cache
	 */
	async load(): Promise<FeedCacheEntry[]> {
		logger.methodEntry('FeedCacheStore', 'load');
		const entries = await this.loadAllItems();
		logger.methodExit('FeedCacheStore', 'load');
		return entries;
	}

	/**
	 * Save all feed cache (not typically used, use setCacheEntry instead)
	 */
	async save(data: FeedCacheEntry[]): Promise<void> {
		logger.methodEntry('FeedCacheStore', 'save');

		if (!this.validate(data)) {
			throw new StorageError('Invalid feed cache data', this.dirPath);
		}

		// Clear existing cache
		await this.clear();

		// Save each entry
		for (const entry of data) {
			const id = this.getFeedCacheId(entry.feedUrl);
			await this.saveItem(id, entry);
		}

		logger.methodExit('FeedCacheStore', 'save');
	}

	/**
	 * Generate cache ID from feed URL
	 */
	private getFeedCacheId(feedUrl: string): string {
		// Use a simple hash of the URL as the cache ID
		let hash = 0;
		for (let i = 0; i < feedUrl.length; i++) {
			const char = feedUrl.charCodeAt(i);
			hash = (hash << 5) - hash + char;
			hash = hash & hash; // Convert to 32-bit integer
		}
		return `feed-${Math.abs(hash).toString(36)}`;
	}

	/**
	 * Get cached feed data
	 */
	async getCacheEntry(feedUrl: string): Promise<FeedCacheEntry | null> {
		logger.methodEntry('FeedCacheStore', 'getCacheEntry', feedUrl);

		const id = this.getFeedCacheId(feedUrl);

		try {
			const defaultEntry: FeedCacheEntry = {
				data: '',
				cachedAt: new Date(),
				expiresAt: new Date(),
				url: '',
				feedUrl: ''
			};
			const entry = await this.loadItem(id, defaultEntry);

			if (!entry || !this.validateEntry(entry)) {
				logger.methodExit('FeedCacheStore', 'getCacheEntry', 'invalid entry');
				return null;
			}

			// Check if cache is expired
			const now = new Date();
			const expiresAt = new Date(entry.expiresAt);

			if (now > expiresAt) {
				logger.debug('Cache entry expired', feedUrl);
				await this.deleteItem(id);
				logger.methodExit('FeedCacheStore', 'getCacheEntry', 'expired');
				return null;
			}

			logger.methodExit('FeedCacheStore', 'getCacheEntry');
			return entry;
		} catch (error) {
			logger.warn('Failed to get cache entry', error);
			logger.methodExit('FeedCacheStore', 'getCacheEntry', 'error');
			return null;
		}
	}

	/**
	 * Set cached feed data
	 */
	async setCacheEntry(
		feedUrl: string,
		data: string,
		ttl: number = this.defaultTTL,
		metadata?: { etag?: string; lastModified?: string }
	): Promise<void> {
		logger.methodEntry('FeedCacheStore', 'setCacheEntry', feedUrl);

		const now = new Date();
		const expiresAt = new Date(now.getTime() + ttl);

		const entry: FeedCacheEntry = {
			data,
			cachedAt: now,
			expiresAt,
			url: feedUrl,
			feedUrl,
			etag: metadata?.etag,
			lastModified: metadata?.lastModified,
		};

		const id = this.getFeedCacheId(feedUrl);
		await this.saveItem(id, entry);

		logger.methodExit('FeedCacheStore', 'setCacheEntry');
	}

	/**
	 * Remove a cached feed
	 */
	async removeCacheEntry(feedUrl: string): Promise<void> {
		logger.methodEntry('FeedCacheStore', 'removeCacheEntry', feedUrl);

		const id = this.getFeedCacheId(feedUrl);
		await this.deleteItem(id);

		logger.methodExit('FeedCacheStore', 'removeCacheEntry');
	}

	/**
	 * Clean up expired cache entries
	 */
	async cleanupExpired(): Promise<void> {
		logger.methodEntry('FeedCacheStore', 'cleanupExpired');

		const entries = await this.loadAllItems();
		const now = new Date();
		let removedCount = 0;

		for (const entry of entries) {
			const expiresAt = new Date(entry.expiresAt);
			if (now > expiresAt) {
				const id = this.getFeedCacheId(entry.feedUrl);
				await this.deleteItem(id);
				removedCount++;
			}
		}

		logger.info(`Cleaned up ${removedCount} expired cache entries`);
		logger.methodExit('FeedCacheStore', 'cleanupExpired');
	}

	/**
	 * Get cache statistics
	 */
	async getCacheStats(): Promise<{
		totalEntries: number;
		expiredEntries: number;
		totalSize: number;
	}> {
		const entries = await this.loadAllItems();
		const now = new Date();
		let expiredCount = 0;
		let totalSize = 0;

		for (const entry of entries) {
			const expiresAt = new Date(entry.expiresAt);
			if (now > expiresAt) {
				expiredCount++;
			}
			totalSize += entry.data.length;
		}

		return {
			totalEntries: entries.length,
			expiredEntries: expiredCount,
			totalSize,
		};
	}
}

/**
 * Image cache index
 */
interface ImageCacheIndex {
	images: ImageCacheEntry[];
	version: number;
}

/**
 * Image cache store
 */
export class ImageCacheStore {
	private vault: Vault;
	private pathManager: DataPathManager;
	private indexFilePath: string;
	private static readonly CURRENT_VERSION = 1;

	constructor(vault: Vault, pathManager: DataPathManager) {
		this.vault = vault;
		this.pathManager = pathManager;
		this.indexFilePath = pathManager.getFilePath('cache', 'image-index.json');
	}

	/**
	 * Load image cache index
	 */
	private async loadIndex(): Promise<ImageCacheIndex> {
		try {
			const adapter = this.vault.adapter;

			if (!(await adapter.exists(this.indexFilePath))) {
				return this.getDefaultIndex();
			}

			const content = await adapter.read(this.indexFilePath);
			const index = JSON.parse(content) as ImageCacheIndex;

			if (!this.validateIndex(index)) {
				logger.warn('Invalid image cache index, using default');
				return this.getDefaultIndex();
			}

			return index;
		} catch (error) {
			logger.error('Failed to load image cache index', error);
			return this.getDefaultIndex();
		}
	}

	/**
	 * Save image cache index
	 */
	private async saveIndex(index: ImageCacheIndex): Promise<void> {
		try {
			const content = JSON.stringify(index, null, 2);
			await this.vault.adapter.write(this.indexFilePath, content);
		} catch (error) {
			logger.error('Failed to save image cache index', error);
			throw new StorageError('Failed to save image cache index', this.indexFilePath);
		}
	}

	/**
	 * Validate image cache index
	 */
	private validateIndex(index: ImageCacheIndex): boolean {
		if (!index || typeof index !== 'object') {
			return false;
		}

		if (!Array.isArray(index.images)) {
			return false;
		}

		if (typeof index.version !== 'number') {
			return false;
		}

		return true;
	}

	/**
	 * Get default index
	 */
	private getDefaultIndex(): ImageCacheIndex {
		return {
			images: [],
			version: ImageCacheStore.CURRENT_VERSION,
		};
	}

	/**
	 * Generate cache filename from image URL
	 */
	private getImageCacheFilename(imageUrl: string): string {
		// Extract file extension from URL
		let extension = 'jpg'; // default
		try {
			const urlObj = new URL(imageUrl);
			const pathname = urlObj.pathname;
			const match = pathname.match(/\.([a-zA-Z0-9]+)$/);
			if (match) {
				extension = match[1].toLowerCase();
			}
		} catch {
			// Invalid URL, use default extension
		}

		// Generate hash-based filename
		let hash = 0;
		for (let i = 0; i < imageUrl.length; i++) {
			const char = imageUrl.charCodeAt(i);
			hash = (hash << 5) - hash + char;
			hash = hash & hash;
		}

		return `image-${Math.abs(hash).toString(36)}.${extension}`;
	}

	/**
	 * Get cached image
	 */
	async getCachedImage(imageUrl: string): Promise<string | null> {
		logger.methodEntry('ImageCacheStore', 'getCachedImage', imageUrl);

		const index = await this.loadIndex();
		const entry = index.images.find(img => img.imageUrl === imageUrl);

		if (!entry) {
			logger.methodExit('ImageCacheStore', 'getCachedImage', 'not found');
			return null;
		}

		// Check if file exists
		const exists = await this.vault.adapter.exists(entry.localPath);
		if (!exists) {
			logger.warn('Cached image file not found', entry.localPath);
			// Remove from index
			await this.removeCachedImage(imageUrl);
			logger.methodExit('ImageCacheStore', 'getCachedImage', 'file missing');
			return null;
		}

		logger.methodExit('ImageCacheStore', 'getCachedImage');
		return entry.localPath;
	}

	/**
	 * Cache an image
	 */
	async cacheImage(imageUrl: string, imageData: ArrayBuffer): Promise<string> {
		logger.methodEntry('ImageCacheStore', 'cacheImage', imageUrl);

		const filename = this.getImageCacheFilename(imageUrl);
		const localPath = this.pathManager.getFilePath('cacheImages', filename);

		// Write image file
		await this.vault.adapter.writeBinary(localPath, imageData);

		// Update index
		const index = await this.loadIndex();

		// Remove existing entry if any
		index.images = index.images.filter(img => img.imageUrl !== imageUrl);

		// Add new entry
		const entry: ImageCacheEntry = {
			imageUrl,
			localPath,
			cachedAt: new Date(),
			size: imageData.byteLength,
		};

		index.images.push(entry);
		await this.saveIndex(index);

		logger.methodExit('ImageCacheStore', 'cacheImage');
		return localPath;
	}

	/**
	 * Remove a cached image
	 */
	async removeCachedImage(imageUrl: string): Promise<void> {
		logger.methodEntry('ImageCacheStore', 'removeCachedImage', imageUrl);

		const index = await this.loadIndex();
		const entry = index.images.find(img => img.imageUrl === imageUrl);

		if (entry) {
			// Delete file
			try {
				await this.vault.adapter.remove(entry.localPath);
			} catch (error) {
				logger.warn('Failed to delete cached image file', error);
			}

			// Remove from index
			index.images = index.images.filter(img => img.imageUrl !== imageUrl);
			await this.saveIndex(index);
		}

		logger.methodExit('ImageCacheStore', 'removeCachedImage');
	}

	/**
	 * Clear all cached images
	 */
	async clearAll(): Promise<void> {
		logger.methodEntry('ImageCacheStore', 'clearAll');

		const index = await this.loadIndex();

		// Delete all image files
		for (const entry of index.images) {
			try {
				await this.vault.adapter.remove(entry.localPath);
			} catch (error) {
				logger.warn(`Failed to delete cached image: ${entry.localPath}`, error);
			}
		}

		// Reset index
		await this.saveIndex(this.getDefaultIndex());

		logger.methodExit('ImageCacheStore', 'clearAll');
	}

	/**
	 * Get cache statistics
	 */
	async getCacheStats(): Promise<{
		totalImages: number;
		totalSize: number;
	}> {
		const index = await this.loadIndex();
		const totalSize = index.images.reduce((sum, img) => sum + img.size, 0);

		return {
			totalImages: index.images.length,
			totalSize,
		};
	}

	/**
	 * Clean up old images (keep only the most recent N)
	 */
	async cleanupOldImages(keepCount = 100): Promise<void> {
		logger.methodEntry('ImageCacheStore', 'cleanupOldImages', `keepCount=${keepCount}`);

		const index = await this.loadIndex();

		if (index.images.length <= keepCount) {
			logger.methodExit('ImageCacheStore', 'cleanupOldImages', 'nothing to cleanup');
			return;
		}

		// Sort by cachedAt (most recent first)
		const sorted = [...index.images].sort((a, b) => {
			const dateA = new Date(a.cachedAt).getTime();
			const dateB = new Date(b.cachedAt).getTime();
			return dateB - dateA;
		});

		// Delete old images
		const toDelete = sorted.slice(keepCount);
		for (const entry of toDelete) {
			try {
				await this.vault.adapter.remove(entry.localPath);
			} catch (error) {
				logger.warn(`Failed to delete old image: ${entry.localPath}`, error);
			}
		}

		// Update index
		index.images = sorted.slice(0, keepCount);
		await this.saveIndex(index);

		logger.info(`Cleaned up ${toDelete.length} old cached images`);
		logger.methodExit('ImageCacheStore', 'cleanupOldImages');
	}
}
