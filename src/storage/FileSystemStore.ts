/**
 * FileSystemStore - Base class for file-based storage
 *
 * Provides common functionality for storing data in JSON files.
 * Other store classes extend this base class.
 */

import { Vault, normalizePath } from 'obsidian';
import { logger } from '../utils/Logger';
import { StorageError, safeJsonParse } from '../utils/errorUtils';
import { DataPathManager } from './DataPathManager';

/**
 * Storage format type
 */
export type StorageFormat = 'json' | 'yaml' | 'markdown';

/**
 * Base class for file system storage
 */
export abstract class FileSystemStore<T> {
	protected vault: Vault;
	protected pathManager: DataPathManager;
	protected format: StorageFormat;

	constructor(
		vault: Vault,
		pathManager: DataPathManager,
		format: StorageFormat = 'json'
	) {
		this.vault = vault;
		this.pathManager = pathManager;
		this.format = format;
	}

	/**
	 * Read a JSON file and parse its contents
	 */
	protected async readJson<TData>(path: string, fallback: TData): Promise<TData> {
		try {
			const adapter = this.vault.adapter;

			if (!(await adapter.exists(path))) {
				logger.debug('File does not exist, returning fallback', path);
				return fallback;
			}

			const content = await adapter.read(path);
			const data = safeJsonParse<TData>(content, fallback);

			logger.debug('Read JSON file', path);
			return data;
		} catch (error) {
			logger.error('Failed to read JSON file', error);
			throw new StorageError(`Failed to read file ${path}`, path);
		}
	}

	/**
	 * Write data to a JSON file
	 */
	protected async writeJson<TData>(path: string, data: TData, createBackup = false): Promise<void> {
		try {
			const adapter = this.vault.adapter;

			// Create backup if file exists
			if (createBackup && (await adapter.exists(path))) {
				try {
					await this.pathManager.createBackup(path);
				} catch (error) {
					logger.warn('Failed to create backup, continuing', error);
				}
			}

			// Write new content
			const content = JSON.stringify(data, null, 2);
			await adapter.write(path, content);

			logger.debug('Wrote JSON file', path);
		} catch (error) {
			logger.error('Failed to write JSON file', error);
			throw new StorageError(`Failed to write file ${path}`, path);
		}
	}

	/**
	 * Delete a file
	 */
	protected async deleteFile(path: string): Promise<void> {
		try {
			await this.vault.adapter.remove(path);
			logger.debug('Deleted file', path);
		} catch (error) {
			logger.error('Failed to delete file', error);
			throw new StorageError(`Failed to delete file ${path}`, path);
		}
	}

	/**
	 * Check if a file exists
	 */
	protected async fileExists(path: string): Promise<boolean> {
		try {
			return await this.vault.adapter.exists(path);
		} catch (error) {
			logger.error('Failed to check file existence', error);
			return false;
		}
	}

	/**
	 * List all files in a directory
	 */
	protected async listFiles(dirPath: string): Promise<string[]> {
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
	 * Validate data before saving (to be implemented by subclasses)
	 */
	protected abstract validate(data: T): boolean;

	/**
	 * Get the default value for this store (to be implemented by subclasses)
	 */
	protected abstract getDefaultValue(): T;

	/**
	 * Load data from storage
	 */
	abstract load(): Promise<T>;

	/**
	 * Save data to storage
	 */
	abstract save(data: T): Promise<void>;

	/**
	 * Clear all data
	 */
	abstract clear(): Promise<void>;
}

/**
 * Single-file store - Stores all data in a single JSON file
 */
export abstract class SingleFileStore<T> extends FileSystemStore<T> {
	protected filePath: string;

	constructor(
		vault: Vault,
		pathManager: DataPathManager,
		filePath: string,
		format: StorageFormat = 'json'
	) {
		super(vault, pathManager, format);
		this.filePath = normalizePath(filePath);
	}

	/**
	 * Load data from the file
	 */
	async load(): Promise<T> {
		logger.methodEntry('SingleFileStore', 'load', this.filePath);

		const data = await this.readJson<T>(this.filePath, this.getDefaultValue());

		if (!this.validate(data)) {
			logger.warn('Data validation failed, using default value', this.filePath);
			return this.getDefaultValue();
		}

		logger.methodExit('SingleFileStore', 'load');
		return data;
	}

	/**
	 * Save data to the file
	 */
	async save(data: T): Promise<void> {
		logger.methodEntry('SingleFileStore', 'save', this.filePath);

		if (!this.validate(data)) {
			throw new StorageError('Data validation failed', this.filePath);
		}

		await this.writeJson(this.filePath, data);
		logger.methodExit('SingleFileStore', 'save');
	}

	/**
	 * Clear all data (reset to default)
	 */
	async clear(): Promise<void> {
		logger.methodEntry('SingleFileStore', 'clear', this.filePath);

		const defaultValue = this.getDefaultValue();
		await this.save(defaultValue);

		logger.methodExit('SingleFileStore', 'clear');
	}

	/**
	 * Delete the file
	 */
	async delete(): Promise<void> {
		if (await this.fileExists(this.filePath)) {
			await this.deleteFile(this.filePath);
		}
	}
}

/**
 * Multi-file store - Stores data across multiple JSON files in a directory
 */
export abstract class MultiFileStore<T, TItem> extends FileSystemStore<T> {
	protected dirPath: string;

	constructor(
		vault: Vault,
		pathManager: DataPathManager,
		dirPath: string,
		format: StorageFormat = 'json'
	) {
		super(vault, pathManager, format);
		this.dirPath = normalizePath(dirPath);
	}

	/**
	 * Get file path for an item by ID
	 */
	protected getItemFilePath(id: string): string {
		return normalizePath(`${this.dirPath}/${id}.json`);
	}

	/**
	 * Load a single item by ID
	 */
	protected async loadItem(id: string, fallback: TItem): Promise<TItem> {
		const filePath = this.getItemFilePath(id);
		return await this.readJson<TItem>(filePath, fallback);
	}

	/**
	 * Save a single item by ID
	 */
	protected async saveItem(id: string, item: TItem): Promise<void> {
		const filePath = this.getItemFilePath(id);
		await this.writeJson(filePath, item);
	}

	/**
	 * Delete a single item by ID
	 */
	protected async deleteItem(id: string): Promise<void> {
		const filePath = this.getItemFilePath(id);
		if (await this.fileExists(filePath)) {
			await this.deleteFile(filePath);
		}
	}

	/**
	 * List all item IDs
	 */
	protected async listItemIds(): Promise<string[]> {
		const files = await this.listFiles(this.dirPath);
		return files
			.filter(f => f.endsWith('.json'))
			.map(f => {
				const filename = f.split('/').pop() || '';
				return filename.replace('.json', '');
			});
	}

	/**
	 * Load all items
	 */
	protected abstract loadAllItems(): Promise<TItem[]>;

	/**
	 * Clear all data (delete all files)
	 */
	async clear(): Promise<void> {
		logger.methodEntry('MultiFileStore', 'clear', this.dirPath);

		const files = await this.listFiles(this.dirPath);
		for (const file of files) {
			await this.deleteFile(file);
		}

		logger.methodExit('MultiFileStore', 'clear');
	}
}
