/**
 * Unit tests for audioUtils
 */

import {
	validatePlaybackSpeed,
	validateVolume,
	PLAYBACK_SPEED_PRESETS,
	getNextPlaybackSpeed,
	getPreviousPlaybackSpeed,
	formatPlaybackSpeed,
	isAudioFormatSupported,
	getSupportedAudioFormats,
	getAudioExtension,
	guessMimeType,
	SKIP_INTERVALS,
	skipForward,
	skipBackward,
	isEpisodeCompleted,
	normalizeVolume,
	volumeToPercentage,
} from '../audioUtils';

// Mock document for audio element
const mockCanPlayType = jest.fn();
global.document = {
	createElement: jest.fn().mockReturnValue({
		canPlayType: mockCanPlayType,
	}),
} as any;

describe('audioUtils', () => {
	describe('validatePlaybackSpeed', () => {
		it('should clamp speed to minimum 0.5', () => {
			expect(validatePlaybackSpeed(0.1)).toBe(0.5);
			expect(validatePlaybackSpeed(0.5)).toBe(0.5);
		});

		it('should clamp speed to maximum 3.0', () => {
			expect(validatePlaybackSpeed(5.0)).toBe(3.0);
			expect(validatePlaybackSpeed(3.0)).toBe(3.0);
		});

		it('should allow valid speeds', () => {
			expect(validatePlaybackSpeed(1.0)).toBe(1.0);
			expect(validatePlaybackSpeed(1.5)).toBe(1.5);
			expect(validatePlaybackSpeed(2.0)).toBe(2.0);
		});
	});

	describe('validateVolume', () => {
		it('should clamp volume to minimum 0.0', () => {
			expect(validateVolume(-0.5)).toBe(0.0);
			expect(validateVolume(0.0)).toBe(0.0);
		});

		it('should clamp volume to maximum 1.0', () => {
			expect(validateVolume(1.5)).toBe(1.0);
			expect(validateVolume(1.0)).toBe(1.0);
		});

		it('should allow valid volumes', () => {
			expect(validateVolume(0.5)).toBe(0.5);
			expect(validateVolume(0.75)).toBe(0.75);
		});
	});

	describe('getNextPlaybackSpeed', () => {
		it('should return next speed from presets', () => {
			expect(getNextPlaybackSpeed(1.0)).toBe(1.25);
			expect(getNextPlaybackSpeed(1.5)).toBe(1.75);
		});

		it('should wrap to first preset when at maximum', () => {
			expect(getNextPlaybackSpeed(3.0)).toBe(0.5);
			expect(getNextPlaybackSpeed(10.0)).toBe(0.5);
		});

		it('should handle speeds between presets', () => {
			expect(getNextPlaybackSpeed(1.1)).toBe(1.25);
			expect(getNextPlaybackSpeed(1.6)).toBe(1.75);
		});
	});

	describe('getPreviousPlaybackSpeed', () => {
		it('should return previous speed from presets', () => {
			expect(getPreviousPlaybackSpeed(1.25)).toBe(1.0);
			expect(getPreviousPlaybackSpeed(2.0)).toBe(1.75);
		});

		it('should wrap to last preset when at minimum', () => {
			expect(getPreviousPlaybackSpeed(0.5)).toBe(3.0);
			expect(getPreviousPlaybackSpeed(0.1)).toBe(3.0);
		});

		it('should handle speeds between presets', () => {
			expect(getPreviousPlaybackSpeed(1.1)).toBe(1.0);
			expect(getPreviousPlaybackSpeed(1.6)).toBe(1.5);
		});
	});

	describe('formatPlaybackSpeed', () => {
		it('should format normal speed as "Normal"', () => {
			expect(formatPlaybackSpeed(1.0)).toBe('Normal');
		});

		it('should format other speeds with x suffix', () => {
			expect(formatPlaybackSpeed(0.5)).toBe('0.50x');
			expect(formatPlaybackSpeed(1.5)).toBe('1.50x');
			expect(formatPlaybackSpeed(2.0)).toBe('2.00x');
		});
	});

	describe('isAudioFormatSupported', () => {
		beforeEach(() => {
			mockCanPlayType.mockClear();
		});

		it('should return true for supported formats', () => {
			mockCanPlayType.mockReturnValue('probably');

			expect(isAudioFormatSupported('audio/mpeg')).toBe(true);
		});

		it('should return false for unsupported formats', () => {
			mockCanPlayType.mockReturnValue('');

			expect(isAudioFormatSupported('audio/unknown')).toBe(false);
		});

		it('should create audio element', () => {
			mockCanPlayType.mockReturnValue('maybe');

			isAudioFormatSupported('audio/mp4');

			expect(document.createElement).toHaveBeenCalledWith('audio');
		});
	});

	describe('getSupportedAudioFormats', () => {
		it('should return list of supported formats', () => {
			mockCanPlayType.mockImplementation((type: string) => {
				const supported = ['audio/mpeg', 'audio/mp4', 'audio/ogg'];
				return supported.includes(type) ? 'probably' : '';
			});

			const formats = getSupportedAudioFormats();

			expect(formats).toContain('audio/mpeg');
			expect(formats).toContain('audio/mp4');
			expect(formats).toContain('audio/ogg');
			expect(formats).not.toContain('audio/wav');
		});
	});

	describe('getAudioExtension', () => {
		it('should extract extension from URL', () => {
			expect(getAudioExtension('https://example.com/audio.mp3')).toBe('mp3');
			expect(getAudioExtension('https://example.com/podcast/episode.m4a')).toBe('m4a');
		});

		it('should handle URLs with query parameters', () => {
			expect(getAudioExtension('https://example.com/audio.mp3?id=123')).toBe('mp3');
		});

		it('should return null for URLs without extension', () => {
			expect(getAudioExtension('https://example.com/audio')).toBe(null);
			expect(getAudioExtension('https://example.com/')).toBe(null);
		});

		it('should return null for invalid URLs', () => {
			expect(getAudioExtension('not-a-url')).toBe(null);
		});
	});

	describe('guessMimeType', () => {
		it('should guess MIME type from extension', () => {
			expect(guessMimeType('mp3')).toBe('audio/mpeg');
			expect(guessMimeType('m4a')).toBe('audio/mp4');
			expect(guessMimeType('ogg')).toBe('audio/ogg');
		});

		it('should handle extensions with dot prefix', () => {
			expect(guessMimeType('.mp3')).toBe('audio/mpeg');
			expect(guessMimeType('.m4a')).toBe('audio/mp4');
		});

		it('should be case insensitive', () => {
			expect(guessMimeType('MP3')).toBe('audio/mpeg');
			expect(guessMimeType('M4A')).toBe('audio/mp4');
		});

		it('should return null for unknown extensions', () => {
			expect(guessMimeType('xyz')).toBe(null);
			expect(guessMimeType('unknown')).toBe(null);
		});
	});

	describe('skipForward', () => {
		it('should skip forward by default amount', () => {
			expect(skipForward(100, 300)).toBe(115);
		});

		it('should skip forward by custom amount', () => {
			expect(skipForward(100, 300, 30)).toBe(130);
		});

		it('should clamp to duration', () => {
			expect(skipForward(290, 300)).toBe(300);
			expect(skipForward(290, 300, 30)).toBe(300);
		});

		it('should work with SKIP_INTERVALS', () => {
			expect(skipForward(100, 300, SKIP_INTERVALS.SHORT)).toBe(115);
			expect(skipForward(100, 300, SKIP_INTERVALS.MEDIUM)).toBe(130);
			expect(skipForward(100, 300, SKIP_INTERVALS.LONG)).toBe(160);
		});
	});

	describe('skipBackward', () => {
		it('should skip backward by default amount', () => {
			expect(skipBackward(100)).toBe(85);
		});

		it('should skip backward by custom amount', () => {
			expect(skipBackward(100, 30)).toBe(70);
		});

		it('should clamp to 0', () => {
			expect(skipBackward(10)).toBe(0);
			expect(skipBackward(10, 30)).toBe(0);
		});

		it('should work with SKIP_INTERVALS', () => {
			expect(skipBackward(100, SKIP_INTERVALS.SHORT)).toBe(85);
			expect(skipBackward(100, SKIP_INTERVALS.MEDIUM)).toBe(70);
			expect(skipBackward(100, SKIP_INTERVALS.LONG)).toBe(40);
		});
	});

	describe('isEpisodeCompleted', () => {
		it('should return true when within default threshold', () => {
			expect(isEpisodeCompleted(3570, 3600)).toBe(true); // 30 seconds from end
			expect(isEpisodeCompleted(3590, 3600)).toBe(true); // 10 seconds from end
		});

		it('should return false when beyond default threshold', () => {
			expect(isEpisodeCompleted(3500, 3600)).toBe(false); // 100 seconds from end
		});

		it('should work with custom threshold', () => {
			expect(isEpisodeCompleted(3590, 3600, 10)).toBe(true); // 10 seconds threshold
			expect(isEpisodeCompleted(3570, 3600, 10)).toBe(false); // 30 seconds from end
		});

		it('should return false for zero duration', () => {
			expect(isEpisodeCompleted(0, 0)).toBe(false);
		});

		it('should return false for negative duration', () => {
			expect(isEpisodeCompleted(100, -100)).toBe(false);
		});
	});

	describe('normalizeVolume', () => {
		it('should normalize from 0-100 scale', () => {
			expect(normalizeVolume(50)).toBe(0.5);
			expect(normalizeVolume(75)).toBe(0.75);
			expect(normalizeVolume(100)).toBe(1.0);
		});

		it('should normalize from custom scale', () => {
			expect(normalizeVolume(5, 10)).toBe(0.5);
			expect(normalizeVolume(50, 200)).toBe(0.25);
		});

		it('should clamp to valid range', () => {
			expect(normalizeVolume(150)).toBe(1.0);
			expect(normalizeVolume(-50)).toBe(0.0);
		});
	});

	describe('volumeToPercentage', () => {
		it('should convert volume to percentage', () => {
			expect(volumeToPercentage(0.5)).toBe(50);
			expect(volumeToPercentage(0.75)).toBe(75);
			expect(volumeToPercentage(1.0)).toBe(100);
		});

		it('should round to integer', () => {
			expect(volumeToPercentage(0.555)).toBe(56);
			expect(volumeToPercentage(0.444)).toBe(44);
		});
	});
});
