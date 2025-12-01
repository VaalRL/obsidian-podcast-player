/**
 * Unit tests for timeUtils
 */

import {
	formatTime,
	formatDuration,
	parseTimeString,
	formatTimestamp,
	formatRelativeTime,
	formatDate,
	formatDateTime,
	calculateProgress,
	isToday,
	isWithinDays,
} from '../timeUtils';

describe('timeUtils', () => {
	describe('formatTime', () => {
		it('should format seconds as MM:SS', () => {
			expect(formatTime(0)).toBe('0:00');
			expect(formatTime(45)).toBe('0:45');
			expect(formatTime(90)).toBe('1:30');
			expect(formatTime(600)).toBe('10:00');
		});

		it('should format seconds as HH:MM:SS when hours present', () => {
			expect(formatTime(3600)).toBe('1:00:00');
			expect(formatTime(3665)).toBe('1:01:05');
			expect(formatTime(7200)).toBe('2:00:00');
		});

		it('should always show hours when requested', () => {
			expect(formatTime(90, true)).toBe('0:1:30');
			expect(formatTime(600, true)).toBe('0:10:00');
		});

		it('should handle invalid input', () => {
			expect(formatTime(Infinity)).toBe('0:00');
			expect(formatTime(-100)).toBe('0:00');
			expect(formatTime(NaN)).toBe('0:00');
		});
	});

	describe('formatDuration', () => {
		it('should format duration in short format', () => {
			expect(formatDuration(45)).toBe('45s');
			expect(formatDuration(90)).toBe('1m 30s');
			expect(formatDuration(3665)).toBe('1h 1m 5s');
		});

		it('should format duration in long format', () => {
			expect(formatDuration(1, false)).toBe('1 second');
			expect(formatDuration(2, false)).toBe('2 seconds');
			expect(formatDuration(60, false)).toBe('1 minute');
			expect(formatDuration(120, false)).toBe('2 minutes');
			expect(formatDuration(3600, false)).toBe('1 hour');
			expect(formatDuration(7200, false)).toBe('2 hours');
		});

		it('should handle zero seconds', () => {
			expect(formatDuration(0)).toBe('0s');
			expect(formatDuration(0, false)).toBe('0 second');
		});

		it('should handle invalid input', () => {
			expect(formatDuration(Infinity)).toBe('0s');
			expect(formatDuration(-100)).toBe('0s');
			expect(formatDuration(Infinity, false)).toBe('0 seconds');
		});

		it('should omit zero components', () => {
			expect(formatDuration(3600)).toBe('1h');
			expect(formatDuration(60)).toBe('1m');
		});
	});

	describe('parseTimeString', () => {
		it('should parse MM:SS format', () => {
			expect(parseTimeString('1:30')).toBe(90);
			expect(parseTimeString('10:00')).toBe(600);
			expect(parseTimeString('0:45')).toBe(45);
		});

		it('should parse HH:MM:SS format', () => {
			expect(parseTimeString('1:00:00')).toBe(3600);
			expect(parseTimeString('1:01:05')).toBe(3665);
			expect(parseTimeString('2:30:45')).toBe(9045);
		});

		it('should return null for invalid format', () => {
			expect(parseTimeString('invalid')).toBe(null);
			expect(parseTimeString('1')).toBe(null);
			expect(parseTimeString('1:2:3:4')).toBe(null);
			expect(parseTimeString('1:aa')).toBe(null);
		});
	});

	describe('formatTimestamp', () => {
		it('should format timestamp for markdown', () => {
			expect(formatTimestamp(90)).toBe('[1:30]');
			expect(formatTimestamp(3665)).toBe('[1:01:05]');
		});
	});

	describe('formatRelativeTime', () => {
		const now = new Date('2024-01-15T12:00:00');

		beforeAll(() => {
			jest.useFakeTimers();
			jest.setSystemTime(now);
		});

		afterAll(() => {
			jest.useRealTimers();
		});

		it('should format seconds as "just now"', () => {
			const date = new Date(now.getTime() - 30 * 1000); // 30 seconds ago
			expect(formatRelativeTime(date)).toBe('just now');
		});

		it('should format minutes', () => {
			const date1 = new Date(now.getTime() - 5 * 60 * 1000); // 5 minutes ago
			expect(formatRelativeTime(date1)).toBe('5 minutes ago');

			const date2 = new Date(now.getTime() - 1 * 60 * 1000); // 1 minute ago
			expect(formatRelativeTime(date2)).toBe('1 minute ago');
		});

		it('should format hours', () => {
			const date1 = new Date(now.getTime() - 3 * 60 * 60 * 1000); // 3 hours ago
			expect(formatRelativeTime(date1)).toBe('3 hours ago');

			const date2 = new Date(now.getTime() - 1 * 60 * 60 * 1000); // 1 hour ago
			expect(formatRelativeTime(date2)).toBe('1 hour ago');
		});

		it('should format days', () => {
			const date1 = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000); // 3 days ago
			expect(formatRelativeTime(date1)).toBe('3 days ago');

			const date2 = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000); // 1 day ago
			expect(formatRelativeTime(date2)).toBe('1 day ago');
		});

		it('should format weeks', () => {
			const date1 = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000); // 2 weeks ago
			expect(formatRelativeTime(date1)).toBe('2 weeks ago');

			const date2 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 1 week ago
			expect(formatRelativeTime(date2)).toBe('1 week ago');
		});

		it('should format months', () => {
			const date1 = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000); // ~2 months ago
			expect(formatRelativeTime(date1)).toBe('2 months ago');

			const date2 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // ~1 month ago
			expect(formatRelativeTime(date2)).toBe('1 month ago');
		});

		it('should format years', () => {
			const date1 = new Date(now.getTime() - 730 * 24 * 60 * 60 * 1000); // ~2 years ago
			expect(formatRelativeTime(date1)).toBe('2 years ago');

			const date2 = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000); // ~1 year ago
			expect(formatRelativeTime(date2)).toBe('1 year ago');
		});
	});

	describe('formatDate', () => {
		it('should format date in short format', () => {
			const date = new Date('2024-01-15T12:00:00');
			const formatted = formatDate(date);

			// Format may vary by locale, but should contain year, month, and day
			expect(formatted).toMatch(/2024/);
			// Month format varies by locale (Jan, 1月, janvier, etc.)
			expect(formatted).toMatch(/15/);
		});
	});

	describe('formatDateTime', () => {
		it('should format date and time', () => {
			const date = new Date('2024-01-15T14:30:00');
			const formatted = formatDateTime(date);

			// Format may vary by locale, but should contain date and time
			expect(formatted).toMatch(/2024/);
			// Month format varies by locale (Jan, 1月, janvier, etc.)
			expect(formatted).toMatch(/15/);
			// Time format varies by locale (12h vs 24h)
		});
	});

	describe('calculateProgress', () => {
		it('should calculate progress percentage', () => {
			expect(calculateProgress(0, 100)).toBe(0);
			expect(calculateProgress(50, 100)).toBe(50);
			expect(calculateProgress(100, 100)).toBe(100);
		});

		it('should clamp to 0-100 range', () => {
			expect(calculateProgress(-10, 100)).toBe(0);
			expect(calculateProgress(150, 100)).toBe(100);
		});

		it('should return 0 for zero total', () => {
			expect(calculateProgress(50, 0)).toBe(0);
		});

		it('should return 0 for negative total', () => {
			expect(calculateProgress(50, -100)).toBe(0);
		});
	});

	describe('isToday', () => {
		beforeAll(() => {
			jest.useFakeTimers();
			jest.setSystemTime(new Date('2024-01-15T12:00:00'));
		});

		afterAll(() => {
			jest.useRealTimers();
		});

		it('should return true for today', () => {
			const today = new Date('2024-01-15T08:00:00');
			expect(isToday(today)).toBe(true);
		});

		it('should return false for yesterday', () => {
			const yesterday = new Date('2024-01-14T12:00:00');
			expect(isToday(yesterday)).toBe(false);
		});

		it('should return false for tomorrow', () => {
			const tomorrow = new Date('2024-01-16T12:00:00');
			expect(isToday(tomorrow)).toBe(false);
		});
	});

	describe('isWithinDays', () => {
		const now = new Date('2024-01-15T12:00:00');

		beforeAll(() => {
			jest.useFakeTimers();
			jest.setSystemTime(now);
		});

		afterAll(() => {
			jest.useRealTimers();
		});

		it('should return true for dates within N days', () => {
			const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
			expect(isWithinDays(yesterday, 7)).toBe(true);

			const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
			expect(isWithinDays(threeDaysAgo, 7)).toBe(true);
		});

		it('should return false for dates beyond N days', () => {
			const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
			expect(isWithinDays(tenDaysAgo, 7)).toBe(false);
		});

		it('should work with exact boundary', () => {
			const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
			expect(isWithinDays(sevenDaysAgo, 7)).toBe(true);
		});
	});
});
