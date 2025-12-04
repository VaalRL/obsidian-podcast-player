/**
 * Unit tests for FeedSyncManager
 */

import { FeedSyncManager, BatchSyncResult, PodcastSyncResult } from '../FeedSyncManager';
import { FeedService } from '../FeedService';
import { SubscriptionStore } from '../../storage/SubscriptionStore';
import { Podcast, Episode } from '../../model';

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

describe('FeedSyncManager', () => {
	let manager: FeedSyncManager;
	let mockFeedService: jest.Mocked<FeedService>;
	let mockSubscriptionStore: jest.Mocked<SubscriptionStore>;

	let mockQueueManager: any;
	let mockPlaylistManager: any;

	const samplePodcast: Podcast = {
		id: 'podcast-123',
		title: 'Test Podcast',
		feedUrl: 'https://example.com/feed.rss',
		description: 'Test description',
		author: 'Test Author',
		imageUrl: 'https://example.com/image.jpg',
		episodes: [
			{
				id: 'ep-1',
				title: 'Episode 1',
				description: 'Description 1',
				audioUrl: 'https://example.com/ep1.mp3',
				publishDate: new Date('2024-01-01'),
				duration: 1800,
				podcastId: 'podcast-123',
			},
		],
		lastFetchedAt: new Date('2024-01-01T10:00:00Z'),
		subscribedAt: new Date('2024-01-01'),
	};

	const newEpisode: Episode = {
		id: 'ep-new',
		title: 'New Episode',
		description: 'New Description',
		audioUrl: 'https://example.com/new.mp3',
		publishDate: new Date('2024-01-02'),
		duration: 2000,
		podcastId: 'podcast-123',
	};

	beforeEach(() => {
		jest.clearAllMocks();

		mockFeedService = {
			updateFeed: jest.fn(),
		} as any;

		mockSubscriptionStore = {
			getAllPodcasts: jest.fn(),
			getPodcast: jest.fn(),
			updatePodcast: jest.fn(),
		} as any;

		mockQueueManager = {
			getQueue: jest.fn(),
			addEpisodes: jest.fn(),
			insertEpisode: jest.fn(),
		};

		mockPlaylistManager = {
			getPlaylist: jest.fn(),
			addEpisodes: jest.fn(),
			updatePlaylist: jest.fn(),
		};

		manager = new FeedSyncManager(mockFeedService, mockSubscriptionStore, mockQueueManager, mockPlaylistManager, 3600000);
	});

	afterEach(() => {
		manager.stopAutoSync();
	});

	describe('constructor', () => {
		it('should create manager with services and default interval', () => {
			const freshManager = new FeedSyncManager(mockFeedService, mockSubscriptionStore, mockQueueManager, mockPlaylistManager);
			expect(freshManager).toBeInstanceOf(FeedSyncManager);
		});

		it('should create manager with custom interval', () => {
			const customInterval = 7200000; // 2 hours
			const freshManager = new FeedSyncManager(mockFeedService, mockSubscriptionStore, mockQueueManager, mockPlaylistManager, customInterval);
			expect(freshManager).toBeInstanceOf(FeedSyncManager);
		});
	});

	describe('startAutoSync', () => {
		it('should start automatic sync', async () => {
			mockSubscriptionStore.getAllPodcasts.mockResolvedValue([samplePodcast]);
			mockFeedService.updateFeed.mockResolvedValue({
				podcast: samplePodcast,
				episodes: samplePodcast.episodes || [],
				newEpisodes: [],
			});

			manager.startAutoSync();

			// Wait a bit for initial sync to start
			await new Promise(resolve => setTimeout(resolve, 100));

			const status = manager.getSyncStatus();
			expect(status.isAutoSyncEnabled).toBe(true);
		});

		it('should not start if already running', () => {
			manager.startAutoSync();
			manager.startAutoSync();

			// Should only create one timer
			const status = manager.getSyncStatus();
			expect(status.isAutoSyncEnabled).toBe(true);
		});
	});

	describe('stopAutoSync', () => {
		it('should stop automatic sync', () => {
			manager.startAutoSync();
			manager.stopAutoSync();

			const status = manager.getSyncStatus();
			expect(status.isAutoSyncEnabled).toBe(false);
		});

		it('should not throw if not running', () => {
			expect(() => manager.stopAutoSync()).not.toThrow();
		});
	});

	describe('syncAll', () => {
		it('should sync all podcasts', async () => {
			const podcast1 = { ...samplePodcast, id: 'p1' };
			const podcast2 = { ...samplePodcast, id: 'p2', lastFetchedAt: undefined };

			mockSubscriptionStore.getAllPodcasts.mockResolvedValue([podcast1, podcast2]);
			mockFeedService.updateFeed.mockResolvedValue({
				podcast: samplePodcast,
				episodes: samplePodcast.episodes || [],
				newEpisodes: [newEpisode],
			});

			const result = await manager.syncAll({ force: true });

			expect(result.totalPodcasts).toBe(2);
			expect(result.successCount).toBe(2);
			expect(result.failureCount).toBe(0);
			expect(result.totalNewEpisodes).toBe(2);
			expect(mockSubscriptionStore.updatePodcast).toHaveBeenCalledTimes(2);
		});

		it('should only sync podcasts that need updating', async () => {
			const oldPodcast = {
				...samplePodcast,
				id: 'old',
				lastFetchedAt: new Date(Date.now() - 7200000), // 2 hours ago
			};
			const recentPodcast = {
				...samplePodcast,
				id: 'recent',
				lastFetchedAt: new Date(Date.now() - 1800000), // 30 minutes ago
			};

			mockSubscriptionStore.getAllPodcasts.mockResolvedValue([oldPodcast, recentPodcast]);
			mockFeedService.updateFeed.mockResolvedValue({
				podcast: samplePodcast,
				episodes: samplePodcast.episodes || [],
				newEpisodes: [],
			});

			const result = await manager.syncAll({ force: false });

			// Only old podcast should be updated (updateInterval is 3600000 = 1 hour)
			expect(result.totalPodcasts).toBe(1);
			expect(mockSubscriptionStore.updatePodcast).toHaveBeenCalledTimes(1);
		});

		it('should throw error if sync already in progress', async () => {
			let resolveUpdate: any;
			mockSubscriptionStore.getAllPodcasts.mockResolvedValue([samplePodcast]);
			mockFeedService.updateFeed.mockImplementation(
				() =>
					new Promise(resolve => {
						resolveUpdate = () =>
							resolve({
								podcast: samplePodcast,
								episodes: samplePodcast.episodes || [],
								newEpisodes: [],
							});
					})
			);

			const promise1 = manager.syncAll();

			// Try to start another sync while first is in progress
			await expect(manager.syncAll()).rejects.toThrow('Sync already in progress');

			// Complete the first sync
			resolveUpdate();
			await promise1;
		});

		it('should handle update failures', async () => {
			const podcast1 = { ...samplePodcast, id: 'p1' };
			const podcast2 = { ...samplePodcast, id: 'p2' };

			mockSubscriptionStore.getAllPodcasts.mockResolvedValue([podcast1, podcast2]);
			mockFeedService.updateFeed
				.mockResolvedValueOnce({
					podcast: podcast1,
					episodes: [],
					newEpisodes: [],
				})
				.mockRejectedValueOnce(new Error('Network error'));

			const result = await manager.syncAll({ force: true });

			expect(result.totalPodcasts).toBe(2);
			expect(result.successCount).toBe(1);
			expect(result.failureCount).toBe(1);
			expect(result.results[1].error).toBe('Network error');
		});

		it('should process all podcasts with concurrency limit', async () => {
			const podcasts = [
				{ ...samplePodcast, id: 'p1' },
				{ ...samplePodcast, id: 'p2' },
				{ ...samplePodcast, id: 'p3' },
				{ ...samplePodcast, id: 'p4' },
			];

			mockSubscriptionStore.getAllPodcasts.mockResolvedValue(podcasts);
			mockFeedService.updateFeed.mockResolvedValue({
				podcast: samplePodcast,
				episodes: [],
				newEpisodes: [],
			});

			const result = await manager.syncAll({ force: true, concurrency: 2 });

			// All podcasts should be processed
			expect(result.totalPodcasts).toBe(4);
			expect(mockFeedService.updateFeed).toHaveBeenCalledTimes(4);
		});

		it('should merge new episodes with existing ones', async () => {
			mockSubscriptionStore.getAllPodcasts.mockResolvedValue([samplePodcast]);
			mockFeedService.updateFeed.mockResolvedValue({
				podcast: samplePodcast,
				episodes: [...(samplePodcast.episodes || []), newEpisode],
				newEpisodes: [newEpisode],
			});

			await manager.syncAll({ force: true });

			const updateCall = mockSubscriptionStore.updatePodcast.mock.calls[0][0];
			expect(updateCall.episodes).toHaveLength(2);
			expect(updateCall.episodes?.[0].id).toBe('ep-new'); // Newest first
		});

		it('should remove duplicate episodes', async () => {
			// Create a podcast with an existing episode
			const podcastWithEpisode = {
				...samplePodcast,
				episodes: [newEpisode], // Already has newEpisode
			};

			// Fetch returns the same episode again (duplicate)
			mockSubscriptionStore.getAllPodcasts.mockResolvedValue([podcastWithEpisode]);
			mockFeedService.updateFeed.mockResolvedValue({
				podcast: podcastWithEpisode,
				episodes: [newEpisode],
				newEpisodes: [newEpisode], // Same episode returned as "new"
			});

			await manager.syncAll({ force: true });

			const updateCall = mockSubscriptionStore.updatePodcast.mock.calls[0][0];
			expect(updateCall.episodes).toHaveLength(1); // Duplicate removed
			expect(updateCall.episodes?.[0].id).toBe('ep-new');
		});

		it('should update lastSyncTime', async () => {
			mockSubscriptionStore.getAllPodcasts.mockResolvedValue([]);

			await manager.syncAll();

			const status = manager.getSyncStatus();
			expect(status.lastSyncTime).not.toBeNull();
		});
	});

	describe('syncPodcasts', () => {
		it('should sync specific podcasts', async () => {
			const podcast1 = { ...samplePodcast, id: 'p1' };
			const podcast2 = { ...samplePodcast, id: 'p2' };

			mockSubscriptionStore.getPodcast
				.mockResolvedValueOnce(podcast1)
				.mockResolvedValueOnce(podcast2);
			mockFeedService.updateFeed.mockResolvedValue({
				podcast: samplePodcast,
				episodes: [],
				newEpisodes: [],
			});

			const result = await manager.syncPodcasts(['p1', 'p2']);

			expect(result.totalPodcasts).toBe(2);
			expect(result.successCount).toBe(2);
			expect(mockFeedService.updateFeed).toHaveBeenCalledTimes(2);
		});

		it('should skip non-existent podcasts', async () => {
			mockSubscriptionStore.getPodcast
				.mockResolvedValueOnce(samplePodcast)
				.mockResolvedValueOnce(null);
			mockFeedService.updateFeed.mockResolvedValue({
				podcast: samplePodcast,
				episodes: [],
				newEpisodes: [],
			});

			const result = await manager.syncPodcasts(['p1', 'p2']);

			expect(result.totalPodcasts).toBe(1);
			expect(mockFeedService.updateFeed).toHaveBeenCalledTimes(1);
		});

		it('should throw error if sync already in progress', async () => {
			let resolveUpdate: any;
			mockSubscriptionStore.getPodcast.mockResolvedValue(samplePodcast);
			mockFeedService.updateFeed.mockImplementation(
				() =>
					new Promise(resolve => {
						resolveUpdate = () =>
							resolve({
								podcast: samplePodcast,
								episodes: [],
								newEpisodes: [],
							});
					})
			);

			const promise1 = manager.syncPodcasts(['p1']);

			// Try to start another sync while first is in progress
			await expect(manager.syncPodcasts(['p2'])).rejects.toThrow('Sync already in progress');

			// Complete the first sync
			resolveUpdate();
			await promise1;
		});
	});

	describe('syncPodcast', () => {
		it('should sync single podcast', async () => {
			mockSubscriptionStore.getPodcast.mockResolvedValue(samplePodcast);
			mockFeedService.updateFeed.mockResolvedValue({
				podcast: samplePodcast,
				episodes: [],
				newEpisodes: [newEpisode],
			});

			const result = await manager.syncPodcast('podcast-123');

			expect(result.podcastId).toBe('podcast-123');
			expect(result.success).toBe(true);
			expect(result.newEpisodesCount).toBe(1);
		});

		it('should throw error if podcast not found', async () => {
			mockSubscriptionStore.getPodcast.mockResolvedValue(null);

			await expect(manager.syncPodcast('non-existent')).rejects.toThrow('Podcast not found');
		});

		it('should handle update failure', async () => {
			mockSubscriptionStore.getPodcast.mockResolvedValue(samplePodcast);
			mockFeedService.updateFeed.mockRejectedValue(new Error('Network error'));

			const result = await manager.syncPodcast('podcast-123');

			expect(result.success).toBe(false);
			expect(result.error).toBe('Network error');
		});
	});

	describe('getSyncStatus', () => {
		it('should return sync status', () => {
			const status = manager.getSyncStatus();

			expect(status).toHaveProperty('isSyncing');
			expect(status).toHaveProperty('isAutoSyncEnabled');
			expect(status).toHaveProperty('lastSyncTime');
			expect(status).toHaveProperty('syncInterval');
		});

		it('should reflect auto sync state', () => {
			let status = manager.getSyncStatus();
			expect(status.isAutoSyncEnabled).toBe(false);

			manager.startAutoSync();
			status = manager.getSyncStatus();
			expect(status.isAutoSyncEnabled).toBe(true);

			manager.stopAutoSync();
			status = manager.getSyncStatus();
			expect(status.isAutoSyncEnabled).toBe(false);
		});
	});

	describe('setSyncInterval', () => {
		it('should update sync interval', () => {
			manager.setSyncInterval(7200000);

			const status = manager.getSyncStatus();
			expect(status.syncInterval).toBe(7200000);
		});

		it('should restart auto sync with new interval', async () => {
			mockSubscriptionStore.getAllPodcasts.mockResolvedValue([]);
			mockFeedService.updateFeed.mockResolvedValue({
				podcast: samplePodcast,
				episodes: [],
				newEpisodes: [],
			});

			manager.startAutoSync();
			await new Promise(resolve => setTimeout(resolve, 100));

			manager.setSyncInterval(7200000);

			const status = manager.getSyncStatus();
			expect(status.isAutoSyncEnabled).toBe(true);
			expect(status.syncInterval).toBe(7200000);
		});
	});

	describe('shouldUpdate', () => {
		it('should return true for never-fetched podcast', () => {
			const podcast = { ...samplePodcast, lastFetchedAt: undefined };
			const result = (manager as any).shouldUpdate(podcast, 3600000);
			expect(result).toBe(true);
		});

		it('should return true if enough time has passed', () => {
			const podcast = {
				...samplePodcast,
				lastFetchedAt: new Date(Date.now() - 7200000), // 2 hours ago
			};
			const result = (manager as any).shouldUpdate(podcast, 3600000); // 1 hour interval
			expect(result).toBe(true);
		});

		it('should return false if not enough time has passed', () => {
			const podcast = {
				...samplePodcast,
				lastFetchedAt: new Date(Date.now() - 1800000), // 30 minutes ago
			};
			const result = (manager as any).shouldUpdate(podcast, 3600000); // 1 hour interval
			expect(result).toBe(false);
		});
	});
});
