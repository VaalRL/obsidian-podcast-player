/**
 * Data Path Manager
 *
 * Manages file system paths for the Podcast Player plugin.
 * Handles creation and validation of data directories.
 */

import { Vault, normalizePath } from 'obsidian';
import { logger } from '../utils/Logger';
import { StorageError } from '../utils/errorUtils';

/**
 * Data folder structure
 */
export interface DataFolderStructure {
	root: string;
	subscriptions: string;
	progress: string;
	playlists: string;
	queues: string;
	cache: string;
	cacheFeed: string;
	cacheImages: string;
	backups: string;
}

/**
 * DataPathManager - Manages data folder paths and ensures directory structure exists
 */
export class DataPathManager {
	private vault: Vault;
	private basePath: string;
	private structure: DataFolderStructure;

	constructor(vault: Vault, basePath: string) {
		this.vault = vault;
		this.basePath = normalizePath(basePath);
		this.structure = this.buildStructure();
	}

	/**
	 * Build the folder structure based on base path
	 */
	private buildStructure(): DataFolderStructure {
		return {
			root: this.basePath,
			subscriptions: normalizePath(`${this.basePath}/subscriptions`),
			progress: normalizePath(`${this.basePath}/progress`),
			playlists: normalizePath(`${this.basePath}/playlists`),
			queues: normalizePath(`${this.basePath}/queues`),
			cache: normalizePath(`${this.basePath}/cache`),
			cacheFeed: normalizePath(`${this.basePath}/cache/feeds`),
			cacheImages: normalizePath(`${this.basePath}/cache/images`),
			backups: normalizePath(`${this.basePath}/backups`),
		};
	}

	/**
	 * Get the complete folder structure
	 */
	getStructure(): DataFolderStructure {
		return { ...this.structure };
	}

	/**
	 * Get the base path
	 */
	getBasePath(): string {
		return this.basePath;
	}

	/**
	 * Update the base path and rebuild structure
	 */
	updateBasePath(newPath: string): void {
		this.basePath = normalizePath(newPath);
		this.structure = this.buildStructure();
	}

	/**
	 * Ensure all required directories exist
	 * Creates directories if they don't exist
	 */
	async ensureDirectories(): Promise<void> {
		logger.info('Ensuring data directories exist', this.basePath);

		try {
			// Check if base path exists
			const adapter = this.vault.adapter;

			// Create base directory if it doesn't exist
			if (!(await adapter.exists(this.basePath))) {
				logger.info('Creating base directory', this.basePath);
				await adapter.mkdir(this.basePath);
			}

			// Create subdirectories
			const directories = [
				this.structure.subscriptions,
				this.structure.progress,
				this.structure.playlists,
				this.structure.queues,
				this.structure.cache,
				this.structure.cacheFeed,
				this.structure.cacheImages,
				this.structure.backups,
			];

			for (const dir of directories) {
				if (!(await adapter.exists(dir))) {
					logger.debug('Creating directory', dir);
					await adapter.mkdir(dir);
				}
			}

			logger.info('Data directories ready');
		} catch (error) {
			logger.error('Failed to create data directories', error);
			throw new StorageError('Failed to create data directories', this.basePath);
		}
	}

	/**
	 * Get the full path for a file in a specific subdirectory
	 */
	getFilePath(subdirectory: keyof DataFolderStructure, filename: string): string {
		const base = this.structure[subdirectory];
		return normalizePath(`${base}/${filename}`);
	}

	/**
	 * Check if a directory exists
	 */
	async directoryExists(path: string): Promise<boolean> {
		try {
			return await this.vault.adapter.exists(path);
		} catch (error) {
			logger.error('Failed to check directory existence', error);
			return false;
		}
	}

	/**
	 * Check if a file exists
	 */
	async fileExists(path: string): Promise<boolean> {
		try {
			return await this.vault.adapter.exists(path);
		} catch (error) {
			logger.error('Failed to check file existence', error);
			return false;
		}
	}

	/**
	 * List files in a directory
	 */
	async listFiles(subdirectory: keyof DataFolderStructure): Promise<string[]> {
		const dirPath = this.structure[subdirectory];

		try {
			const adapter = this.vault.adapter;
			if (!(await adapter.exists(dirPath))) {
				return [];
			}

			const list = await adapter.list(dirPath);
			return list.files;
		} catch (error) {
			logger.error('Failed to list files', error);
			throw new StorageError(`Failed to list files in ${dirPath}`, dirPath);
		}
	}

	/**
	 * Delete a file
	 */
	async deleteFile(path: string): Promise<void> {
		try {
			await this.vault.adapter.remove(path);
			logger.debug('Deleted file', path);
		} catch (error) {
			logger.error('Failed to delete file', error);
			throw new StorageError(`Failed to delete file ${path}`, path);
		}
	}

	/**
	 * Create a backup of a file
	 */
	async createBackup(sourcePath: string, backupName?: string): Promise<string> {
		try {
			const content = await this.vault.adapter.read(sourcePath);
			const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
			const filename = backupName || `backup-${timestamp}.json`;
			const backupPath = this.getFilePath('backups', filename);

			await this.vault.adapter.write(backupPath, content);
			logger.info('Created backup', backupPath);

			return backupPath;
		} catch (error) {
			logger.error('Failed to create backup', error);
			throw new StorageError(`Failed to create backup of ${sourcePath}`, sourcePath);
		}
	}

	/**
	 * Clean up old backups (keep only the most recent N backups)
	 */
	async cleanupOldBackups(keepCount = 5): Promise<void> {
		try {
			const backupFiles = await this.listFiles('backups');

			if (backupFiles.length <= keepCount) {
				return; // Nothing to clean up
			}

			// Sort by modification time (newest first)
			const filesWithStats = await Promise.all(
				backupFiles.map(async (file) => {
					const stat = await this.vault.adapter.stat(file);
					return { file, mtime: stat?.mtime || 0 };
				})
			);

			filesWithStats.sort((a, b) => b.mtime - a.mtime);

			// Delete old backups
			const filesToDelete = filesWithStats.slice(keepCount);
			for (const { file } of filesToDelete) {
				await this.deleteFile(file);
				logger.debug('Deleted old backup', file);
			}

			logger.info(`Cleaned up ${filesToDelete.length} old backups`);
		} catch (error) {
			logger.error('Failed to cleanup old backups', error);
		}
	}

	/**
	 * Get the size of a directory in bytes
	 */
	async getDirectorySize(subdirectory: keyof DataFolderStructure): Promise<number> {
		try {
			const files = await this.listFiles(subdirectory);
			let totalSize = 0;

			for (const file of files) {
				const stat = await this.vault.adapter.stat(file);
				totalSize += stat?.size || 0;
			}

			return totalSize;
		} catch (error) {
			logger.error('Failed to get directory size', error);
			return 0;
		}
	}
}
