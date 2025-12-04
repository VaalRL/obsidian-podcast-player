/**
 * QueueStore - Manages queue persistence
 *
 * Stores queues in separate JSON files in the queues/ directory.
 * Each queue is stored as queues/[queue-id].json
 */

import { Vault } from 'obsidian';
import { logger } from '../utils/Logger';
import { StorageError } from '../utils/errorUtils';
import { Queue } from '../model';
import { DataPathManager } from '../storage/DataPathManager';
import { MultiFileStore } from '../storage/FileSystemStore';

/**
 * Queue Store
 */
export class QueueStore extends MultiFileStore<Queue[], Queue> {
	constructor(vault: Vault, pathManager: DataPathManager) {
		const dirPath = pathManager.getStructure().queues;
		super(vault, pathManager, dirPath);
	}

	/**
	 * Load a single queue item and ensure dates are Date objects
	 */
	protected async loadItem(id: string, fallback: Queue): Promise<Queue> {
		const queue = await super.loadItem(id, fallback);

		if (queue) {
			// Convert date strings to Date objects if needed
			if (typeof queue.createdAt === 'string') {
				queue.createdAt = new Date(queue.createdAt);
			}
			if (typeof queue.updatedAt === 'string') {
				queue.updatedAt = new Date(queue.updatedAt);
			}
		}

		return queue;
	}

	/**
	 * Validate queue data
	 */
	protected validate(data: Queue[]): boolean {
		if (!Array.isArray(data)) {
			logger.warn('Invalid queue data: not an array');
			return false;
		}

		for (const queue of data) {
			if (!this.validateQueue(queue)) {
				logger.warn('Invalid queue', queue);
				return false;
			}
		}

		return true;
	}

	/**
	 * Validate a single queue
	 */
	private validateQueue(queue: Queue): boolean {
		if (!queue || typeof queue !== 'object') {
			return false;
		}

		const requiredFields = [
			'id',
			'name',
			'episodeIds',
			'currentIndex',
			'autoPlayNext',
			'shuffle',
			'repeat',
			'createdAt',
			'updatedAt',
		];

		for (const field of requiredFields) {
			if (!(field in queue)) {
				logger.warn(`Missing required field in queue: ${field}`);
				return false;
			}
		}

		if (!Array.isArray(queue.episodeIds)) {
			logger.warn('Queue episodeIds is not an array');
			return false;
		}

		if (typeof queue.currentIndex !== 'number') {
			logger.warn('Queue currentIndex is not a number');
			return false;
		}

		if (typeof queue.autoPlayNext !== 'boolean') {
			logger.warn('Queue autoPlayNext is not a boolean');
			return false;
		}

		if (typeof queue.shuffle !== 'boolean') {
			logger.warn('Queue shuffle is not a boolean');
			return false;
		}

		if (!['none', 'one', 'all'].includes(queue.repeat)) {
			logger.warn('Queue repeat has invalid value');
			return false;
		}

		return true;
	}

	/**
	 * Get default value
	 */
	protected getDefaultValue(): Queue[] {
		return [];
	}

	/**
	 * Load all queues
	 */
	protected async loadAllItems(): Promise<Queue[]> {
		const ids = await this.listItemIds();
		const queues: Queue[] = [];

		for (const id of ids) {
			try {
				const queue = await this.loadItem(id, null as any);
				if (queue && this.validateQueue(queue)) {
					queues.push(queue);
				}
			} catch (error) {
				logger.warn(`Failed to load queue: ${id}`, error);
			}
		}

		return queues;
	}

	/**
	 * Load all queues
	 */
	async load(): Promise<Queue[]> {
		logger.methodEntry('QueueStore', 'load');
		const queues = await this.loadAllItems();
		logger.methodExit('QueueStore', 'load');
		return queues;
	}

	/**
	 * Save all queues (not typically used, use saveQueue instead)
	 */
	async save(data: Queue[]): Promise<void> {
		logger.methodEntry('QueueStore', 'save');

		if (!this.validate(data)) {
			throw new StorageError('Invalid queue data', this.dirPath);
		}

		// Clear existing queues
		await this.clear();

		// Save each queue
		for (const queue of data) {
			await this.saveItem(queue.id, queue);
		}

		logger.methodExit('QueueStore', 'save');
	}

	/**
	 * Get a queue by ID
	 */
	async getQueue(id: string): Promise<Queue | null> {
		logger.methodEntry('QueueStore', 'getQueue', id);

		try {
			const queue = await this.loadItem(id, null as any);

			if (!queue || !this.validateQueue(queue)) {
				logger.methodExit('QueueStore', 'getQueue', 'invalid');
				return null;
			}

			logger.methodExit('QueueStore', 'getQueue');
			return queue;
		} catch (error) {
			logger.warn('Failed to get queue', error);
			logger.methodExit('QueueStore', 'getQueue', 'error');
			return null;
		}
	}

	/**
	 * Save a queue
	 */
	async saveQueue(queue: Queue): Promise<void> {
		logger.methodEntry('QueueStore', 'saveQueue', queue.id);

		if (!this.validateQueue(queue)) {
			throw new StorageError('Invalid queue data', `${this.dirPath}/${queue.id}.json`);
		}

		await this.saveItem(queue.id, queue);

		logger.methodExit('QueueStore', 'saveQueue');
	}

	/**
	 * Delete a queue
	 */
	async deleteQueue(id: string): Promise<void> {
		logger.methodEntry('QueueStore', 'deleteQueue', id);

		await this.deleteItem(id);

		logger.methodExit('QueueStore', 'deleteQueue');
	}

	/**
	 * Check if a queue exists
	 */
	async exists(id: string): Promise<boolean> {
		const queue = await this.getQueue(id);
		return queue !== null;
	}

	/**
	 * Get all queue IDs
	 */
	async getAllIds(): Promise<string[]> {
		return await this.listItemIds();
	}

	/**
	 * Get queue count
	 */
	async getCount(): Promise<number> {
		const ids = await this.listItemIds();
		return ids.length;
	}

	/**
	 * Clear all queues
	 */
	async clear(): Promise<void> {
		logger.methodEntry('QueueStore', 'clear');

		const ids = await this.listItemIds();

		for (const id of ids) {
			await this.deleteItem(id);
		}

		logger.info('All queues cleared');
		logger.methodExit('QueueStore', 'clear');
	}
}
