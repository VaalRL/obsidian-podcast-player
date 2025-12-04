/**
 * PlaylistManager - Manages playlists
 *
 * Provides high-level playlist management functionality including
 * creating, updating, and organizing playlists.
 */

import { App } from 'obsidian';
import { logger } from '../utils/Logger';
import { Playlist, Episode } from '../model';
import { PlaylistStore } from './PlaylistStore';

/**
 * Playlist Manager
 */
export class PlaylistManager {
	private playlistStore: PlaylistStore;
	private app?: App;

	constructor(playlistStore: PlaylistStore, app?: App) {
		this.playlistStore = playlistStore;
		this.app = app;
	}

	/**
	 * Create a new playlist
	 */
	async createPlaylist(name: string, description?: string, imageUrl?: string): Promise<Playlist> {
		logger.methodEntry('PlaylistManager', 'createPlaylist', name);

		const id = this.generatePlaylistId(name);
		const now = new Date();

		const playlist: Playlist = {
			id,
			name,
			description,
			episodeIds: [],
			createdAt: now,
			updatedAt: now,
			imageUrl,
		};

		await this.playlistStore.savePlaylist(playlist);

		logger.info('Playlist created', id);
		logger.methodExit('PlaylistManager', 'createPlaylist');

		return playlist;
	}

	/**
	 * Get a playlist by ID
	 */
	async getPlaylist(id: string): Promise<Playlist | null> {
		logger.methodEntry('PlaylistManager', 'getPlaylist', id);

		const playlist = await this.playlistStore.getPlaylist(id);

		logger.methodExit('PlaylistManager', 'getPlaylist');
		return playlist;
	}

	/**
	 * Get all playlists
	 */
	async getAllPlaylists(): Promise<Playlist[]> {
		logger.methodEntry('PlaylistManager', 'getAllPlaylists');

		const playlists = await this.playlistStore.load();

		// Sort by updated date (most recent first)
		playlists.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

		logger.methodExit('PlaylistManager', 'getAllPlaylists');
		return playlists;
	}

	/**
	 * Update playlist metadata
	 */
	async updatePlaylist(id: string, updates: Partial<Omit<Playlist, 'id' | 'createdAt'>>): Promise<void> {
		logger.methodEntry('PlaylistManager', 'updatePlaylist', id);

		const playlist = await this.playlistStore.getPlaylist(id);

		if (!playlist) {
			throw new Error(`Playlist not found: ${id}`);
		}

		const updatedPlaylist: Playlist = {
			...playlist,
			...updates,
			id: playlist.id, // Preserve ID
			createdAt: playlist.createdAt, // Preserve creation date
			updatedAt: new Date(),
		};

		await this.playlistStore.savePlaylist(updatedPlaylist);

		if (this.app) {
			this.app.workspace.trigger('podcast:playlist-updated', id);
		}

		logger.methodExit('PlaylistManager', 'updatePlaylist');
	}

	/**
	 * Delete a playlist
	 */
	async deletePlaylist(id: string): Promise<void> {
		logger.methodEntry('PlaylistManager', 'deletePlaylist', id);

		await this.playlistStore.deletePlaylist(id);

		logger.info('Playlist deleted', id);
		logger.methodExit('PlaylistManager', 'deletePlaylist');
	}

	/**
	 * Add an episode to a playlist
	 */
	async addEpisode(playlistId: string, episodeId: string): Promise<void> {
		logger.methodEntry('PlaylistManager', 'addEpisode', `${playlistId}, ${episodeId}`);

		const playlist = await this.playlistStore.getPlaylist(playlistId);

		if (!playlist) {
			throw new Error(`Playlist not found: ${playlistId}`);
		}

		// Check if episode already exists
		if (playlist.episodeIds.includes(episodeId)) {
			logger.warn('Episode already in playlist', episodeId);
			return;
		}

		playlist.episodeIds.push(episodeId);
		playlist.updatedAt = new Date();

		await this.playlistStore.savePlaylist(playlist);

		logger.info('Episode added to playlist', episodeId);

		if (this.app) {
			this.app.workspace.trigger('podcast:playlist-updated', playlistId);
		}

		logger.methodExit('PlaylistManager', 'addEpisode');
	}

	/**
	 * Add multiple episodes to a playlist
	 */
	async addEpisodes(playlistId: string, episodeIds: string[]): Promise<void> {
		logger.methodEntry('PlaylistManager', 'addEpisodes', `${playlistId}, count=${episodeIds.length}`);

		const playlist = await this.playlistStore.getPlaylist(playlistId);

		if (!playlist) {
			throw new Error(`Playlist not found: ${playlistId}`);
		}

		// Add only new episodes
		const existingIds = new Set(playlist.episodeIds);
		const newEpisodeIds = episodeIds.filter(id => !existingIds.has(id));

		if (newEpisodeIds.length === 0) {
			logger.warn('No new episodes to add');
			return;
		}

		playlist.episodeIds.push(...newEpisodeIds);
		playlist.updatedAt = new Date();

		await this.playlistStore.savePlaylist(playlist);

		logger.info(`Added ${newEpisodeIds.length} episodes to playlist`);

		if (this.app) {
			this.app.workspace.trigger('podcast:playlist-updated', playlistId);
		}

		logger.methodExit('PlaylistManager', 'addEpisodes');
	}

	/**
	 * Remove an episode from a playlist
	 */
	async removeEpisode(playlistId: string, episodeId: string): Promise<void> {
		logger.methodEntry('PlaylistManager', 'removeEpisode', `${playlistId}, ${episodeId}`);

		const playlist = await this.playlistStore.getPlaylist(playlistId);

		if (!playlist) {
			throw new Error(`Playlist not found: ${playlistId}`);
		}

		const index = playlist.episodeIds.indexOf(episodeId);

		if (index === -1) {
			logger.warn('Episode not found in playlist', episodeId);
			return;
		}

		playlist.episodeIds.splice(index, 1);
		playlist.updatedAt = new Date();

		await this.playlistStore.savePlaylist(playlist);

		logger.info('Episode removed from playlist', episodeId);

		if (this.app) {
			this.app.workspace.trigger('podcast:playlist-updated', playlistId);
		}

		logger.methodExit('PlaylistManager', 'removeEpisode');
	}

	/**
	 * Remove multiple episodes from a playlist
	 */
	async removeEpisodes(playlistId: string, episodeIds: string[]): Promise<void> {
		logger.methodEntry('PlaylistManager', 'removeEpisodes', `${playlistId}, count=${episodeIds.length}`);

		const playlist = await this.playlistStore.getPlaylist(playlistId);

		if (!playlist) {
			throw new Error(`Playlist not found: ${playlistId}`);
		}

		const idsToRemove = new Set(episodeIds);
		playlist.episodeIds = playlist.episodeIds.filter(id => !idsToRemove.has(id));
		playlist.updatedAt = new Date();

		await this.playlistStore.savePlaylist(playlist);

		logger.info(`Removed ${episodeIds.length} episodes from playlist`);

		if (this.app) {
			this.app.workspace.trigger('podcast:playlist-updated', playlistId);
		}

		logger.methodExit('PlaylistManager', 'removeEpisodes');
	}

	/**
	 * Reorder episodes in a playlist
	 */
	async reorderEpisodes(playlistId: string, episodeIds: string[]): Promise<void> {
		logger.methodEntry('PlaylistManager', 'reorderEpisodes', playlistId);

		const playlist = await this.playlistStore.getPlaylist(playlistId);

		if (!playlist) {
			throw new Error(`Playlist not found: ${playlistId}`);
		}

		// Verify all episodes exist in the playlist
		const existingIds = new Set(playlist.episodeIds);
		const allValid = episodeIds.every(id => existingIds.has(id));

		if (!allValid) {
			throw new Error('Invalid episode IDs in reorder request');
		}

		playlist.episodeIds = episodeIds;
		playlist.updatedAt = new Date();

		await this.playlistStore.savePlaylist(playlist);

		logger.info('Playlist episodes reordered');

		if (this.app) {
			this.app.workspace.trigger('podcast:playlist-updated', playlistId);
		}

		logger.methodExit('PlaylistManager', 'reorderEpisodes');
	}

	/**
	 * Move episode to a different position
	 */
	async moveEpisode(playlistId: string, episodeId: string, toIndex: number): Promise<void> {
		logger.methodEntry('PlaylistManager', 'moveEpisode', `${playlistId}, ${episodeId}, to=${toIndex}`);

		const playlist = await this.playlistStore.getPlaylist(playlistId);

		if (!playlist) {
			throw new Error(`Playlist not found: ${playlistId}`);
		}

		const fromIndex = playlist.episodeIds.indexOf(episodeId);

		if (fromIndex === -1) {
			throw new Error(`Episode not found in playlist: ${episodeId}`);
		}

		// Remove from old position
		playlist.episodeIds.splice(fromIndex, 1);

		// Insert at new position
		const clampedIndex = Math.max(0, Math.min(toIndex, playlist.episodeIds.length));
		playlist.episodeIds.splice(clampedIndex, 0, episodeId);

		playlist.updatedAt = new Date();

		await this.playlistStore.savePlaylist(playlist);

		logger.info('Episode moved in playlist');

		if (this.app) {
			this.app.workspace.trigger('podcast:playlist-updated', playlistId);
		}

		logger.methodExit('PlaylistManager', 'moveEpisode');
	}

	/**
	 * Clear all episodes from a playlist
	 */
	async clearPlaylist(playlistId: string): Promise<void> {
		logger.methodEntry('PlaylistManager', 'clearPlaylist', playlistId);

		const playlist = await this.playlistStore.getPlaylist(playlistId);

		if (!playlist) {
			throw new Error(`Playlist not found: ${playlistId}`);
		}

		playlist.episodeIds = [];
		playlist.updatedAt = new Date();

		await this.playlistStore.savePlaylist(playlist);

		logger.info('Playlist cleared');

		if (this.app) {
			this.app.workspace.trigger('podcast:playlist-updated', playlistId);
		}

		logger.methodExit('PlaylistManager', 'clearPlaylist');
	}

	/**
	 * Get episode count in a playlist
	 */
	async getEpisodeCount(playlistId: string): Promise<number> {
		const playlist = await this.playlistStore.getPlaylist(playlistId);

		if (!playlist) {
			return 0;
		}

		return playlist.episodeIds.length;
	}

	/**
	 * Check if an episode is in a playlist
	 */
	async hasEpisode(playlistId: string, episodeId: string): Promise<boolean> {
		const playlist = await this.playlistStore.getPlaylist(playlistId);

		if (!playlist) {
			return false;
		}

		return playlist.episodeIds.includes(episodeId);
	}

	/**
	 * Search playlists by name
	 */
	async searchPlaylists(query: string): Promise<Playlist[]> {
		logger.methodEntry('PlaylistManager', 'searchPlaylists', query);

		const playlists = await this.getAllPlaylists();
		const lowercaseQuery = query.toLowerCase();

		const results = playlists.filter(playlist => {
			const nameMatch = playlist.name.toLowerCase().includes(lowercaseQuery);
			const descriptionMatch = playlist.description?.toLowerCase().includes(lowercaseQuery);
			return nameMatch || descriptionMatch;
		});

		logger.methodExit('PlaylistManager', 'searchPlaylists', `results=${results.length}`);
		return results;
	}

	/**
	 * Duplicate a playlist
	 */
	async duplicatePlaylist(playlistId: string, newName?: string): Promise<Playlist> {
		logger.methodEntry('PlaylistManager', 'duplicatePlaylist', playlistId);

		const playlist = await this.playlistStore.getPlaylist(playlistId);

		if (!playlist) {
			throw new Error(`Playlist not found: ${playlistId}`);
		}

		const duplicateName = newName || `${playlist.name} (Copy)`;
		const duplicate = await this.createPlaylist(
			duplicateName,
			playlist.description,
			playlist.imageUrl
		);

		// Copy episodes
		duplicate.episodeIds = [...playlist.episodeIds];
		await this.playlistStore.savePlaylist(duplicate);

		logger.info('Playlist duplicated', duplicate.id);
		logger.methodExit('PlaylistManager', 'duplicatePlaylist');

		return duplicate;
	}

	/**
	 * Merge multiple playlists into one
	 */
	async mergePlaylists(playlistIds: string[], newName: string): Promise<Playlist> {
		logger.methodEntry('PlaylistManager', 'mergePlaylists', `count=${playlistIds.length}`);

		const allEpisodeIds: string[] = [];

		for (const id of playlistIds) {
			const playlist = await this.playlistStore.getPlaylist(id);
			if (playlist) {
				allEpisodeIds.push(...playlist.episodeIds);
			}
		}

		// Remove duplicates while preserving order
		const uniqueEpisodeIds = Array.from(new Set(allEpisodeIds));

		const merged = await this.createPlaylist(newName);
		merged.episodeIds = uniqueEpisodeIds;
		await this.playlistStore.savePlaylist(merged);

		logger.info('Playlists merged', merged.id);
		logger.methodExit('PlaylistManager', 'mergePlaylists');

		return merged;
	}

	/**
	 * Get playlist count
	 */
	async getPlaylistCount(): Promise<number> {
		return await this.playlistStore.getCount();
	}

	/**
	 * Generate a unique playlist ID
	 */
	private generatePlaylistId(name: string): string {
		const timestamp = Date.now();
		const randomStr = Math.random().toString(36).substring(2, 8);
		return `playlist-${timestamp}-${randomStr}`;
	}

	/**
	 * Export playlist data
	 */
	async exportPlaylist(playlistId: string): Promise<Playlist> {
		const playlist = await this.playlistStore.getPlaylist(playlistId);

		if (!playlist) {
			throw new Error(`Playlist not found: ${playlistId}`);
		}

		return playlist;
	}

	/**
	 * Import playlist data
	 */
	async importPlaylist(playlistData: Playlist): Promise<Playlist> {
		logger.methodEntry('PlaylistManager', 'importPlaylist', playlistData.id);

		// Generate new ID if conflicts
		const exists = await this.playlistStore.exists(playlistData.id);
		if (exists) {
			playlistData.id = this.generatePlaylistId(playlistData.name);
		}

		await this.playlistStore.savePlaylist(playlistData);

		logger.info('Playlist imported', playlistData.id);
		logger.methodExit('PlaylistManager', 'importPlaylist');

		return playlistData;
	}
}
