/**
 * QueueManager - Manages playback queues
 *
 * Provides high-level queue management functionality including
 * queue control, episode ordering, and playback state management.
 */

import { App } from 'obsidian';
import { logger } from '../utils/Logger';
import { Queue } from '../model';
import { QueueStore } from './QueueStore';

/**
 * Queue Manager
 */
export class QueueManager {
	private queueStore: QueueStore;
	private currentQueueId: string | null = null;
	private app?: App;

	constructor(queueStore: QueueStore, app?: App) {
		this.queueStore = queueStore;
		this.app = app;
	}

	/**
	 * Create a new queue
	 */
	async createQueue(name: string): Promise<Queue> {
		logger.methodEntry('QueueManager', 'createQueue', name);

		const id = this.generateQueueId(name);
		const now = new Date();

		const queue: Queue = {
			id,
			name,
			episodeIds: [],
			currentIndex: 0,
			autoPlayNext: true,
			shuffle: false,
			repeat: 'none',
			createdAt: now,
			updatedAt: now,
		};

		await this.queueStore.saveQueue(queue);

		logger.info('Queue created', id);
		logger.methodExit('QueueManager', 'createQueue');

		return queue;
	}

	/**
	 * Get a queue by ID
	 */
	async getQueue(id: string): Promise<Queue | null> {
		logger.methodEntry('QueueManager', 'getQueue', id);

		const queue = await this.queueStore.getQueue(id);

		logger.methodExit('QueueManager', 'getQueue');
		return queue;
	}

	/**
	 * Get all queues
	 */
	async getAllQueues(): Promise<Queue[]> {
		logger.methodEntry('QueueManager', 'getAllQueues');

		const queues = await this.queueStore.load();

		// Sort by updated date (most recent first)
		queues.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

		logger.methodExit('QueueManager', 'getAllQueues');
		return queues;
	}

	/**
	 * Update queue metadata
	 */
	async updateQueue(id: string, updates: Partial<Omit<Queue, 'id' | 'createdAt'>>): Promise<void> {
		logger.methodEntry('QueueManager', 'updateQueue', id);

		const queue = await this.queueStore.getQueue(id);

		if (!queue) {
			throw new Error(`Queue not found: ${id}`);
		}

		const updatedQueue: Queue = {
			...queue,
			...updates,
			id: queue.id, // Preserve ID
			createdAt: queue.createdAt, // Preserve creation date
			updatedAt: new Date(),
		};

		await this.queueStore.saveQueue(updatedQueue);

		if (this.app) {
			this.app.workspace.trigger('podcast:queue-updated', id);
		}

		logger.methodExit('QueueManager', 'updateQueue');
	}

	/**
	 * Delete a queue
	 */
	async deleteQueue(id: string): Promise<void> {
		logger.methodEntry('QueueManager', 'deleteQueue', id);

		await this.queueStore.deleteQueue(id);

		// Clear current queue if deleted
		if (this.currentQueueId === id) {
			this.currentQueueId = null;
		}

		logger.info('Queue deleted', id);
		logger.methodExit('QueueManager', 'deleteQueue');
	}

	/**
	 * Set current queue
	 */
	setCurrentQueue(queueId: string): void {
		logger.methodEntry('QueueManager', 'setCurrentQueue', queueId);
		this.currentQueueId = queueId;
		logger.methodExit('QueueManager', 'setCurrentQueue');
	}

	/**
	 * Get current queue
	 */
	async getCurrentQueue(): Promise<Queue | null> {
		if (!this.currentQueueId) {
			return null;
		}

		return await this.getQueue(this.currentQueueId);
	}

	/**
	 * Add an episode to a queue
	 */
	async addEpisode(queueId: string, episodeId: string): Promise<void> {
		logger.methodEntry('QueueManager', 'addEpisode', `${queueId}, ${episodeId}`);

		const queue = await this.queueStore.getQueue(queueId);

		if (!queue) {
			throw new Error(`Queue not found: ${queueId}`);
		}

		queue.episodeIds.push(episodeId);
		queue.updatedAt = new Date();

		await this.queueStore.saveQueue(queue);

		logger.info('Episode added to queue', episodeId);

		if (this.app) {
			this.app.workspace.trigger('podcast:queue-updated', queueId);
		}

		logger.methodExit('QueueManager', 'addEpisode');
	}

	/**
	 * Add multiple episodes to a queue
	 */
	async addEpisodes(queueId: string, episodeIds: string[]): Promise<void> {
		logger.methodEntry('QueueManager', 'addEpisodes', `${queueId}, count=${episodeIds.length}`);

		const queue = await this.queueStore.getQueue(queueId);

		if (!queue) {
			throw new Error(`Queue not found: ${queueId}`);
		}

		queue.episodeIds.push(...episodeIds);
		queue.updatedAt = new Date();

		await this.queueStore.saveQueue(queue);

		logger.info(`Added ${episodeIds.length} episodes to queue`);

		if (this.app) {
			this.app.workspace.trigger('podcast:queue-updated', queueId);
		}

		logger.methodExit('QueueManager', 'addEpisodes');
	}

	/**
	 * Insert episode at specific position
	 */
	async insertEpisode(queueId: string, episodeId: string, index: number): Promise<void> {
		logger.methodEntry('QueueManager', 'insertEpisode', `${queueId}, ${episodeId}, index=${index}`);

		const queue = await this.queueStore.getQueue(queueId);

		if (!queue) {
			throw new Error(`Queue not found: ${queueId}`);
		}

		const clampedIndex = Math.max(0, Math.min(index, queue.episodeIds.length));
		queue.episodeIds.splice(clampedIndex, 0, episodeId);
		queue.updatedAt = new Date();

		await this.queueStore.saveQueue(queue);

		logger.info('Episode inserted into queue', episodeId);

		if (this.app) {
			this.app.workspace.trigger('podcast:queue-updated', queueId);
		}

		logger.methodExit('QueueManager', 'insertEpisode');
	}

	/**
	 * Remove an episode from a queue
	 */
	async removeEpisode(queueId: string, episodeId: string): Promise<void> {
		logger.methodEntry('QueueManager', 'removeEpisode', `${queueId}, ${episodeId}`);

		const queue = await this.queueStore.getQueue(queueId);

		if (!queue) {
			throw new Error(`Queue not found: ${queueId}`);
		}

		const index = queue.episodeIds.indexOf(episodeId);

		if (index === -1) {
			logger.warn('Episode not found in queue', episodeId);
			return;
		}

		queue.episodeIds.splice(index, 1);

		// Adjust current index if needed
		if (index < queue.currentIndex) {
			queue.currentIndex = Math.max(0, queue.currentIndex - 1);
		} else if (index === queue.currentIndex) {
			// If removing current episode, keep index but it now points to next episode
			queue.currentIndex = Math.min(queue.currentIndex, queue.episodeIds.length - 1);
		}

		queue.updatedAt = new Date();

		await this.queueStore.saveQueue(queue);

		logger.info('Episode removed from queue', episodeId);

		if (this.app) {
			this.app.workspace.trigger('podcast:queue-updated', queueId);
		}

		logger.methodExit('QueueManager', 'removeEpisode');
	}

	/**
	 * Clear all episodes from a queue
	 */
	async clearQueue(queueId: string): Promise<void> {
		logger.methodEntry('QueueManager', 'clearQueue', queueId);

		const queue = await this.queueStore.getQueue(queueId);

		if (!queue) {
			throw new Error(`Queue not found: ${queueId}`);
		}

		queue.episodeIds = [];
		queue.currentIndex = 0;
		queue.updatedAt = new Date();

		await this.queueStore.saveQueue(queue);

		logger.info('Queue cleared');

		if (this.app) {
			this.app.workspace.trigger('podcast:queue-updated', queueId);
		}

		logger.methodExit('QueueManager', 'clearQueue');
	}

	/**
	 * Get current episode ID
	 */
	async getCurrentEpisodeId(queueId: string): Promise<string | null> {
		const queue = await this.queueStore.getQueue(queueId);

		if (!queue || queue.episodeIds.length === 0) {
			return null;
		}

		if (queue.currentIndex < 0 || queue.currentIndex >= queue.episodeIds.length) {
			return null;
		}

		return queue.episodeIds[queue.currentIndex];
	}

	/**
	 * Move to next episode
	 */
	async next(queueId: string): Promise<string | null> {
		logger.methodEntry('QueueManager', 'next', queueId);

		const queue = await this.queueStore.getQueue(queueId);

		if (!queue || queue.episodeIds.length === 0) {
			logger.methodExit('QueueManager', 'next', 'no queue or empty');
			return null;
		}

		// Handle repeat one
		if (queue.repeat === 'one') {
			logger.methodExit('QueueManager', 'next', 'repeat one');
			return queue.episodeIds[queue.currentIndex];
		}

		// Move to next
		queue.currentIndex++;

		// Handle end of queue
		if (queue.currentIndex >= queue.episodeIds.length) {
			if (queue.repeat === 'all') {
				queue.currentIndex = 0;
			} else {
				queue.currentIndex = queue.episodeIds.length - 1;
				await this.queueStore.saveQueue(queue);
				logger.methodExit('QueueManager', 'next', 'end of queue');
				return null;
			}
		}

		queue.updatedAt = new Date();
		await this.queueStore.saveQueue(queue);

		const nextEpisodeId = queue.episodeIds[queue.currentIndex];

		logger.info('Moved to next episode', nextEpisodeId);
		logger.methodExit('QueueManager', 'next');

		return nextEpisodeId;
	}

	/**
	 * Move to next episode and remove the current (played) episode from queue
	 * This is the queue-style behavior where episodes are consumed as they play
	 */
	async nextAndRemovePlayed(queueId: string): Promise<string | null> {
		logger.methodEntry('QueueManager', 'nextAndRemovePlayed', queueId);

		const queue = await this.queueStore.getQueue(queueId);

		if (!queue || queue.episodeIds.length === 0) {
			logger.methodExit('QueueManager', 'nextAndRemovePlayed', 'no queue or empty');
			return null;
		}

		// Handle repeat one - don't remove, just return current
		if (queue.repeat === 'one') {
			logger.methodExit('QueueManager', 'nextAndRemovePlayed', 'repeat one');
			return queue.episodeIds[queue.currentIndex];
		}

		// If it's a playlist, don't remove the episode, just advance index
		if (queue.isPlaylist) {
			// Advance index
			queue.currentIndex++;

			// Handle end of playlist
			if (queue.currentIndex >= queue.episodeIds.length) {
				if (queue.repeat === 'all') {
					queue.currentIndex = 0;
				} else {
					// End of playlist
					queue.currentIndex = 0;
					queue.updatedAt = new Date();
					await this.queueStore.saveQueue(queue);
					logger.methodExit('QueueManager', 'nextAndRemovePlayed', 'end of playlist');
					return null;
				}
			}

			queue.updatedAt = new Date();
			await this.queueStore.saveQueue(queue);
			return queue.episodeIds[queue.currentIndex];
		}

		// Remove the current (just played) episode
		const playedEpisodeId = queue.episodeIds[queue.currentIndex];
		queue.episodeIds.splice(queue.currentIndex, 1);

		// If queue is now empty, save and return null
		if (queue.episodeIds.length === 0) {
			queue.currentIndex = 0;
			queue.updatedAt = new Date();
			await this.queueStore.saveQueue(queue);
			logger.info('Queue is now empty after removing played episode', playedEpisodeId);
			logger.methodExit('QueueManager', 'nextAndRemovePlayed', 'queue empty');
			return null;
		}

		// Adjust currentIndex if needed (since we removed an element)
		if (queue.currentIndex >= queue.episodeIds.length) {
			if (queue.repeat === 'all') {
				queue.currentIndex = 0;
			} else {
				// No more episodes to play
				queue.currentIndex = 0;
				queue.updatedAt = new Date();
				await this.queueStore.saveQueue(queue);
				logger.info('End of queue, removed played episode', playedEpisodeId);
				logger.methodExit('QueueManager', 'nextAndRemovePlayed', 'end of queue');
				return null;
			}
		}

		queue.updatedAt = new Date();
		await this.queueStore.saveQueue(queue);

		const nextEpisodeId = queue.episodeIds[queue.currentIndex];

		logger.info('Moved to next episode and removed played', { played: playedEpisodeId, next: nextEpisodeId });
		logger.methodExit('QueueManager', 'nextAndRemovePlayed');

		return nextEpisodeId;
	}
	/**
	 * Move to previous episode
	 */
	async previous(queueId: string): Promise<string | null> {
		logger.methodEntry('QueueManager', 'previous', queueId);

		const queue = await this.queueStore.getQueue(queueId);

		if (!queue || queue.episodeIds.length === 0) {
			logger.methodExit('QueueManager', 'previous', 'no queue or empty');
			return null;
		}

		// Handle repeat one
		if (queue.repeat === 'one') {
			logger.methodExit('QueueManager', 'previous', 'repeat one');
			return queue.episodeIds[queue.currentIndex];
		}

		// Move to previous
		queue.currentIndex--;

		// Handle start of queue
		if (queue.currentIndex < 0) {
			if (queue.repeat === 'all') {
				queue.currentIndex = queue.episodeIds.length - 1;
			} else {
				queue.currentIndex = 0;
			}
		}

		queue.updatedAt = new Date();
		await this.queueStore.saveQueue(queue);

		const prevEpisodeId = queue.episodeIds[queue.currentIndex];

		logger.info('Moved to previous episode', prevEpisodeId);
		logger.methodExit('QueueManager', 'previous');

		return prevEpisodeId;
	}

	/**
	 * Jump to specific episode index
	 */
	async jumpTo(queueId: string, index: number): Promise<string | null> {
		logger.methodEntry('QueueManager', 'jumpTo', `${queueId}, index=${index}`);

		const queue = await this.queueStore.getQueue(queueId);

		if (!queue || queue.episodeIds.length === 0) {
			logger.methodExit('QueueManager', 'jumpTo', 'no queue or empty');
			return null;
		}

		if (index < 0 || index >= queue.episodeIds.length) {
			logger.warn('Invalid index', index);
			logger.methodExit('QueueManager', 'jumpTo', 'invalid index');
			return null;
		}

		queue.currentIndex = index;
		queue.updatedAt = new Date();

		await this.queueStore.saveQueue(queue);

		const episodeId = queue.episodeIds[queue.currentIndex];

		logger.info('Jumped to episode', episodeId);

		if (this.app) {
			this.app.workspace.trigger('podcast:queue-updated', queueId);
		}

		logger.methodExit('QueueManager', 'jumpTo');

		return episodeId;
	}

	/**
	 * Move an episode from one position to another
	 */
	async moveEpisode(queueId: string, fromIndex: number, toIndex: number): Promise<void> {
		logger.methodEntry('QueueManager', 'moveEpisode', `${queueId}, ${fromIndex} -> ${toIndex}`);

		const queue = await this.queueStore.getQueue(queueId);

		if (!queue) {
			throw new Error(`Queue not found: ${queueId}`);
		}

		if (fromIndex < 0 || fromIndex >= queue.episodeIds.length || toIndex < 0 || toIndex >= queue.episodeIds.length) {
			logger.warn('Invalid index', fromIndex, toIndex);
			return;
		}

		const episodeId = queue.episodeIds[fromIndex];
		queue.episodeIds.splice(fromIndex, 1);
		queue.episodeIds.splice(toIndex, 0, episodeId);

		// Update current index if needed
		if (queue.currentIndex === fromIndex) {
			queue.currentIndex = toIndex;
		} else if (queue.currentIndex > fromIndex && queue.currentIndex <= toIndex) {
			queue.currentIndex--;
		} else if (queue.currentIndex < fromIndex && queue.currentIndex >= toIndex) {
			queue.currentIndex++;
		}

		queue.updatedAt = new Date();

		await this.queueStore.saveQueue(queue);

		logger.info('Episode moved', episodeId);

		if (this.app) {
			this.app.workspace.trigger('podcast:queue-updated', queueId);
		}

		logger.methodExit('QueueManager', 'moveEpisode');
	}

	/**
	 * Toggle shuffle
	 */
	async toggleShuffle(queueId: string): Promise<boolean> {
		logger.methodEntry('QueueManager', 'toggleShuffle', queueId);

		const queue = await this.queueStore.getQueue(queueId);

		if (!queue) {
			throw new Error(`Queue not found: ${queueId}`);
		}

		queue.shuffle = !queue.shuffle;
		queue.updatedAt = new Date();

		// If enabling shuffle, save current episode and reshuffle
		if (queue.shuffle && queue.episodeIds.length > 0) {
			const currentEpisodeId = queue.episodeIds[queue.currentIndex];
			this.shuffleArray(queue.episodeIds);
			// Find new index of current episode
			queue.currentIndex = queue.episodeIds.indexOf(currentEpisodeId);
		}

		await this.queueStore.saveQueue(queue);

		logger.info('Shuffle toggled', queue.shuffle);
		logger.methodExit('QueueManager', 'toggleShuffle');

		return queue.shuffle;
	}

	/**
	 * Set repeat mode
	 */
	async setRepeat(queueId: string, repeat: 'none' | 'one' | 'all'): Promise<void> {
		logger.methodEntry('QueueManager', 'setRepeat', `${queueId}, ${repeat}`);

		const queue = await this.queueStore.getQueue(queueId);

		if (!queue) {
			throw new Error(`Queue not found: ${queueId}`);
		}

		queue.repeat = repeat;
		queue.updatedAt = new Date();

		await this.queueStore.saveQueue(queue);

		logger.info('Repeat mode set', repeat);
		logger.methodExit('QueueManager', 'setRepeat');
	}

	/**
	 * Cycle repeat mode (none -> one -> all -> none)
	 */
	async cycleRepeat(queueId: string): Promise<'none' | 'one' | 'all'> {
		const queue = await this.queueStore.getQueue(queueId);

		if (!queue) {
			throw new Error(`Queue not found: ${queueId}`);
		}

		const nextRepeat = queue.repeat === 'none' ? 'one' : queue.repeat === 'one' ? 'all' : 'none';
		await this.setRepeat(queueId, nextRepeat);

		return nextRepeat;
	}

	/**
	 * Set auto play next
	 */
	async setAutoPlayNext(queueId: string, autoPlayNext: boolean): Promise<void> {
		logger.methodEntry('QueueManager', 'setAutoPlayNext', `${queueId}, ${autoPlayNext}`);

		const queue = await this.queueStore.getQueue(queueId);

		if (!queue) {
			throw new Error(`Queue not found: ${queueId}`);
		}

		queue.autoPlayNext = autoPlayNext;
		queue.updatedAt = new Date();

		await this.queueStore.saveQueue(queue);

		logger.info('Auto play next set', autoPlayNext);
		logger.methodExit('QueueManager', 'setAutoPlayNext');
	}

	/**
	 * Get episode count in queue
	 */
	async getEpisodeCount(queueId: string): Promise<number> {
		const queue = await this.queueStore.getQueue(queueId);

		if (!queue) {
			return 0;
		}

		return queue.episodeIds.length;
	}

	/**
	 * Check if queue has next episode
	 */
	async hasNext(queueId: string): Promise<boolean> {
		const queue = await this.queueStore.getQueue(queueId);

		if (!queue || queue.episodeIds.length === 0) {
			return false;
		}

		if (queue.repeat !== 'none') {
			return true;
		}

		return queue.currentIndex < queue.episodeIds.length - 1;
	}

	/**
	 * Check if queue has previous episode
	 */
	async hasPrevious(queueId: string): Promise<boolean> {
		const queue = await this.queueStore.getQueue(queueId);

		if (!queue || queue.episodeIds.length === 0) {
			return false;
		}

		if (queue.repeat === 'all') {
			return true;
		}

		return queue.currentIndex > 0;
	}

	/**
	 * Get queue count
	 */
	async getQueueCount(): Promise<number> {
		return await this.queueStore.getCount();
	}

	/**
	 * Generate a unique queue ID
	 */
	private generateQueueId(name: string): string {
		const timestamp = Date.now();
		const randomStr = Math.random().toString(36).substring(2, 8);
		return `queue-${timestamp}-${randomStr}`;
	}

	/**
	 * Shuffle array in place (Fisher-Yates algorithm)
	 */
	private shuffleArray<T>(array: T[]): void {
		for (let i = array.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[array[i], array[j]] = [array[j], array[i]];
		}
	}
}
