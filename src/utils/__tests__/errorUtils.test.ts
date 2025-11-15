/**
 * Unit tests for errorUtils
 */

import {
	PodcastPlayerError,
	FeedParseError,
	NetworkError,
	AudioPlaybackError,
	StorageError,
	handleError,
	getErrorMessage,
	isNetworkError,
	withErrorHandling,
	retryWithBackoff,
	sleep,
	safeJsonParse,
	assertDefined,
} from '../errorUtils';
import { Notice } from 'obsidian';

// Mock logger
jest.mock('../Logger', () => ({
	logger: {
		error: jest.fn(),
		warn: jest.fn(),
	},
}));

// Mock Notice
jest.mock('obsidian', () => ({
	Notice: jest.fn(),
}));

import { logger } from '../Logger';

describe('errorUtils', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('Custom Error Classes', () => {
		describe('PodcastPlayerError', () => {
			it('should create error with message and code', () => {
				const error = new PodcastPlayerError('Test error', 'TEST_CODE');
				expect(error.message).toBe('Test error');
				expect(error.code).toBe('TEST_CODE');
				expect(error.name).toBe('PodcastPlayerError');
				expect(error).toBeInstanceOf(Error);
			});

			it('should create error without code', () => {
				const error = new PodcastPlayerError('Test error');
				expect(error.message).toBe('Test error');
				expect(error.code).toBeUndefined();
			});
		});

		describe('FeedParseError', () => {
			it('should create error with feed URL', () => {
				const error = new FeedParseError('Parse failed', 'https://example.com/feed.rss');
				expect(error.message).toBe('Parse failed');
				expect(error.feedUrl).toBe('https://example.com/feed.rss');
				expect(error.code).toBe('FEED_PARSE_ERROR');
				expect(error.name).toBe('FeedParseError');
			});

			it('should create error with cause', () => {
				const cause = new Error('Original error');
				const error = new FeedParseError('Parse failed', 'https://example.com/feed.rss', cause);
				expect(error.cause).toBe(cause);
			});
		});

		describe('NetworkError', () => {
			it('should create error with URL', () => {
				const error = new NetworkError('Connection failed', 'https://example.com');
				expect(error.message).toBe('Connection failed');
				expect(error.url).toBe('https://example.com');
				expect(error.code).toBe('NETWORK_ERROR');
				expect(error.name).toBe('NetworkError');
			});

			it('should create error with cause', () => {
				const cause = new Error('Timeout');
				const error = new NetworkError('Connection failed', 'https://example.com', cause);
				expect(error.cause).toBe(cause);
			});
		});

		describe('AudioPlaybackError', () => {
			it('should create error with audio URL', () => {
				const error = new AudioPlaybackError('Playback failed', 'https://example.com/audio.mp3');
				expect(error.message).toBe('Playback failed');
				expect(error.audioUrl).toBe('https://example.com/audio.mp3');
				expect(error.code).toBe('AUDIO_PLAYBACK_ERROR');
				expect(error.name).toBe('AudioPlaybackError');
			});

			it('should create error without audio URL', () => {
				const error = new AudioPlaybackError('Playback failed');
				expect(error.audioUrl).toBeUndefined();
			});
		});

		describe('StorageError', () => {
			it('should create error with path', () => {
				const error = new StorageError('Save failed', '/path/to/file.json');
				expect(error.message).toBe('Save failed');
				expect(error.path).toBe('/path/to/file.json');
				expect(error.code).toBe('STORAGE_ERROR');
				expect(error.name).toBe('StorageError');
			});

			it('should create error without path', () => {
				const error = new StorageError('Save failed');
				expect(error.path).toBeUndefined();
			});
		});
	});

	describe('handleError', () => {
		it('should log Error object', () => {
			const error = new Error('Test error');
			handleError(error, undefined, false);

			expect(logger.error).toHaveBeenCalledWith('Test error', error);
			expect(Notice).not.toHaveBeenCalled();
		});

		it('should log unknown error', () => {
			handleError('string error', undefined, false);

			expect(logger.error).toHaveBeenCalledWith('Unknown error occurred', 'string error');
		});

		it('should show notice with custom message', () => {
			const error = new Error('Test error');
			handleError(error, 'Custom message');

			expect(Notice).toHaveBeenCalledWith('Podcast Player: Custom message');
		});

		it('should show notice with error message', () => {
			const error = new Error('Test error');
			handleError(error);

			expect(Notice).toHaveBeenCalledWith('Podcast Player: Test error');
		});

		it('should not show notice if showNotice is false', () => {
			const error = new Error('Test error');
			handleError(error, 'Message', false);

			expect(Notice).not.toHaveBeenCalled();
		});
	});

	describe('getErrorMessage', () => {
		it('should return message from PodcastPlayerError', () => {
			const error = new PodcastPlayerError('Custom error');
			expect(getErrorMessage(error)).toBe('Custom error');
		});

		it('should return message from Error', () => {
			const error = new Error('Standard error');
			expect(getErrorMessage(error)).toBe('Standard error');
		});

		it('should return string error', () => {
			expect(getErrorMessage('String error')).toBe('String error');
		});

		it('should return default message for unknown error', () => {
			expect(getErrorMessage({})).toBe('An unknown error occurred');
			expect(getErrorMessage(123)).toBe('An unknown error occurred');
			expect(getErrorMessage(null)).toBe('An unknown error occurred');
		});
	});

	describe('isNetworkError', () => {
		it('should return true for NetworkError', () => {
			const error = new NetworkError('Connection failed', 'https://example.com');
			expect(isNetworkError(error)).toBe(true);
		});

		it('should return true for Error with network keywords', () => {
			expect(isNetworkError(new Error('Network error occurred'))).toBe(true);
			expect(isNetworkError(new Error('Fetch failed'))).toBe(true);
			expect(isNetworkError(new Error('Connection timeout'))).toBe(true);
			expect(isNetworkError(new Error('Lost connection'))).toBe(true);
		});

		it('should return false for other errors', () => {
			expect(isNetworkError(new Error('File not found'))).toBe(false);
			expect(isNetworkError(new Error('Parse error'))).toBe(false);
		});

		it('should return false for non-Error values', () => {
			expect(isNetworkError('network error')).toBe(false);
			expect(isNetworkError({})).toBe(false);
			expect(isNetworkError(null)).toBe(false);
		});
	});

	describe('withErrorHandling', () => {
		it('should execute function successfully', async () => {
			const fn = jest.fn().mockResolvedValue('success');
			const wrapped = withErrorHandling(fn);

			const result = await wrapped('arg1', 'arg2');

			expect(result).toBe('success');
			expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
			expect(logger.error).not.toHaveBeenCalled();
		});

		it('should handle error and re-throw', async () => {
			const error = new Error('Test error');
			const fn = jest.fn().mockRejectedValue(error);
			const wrapped = withErrorHandling(fn, 'Custom error message');

			await expect(wrapped()).rejects.toThrow(error);
			expect(logger.error).toHaveBeenCalled();
			expect(Notice).toHaveBeenCalledWith('Podcast Player: Custom error message');
		});

		it('should preserve function signature', async () => {
			const fn = async (a: number, b: string): Promise<string> => {
				return `${a}-${b}`;
			};
			const wrapped = withErrorHandling(fn);

			const result = await wrapped(42, 'test');
			expect(result).toBe('42-test');
		});
	});

	describe('retryWithBackoff', () => {
		it('should succeed on first attempt', async () => {
			const fn = jest.fn().mockResolvedValue('success');

			const result = await retryWithBackoff(fn);

			expect(result).toBe('success');
			expect(fn).toHaveBeenCalledTimes(1);
		});

		it('should retry on failure and eventually succeed', async () => {
			const fn = jest
				.fn()
				.mockRejectedValueOnce(new Error('Attempt 1'))
				.mockRejectedValueOnce(new Error('Attempt 2'))
				.mockResolvedValue('success');

			const result = await retryWithBackoff(fn, { maxRetries: 3, initialDelay: 10 });

			expect(result).toBe('success');
			expect(fn).toHaveBeenCalledTimes(3);
			expect(logger.warn).toHaveBeenCalledTimes(2);
		});

		it('should throw after max retries', async () => {
			const error = new Error('Persistent error');
			const fn = jest.fn().mockRejectedValue(error);

			await expect(retryWithBackoff(fn, { maxRetries: 2, initialDelay: 10 })).rejects.toThrow(error);
			expect(fn).toHaveBeenCalledTimes(3); // Initial + 2 retries
		});

		it('should use exponential backoff', async () => {
			const fn = jest
				.fn()
				.mockRejectedValueOnce(new Error('Attempt 1'))
				.mockResolvedValue('success');

			const startTime = Date.now();
			await retryWithBackoff(fn, { maxRetries: 1, initialDelay: 50, backoffMultiplier: 2 });
			const elapsed = Date.now() - startTime;

			// Should wait at least 50ms for first retry
			expect(elapsed).toBeGreaterThanOrEqual(40); // Allow some margin
			expect(fn).toHaveBeenCalledTimes(2);
		});
	});

	describe('sleep', () => {
		beforeEach(() => {
			jest.useFakeTimers();
		});

		afterEach(() => {
			jest.useRealTimers();
		});

		it('should resolve after specified time', async () => {
			const callback = jest.fn();
			const promise = sleep(1000).then(callback);

			expect(callback).not.toHaveBeenCalled();

			jest.advanceTimersByTime(1000);
			await promise;

			expect(callback).toHaveBeenCalled();
		});

		it('should not resolve before specified time', async () => {
			const callback = jest.fn();
			sleep(1000).then(callback);

			jest.advanceTimersByTime(500);
			await Promise.resolve();

			expect(callback).not.toHaveBeenCalled();
		});
	});

	describe('safeJsonParse', () => {
		it('should parse valid JSON', () => {
			const json = '{"name":"test","value":42}';
			const result = safeJsonParse(json, {});

			expect(result).toEqual({ name: 'test', value: 42 });
			expect(logger.warn).not.toHaveBeenCalled();
		});

		it('should return fallback for invalid JSON', () => {
			const fallback = { default: true };
			const result = safeJsonParse('invalid json', fallback);

			expect(result).toBe(fallback);
			expect(logger.warn).toHaveBeenCalled();
		});

		it('should handle null and undefined fallback', () => {
			expect(safeJsonParse('invalid', null)).toBeNull();
			expect(safeJsonParse('invalid', undefined)).toBeUndefined();
		});

		it('should preserve types', () => {
			interface TestData {
				id: string;
				count: number;
			}

			const json = '{"id":"test","count":10}';
			const fallback: TestData = { id: 'default', count: 0 };
			const result = safeJsonParse<TestData>(json, fallback);

			expect(result.id).toBe('test');
			expect(result.count).toBe(10);
		});
	});

	describe('assertDefined', () => {
		it('should not throw for defined values', () => {
			expect(() => assertDefined('value')).not.toThrow();
			expect(() => assertDefined(0)).not.toThrow();
			expect(() => assertDefined(false)).not.toThrow();
			expect(() => assertDefined([])).not.toThrow();
			expect(() => assertDefined({})).not.toThrow();
		});

		it('should throw for null', () => {
			expect(() => assertDefined(null)).toThrow(PodcastPlayerError);
			expect(() => assertDefined(null)).toThrow('Value is required');
		});

		it('should throw for undefined', () => {
			expect(() => assertDefined(undefined)).toThrow(PodcastPlayerError);
			expect(() => assertDefined(undefined)).toThrow('Value is required');
		});

		it('should throw with custom message', () => {
			expect(() => assertDefined(null, 'Custom error message')).toThrow('Custom error message');
		});

		it('should work as type guard', () => {
			const value: string | null = 'test';
			assertDefined(value);
			// After assertion, TypeScript should know value is string
			const length: number = value.length;
			expect(length).toBe(4);
		});
	});
});
