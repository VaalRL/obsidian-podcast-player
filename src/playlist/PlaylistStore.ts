/**
 * PlaylistStore - Manages playlist persistence
 *
 * Stores playlists in separate JSON files in the playlists/ directory.
 * Each playlist is stored as playlists/[playlist-id].json
 */

import { Vault } from 'obsidian';
import { logger } from '../utils/Logger';
import { StorageError } from '../utils/errorUtils';
import { Playlist } from '../model';
import { DataPathManager } from '../storage/DataPathManager';
import { MultiFileStore } from '../storage/FileSystemStore';

/**
 * Playlist Store
 */
export class PlaylistStore extends MultiFileStore<Playlist[], Playlist> {
	constructor(vault: Vault, pathManager: DataPathManager) {
		const dirPath = pathManager.getStructure().playlists;
		super(vault, pathManager, dirPath);
	}

	/**
	 * Load a single playlist item and ensure dates are Date objects
	 */
	protected async loadItem(id: string, fallback: Playlist): Promise<Playlist> {
		const playlist = await super.loadItem(id, fallback);

		if (playlist) {
			// Convert date strings to Date objects if needed
			if (typeof playlist.createdAt === 'string') {
				playlist.createdAt = new Date(playlist.createdAt);
			}
			if (typeof playlist.updatedAt === 'string') {
				playlist.updatedAt = new Date(playlist.updatedAt);
			}
		}

		return playlist;
	}

	/**
	 * Validate playlist data
	 */
	protected validate(data: Playlist[]): boolean {
		if (!Array.isArray(data)) {
			logger.warn('Invalid playlist data: not an array');
			return false;
		}

		for (const playlist of data) {
			if (!this.validatePlaylist(playlist)) {
				logger.warn('Invalid playlist', playlist);
				return false;
			}
		}

		return true;
	}

	/**
	 * Validate a single playlist
	 */
	private validatePlaylist(playlist: Playlist): boolean {
		if (!playlist || typeof playlist !== 'object') {
			return false;
		}

		const requiredFields = ['id', 'name', 'episodeIds', 'createdAt', 'updatedAt'];
		for (const field of requiredFields) {
			if (!(field in playlist)) {
				logger.warn(`Missing required field in playlist: ${field}`);
				return false;
			}
		}

		if (!Array.isArray(playlist.episodeIds)) {
			logger.warn('Playlist episodeIds is not an array');
			return false;
		}

		return true;
	}

	/**
	 * Get default value
	 */
	protected getDefaultValue(): Playlist[] {
		return [];
	}

	/**
	 * Load all playlists
	 */
	protected async loadAllItems(): Promise<Playlist[]> {
		const ids = await this.listItemIds();
		const playlists: Playlist[] = [];

		for (const id of ids) {
			try {
				const playlist = await this.loadItem(id, null as any);
				if (playlist && this.validatePlaylist(playlist)) {
					playlists.push(playlist);
				}
			} catch (error) {
				logger.warn(`Failed to load playlist: ${id}`, error);
			}
		}

		return playlists;
	}

	/**
	 * Load all playlists
	 */
	async load(): Promise<Playlist[]> {
		logger.methodEntry('PlaylistStore', 'load');
		const playlists = await this.loadAllItems();
		logger.methodExit('PlaylistStore', 'load');
		return playlists;
	}

	/**
	 * Save all playlists (not typically used, use savePlaylist instead)
	 */
	async save(data: Playlist[]): Promise<void> {
		logger.methodEntry('PlaylistStore', 'save');

		if (!this.validate(data)) {
			throw new StorageError('Invalid playlist data', this.dirPath);
		}

		// Clear existing playlists
		await this.clear();

		// Save each playlist
		for (const playlist of data) {
			await this.saveItem(playlist.id, playlist);
		}

		logger.methodExit('PlaylistStore', 'save');
	}

	/**
	 * Get a playlist by ID
	 */
	async getPlaylist(id: string): Promise<Playlist | null> {
		logger.methodEntry('PlaylistStore', 'getPlaylist', id);

		try {
			const playlist = await this.loadItem(id, null as any);

			if (!playlist || !this.validatePlaylist(playlist)) {
				logger.methodExit('PlaylistStore', 'getPlaylist', 'invalid');
				return null;
			}

			logger.methodExit('PlaylistStore', 'getPlaylist');
			return playlist;
		} catch (error) {
			logger.warn('Failed to get playlist', error);
			logger.methodExit('PlaylistStore', 'getPlaylist', 'error');
			return null;
		}
	}

	/**
	 * Save a playlist
	 */
	async savePlaylist(playlist: Playlist): Promise<void> {
		logger.methodEntry('PlaylistStore', 'savePlaylist', playlist.id);

		if (!this.validatePlaylist(playlist)) {
			throw new StorageError('Invalid playlist data', `${this.dirPath}/${playlist.id}.json`);
		}

		await this.saveItem(playlist.id, playlist);

		logger.methodExit('PlaylistStore', 'savePlaylist');
	}

	/**
	 * Delete a playlist
	 */
	async deletePlaylist(id: string): Promise<void> {
		logger.methodEntry('PlaylistStore', 'deletePlaylist', id);

		await this.deleteItem(id);

		logger.methodExit('PlaylistStore', 'deletePlaylist');
	}

	/**
	 * Check if a playlist exists
	 */
	async exists(id: string): Promise<boolean> {
		const playlist = await this.getPlaylist(id);
		return playlist !== null;
	}

	/**
	 * Get all playlist IDs
	 */
	async getAllIds(): Promise<string[]> {
		return await this.listItemIds();
	}

	/**
	 * Get playlist count
	 */
	async getCount(): Promise<number> {
		const ids = await this.listItemIds();
		return ids.length;
	}

	/**
	 * Clear all playlists
	 */
	async clear(): Promise<void> {
		logger.methodEntry('PlaylistStore', 'clear');

		const ids = await this.listItemIds();

		for (const id of ids) {
			await this.deleteItem(id);
		}

		logger.info('All playlists cleared');
		logger.methodExit('PlaylistStore', 'clear');
	}
}
