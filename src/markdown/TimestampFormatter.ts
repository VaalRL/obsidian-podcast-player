/**
 * TimestampFormatter - Formats timestamps for markdown notes
 *
 * Creates clickable timestamps that can be used in notes to jump to
 * specific positions in podcast episodes.
 */

import { logger } from '../utils/Logger';
import { formatTime } from '../utils/timeUtils';
import { Episode } from '../model';

/**
 * Timestamp format style
 */
export type TimestampStyle = 'brackets' | 'link' | 'plain' | 'custom';

/**
 * Timestamp format options
 */
export interface TimestampFormatOptions {
	/** Style of timestamp */
	style?: TimestampStyle;
	/** Include episode title */
	includeEpisodeTitle?: boolean;
	/** Include podcast name */
	includePodcastName?: boolean;
	/** Custom format template */
	customTemplate?: string;
	/** Always show hours (even if 0) */
	alwaysShowHours?: boolean;
}

/**
 * Timestamp Formatter
 */
export class TimestampFormatter {
	/**
	 * Format a timestamp for markdown
	 */
	static formatTimestamp(
		seconds: number,
		episode?: Episode,
		options: TimestampFormatOptions = {}
	): string {
		logger.methodEntry('TimestampFormatter', 'formatTimestamp', seconds);

		const {
			style = 'brackets',
			includeEpisodeTitle = false,
			includePodcastName = false,
			customTemplate,
			alwaysShowHours = false,
		} = options;

		const timeStr = formatTime(seconds, alwaysShowHours);

		let result = '';

		switch (style) {
			case 'brackets':
				result = `[${timeStr}]`;
				break;

			case 'link':
				// Create a markdown link that could be used with a custom protocol
				result = `[${timeStr}](podcast://${episode?.id || 'unknown'}?t=${seconds})`;
				break;

			case 'plain':
				result = timeStr;
				break;

			case 'custom':
				if (customTemplate) {
					result = this.applyCustomTemplate(customTemplate, seconds, timeStr, episode);
				} else {
					result = `[${timeStr}]`;
				}
				break;

			default:
				result = `[${timeStr}]`;
		}

		// Add episode title if requested
		if (includeEpisodeTitle && episode) {
			result = `${result} ${episode.title}`;
		}

		// Add podcast name if requested (would need to be passed in)
		if (includePodcastName && episode) {
			// Note: episode doesn't have podcast name, would need to fetch it
			// For now, just include the podcast ID as reference
			result = `${result} (${episode.podcastId})`;
		}

		logger.methodExit('TimestampFormatter', 'formatTimestamp');
		return result;
	}

	/**
	 * Apply custom template
	 */
	private static applyCustomTemplate(
		template: string,
		seconds: number,
		timeStr: string,
		episode?: Episode
	): string {
		return template
			.replace('{time}', timeStr)
			.replace('{seconds}', seconds.toString())
			.replace('{title}', episode?.title || '')
			.replace('{episodeId}', episode?.id || '')
			.replace('{podcastId}', episode?.podcastId || '');
	}

	/**
	 * Format a timestamp with note text
	 */
	static formatTimestampWithNote(
		seconds: number,
		note: string,
		episode?: Episode,
		options: TimestampFormatOptions = {}
	): string {
		const timestamp = this.formatTimestamp(seconds, episode, options);
		return `${timestamp} ${note}`;
	}

	/**
	 * Format multiple timestamps
	 */
	static formatTimestamps(
		timestamps: Array<{ seconds: number; note?: string }>,
		episode?: Episode,
		options: TimestampFormatOptions = {}
	): string[] {
		return timestamps.map(({ seconds, note }) => {
			if (note) {
				return this.formatTimestampWithNote(seconds, note, episode, options);
			}
			return this.formatTimestamp(seconds, episode, options);
		});
	}

	/**
	 * Parse timestamp from string
	 * Supports formats: [HH:MM:SS], [MM:SS], HH:MM:SS, MM:SS
	 */
	static parseTimestamp(timestampStr: string): number | null {
		logger.methodEntry('TimestampFormatter', 'parseTimestamp', timestampStr);

		// Remove brackets if present
		const cleaned = timestampStr.replace(/^\[|\]$/g, '').trim();

		// Split by colon
		const parts = cleaned.split(':').map(p => parseInt(p, 10));

		if (parts.some(isNaN)) {
			logger.warn('Invalid timestamp format', timestampStr);
			logger.methodExit('TimestampFormatter', 'parseTimestamp', 'invalid');
			return null;
		}

		let seconds = 0;

		if (parts.length === 3) {
			// HH:MM:SS
			const [hours, minutes, secs] = parts;
			seconds = hours * 3600 + minutes * 60 + secs;
		} else if (parts.length === 2) {
			// MM:SS
			const [minutes, secs] = parts;
			seconds = minutes * 60 + secs;
		} else if (parts.length === 1) {
			// Just seconds
			seconds = parts[0];
		} else {
			logger.warn('Invalid timestamp format', timestampStr);
			logger.methodExit('TimestampFormatter', 'parseTimestamp', 'invalid');
			return null;
		}

		logger.methodExit('TimestampFormatter', 'parseTimestamp', seconds);
		return seconds;
	}

	/**
	 * Extract all timestamps from markdown text
	 */
	static extractTimestamps(markdown: string): Array<{ timestamp: string; seconds: number; line: number }> {
		logger.methodEntry('TimestampFormatter', 'extractTimestamps');

		const results: Array<{ timestamp: string; seconds: number; line: number }> = [];
		const lines = markdown.split('\n');

		// Regular expression to match timestamps: [HH:MM:SS] or [MM:SS]
		const timestampRegex = /\[(\d{1,2}:\d{2}(?::\d{2})?)\]/g;

		lines.forEach((line, lineIndex) => {
			let match;
			while ((match = timestampRegex.exec(line)) !== null) {
				const timestamp = match[1];
				const seconds = this.parseTimestamp(timestamp);

				if (seconds !== null) {
					results.push({
						timestamp: match[0], // Include brackets
						seconds,
						line: lineIndex + 1, // 1-indexed
					});
				}
			}
		});

		logger.info(`Extracted ${results.length} timestamps`);
		logger.methodExit('TimestampFormatter', 'extractTimestamps');

		return results;
	}

	/**
	 * Create a timestamp list from an array of times
	 */
	static createTimestampList(
		timestamps: Array<{ seconds: number; note: string }>,
		episode?: Episode,
		options: TimestampFormatOptions = {}
	): string {
		const lines = timestamps.map(({ seconds, note }) =>
			`- ${this.formatTimestampWithNote(seconds, note, episode, options)}`
		);

		return lines.join('\n');
	}

	/**
	 * Create a timestamp table
	 */
	static createTimestampTable(
		timestamps: Array<{ seconds: number; note: string; speaker?: string }>,
		episode?: Episode,
		options: TimestampFormatOptions = {}
	): string {
		const rows = [
			'| Time | Note | Speaker |',
			'|------|------|---------|',
		];

		timestamps.forEach(({ seconds, note, speaker }) => {
			const timeStr = this.formatTimestamp(seconds, episode, options);
			const speakerStr = speaker || '-';
			rows.push(`| ${timeStr} | ${note} | ${speakerStr} |`);
		});

		return rows.join('\n');
	}

	/**
	 * Validate timestamp format
	 */
	static isValidTimestamp(timestampStr: string): boolean {
		const seconds = this.parseTimestamp(timestampStr);
		return seconds !== null && seconds >= 0;
	}
}
