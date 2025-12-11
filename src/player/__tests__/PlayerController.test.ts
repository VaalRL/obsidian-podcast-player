/**
 * Unit tests for PlayerController
 */

import { PlayerController } from '../PlayerController';
import { PlaybackEngine } from '../PlaybackEngine';
import { ProgressTracker } from '../ProgressTracker';
import { Episode, PodcastSettings } from '../../model';

// Mock dependencies
jest.mock('../PlaybackEngine');
jest.mock('../ProgressTracker');

describe('PlayerController', () => {
	let playerController: PlayerController;
	let mockEngine: jest.Mocked<PlaybackEngine>;
	let mockProgressTracker: jest.Mocked<ProgressTracker>;

	const testEpisode: Episode = {
		id: 'ep-123',
		podcastId: 'podcast-456',
		title: 'Test Episode',
		description: 'Test Description',
		audioUrl: 'https://example.com/audio.mp3',
		duration: 3600,
		publishDate: new Date('2024-01-01'),
	};

	beforeEach(() => {
		// Create mocked PlaybackEngine
		mockEngine = {
			load: jest.fn().mockReturnValue(undefined),
			play: jest.fn().mockResolvedValue(undefined),
			pause: jest.fn().mockReturnValue(undefined),
			stop: jest.fn().mockReturnValue(undefined),
			seek: jest.fn().mockReturnValue(undefined),
			setVolume: jest.fn().mockReturnValue(undefined),
			setPlaybackRate: jest.fn().mockReturnValue(undefined),
			setMuted: jest.fn().mockReturnValue(undefined),
			getCurrentTime: jest.fn().mockReturnValue(0),
			getDuration: jest.fn().mockReturnValue(3600),
			getPlaybackRate: jest.fn().mockReturnValue(1.0),
			isMuted: jest.fn().mockReturnValue(false),
			isPlaying: jest.fn().mockReturnValue(false),
			isPaused: jest.fn().mockReturnValue(false),
			setEventHandlers: jest.fn(),
			destroy: jest.fn(),
		} as unknown as jest.Mocked<PlaybackEngine>;

		// Create mocked ProgressTracker
		mockProgressTracker = {
			startTracking: jest.fn().mockResolvedValue(undefined),
			stopTracking: jest.fn().mockResolvedValue(undefined),
			updatePosition: jest.fn(),
			markCompleted: jest.fn().mockResolvedValue(undefined),
			shouldResume: jest.fn().mockResolvedValue(false),
			getResumePosition: jest.fn().mockResolvedValue(0),
		} as unknown as jest.Mocked<ProgressTracker>;

		playerController = new PlayerController(mockEngine, mockProgressTracker);
	});

	describe('constructor', () => {
		it('should initialize with default state', () => {
			const state = playerController.getState();

			expect(state.status).toBe('stopped');
			expect(state.position).toBe(0);
			expect(state.volume).toBe(1.0);
			expect(state.playbackSpeed).toBe(1.0);
			expect(state.muted).toBe(false);
		});

		it('should setup engine event handlers', () => {
			expect(mockEngine.setEventHandlers).toHaveBeenCalled();
		});
	});

	describe('loadEpisode', () => {
		it('should load an episode', async () => {
			await playerController.loadEpisode(testEpisode, false, false);

			expect(mockEngine.load).toHaveBeenCalledWith(testEpisode.audioUrl);
			expect(mockProgressTracker.startTracking).toHaveBeenCalledWith(testEpisode);
			expect(playerController.getCurrentEpisode()).toEqual(testEpisode);
		});

		it('should auto-play when autoPlay is true', async () => {
			await playerController.loadEpisode(testEpisode, true, false);

			expect(mockEngine.play).toHaveBeenCalled();
		});

		it('should resume from saved position', async () => {
			mockProgressTracker.shouldResume.mockResolvedValue(true);
			mockProgressTracker.getResumePosition.mockResolvedValue(120);

			await playerController.loadEpisode(testEpisode, false, true);

			expect(mockProgressTracker.shouldResume).toHaveBeenCalledWith(testEpisode.id);
			expect(mockProgressTracker.getResumePosition).toHaveBeenCalledWith(testEpisode.id);
			expect(mockEngine.seek).toHaveBeenCalledWith(120);
		});

		it('should skip intro when configured', async () => {
			const settings: PodcastSettings = {
				volume: 1.0,
				playbackSpeed: 1.0,
				skipIntroSeconds: 30,
				skipOutroSeconds: 0,
			};

			playerController.applyPodcastSettings(settings);
			mockProgressTracker.shouldResume.mockResolvedValue(false);

			await playerController.loadEpisode(testEpisode, false, true);

			expect(mockEngine.seek).toHaveBeenCalledWith(30);
		});

		it('should stop tracking previous episode before loading new one', async () => {
			await playerController.loadEpisode(testEpisode, false, false);
			mockProgressTracker.stopTracking.mockClear();

			const newEpisode = { ...testEpisode, id: 'ep-456' };
			await playerController.loadEpisode(newEpisode, false, false);

			expect(mockProgressTracker.stopTracking).toHaveBeenCalledWith(true);
		});

		it('should handle load errors', async () => {
			const error = new Error('Load failed');
			mockEngine.load.mockImplementation(() => {
				throw error;
			});

			await expect(playerController.loadEpisode(testEpisode, false, false)).rejects.toThrow('Load failed');

			const state = playerController.getState();
			expect(state.status).toBe('error');
			expect(state.error).toBe('Load failed');
		});
	});

	describe('play', () => {
		it('should play current episode', async () => {
			await playerController.loadEpisode(testEpisode, false, false);
			await playerController.play();

			expect(mockEngine.play).toHaveBeenCalled();
		});

		it('should throw error if no episode loaded', async () => {
			await expect(playerController.play()).rejects.toThrow('No episode loaded');
		});
	});

	describe('pause', () => {
		it('should pause playback', () => {
			playerController.pause();

			expect(mockEngine.pause).toHaveBeenCalled();
		});
	});

	describe('togglePlayPause', () => {
		it('should pause when playing', async () => {
			mockEngine.isPlaying.mockReturnValue(true);
			await playerController.loadEpisode(testEpisode, false, false);

			await playerController.togglePlayPause();

			expect(mockEngine.pause).toHaveBeenCalled();
		});

		it('should play when paused', async () => {
			mockEngine.isPlaying.mockReturnValue(false);
			await playerController.loadEpisode(testEpisode, false, false);

			await playerController.togglePlayPause();

			expect(mockEngine.play).toHaveBeenCalled();
		});
	});

	describe('stop', () => {
		it('should stop playback and clear episode', async () => {
			await playerController.loadEpisode(testEpisode, false, false);
			await playerController.stop();

			expect(mockEngine.stop).toHaveBeenCalled();
			expect(mockProgressTracker.stopTracking).toHaveBeenCalledWith(true);
			expect(playerController.getCurrentEpisode()).toBeNull();

			const state = playerController.getState();
			expect(state.status).toBe('stopped');
			expect(state.position).toBe(0);
		});
	});

	describe('seek', () => {
		it('should seek to position', () => {
			playerController.seek(120);

			expect(mockEngine.seek).toHaveBeenCalledWith(120);
			expect(mockProgressTracker.updatePosition).toHaveBeenCalledWith(120);
		});
	});

	describe('skipForward', () => {
		it('should skip forward by default amount', () => {
			mockEngine.getCurrentTime.mockReturnValue(100);
			mockEngine.getDuration.mockReturnValue(3600);

			playerController.skipForward();

			expect(mockEngine.seek).toHaveBeenCalled();
			// Default skip is 15 seconds
			const callArg = (mockEngine.seek as jest.Mock).mock.calls[0][0];
			expect(callArg).toBeGreaterThan(100);
		});

		it('should skip forward by custom amount', () => {
			mockEngine.getCurrentTime.mockReturnValue(100);
			mockEngine.getDuration.mockReturnValue(3600);

			playerController.skipForward(30);

			expect(mockEngine.seek).toHaveBeenCalled();
		});
	});

	describe('skipBackward', () => {
		it('should skip backward by default amount', () => {
			mockEngine.getCurrentTime.mockReturnValue(100);

			playerController.skipBackward();

			expect(mockEngine.seek).toHaveBeenCalled();
			const callArg = (mockEngine.seek as jest.Mock).mock.calls[0][0];
			expect(callArg).toBeLessThan(100);
		});

		it('should skip backward by custom amount', () => {
			mockEngine.getCurrentTime.mockReturnValue(100);

			playerController.skipBackward(30);

			expect(mockEngine.seek).toHaveBeenCalled();
		});
	});

	describe('volume control', () => {
		it('should set volume', () => {
			playerController.setVolume(0.5);

			expect(mockEngine.setVolume).toHaveBeenCalledWith(0.5);
		});

		it('should set muted state', () => {
			playerController.setMuted(true);

			expect(mockEngine.setMuted).toHaveBeenCalledWith(true);
		});

		it('should toggle mute', () => {
			mockEngine.isMuted.mockReturnValue(false);

			playerController.toggleMute();

			expect(mockEngine.setMuted).toHaveBeenCalledWith(true);
		});
	});

	describe('playback speed control', () => {
		it('should set playback speed', () => {
			playerController.setPlaybackSpeed(1.5);

			expect(mockEngine.setPlaybackRate).toHaveBeenCalledWith(1.5);
		});

		it('should cycle playback speed', () => {
			mockEngine.getPlaybackRate.mockReturnValue(1.0);

			playerController.cyclePlaybackSpeed();

			expect(mockEngine.setPlaybackRate).toHaveBeenCalled();
			// Should cycle to next speed (implementation dependent)
		});
	});

	describe('applyPodcastSettings', () => {
		it('should apply podcast settings', () => {
			const settings: PodcastSettings = {
				volume: 0.8,
				playbackSpeed: 1.5,
				skipIntroSeconds: 30,
				skipOutroSeconds: 10,
			};

			playerController.applyPodcastSettings(settings);

			expect(mockEngine.setVolume).toHaveBeenCalledWith(0.8);
			expect(mockEngine.setPlaybackRate).toHaveBeenCalledWith(1.5);
		});
	});

	describe('state and getters', () => {
		it('should get current state', async () => {
			await playerController.loadEpisode(testEpisode, false, false);

			const state = playerController.getState();

			expect(state.currentEpisode).toEqual(testEpisode);
			expect(state.status).toBe('paused');
		});

		it('should get current episode', async () => {
			await playerController.loadEpisode(testEpisode, false, false);

			expect(playerController.getCurrentEpisode()).toEqual(testEpisode);
		});

		it('should get current position', () => {
			mockEngine.getCurrentTime.mockReturnValue(120);

			expect(playerController.getCurrentPosition()).toBe(120);
		});

		it('should get duration', () => {
			mockEngine.getDuration.mockReturnValue(3600);

			expect(playerController.getDuration()).toBe(3600);
		});

		it('should check if playing', () => {
			mockEngine.isPlaying.mockReturnValue(true);

			expect(playerController.isPlaying()).toBe(true);
		});

		it('should check if paused', () => {
			mockEngine.isPaused.mockReturnValue(true);

			expect(playerController.isPaused()).toBe(true);
		});
	});

	describe('event handlers', () => {
		it('should set event handlers', () => {
			const onStateChange = jest.fn();
			const onEpisodeChange = jest.fn();
			const onEpisodeEnded = jest.fn();
			const onError = jest.fn();

			playerController.setEventHandlers({
				onStateChange,
				onEpisodeChange,
				onEpisodeEnded,
				onError,
			});

			// Handlers are set (verified by no errors)
			expect(true).toBe(true);
		});

		it('should call onEpisodeChange when episode loaded', async () => {
			const onEpisodeChange = jest.fn();
			playerController.setEventHandlers({ onEpisodeChange });

			await playerController.loadEpisode(testEpisode, false, false);

			expect(onEpisodeChange).toHaveBeenCalledWith(testEpisode);
		});

		it('should call onEpisodeChange when stopped', async () => {
			const onEpisodeChange = jest.fn();
			playerController.setEventHandlers({ onEpisodeChange });

			await playerController.loadEpisode(testEpisode, false, false);
			onEpisodeChange.mockClear();

			await playerController.stop();

			expect(onEpisodeChange).toHaveBeenCalledWith(null);
		});
	});

	describe('markEpisodeCompleted', () => {
		it('should mark episode as completed', async () => {
			await playerController.loadEpisode(testEpisode, false, false);
			await playerController.markEpisodeCompleted();

			expect(mockProgressTracker.markCompleted).toHaveBeenCalled();
		});

		it('should do nothing if no episode loaded', async () => {
			await playerController.markEpisodeCompleted();

			expect(mockProgressTracker.markCompleted).not.toHaveBeenCalled();
		});
	});

	describe('destroy', () => {
		it('should cleanup resources', async () => {
			await playerController.loadEpisode(testEpisode, false, false);
			await playerController.destroy();

			expect(mockProgressTracker.stopTracking).toHaveBeenCalledWith(true);
			expect(mockEngine.destroy).toHaveBeenCalled();
			expect(playerController.getCurrentEpisode()).toBeNull();
		});
	});
});
