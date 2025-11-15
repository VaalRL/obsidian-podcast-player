/**
 * Unit tests for PlaybackEngine
 */

import { PlaybackEngine, PlaybackStatus, AudioMetadata, PlaybackEventHandlers } from '../PlaybackEngine';
import { AudioPlaybackError } from '../../utils/errorUtils';

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

// Mock audioUtils
jest.mock('../../utils/audioUtils', () => ({
	validateVolume: jest.fn((vol) => Math.max(0, Math.min(1, vol))),
	validatePlaybackSpeed: jest.fn((speed) => Math.max(0.5, Math.min(3, speed))),
}));

// Mock window object for timer functions
global.window = {
	setInterval: jest.fn((callback, delay) => setInterval(callback, delay)),
	clearInterval: jest.fn((id) => clearInterval(id)),
} as any;

// Mock HTMLAudioElement
class MockAudioElement {
	src = '';
	volume = 1.0;
	playbackRate = 1.0;
	muted = false;
	currentTime = 0;
	duration = NaN;
	preload = '';
	buffered = {
		length: 0,
		start: jest.fn(),
		end: jest.fn(),
	};
	error: MediaError | null = null;

	private eventListeners: Map<string, ((event?: any) => void)[]> = new Map();

	addEventListener(event: string, handler: (event?: any) => void): void {
		if (!this.eventListeners.has(event)) {
			this.eventListeners.set(event, []);
		}
		this.eventListeners.get(event)!.push(handler);
	}

	removeEventListener(event: string, handler: (event?: any) => void): void {
		const handlers = this.eventListeners.get(event);
		if (handlers) {
			const index = handlers.indexOf(handler);
			if (index !== -1) {
				handlers.splice(index, 1);
			}
		}
	}

	dispatchEvent(event: Event): boolean {
		const handlers = this.eventListeners.get(event.type);
		if (handlers) {
			handlers.forEach(handler => handler(event));
		}
		return true;
	}

	// Trigger event manually
	triggerEvent(eventType: string, eventData?: any): void {
		const handlers = this.eventListeners.get(eventType);
		if (handlers) {
			handlers.forEach(handler => handler(eventData));
		}
	}

	load = jest.fn();
	play = jest.fn().mockResolvedValue(undefined);
	pause = jest.fn();
}

// Replace global Audio constructor
global.Audio = MockAudioElement as any;

describe('PlaybackEngine', () => {
	let playbackEngine: PlaybackEngine;
	let mockAudio: MockAudioElement;

	beforeEach(() => {
		jest.clearAllMocks();
		jest.useFakeTimers();
		playbackEngine = new PlaybackEngine();
		// Get the audio element created by the engine
		mockAudio = (playbackEngine as any).audio as MockAudioElement;
	});

	afterEach(() => {
		playbackEngine.destroy();
		jest.useRealTimers();
	});

	describe('constructor', () => {
		it('should initialize with idle status', () => {
			expect(playbackEngine.getStatus()).toBe('idle');
		});

		it('should create audio element', () => {
			expect(mockAudio).toBeDefined();
			expect(mockAudio.preload).toBe('metadata');
		});
	});

	describe('load', () => {
		const testUrl = 'https://example.com/audio.mp3';

		it('should load audio from URL', async () => {
			await playbackEngine.load(testUrl);

			expect(mockAudio.src).toBe(testUrl);
			expect(mockAudio.load).toHaveBeenCalled();
		});

		it('should pause current playback before loading', async () => {
			// Start playing
			await playbackEngine.load(testUrl);
			mockAudio.triggerEvent('play');

			// Load new audio
			const newUrl = 'https://example.com/audio2.mp3';
			await playbackEngine.load(newUrl);

			expect(mockAudio.pause).toHaveBeenCalled();
		});

		it('should trigger loadstart event', async () => {
			const onLoadStart = jest.fn();
			playbackEngine.setEventHandlers({ onLoadStart });

			await playbackEngine.load(testUrl);
			mockAudio.triggerEvent('loadstart');

			expect(onLoadStart).toHaveBeenCalled();
			expect(playbackEngine.getStatus()).toBe('loading');
		});
	});

	describe('play', () => {
		const testUrl = 'https://example.com/audio.mp3';

		it('should play audio', async () => {
			await playbackEngine.load(testUrl);
			await playbackEngine.play();

			expect(mockAudio.play).toHaveBeenCalled();
		});

		it('should throw error if no audio loaded', async () => {
			await expect(playbackEngine.play()).rejects.toThrow(AudioPlaybackError);
		});

		it('should trigger onPlay event handler', async () => {
			const onPlay = jest.fn();
			playbackEngine.setEventHandlers({ onPlay });

			await playbackEngine.load(testUrl);
			await playbackEngine.play();
			mockAudio.triggerEvent('play');

			expect(onPlay).toHaveBeenCalled();
			expect(playbackEngine.getStatus()).toBe('playing');
		});

		it('should start progress tracking on play', async () => {
			const onTimeUpdate = jest.fn();
			playbackEngine.setEventHandlers({ onTimeUpdate });

			await playbackEngine.load(testUrl);
			await playbackEngine.play();
			mockAudio.triggerEvent('play');

			expect(window.setInterval).toHaveBeenCalled();
		});

		it('should handle play errors', async () => {
			await playbackEngine.load(testUrl);
			mockAudio.play = jest.fn().mockRejectedValue(new Error('Play failed'));

			await expect(playbackEngine.play()).rejects.toThrow(AudioPlaybackError);
			expect(playbackEngine.getStatus()).toBe('error');
		});
	});

	describe('pause', () => {
		const testUrl = 'https://example.com/audio.mp3';

		it('should pause audio', async () => {
			await playbackEngine.load(testUrl);
			await playbackEngine.play();
			mockAudio.triggerEvent('play');

			playbackEngine.pause();

			expect(mockAudio.pause).toHaveBeenCalled();
		});

		it('should trigger onPause event handler', async () => {
			const onPause = jest.fn();
			playbackEngine.setEventHandlers({ onPause });

			await playbackEngine.load(testUrl);
			await playbackEngine.play();
			mockAudio.triggerEvent('play');

			playbackEngine.pause();
			mockAudio.triggerEvent('pause');

			expect(onPause).toHaveBeenCalled();
			expect(playbackEngine.getStatus()).toBe('paused');
		});

		it('should stop progress tracking on pause', async () => {
			await playbackEngine.load(testUrl);
			await playbackEngine.play();
			mockAudio.triggerEvent('play');

			playbackEngine.pause();
			mockAudio.triggerEvent('pause');

			expect(playbackEngine.getStatus()).toBe('paused');
		});
	});

	describe('stop', () => {
		const testUrl = 'https://example.com/audio.mp3';

		it('should stop audio and reset to beginning', async () => {
			await playbackEngine.load(testUrl);
			await playbackEngine.play();
			mockAudio.currentTime = 50;

			playbackEngine.stop();

			expect(mockAudio.pause).toHaveBeenCalled();
			expect(mockAudio.currentTime).toBe(0);
			expect(playbackEngine.getStatus()).toBe('idle');
		});
	});

	describe('seek', () => {
		const testUrl = 'https://example.com/audio.mp3';

		it('should seek to position', async () => {
			await playbackEngine.load(testUrl);
			mockAudio.duration = 100;

			playbackEngine.seek(50);

			expect(mockAudio.currentTime).toBe(50);
		});

		it('should clamp position to valid range', async () => {
			await playbackEngine.load(testUrl);
			mockAudio.duration = 100;

			playbackEngine.seek(-10);
			expect(mockAudio.currentTime).toBe(0);

			playbackEngine.seek(150);
			expect(mockAudio.currentTime).toBe(100);
		});

		it('should not seek if duration not available', async () => {
			await playbackEngine.load(testUrl);
			mockAudio.duration = NaN;
			mockAudio.currentTime = 0;

			playbackEngine.seek(50);

			expect(mockAudio.currentTime).toBe(0);
		});
	});

	describe('setVolume', () => {
		it('should set volume', () => {
			playbackEngine.setVolume(0.5);

			expect(mockAudio.volume).toBe(0.5);
		});

		it('should trigger onVolumeChange event handler', () => {
			const onVolumeChange = jest.fn();
			playbackEngine.setEventHandlers({ onVolumeChange });

			playbackEngine.setVolume(0.7);
			mockAudio.triggerEvent('volumechange');

			expect(onVolumeChange).toHaveBeenCalledWith(0.7, false);
		});
	});

	describe('setPlaybackRate', () => {
		it('should set playback rate', () => {
			playbackEngine.setPlaybackRate(1.5);

			expect(mockAudio.playbackRate).toBe(1.5);
		});

		it('should trigger onRateChange event handler', () => {
			const onRateChange = jest.fn();
			playbackEngine.setEventHandlers({ onRateChange });

			playbackEngine.setPlaybackRate(2.0);
			mockAudio.triggerEvent('ratechange');

			expect(onRateChange).toHaveBeenCalledWith(2.0);
		});
	});

	describe('setMuted', () => {
		it('should set muted state', () => {
			playbackEngine.setMuted(true);

			expect(mockAudio.muted).toBe(true);
		});

		it('should trigger onVolumeChange event handler', () => {
			const onVolumeChange = jest.fn();
			playbackEngine.setEventHandlers({ onVolumeChange });

			playbackEngine.setMuted(true);
			mockAudio.triggerEvent('volumechange');

			expect(onVolumeChange).toHaveBeenCalledWith(mockAudio.volume, true);
		});
	});

	describe('event handlers', () => {
		it('should set event handlers', () => {
			const handlers: PlaybackEventHandlers = {
				onPlay: jest.fn(),
				onPause: jest.fn(),
			};

			playbackEngine.setEventHandlers(handlers);

			mockAudio.triggerEvent('play');
			expect(handlers.onPlay).toHaveBeenCalled();
		});

		it('should merge event handlers', () => {
			const handler1 = { onPlay: jest.fn() };
			const handler2 = { onPause: jest.fn() };

			playbackEngine.setEventHandlers(handler1);
			playbackEngine.setEventHandlers(handler2);

			mockAudio.triggerEvent('play');
			mockAudio.triggerEvent('pause');

			expect(handler1.onPlay).toHaveBeenCalled();
			expect(handler2.onPause).toHaveBeenCalled();
		});

		it('should trigger onEnded event handler', () => {
			const onEnded = jest.fn();
			playbackEngine.setEventHandlers({ onEnded });

			mockAudio.triggerEvent('ended');

			expect(onEnded).toHaveBeenCalled();
			expect(playbackEngine.getStatus()).toBe('ended');
		});

		it('should trigger onTimeUpdate event handler', () => {
			const onTimeUpdate = jest.fn();
			playbackEngine.setEventHandlers({ onTimeUpdate });

			mockAudio.currentTime = 50;
			mockAudio.triggerEvent('timeupdate');

			expect(onTimeUpdate).toHaveBeenCalledWith(50);
		});

		it('should trigger onDurationChange event handler', () => {
			const onDurationChange = jest.fn();
			playbackEngine.setEventHandlers({ onDurationChange });

			mockAudio.duration = 200;
			mockAudio.triggerEvent('durationchange');

			expect(onDurationChange).toHaveBeenCalledWith(200);
		});

		it('should trigger onLoadedMetadata event handler', () => {
			const onLoadedMetadata = jest.fn();
			playbackEngine.setEventHandlers({ onLoadedMetadata });

			mockAudio.triggerEvent('loadedmetadata');

			expect(onLoadedMetadata).toHaveBeenCalled();
		});

		it('should trigger onCanPlay event handler', () => {
			const onCanPlay = jest.fn();
			playbackEngine.setEventHandlers({ onCanPlay });

			mockAudio.triggerEvent('canplay');

			expect(onCanPlay).toHaveBeenCalled();
		});

		it('should trigger onError event handler', () => {
			const onError = jest.fn();
			playbackEngine.setEventHandlers({ onError });

			mockAudio.error = {
				code: 4,
				message: 'Media not supported',
				MEDIA_ERR_ABORTED: 1,
				MEDIA_ERR_NETWORK: 2,
				MEDIA_ERR_DECODE: 3,
				MEDIA_ERR_SRC_NOT_SUPPORTED: 4,
			};

			mockAudio.triggerEvent('error');

			expect(onError).toHaveBeenCalled();
			expect(playbackEngine.getStatus()).toBe('error');
		});

		it('should trigger onProgress event handler', () => {
			const onProgress = jest.fn();
			playbackEngine.setEventHandlers({ onProgress });

			mockAudio.buffered = {
				length: 1,
				start: jest.fn(),
				end: jest.fn().mockReturnValue(50),
			};

			mockAudio.triggerEvent('progress');

			expect(onProgress).toHaveBeenCalledWith(50);
		});
	});

	describe('getters', () => {
		it('should get status', () => {
			expect(playbackEngine.getStatus()).toBe('idle');
		});

		it('should get metadata', () => {
			mockAudio.duration = 100;
			mockAudio.currentTime = 50;
			mockAudio.volume = 0.8;
			mockAudio.playbackRate = 1.5;
			mockAudio.muted = false;
			mockAudio.buffered = {
				length: 1,
				start: jest.fn(),
				end: jest.fn().mockReturnValue(60),
			};

			const metadata = playbackEngine.getMetadata();

			expect(metadata).toEqual({
				duration: 100,
				currentTime: 50,
				buffered: 60,
				volume: 0.8,
				playbackRate: 1.5,
				muted: false,
			});
		});

		it('should get current time', () => {
			mockAudio.currentTime = 75;

			expect(playbackEngine.getCurrentTime()).toBe(75);
		});

		it('should get duration', () => {
			mockAudio.duration = 200;

			expect(playbackEngine.getDuration()).toBe(200);
		});

		it('should get volume', () => {
			mockAudio.volume = 0.6;

			expect(playbackEngine.getVolume()).toBe(0.6);
		});

		it('should get playback rate', () => {
			mockAudio.playbackRate = 2.0;

			expect(playbackEngine.getPlaybackRate()).toBe(2.0);
		});

		it('should check if muted', () => {
			mockAudio.muted = true;

			expect(playbackEngine.isMuted()).toBe(true);
		});

		it('should check if playing', async () => {
			const testUrl = 'https://example.com/audio.mp3';
			await playbackEngine.load(testUrl);
			await playbackEngine.play();
			mockAudio.triggerEvent('play');

			expect(playbackEngine.isPlaying()).toBe(true);
		});

		it('should check if paused', async () => {
			const testUrl = 'https://example.com/audio.mp3';
			await playbackEngine.load(testUrl);
			await playbackEngine.play();
			mockAudio.triggerEvent('play');

			playbackEngine.pause();
			mockAudio.triggerEvent('pause');

			expect(playbackEngine.isPaused()).toBe(true);
		});

		it('should check if loading', async () => {
			const testUrl = 'https://example.com/audio.mp3';
			await playbackEngine.load(testUrl);
			mockAudio.triggerEvent('loadstart');

			expect(playbackEngine.isLoading()).toBe(true);
		});
	});

	describe('progress tracking', () => {
		const testUrl = 'https://example.com/audio.mp3';

		it('should emit periodic time updates while playing', async () => {
			const onTimeUpdate = jest.fn();
			playbackEngine.setEventHandlers({ onTimeUpdate });

			await playbackEngine.load(testUrl);
			await playbackEngine.play();
			mockAudio.triggerEvent('play');

			// Advance time
			jest.advanceTimersByTime(100);

			expect(window.setInterval).toHaveBeenCalledWith(expect.any(Function), 100);
		});

		it('should not emit updates when paused', async () => {
			const onTimeUpdate = jest.fn();
			playbackEngine.setEventHandlers({ onTimeUpdate });

			await playbackEngine.load(testUrl);
			await playbackEngine.play();
			mockAudio.triggerEvent('play');

			onTimeUpdate.mockClear();

			playbackEngine.pause();
			mockAudio.triggerEvent('pause');

			jest.advanceTimersByTime(200);

			// Should not have been called from interval (only from pause event)
			expect(onTimeUpdate).not.toHaveBeenCalled();
		});
	});

	describe('destroy', () => {
		it('should cleanup resources', async () => {
			const testUrl = 'https://example.com/audio.mp3';
			await playbackEngine.load(testUrl);
			await playbackEngine.play();
			mockAudio.triggerEvent('play');

			playbackEngine.destroy();

			expect(mockAudio.pause).toHaveBeenCalled();
			expect(mockAudio.src).toBe('');
			expect(mockAudio.load).toHaveBeenCalled();
			expect(playbackEngine.getStatus()).toBe('idle');
		});

		it('should stop progress tracking', async () => {
			const testUrl = 'https://example.com/audio.mp3';
			await playbackEngine.load(testUrl);
			await playbackEngine.play();
			mockAudio.triggerEvent('play');

			const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

			playbackEngine.destroy();

			expect(clearIntervalSpy).toHaveBeenCalled();
		});
	});
});
