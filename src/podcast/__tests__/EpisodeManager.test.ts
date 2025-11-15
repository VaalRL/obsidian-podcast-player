/**
 * Unit tests for EpisodeManager
 */

import { EpisodeManager, EpisodeFilter, EpisodeSortBy, EpisodeWithProgress } from '../EpisodeManager';
import { ProgressStore } from '../../storage/ProgressStore';
import { SubscriptionStore } from '../../storage/SubscriptionStore';
import { Podcast, Episode, PlayProgress } from '../../model';

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

describe('EpisodeManager', () => {
	let manager: EpisodeManager;
	let mockProgressStore: jest.Mocked<ProgressStore>;
	let mockSubscriptionStore: jest.Mocked<SubscriptionStore>;

	const samplePodcast: Podcast = {
		id: 'podcast-1',
		title: 'Test Podcast',
		author: 'Test Author',
		description: 'Test Description',
		feedUrl: 'https://example.com/feed.rss',
		subscribedAt: new Date('2024-01-01'),
		lastFetchedAt: new Date('2024-01-01'),
	};

	const sampleEpisodes: Episode[] = [
		{
			id: 'ep-1',
			podcastId: 'podcast-1',
			title: 'Episode 1',
			description: 'First episode',
			audioUrl: 'https://example.com/ep1.mp3',
			duration: 3600,
			publishDate: new Date('2024-01-01'),
			episodeNumber: 1,
			seasonNumber: 1,
		},
		{
			id: 'ep-2',
			podcastId: 'podcast-1',
			title: 'Episode 2',
			description: 'Second episode',
			audioUrl: 'https://example.com/ep2.mp3',
			duration: 2400,
			publishDate: new Date('2024-01-08'),
			episodeNumber: 2,
			seasonNumber: 1,
		},
		{
			id: 'ep-3',
			podcastId: 'podcast-1',
			title: 'Episode 3',
			description: 'Third episode',
			audioUrl: 'https://example.com/ep3.mp3',
			duration: 1800,
			publishDate: new Date('2024-01-15'),
			episodeType: 'bonus',
		},
	];

	const sampleProgress: PlayProgress = {
		episodeId: 'ep-1',
		podcastId: 'podcast-1',
		position: 1800,
		duration: 3600,
		completed: false,
		lastPlayedAt: new Date('2024-01-10'),
	};

	beforeEach(() => {
		mockProgressStore = {
			getProgress: jest.fn(),
			saveProgress: jest.fn(),
			getCompletionPercentage: jest.fn(),
			getInProgressEpisodes: jest.fn(),
			getCompletedEpisodes: jest.fn(),
			getRecentlyPlayed: jest.fn(),
			getTotalListeningTime: jest.fn(),
		} as any;

		mockSubscriptionStore = {
			getPodcast: jest.fn(),
			getAllPodcasts: jest.fn(),
		} as any;

		manager = new EpisodeManager(mockProgressStore, mockSubscriptionStore);

		jest.clearAllMocks();
	});

	describe('constructor', () => {
		it('should create manager with dependencies', () => {
			expect(manager).toBeInstanceOf(EpisodeManager);
		});
	});

	describe('getEpisodeWithProgress', () => {
		it('should get episode with progress information', async () => {
			const podcastWithEpisodes = { ...samplePodcast, episodes: sampleEpisodes };
			mockSubscriptionStore.getAllPodcasts.mockResolvedValue([podcastWithEpisodes]);
			mockProgressStore.getProgress.mockResolvedValue(sampleProgress);
			mockProgressStore.getCompletionPercentage.mockResolvedValue(50);

			const result = await manager.getEpisodeWithProgress('ep-1');

			expect(result).toBeDefined();
			expect(result?.id).toBe('ep-1');
			expect(result?.progress).toEqual(sampleProgress);
			expect(result?.completionPercentage).toBe(50);
		});

		it('should return null if episode not found', async () => {
			mockSubscriptionStore.getAllPodcasts.mockResolvedValue([]);

			const result = await manager.getEpisodeWithProgress('nonexistent');

			expect(result).toBeNull();
		});

		it('should handle episode without progress', async () => {
			const podcastWithEpisodes = { ...samplePodcast, episodes: sampleEpisodes };
			mockSubscriptionStore.getAllPodcasts.mockResolvedValue([podcastWithEpisodes]);
			mockProgressStore.getProgress.mockResolvedValue(null);

			const result = await manager.getEpisodeWithProgress('ep-1');

			expect(result).toBeDefined();
			expect(result?.progress).toBeUndefined();
			expect(result?.completionPercentage).toBe(0);
		});
	});

	describe('getEpisodesWithProgress', () => {
		it('should get multiple episodes with progress', async () => {
			const podcastWithEpisodes = { ...samplePodcast, episodes: sampleEpisodes };
			mockSubscriptionStore.getAllPodcasts.mockResolvedValue([podcastWithEpisodes]);
			mockProgressStore.getProgress.mockResolvedValue(null);
			mockProgressStore.getCompletionPercentage.mockResolvedValue(0);

			const result = await manager.getEpisodesWithProgress(['ep-1', 'ep-2']);

			expect(result).toHaveLength(2);
			expect(result[0].id).toBe('ep-1');
			expect(result[1].id).toBe('ep-2');
		});

		it('should skip episodes that do not exist', async () => {
			const podcastWithEpisodes = { ...samplePodcast, episodes: sampleEpisodes };
			mockSubscriptionStore.getAllPodcasts.mockResolvedValue([podcastWithEpisodes]);
			mockProgressStore.getProgress.mockResolvedValue(null);
			mockProgressStore.getCompletionPercentage.mockResolvedValue(0);

			const result = await manager.getEpisodesWithProgress(['ep-1', 'nonexistent']);

			expect(result).toHaveLength(1);
			expect(result[0].id).toBe('ep-1');
		});
	});

	describe('getPodcastEpisodesWithProgress', () => {
		it('should get all episodes for a podcast with progress', async () => {
			const podcastWithEpisodes = { ...samplePodcast, episodes: sampleEpisodes };
			mockSubscriptionStore.getPodcast.mockResolvedValue(podcastWithEpisodes);
			mockProgressStore.getProgress.mockResolvedValue(null);
			mockProgressStore.getCompletionPercentage.mockResolvedValue(0);

			const result = await manager.getPodcastEpisodesWithProgress('podcast-1');

			expect(result).toHaveLength(3);
			expect(result[0].id).toBe('ep-1');
			expect(result[1].id).toBe('ep-2');
			expect(result[2].id).toBe('ep-3');
		});

		it('should return empty array if podcast not found', async () => {
			mockSubscriptionStore.getPodcast.mockResolvedValue(null);

			const result = await manager.getPodcastEpisodesWithProgress('podcast-1');

			expect(result).toEqual([]);
		});

		it('should return empty array if podcast has no episodes', async () => {
			mockSubscriptionStore.getPodcast.mockResolvedValue(samplePodcast);

			const result = await manager.getPodcastEpisodesWithProgress('podcast-1');

			expect(result).toEqual([]);
		});
	});

	describe('filterEpisodes', () => {
		const episodesWithProgress: EpisodeWithProgress[] = [
			{
				...sampleEpisodes[0],
				progress: { ...sampleProgress, completed: false },
				completionPercentage: 50,
			},
			{
				...sampleEpisodes[1],
				progress: { ...sampleProgress, episodeId: 'ep-2', completed: true },
				completionPercentage: 100,
			},
			{
				...sampleEpisodes[2],
				completionPercentage: 0,
			},
		];

		it('should filter by podcast ID', async () => {
			const filter: EpisodeFilter = { podcastId: 'podcast-1' };

			const result = await manager.filterEpisodes(episodesWithProgress, filter);

			expect(result).toHaveLength(3);
		});

		it('should filter by completed status', async () => {
			const filter: EpisodeFilter = { completed: true };

			const result = await manager.filterEpisodes(episodesWithProgress, filter);

			expect(result).toHaveLength(1);
			expect(result[0].id).toBe('ep-2');
		});

		it('should filter by in-progress status', async () => {
			const filter: EpisodeFilter = { inProgress: true };

			const result = await manager.filterEpisodes(episodesWithProgress, filter);

			expect(result).toHaveLength(1);
			expect(result[0].id).toBe('ep-1');
		});

		it('should filter by date range (newer than)', async () => {
			const filter: EpisodeFilter = { newerThan: new Date('2024-01-07') };

			const result = await manager.filterEpisodes(episodesWithProgress, filter);

			expect(result).toHaveLength(2);
		});

		it('should filter by date range (older than)', async () => {
			const filter: EpisodeFilter = { olderThan: new Date('2024-01-10') };

			const result = await manager.filterEpisodes(episodesWithProgress, filter);

			expect(result).toHaveLength(2);
		});

		it('should filter by episode type', async () => {
			const filter: EpisodeFilter = { episodeType: 'bonus' };

			const result = await manager.filterEpisodes(episodesWithProgress, filter);

			expect(result).toHaveLength(1);
			expect(result[0].id).toBe('ep-3');
		});

		it('should filter by season number', async () => {
			const filter: EpisodeFilter = { seasonNumber: 1 };

			const result = await manager.filterEpisodes(episodesWithProgress, filter);

			expect(result).toHaveLength(2);
		});

		it('should apply multiple filters', async () => {
			const filter: EpisodeFilter = {
				seasonNumber: 1,
				completed: false,
			};

			const result = await manager.filterEpisodes(episodesWithProgress, filter);

			expect(result).toHaveLength(1);
			expect(result[0].id).toBe('ep-1');
		});
	});

	describe('sortEpisodes', () => {
		const unsortedEpisodes: EpisodeWithProgress[] = [
			{ ...sampleEpisodes[2], completionPercentage: 0 },
			{ ...sampleEpisodes[0], completionPercentage: 0 },
			{ ...sampleEpisodes[1], completionPercentage: 0 },
		];

		it('should sort by publish date (desc)', () => {
			const result = manager.sortEpisodes(unsortedEpisodes, 'publishDate', 'desc');

			expect(result[0].id).toBe('ep-3'); // Newest first
			expect(result[2].id).toBe('ep-1'); // Oldest last
		});

		it('should sort by publish date (asc)', () => {
			const result = manager.sortEpisodes(unsortedEpisodes, 'publishDate', 'asc');

			expect(result[0].id).toBe('ep-1'); // Oldest first
			expect(result[2].id).toBe('ep-3'); // Newest last
		});

		it('should sort by duration', () => {
			const result = manager.sortEpisodes(unsortedEpisodes, 'duration', 'desc');

			expect(result[0].duration).toBe(3600);
			expect(result[2].duration).toBe(1800);
		});

		it('should sort by title', () => {
			const result = manager.sortEpisodes(unsortedEpisodes, 'title', 'asc');

			expect(result[0].title).toBe('Episode 1');
			expect(result[2].title).toBe('Episode 3');
		});

		it('should sort by episode number', () => {
			// Use only episodes with episode numbers
			const episodesWithNumbers = unsortedEpisodes.filter(e => e.episodeNumber !== undefined);
			const result = manager.sortEpisodes(episodesWithNumbers, 'episodeNumber', 'asc');

			expect(result[0].episodeNumber).toBe(1);
			expect(result[1].episodeNumber).toBe(2);
		});

		it('should sort by last played date', () => {
			const episodes: EpisodeWithProgress[] = [
				{
					...sampleEpisodes[0],
					progress: { ...sampleProgress, lastPlayedAt: new Date('2024-01-10') },
					completionPercentage: 0,
				},
				{
					...sampleEpisodes[1],
					progress: { ...sampleProgress, lastPlayedAt: new Date('2024-01-15') },
					completionPercentage: 0,
				},
			];

			const result = manager.sortEpisodes(episodes, 'lastPlayed', 'desc');

			expect(result[0].id).toBe('ep-2'); // Most recently played first
		});
	});

	describe('searchEpisodes', () => {
		const episodes: EpisodeWithProgress[] = sampleEpisodes.map(e => ({
			...e,
			completionPercentage: 0,
		}));

		it('should search by title', () => {
			const result = manager.searchEpisodes(episodes, 'Episode 2');

			expect(result).toHaveLength(1);
			expect(result[0].id).toBe('ep-2');
		});

		it('should search by description', () => {
			const result = manager.searchEpisodes(episodes, 'First');

			expect(result).toHaveLength(1);
			expect(result[0].id).toBe('ep-1');
		});

		it('should be case insensitive', () => {
			const result = manager.searchEpisodes(episodes, 'EPISODE');

			expect(result).toHaveLength(3);
		});

		it('should return empty array if no matches', () => {
			const result = manager.searchEpisodes(episodes, 'nonexistent');

			expect(result).toEqual([]);
		});
	});

	describe('getUnplayedEpisodes', () => {
		it('should get unplayed episodes for specific podcast', async () => {
			const podcastWithEpisodes = { ...samplePodcast, episodes: sampleEpisodes };
			mockSubscriptionStore.getPodcast.mockResolvedValue(podcastWithEpisodes);
			mockProgressStore.getProgress.mockResolvedValue(null);
			mockProgressStore.getCompletionPercentage.mockResolvedValue(0);

			const result = await manager.getUnplayedEpisodes('podcast-1');

			expect(result).toHaveLength(3); // All episodes are unplayed
		});

		it('should get unplayed episodes across all podcasts', async () => {
			const podcastWithEpisodes = { ...samplePodcast, episodes: sampleEpisodes };
			mockSubscriptionStore.getAllPodcasts.mockResolvedValue([podcastWithEpisodes]);
			mockProgressStore.getProgress.mockResolvedValue(null);
			mockProgressStore.getCompletionPercentage.mockResolvedValue(0);

			const result = await manager.getUnplayedEpisodes();

			expect(result).toHaveLength(3);
		});
	});

	describe('getInProgressEpisodes', () => {
		it('should get in-progress episodes for specific podcast', async () => {
			const podcastWithEpisodes = { ...samplePodcast, episodes: sampleEpisodes };
			mockSubscriptionStore.getAllPodcasts.mockResolvedValue([podcastWithEpisodes]);
			mockProgressStore.getInProgressEpisodes.mockResolvedValue([
				{ ...sampleProgress, podcastId: 'podcast-1' },
			]);
			mockProgressStore.getProgress.mockResolvedValue(sampleProgress);
			mockProgressStore.getCompletionPercentage.mockResolvedValue(50);

			const result = await manager.getInProgressEpisodes('podcast-1');

			expect(result).toHaveLength(1);
			expect(result[0].id).toBe('ep-1');
		});

		it('should get in-progress episodes across all podcasts', async () => {
			const podcastWithEpisodes = { ...samplePodcast, episodes: sampleEpisodes };
			mockSubscriptionStore.getAllPodcasts.mockResolvedValue([podcastWithEpisodes]);
			mockProgressStore.getInProgressEpisodes.mockResolvedValue([sampleProgress]);
			mockProgressStore.getProgress.mockResolvedValue(sampleProgress);
			mockProgressStore.getCompletionPercentage.mockResolvedValue(50);

			const result = await manager.getInProgressEpisodes();

			expect(result).toHaveLength(1);
		});

		it('should return empty array if no in-progress episodes', async () => {
			mockProgressStore.getInProgressEpisodes.mockResolvedValue([]);

			const result = await manager.getInProgressEpisodes();

			expect(result).toEqual([]);
		});
	});

	describe('getCompletedEpisodes', () => {
		it('should get completed episodes for specific podcast', async () => {
			const podcastWithEpisodes = { ...samplePodcast, episodes: sampleEpisodes };
			const completedProgress = { ...sampleProgress, completed: true };
			mockSubscriptionStore.getAllPodcasts.mockResolvedValue([podcastWithEpisodes]);
			mockProgressStore.getCompletedEpisodes.mockResolvedValue([completedProgress]);
			mockProgressStore.getProgress.mockResolvedValue(completedProgress);
			mockProgressStore.getCompletionPercentage.mockResolvedValue(100);

			const result = await manager.getCompletedEpisodes('podcast-1');

			expect(result).toHaveLength(1);
			expect(result[0].progress?.completed).toBe(true);
		});

		it('should return empty array if no completed episodes', async () => {
			mockProgressStore.getCompletedEpisodes.mockResolvedValue([]);

			const result = await manager.getCompletedEpisodes();

			expect(result).toEqual([]);
		});
	});

	describe('getRecentlyPlayedEpisodes', () => {
		it('should get recently played episodes in correct order', async () => {
			const podcastWithEpisodes = { ...samplePodcast, episodes: sampleEpisodes };
			const progressList = [
				{ ...sampleProgress, episodeId: 'ep-2' },
				{ ...sampleProgress, episodeId: 'ep-1' },
			];
			mockSubscriptionStore.getAllPodcasts.mockResolvedValue([podcastWithEpisodes]);
			mockProgressStore.getRecentlyPlayed.mockResolvedValue(progressList);
			mockProgressStore.getProgress.mockResolvedValue(sampleProgress);
			mockProgressStore.getCompletionPercentage.mockResolvedValue(50);

			const result = await manager.getRecentlyPlayedEpisodes(10);

			expect(result).toHaveLength(2);
			expect(result[0].id).toBe('ep-2'); // Most recent first
			expect(result[1].id).toBe('ep-1');
		});

		it('should return empty array if no recently played episodes', async () => {
			mockProgressStore.getRecentlyPlayed.mockResolvedValue([]);

			const result = await manager.getRecentlyPlayedEpisodes();

			expect(result).toEqual([]);
		});
	});

	describe('getAllEpisodesWithProgress', () => {
		it('should get all episodes across all podcasts', async () => {
			const podcast1 = { ...samplePodcast, episodes: [sampleEpisodes[0]] };
			const podcast2 = {
				...samplePodcast,
				id: 'podcast-2',
				episodes: [sampleEpisodes[1]],
			};
			mockSubscriptionStore.getAllPodcasts.mockResolvedValue([podcast1, podcast2]);
			mockProgressStore.getProgress.mockResolvedValue(null);
			mockProgressStore.getCompletionPercentage.mockResolvedValue(0);

			const result = await manager.getAllEpisodesWithProgress();

			expect(result).toHaveLength(2);
		});
	});

	describe('getPodcastStatistics', () => {
		it('should calculate podcast statistics', async () => {
			const podcastWithEpisodes = { ...samplePodcast, episodes: sampleEpisodes };
			mockSubscriptionStore.getPodcast.mockResolvedValue(podcastWithEpisodes);
			mockProgressStore.getProgress
				.mockResolvedValueOnce({ ...sampleProgress, completed: true, position: 3600 })
				.mockResolvedValueOnce({ ...sampleProgress, episodeId: 'ep-2', position: 1200 })
				.mockResolvedValueOnce(null);
			mockProgressStore.getCompletionPercentage
				.mockResolvedValueOnce(100)
				.mockResolvedValueOnce(50)
				.mockResolvedValueOnce(0);

			const result = await manager.getPodcastStatistics('podcast-1');

			expect(result.totalEpisodes).toBe(3);
			expect(result.completedEpisodes).toBe(1);
			expect(result.inProgressEpisodes).toBe(1);
			expect(result.unplayedEpisodes).toBe(1);
			expect(result.totalDuration).toBe(7800); // 3600 + 2400 + 1800
			expect(result.totalListeningTime).toBe(4800); // 3600 + 1200 + 0
		});
	});

	describe('getOverallStatistics', () => {
		it('should calculate overall statistics', async () => {
			const podcast1 = { ...samplePodcast, episodes: sampleEpisodes };
			mockSubscriptionStore.getAllPodcasts.mockResolvedValue([podcast1]);
			mockProgressStore.getTotalListeningTime.mockResolvedValue(5000);
			mockProgressStore.getCompletedEpisodes.mockResolvedValue([sampleProgress]);
			mockProgressStore.getInProgressEpisodes.mockResolvedValue([sampleProgress]);

			const result = await manager.getOverallStatistics();

			expect(result.totalEpisodes).toBe(3);
			expect(result.totalDuration).toBe(7800);
			expect(result.totalListeningTime).toBe(5000);
			expect(result.completedEpisodes).toBe(1);
			expect(result.inProgressEpisodes).toBe(1);
		});
	});

	describe('getEpisodesBySeason', () => {
		it('should get episodes by season number', async () => {
			const podcastWithEpisodes = { ...samplePodcast, episodes: sampleEpisodes };
			mockSubscriptionStore.getPodcast.mockResolvedValue(podcastWithEpisodes);
			mockProgressStore.getProgress.mockResolvedValue(null);
			mockProgressStore.getCompletionPercentage.mockResolvedValue(0);

			const result = await manager.getEpisodesBySeason('podcast-1', 1);

			expect(result).toHaveLength(2);
			expect(result[0].episodeNumber).toBe(1);
			expect(result[1].episodeNumber).toBe(2);
		});
	});

	describe('getAvailableSeasons', () => {
		it('should get list of available seasons', async () => {
			const podcastWithEpisodes = { ...samplePodcast, episodes: sampleEpisodes };
			mockSubscriptionStore.getPodcast.mockResolvedValue(podcastWithEpisodes);

			const result = await manager.getAvailableSeasons('podcast-1');

			expect(result).toEqual([1]);
		});

		it('should return empty array if podcast not found', async () => {
			mockSubscriptionStore.getPodcast.mockResolvedValue(null);

			const result = await manager.getAvailableSeasons('podcast-1');

			expect(result).toEqual([]);
		});

		it('should return sorted season numbers', async () => {
			const episodes = [
				{ ...sampleEpisodes[0], seasonNumber: 2 },
				{ ...sampleEpisodes[1], seasonNumber: 1 },
				{ ...sampleEpisodes[2], seasonNumber: 3 },
			];
			const podcastWithEpisodes = { ...samplePodcast, episodes };
			mockSubscriptionStore.getPodcast.mockResolvedValue(podcastWithEpisodes);

			const result = await manager.getAvailableSeasons('podcast-1');

			expect(result).toEqual([1, 2, 3]);
		});
	});
});
