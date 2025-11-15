/**
 * Unit tests for TimestampFormatter
 */

import { TimestampFormatter, TimestampStyle } from '../TimestampFormatter';
import { Episode } from '../../model';

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

// Mock time utils
jest.mock('../../utils/timeUtils', () => ({
	formatTime: jest.fn((seconds: number, alwaysShowHours: boolean) => {
		const hours = Math.floor(seconds / 3600);
		const minutes = Math.floor((seconds % 3600) / 60);
		const secs = seconds % 60;

		if (alwaysShowHours || hours > 0) {
			return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
		}
		return `${minutes}:${secs.toString().padStart(2, '0')}`;
	}),
	formatTimestamp: jest.fn((seconds: number) => new Date(seconds * 1000).toISOString()),
}));

describe('TimestampFormatter', () => {
	const sampleEpisode: Episode = {
		id: 'ep-123',
		podcastId: 'podcast-456',
		title: 'Test Episode',
		description: 'Test Description',
		audioUrl: 'https://example.com/episode.mp3',
		duration: 3600,
		publishDate: new Date('2024-01-01'),
	};

	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('formatTimestamp', () => {
		it('should format timestamp with brackets style (default)', () => {
			const result = TimestampFormatter.formatTimestamp(90);

			expect(result).toBe('[1:30]');
		});

		it('should format timestamp with link style', () => {
			const result = TimestampFormatter.formatTimestamp(90, sampleEpisode, {
				style: 'link',
			});

			expect(result).toBe('[1:30](podcast://ep-123?t=90)');
		});

		it('should format timestamp with plain style', () => {
			const result = TimestampFormatter.formatTimestamp(90, undefined, {
				style: 'plain',
			});

			expect(result).toBe('1:30');
		});

		it('should format timestamp with custom template', () => {
			const result = TimestampFormatter.formatTimestamp(90, sampleEpisode, {
				style: 'custom',
				customTemplate: 'At {time} ({seconds}s) in {title}',
			});

			expect(result).toBe('At 1:30 (90s) in Test Episode');
		});

		it('should include episode title when requested', () => {
			const result = TimestampFormatter.formatTimestamp(90, sampleEpisode, {
				includeEpisodeTitle: true,
			});

			expect(result).toBe('[1:30] Test Episode');
		});

		it('should include podcast ID when requested', () => {
			const result = TimestampFormatter.formatTimestamp(90, sampleEpisode, {
				includePodcastName: true,
			});

			expect(result).toBe('[1:30] (podcast-456)');
		});

		it('should format with hours when alwaysShowHours is true', () => {
			const result = TimestampFormatter.formatTimestamp(90, undefined, {
				alwaysShowHours: true,
			});

			expect(result).toBe('[0:01:30]');
		});

		it('should handle timestamps with hours', () => {
			const result = TimestampFormatter.formatTimestamp(3661); // 1:01:01

			expect(result).toBe('[1:01:01]');
		});

		it('should fallback to brackets for custom style without template', () => {
			const result = TimestampFormatter.formatTimestamp(90, undefined, {
				style: 'custom',
			});

			expect(result).toBe('[1:30]');
		});
	});

	describe('formatTimestampWithNote', () => {
		it('should format timestamp with note text', () => {
			const result = TimestampFormatter.formatTimestampWithNote(
				90,
				'Important discussion',
				sampleEpisode
			);

			expect(result).toBe('[1:30] Important discussion');
		});

		it('should work with custom style', () => {
			const result = TimestampFormatter.formatTimestampWithNote(
				90,
				'Key point',
				sampleEpisode,
				{ style: 'plain' }
			);

			expect(result).toBe('1:30 Key point');
		});
	});

	describe('formatTimestamps', () => {
		it('should format multiple timestamps', () => {
			const timestamps = [
				{ seconds: 60, note: 'Intro' },
				{ seconds: 120, note: 'Main topic' },
				{ seconds: 180 },
			];

			const result = TimestampFormatter.formatTimestamps(timestamps, sampleEpisode);

			expect(result).toHaveLength(3);
			expect(result[0]).toBe('[1:00] Intro');
			expect(result[1]).toBe('[2:00] Main topic');
			expect(result[2]).toBe('[3:00]');
		});

		it('should apply options to all timestamps', () => {
			const timestamps = [
				{ seconds: 60, note: 'First' },
				{ seconds: 120, note: 'Second' },
			];

			const result = TimestampFormatter.formatTimestamps(timestamps, sampleEpisode, {
				style: 'plain',
			});

			expect(result[0]).toBe('1:00 First');
			expect(result[1]).toBe('2:00 Second');
		});
	});

	describe('parseTimestamp', () => {
		it('should parse HH:MM:SS format', () => {
			const result = TimestampFormatter.parseTimestamp('1:23:45');

			expect(result).toBe(5025); // 1*3600 + 23*60 + 45
		});

		it('should parse MM:SS format', () => {
			const result = TimestampFormatter.parseTimestamp('12:34');

			expect(result).toBe(754); // 12*60 + 34
		});

		it('should parse seconds only', () => {
			const result = TimestampFormatter.parseTimestamp('45');

			expect(result).toBe(45);
		});

		it('should parse timestamps with brackets', () => {
			const result = TimestampFormatter.parseTimestamp('[12:34]');

			expect(result).toBe(754);
		});

		it('should handle leading/trailing whitespace', () => {
			const result = TimestampFormatter.parseTimestamp('  12:34  ');

			expect(result).toBe(754);
		});

		it('should return null for invalid format', () => {
			const result = TimestampFormatter.parseTimestamp('invalid');

			expect(result).toBeNull();
		});

		it('should return null for too many parts', () => {
			const result = TimestampFormatter.parseTimestamp('1:2:3:4');

			expect(result).toBeNull();
		});

		it('should return null for non-numeric parts', () => {
			const result = TimestampFormatter.parseTimestamp('12:abc');

			expect(result).toBeNull();
		});
	});

	describe('extractTimestamps', () => {
		it('should extract timestamps from markdown', () => {
			const markdown = `
# Episode Notes

[12:34] Introduction to the topic
Some text here
[45:00] Main discussion
[1:23:45] Conclusion
`;

			const result = TimestampFormatter.extractTimestamps(markdown);

			expect(result).toHaveLength(3);
			expect(result[0]).toEqual({
				timestamp: '[12:34]',
				seconds: 754,
				line: 4,
			});
			expect(result[1]).toEqual({
				timestamp: '[45:00]',
				seconds: 2700,
				line: 6,
			});
			expect(result[2]).toEqual({
				timestamp: '[1:23:45]',
				seconds: 5025,
				line: 7,
			});
		});

		it('should handle multiple timestamps on same line', () => {
			const markdown = '[12:00] First point [23:00] Second point';

			const result = TimestampFormatter.extractTimestamps(markdown);

			expect(result).toHaveLength(2);
			expect(result[0].seconds).toBe(720);
			expect(result[1].seconds).toBe(1380);
		});

		it('should return empty array for markdown without timestamps', () => {
			const markdown = 'Just some regular text without any timestamps';

			const result = TimestampFormatter.extractTimestamps(markdown);

			expect(result).toEqual([]);
		});

		it('should skip invalid timestamps', () => {
			const markdown = `
[12:34] Valid
[invalid] Invalid
[45:00] Another valid
`;

			const result = TimestampFormatter.extractTimestamps(markdown);

			expect(result).toHaveLength(2);
			expect(result[0].seconds).toBe(754);
			expect(result[1].seconds).toBe(2700);
		});
	});

	describe('createTimestampList', () => {
		it('should create a bulleted list of timestamps', () => {
			const timestamps = [
				{ seconds: 60, note: 'Introduction' },
				{ seconds: 300, note: 'Main topic' },
				{ seconds: 900, note: 'Conclusion' },
			];

			const result = TimestampFormatter.createTimestampList(timestamps, sampleEpisode);

			expect(result).toBe(
				'- [1:00] Introduction\n- [5:00] Main topic\n- [15:00] Conclusion'
			);
		});

		it('should apply formatting options', () => {
			const timestamps = [
				{ seconds: 60, note: 'First' },
				{ seconds: 120, note: 'Second' },
			];

			const result = TimestampFormatter.createTimestampList(timestamps, sampleEpisode, {
				style: 'plain',
			});

			expect(result).toBe('- 1:00 First\n- 2:00 Second');
		});
	});

	describe('createTimestampTable', () => {
		it('should create a markdown table with timestamps', () => {
			const timestamps = [
				{ seconds: 60, note: 'Introduction', speaker: 'Host' },
				{ seconds: 300, note: 'Guest interview' },
				{ seconds: 900, note: 'Q&A', speaker: 'Audience' },
			];

			const result = TimestampFormatter.createTimestampTable(timestamps, sampleEpisode);

			const lines = result.split('\n');
			expect(lines).toHaveLength(5); // Header + separator + 3 rows
			expect(lines[0]).toBe('| Time | Note | Speaker |');
			expect(lines[1]).toBe('|------|------|---------|');
			expect(lines[2]).toContain('[1:00]');
			expect(lines[2]).toContain('Introduction');
			expect(lines[2]).toContain('Host');
			expect(lines[3]).toContain('[5:00]');
			expect(lines[3]).toContain('-'); // No speaker
			expect(lines[4]).toContain('Audience');
		});

		it('should apply formatting options to table', () => {
			const timestamps = [
				{ seconds: 60, note: 'Test', speaker: 'Speaker' },
			];

			const result = TimestampFormatter.createTimestampTable(timestamps, sampleEpisode, {
				style: 'plain',
			});

			expect(result).toContain('1:00');
		});
	});

	describe('isValidTimestamp', () => {
		it('should validate correct timestamp formats', () => {
			expect(TimestampFormatter.isValidTimestamp('12:34')).toBe(true);
			expect(TimestampFormatter.isValidTimestamp('1:23:45')).toBe(true);
			expect(TimestampFormatter.isValidTimestamp('[12:34]')).toBe(true);
			expect(TimestampFormatter.isValidTimestamp('45')).toBe(true);
		});

		it('should reject invalid timestamp formats', () => {
			expect(TimestampFormatter.isValidTimestamp('invalid')).toBe(false);
			expect(TimestampFormatter.isValidTimestamp('12:abc')).toBe(false);
			expect(TimestampFormatter.isValidTimestamp('1:2:3:4')).toBe(false);
		});

		it('should reject negative timestamps', () => {
			// parseTimestamp would return a negative number, isValidTimestamp checks >= 0
			expect(TimestampFormatter.isValidTimestamp('-12:34')).toBe(false);
		});
	});

	describe('custom template placeholders', () => {
		it('should replace all template variables', () => {
			const result = TimestampFormatter.formatTimestamp(90, sampleEpisode, {
				style: 'custom',
				customTemplate: '{time} - {title} (ep {episodeId}) from {podcastId} at {seconds}s',
			});

			expect(result).toContain('1:30');
			expect(result).toContain('Test Episode');
			expect(result).toContain('ep-123');
			expect(result).toContain('podcast-456');
			expect(result).toContain('90s');
		});

		it('should handle missing episode gracefully', () => {
			const result = TimestampFormatter.formatTimestamp(90, undefined, {
				style: 'custom',
				customTemplate: '{time} - {title}',
			});

			expect(result).toContain('1:30');
			expect(result).toContain(' - '); // Empty title
		});
	});
});
