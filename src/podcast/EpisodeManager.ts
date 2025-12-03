/**
 * EpisodeManager - Manages podcast episodes
 *
 * Handles episode filtering, sorting, searching, and statistics.
 * Integrates with ProgressStore for playback progress tracking.
 */

import { logger } from '../utils/Logger';
import { Episode, PlayProgress } from '../model';
import { ProgressStore } from '../storage/ProgressStore';
import { SubscriptionStore } from '../storage/SubscriptionStore';

/**
 * Episode filter options
 */
export interface EpisodeFilter {
	/** Filter by podcast ID */
	podcastId?: string;
	/** Filter by completion status */
	completed?: boolean;
	/** Filter by in-progress status */
	inProgress?: boolean;
	/** Filter episodes newer than date */
	newerThan?: Date;
	/** Filter episodes older than date */
	olderThan?: Date;
	/** Filter by episode type */
	episodeType?: 'full' | 'trailer' | 'bonus';
	/** Filter by season number */
	seasonNumber?: number;
}

/**
 * Episode sort options
 */
export type EpisodeSortBy =
	| 'publishDate'
	| 'duration'
	| 'title'
	| 'episodeNumber'
	| 'lastPlayed';

export type EpisodeSortOrder = 'asc' | 'desc';

/**
 * Episode with progress information
 */
export interface EpisodeWithProgress extends Episode {
	progress?: PlayProgress;
	completionPercentage?: number;
}

/**
 * Episode statistics
 */
export interface EpisodeStatistics {
	totalEpisodes: number;
	completedEpisodes: number;
	inProgressEpisodes: number;
	unplayedEpisodes: number;
	totalDuration: number;
	totalListeningTime: number;
	averageCompletionRate: number;
}

/**
 * Episode Manager
 */
export class EpisodeManager {
	private progressStore: ProgressStore;
	private subscriptionStore: SubscriptionStore;

	constructor(progressStore: ProgressStore, subscriptionStore: SubscriptionStore) {
		this.progressStore = progressStore;
		this.subscriptionStore = subscriptionStore;
	}

	/**
	 * Get episode with progress information
	 */
	async getEpisodeWithProgress(episodeId: string): Promise<EpisodeWithProgress | null> {
		logger.methodEntry('EpisodeManager', 'getEpisodeWithProgress', episodeId);

		// Find episode in all podcasts
		const podcasts = await this.subscriptionStore.getAllPodcasts();
		let episode: Episode | null = null;

		for (const podcast of podcasts) {
			if (podcast.episodes) {
				const found = podcast.episodes.find(e => e.id === episodeId);
				if (found) {
					episode = found;
					break;
				}
			}
		}

		if (!episode) {
			logger.methodExit('EpisodeManager', 'getEpisodeWithProgress', 'not found');
			return null;
		}

		// Get progress
		const progress = await this.progressStore.getProgress(episodeId);
		const completionPercentage = progress
			? await this.progressStore.getCompletionPercentage(episodeId)
			: 0;

		const episodeWithProgress: EpisodeWithProgress = {
			...episode,
			progress: progress || undefined,
			completionPercentage,
		};

		logger.methodExit('EpisodeManager', 'getEpisodeWithProgress');
		return episodeWithProgress;
	}

	/**
	 * Get episodes with progress information
	 */
	async getEpisodesWithProgress(episodeIds: string[]): Promise<EpisodeWithProgress[]> {
		logger.methodEntry('EpisodeManager', 'getEpisodesWithProgress', `count=${episodeIds.length}`);

		const episodes: EpisodeWithProgress[] = [];

		for (const episodeId of episodeIds) {
			const episode = await this.getEpisodeWithProgress(episodeId);
			if (episode) {
				episodes.push(episode);
			}
		}

		logger.methodExit('EpisodeManager', 'getEpisodesWithProgress');
		return episodes;
	}

	/**
	 * Get all episodes for a podcast with progress
	 */
	async getPodcastEpisodesWithProgress(podcastId: string): Promise<EpisodeWithProgress[]> {
		logger.methodEntry('EpisodeManager', 'getPodcastEpisodesWithProgress', podcastId);

		const podcast = await this.subscriptionStore.getPodcast(podcastId);

		if (!podcast || !podcast.episodes) {
			logger.methodExit('EpisodeManager', 'getPodcastEpisodesWithProgress', 'not found');
			return [];
		}

		const episodes: EpisodeWithProgress[] = [];

		for (const episode of podcast.episodes) {
			const progress = await this.progressStore.getProgress(episode.id);
			const completionPercentage = progress
				? await this.progressStore.getCompletionPercentage(episode.id)
				: 0;

			episodes.push({
				...episode,
				progress: progress || undefined,
				completionPercentage,
			});
		}

		logger.methodExit('EpisodeManager', 'getPodcastEpisodesWithProgress');
		return episodes;
	}

	/**
	 * Filter episodes
	 */
	async filterEpisodes(
		episodes: EpisodeWithProgress[],
		filter: EpisodeFilter
	): Promise<EpisodeWithProgress[]> {
		logger.methodEntry('EpisodeManager', 'filterEpisodes', `count=${episodes.length}`);

		let filtered = [...episodes];

		// Filter by podcast ID
		if (filter.podcastId) {
			filtered = filtered.filter(e => e.podcastId === filter.podcastId);
		}

		// Filter by completion status
		if (filter.completed !== undefined) {
			filtered = filtered.filter(e => {
				const isCompleted = e.progress?.completed || false;
				return isCompleted === filter.completed;
			});
		}

		// Filter by in-progress status
		if (filter.inProgress !== undefined) {
			filtered = filtered.filter(e => {
				const isInProgress = e.progress && !e.progress.completed && e.progress.position > 0;
				return !!isInProgress === filter.inProgress;
			});
		}

		// Filter by date range
		if (filter.newerThan) {
			filtered = filtered.filter(e => e.publishDate >= filter.newerThan!);
		}

		if (filter.olderThan) {
			filtered = filtered.filter(e => e.publishDate <= filter.olderThan!);
		}

		// Filter by episode type
		if (filter.episodeType) {
			filtered = filtered.filter(e => e.episodeType === filter.episodeType);
		}

		// Filter by season number
		if (filter.seasonNumber !== undefined) {
			filtered = filtered.filter(e => e.seasonNumber === filter.seasonNumber);
		}

		logger.methodExit('EpisodeManager', 'filterEpisodes', `filtered=${filtered.length}`);
		return filtered;
	}

	/**
	 * Sort episodes
	 */
	sortEpisodes(
		episodes: EpisodeWithProgress[],
		sortBy: EpisodeSortBy = 'publishDate',
		order: EpisodeSortOrder = 'desc'
	): EpisodeWithProgress[] {
		logger.methodEntry('EpisodeManager', 'sortEpisodes', `sortBy=${sortBy}, order=${order}`);

		const sorted = [...episodes].sort((a, b) => {
			let comparison = 0;

			switch (sortBy) {
				case 'publishDate':
					// Convert to Date objects in case they were deserialized as strings
					const dateA = a.publishDate instanceof Date ? a.publishDate : new Date(a.publishDate);
					const dateB = b.publishDate instanceof Date ? b.publishDate : new Date(b.publishDate);
					comparison = dateA.getTime() - dateB.getTime();
					break;

				case 'duration':
					comparison = a.duration - b.duration;
					break;

				case 'title':
					comparison = a.title.localeCompare(b.title);
					break;

				case 'episodeNumber':
					const aNum = a.episodeNumber || 0;
					const bNum = b.episodeNumber || 0;
					comparison = aNum - bNum;
					break;

				case 'lastPlayed':
					const aLastPlayed = a.progress?.lastPlayedAt?.getTime() || 0;
					const bLastPlayed = b.progress?.lastPlayedAt?.getTime() || 0;
					comparison = aLastPlayed - bLastPlayed;
					break;

				default:
					comparison = 0;
			}

			return order === 'asc' ? comparison : -comparison;
		});

		logger.methodExit('EpisodeManager', 'sortEpisodes');
		return sorted;
	}

	/**
	 * Search episodes by title or description
	 */
	searchEpisodes(episodes: EpisodeWithProgress[], query: string): EpisodeWithProgress[] {
		logger.methodEntry('EpisodeManager', 'searchEpisodes', query);

		const lowercaseQuery = query.toLowerCase();

		const results = episodes.filter(episode => {
			const titleMatch = episode.title.toLowerCase().includes(lowercaseQuery);
			const descriptionMatch = episode.description.toLowerCase().includes(lowercaseQuery);
			return titleMatch || descriptionMatch;
		});

		logger.methodExit('EpisodeManager', 'searchEpisodes', `results=${results.length}`);
		return results;
	}

	/**
	 * Get unplayed episodes
	 */
	async getUnplayedEpisodes(podcastId?: string): Promise<EpisodeWithProgress[]> {
		logger.methodEntry('EpisodeManager', 'getUnplayedEpisodes', podcastId);

		let episodes: EpisodeWithProgress[];

		if (podcastId) {
			episodes = await this.getPodcastEpisodesWithProgress(podcastId);
		} else {
			episodes = await this.getAllEpisodesWithProgress();
		}

		const unplayed = episodes.filter(e => !e.progress || e.progress.position === 0);

		logger.methodExit('EpisodeManager', 'getUnplayedEpisodes');
		return unplayed;
	}

	/**
	 * Get in-progress episodes
	 */
	async getInProgressEpisodes(podcastId?: string): Promise<EpisodeWithProgress[]> {
		logger.methodEntry('EpisodeManager', 'getInProgressEpisodes', podcastId);

		const progressList = await this.progressStore.getInProgressEpisodes();

		if (!progressList.length) {
			logger.methodExit('EpisodeManager', 'getInProgressEpisodes', 'empty');
			return [];
		}

		// Filter by podcast if specified
		const filteredProgress = podcastId
			? progressList.filter(p => p.podcastId === podcastId)
			: progressList;

		// Get episodes with progress
		const episodeIds = filteredProgress.map(p => p.episodeId);
		const episodes = await this.getEpisodesWithProgress(episodeIds);

		logger.methodExit('EpisodeManager', 'getInProgressEpisodes');
		return episodes;
	}

	/**
	 * Get completed episodes
	 */
	async getCompletedEpisodes(podcastId?: string): Promise<EpisodeWithProgress[]> {
		logger.methodEntry('EpisodeManager', 'getCompletedEpisodes', podcastId);

		const progressList = await this.progressStore.getCompletedEpisodes();

		if (!progressList.length) {
			logger.methodExit('EpisodeManager', 'getCompletedEpisodes', 'empty');
			return [];
		}

		// Filter by podcast if specified
		const filteredProgress = podcastId
			? progressList.filter(p => p.podcastId === podcastId)
			: progressList;

		// Get episodes with progress
		const episodeIds = filteredProgress.map(p => p.episodeId);
		const episodes = await this.getEpisodesWithProgress(episodeIds);

		logger.methodExit('EpisodeManager', 'getCompletedEpisodes');
		return episodes;
	}

	/**
	 * Get recently played episodes
	 */
	async getRecentlyPlayedEpisodes(limit = 10): Promise<EpisodeWithProgress[]> {
		logger.methodEntry('EpisodeManager', 'getRecentlyPlayedEpisodes', `limit=${limit}`);

		const progressList = await this.progressStore.getRecentlyPlayed(limit);

		if (!progressList.length) {
			logger.methodExit('EpisodeManager', 'getRecentlyPlayedEpisodes', 'empty');
			return [];
		}

		// Get episodes with progress
		const episodeIds = progressList.map(p => p.episodeId);
		const episodes = await this.getEpisodesWithProgress(episodeIds);

		// Maintain order from recently played
		const orderedEpisodes = episodeIds
			.map(id => episodes.find(e => e.id === id))
			.filter((e): e is EpisodeWithProgress => e !== undefined);

		logger.methodExit('EpisodeManager', 'getRecentlyPlayedEpisodes');
		return orderedEpisodes;
	}

	/**
	 * Get all episodes with progress across all podcasts
	 */
	async getAllEpisodesWithProgress(): Promise<EpisodeWithProgress[]> {
		logger.methodEntry('EpisodeManager', 'getAllEpisodesWithProgress');

		const podcasts = await this.subscriptionStore.getAllPodcasts();
		const allEpisodes: EpisodeWithProgress[] = [];

		for (const podcast of podcasts) {
			if (podcast.episodes) {
				for (const episode of podcast.episodes) {
					const progress = await this.progressStore.getProgress(episode.id);
					const completionPercentage = progress
						? await this.progressStore.getCompletionPercentage(episode.id)
						: 0;

					allEpisodes.push({
						...episode,
						progress: progress || undefined,
						completionPercentage,
					});
				}
			}
		}

		logger.methodExit('EpisodeManager', 'getAllEpisodesWithProgress');
		return allEpisodes;
	}

	/**
	 * Get episode statistics for a podcast
	 */
	async getPodcastStatistics(podcastId: string): Promise<EpisodeStatistics> {
		logger.methodEntry('EpisodeManager', 'getPodcastStatistics', podcastId);

		const episodes = await this.getPodcastEpisodesWithProgress(podcastId);

		const stats: EpisodeStatistics = {
			totalEpisodes: episodes.length,
			completedEpisodes: episodes.filter(e => e.progress?.completed).length,
			inProgressEpisodes: episodes.filter(e => e.progress && !e.progress.completed && e.progress.position > 0).length,
			unplayedEpisodes: episodes.filter(e => !e.progress || e.progress.position === 0).length,
			totalDuration: episodes.reduce((sum, e) => sum + e.duration, 0),
			totalListeningTime: episodes.reduce((sum, e) => sum + (e.progress?.position || 0), 0),
			averageCompletionRate: 0,
		};

		// Calculate average completion rate
		if (stats.totalEpisodes > 0 && stats.totalDuration > 0) {
			stats.averageCompletionRate = (stats.totalListeningTime / stats.totalDuration) * 100;
		}

		logger.methodExit('EpisodeManager', 'getPodcastStatistics');
		return stats;
	}

	/**
	 * Get overall statistics across all podcasts
	 */
	async getOverallStatistics(): Promise<EpisodeStatistics> {
		logger.methodEntry('EpisodeManager', 'getOverallStatistics');

		const podcasts = await this.subscriptionStore.getAllPodcasts();
		let totalEpisodes = 0;
		let totalDuration = 0;

		for (const podcast of podcasts) {
			if (podcast.episodes) {
				totalEpisodes += podcast.episodes.length;
				totalDuration += podcast.episodes.reduce((sum, e) => sum + e.duration, 0);
			}
		}

		const totalListeningTime = await this.progressStore.getTotalListeningTime();
		const completedEpisodes = (await this.progressStore.getCompletedEpisodes()).length;
		const inProgressEpisodes = (await this.progressStore.getInProgressEpisodes()).length;
		const unplayedEpisodes = totalEpisodes - completedEpisodes - inProgressEpisodes;

		const stats: EpisodeStatistics = {
			totalEpisodes,
			completedEpisodes,
			inProgressEpisodes,
			unplayedEpisodes,
			totalDuration,
			totalListeningTime,
			averageCompletionRate: 0,
		};

		// Calculate average completion rate
		if (stats.totalEpisodes > 0 && stats.totalDuration > 0) {
			stats.averageCompletionRate = (stats.totalListeningTime / stats.totalDuration) * 100;
		}

		logger.methodExit('EpisodeManager', 'getOverallStatistics');
		return stats;
	}

	/**
	 * Get episodes by season
	 */
	async getEpisodesBySeason(podcastId: string, seasonNumber: number): Promise<EpisodeWithProgress[]> {
		logger.methodEntry('EpisodeManager', 'getEpisodesBySeason', `${podcastId}, season=${seasonNumber}`);

		const episodes = await this.getPodcastEpisodesWithProgress(podcastId);
		const seasonEpisodes = episodes.filter(e => e.seasonNumber === seasonNumber);

		// Sort by episode number
		seasonEpisodes.sort((a, b) => (a.episodeNumber || 0) - (b.episodeNumber || 0));

		logger.methodExit('EpisodeManager', 'getEpisodesBySeason');
		return seasonEpisodes;
	}

	/**
	 * Get available seasons for a podcast
	 */
	async getAvailableSeasons(podcastId: string): Promise<number[]> {
		logger.methodEntry('EpisodeManager', 'getAvailableSeasons', podcastId);

		const podcast = await this.subscriptionStore.getPodcast(podcastId);

		if (!podcast || !podcast.episodes) {
			logger.methodExit('EpisodeManager', 'getAvailableSeasons', 'not found');
			return [];
		}

		const seasons = new Set<number>();

		for (const episode of podcast.episodes) {
			if (episode.seasonNumber !== undefined) {
				seasons.add(episode.seasonNumber);
			}
		}

		const seasonNumbers = Array.from(seasons).sort((a, b) => a - b);

		logger.methodExit('EpisodeManager', 'getAvailableSeasons');
		return seasonNumbers;
	}
}
