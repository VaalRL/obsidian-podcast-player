/**
 * Error Utilities
 *
 * Provides error handling and formatting utilities for the Podcast Player plugin.
 */

import { logger } from './Logger';
import { Notice } from 'obsidian';

/**
 * Custom error classes for specific error types
 */

export class PodcastPlayerError extends Error {
	constructor(message: string, public readonly code?: string) {
		super(message);
		this.name = 'PodcastPlayerError';
	}
}

export class FeedParseError extends PodcastPlayerError {
	constructor(message: string, public readonly feedUrl: string, public readonly cause?: Error | unknown) {
		super(message, 'FEED_PARSE_ERROR');
		this.name = 'FeedParseError';
	}
}

export class NetworkError extends PodcastPlayerError {
	constructor(message: string, public readonly url: string, public readonly cause?: Error | unknown) {
		super(message, 'NETWORK_ERROR');
		this.name = 'NetworkError';
	}
}

export class AudioPlaybackError extends PodcastPlayerError {
	constructor(message: string, public readonly audioUrl?: string, public readonly cause?: Error | unknown) {
		super(message, 'AUDIO_PLAYBACK_ERROR');
		this.name = 'AudioPlaybackError';
	}
}

export class StorageError extends PodcastPlayerError {
	constructor(message: string, public readonly path?: string) {
		super(message, 'STORAGE_ERROR');
		this.name = 'StorageError';
	}
}

/**
 * Error handling utilities
 */

/**
 * Handle an error by logging it and optionally showing a notice to the user
 */
export function handleError(
	error: Error | unknown,
	userMessage?: string,
	showNotice = true
): void {
	// Log the error
	if (error instanceof Error) {
		logger.error(error.message, error);
	} else {
		logger.error('Unknown error occurred', error);
	}

	// Show notice to user if requested
	if (showNotice) {
		const message = userMessage || getErrorMessage(error);
		new Notice(`Podcast Player: ${message}`);
	}
}

/**
 * Get a user-friendly error message from an error object
 */
export function getErrorMessage(error: Error | unknown): string {
	if (error instanceof PodcastPlayerError) {
		return error.message;
	}

	if (error instanceof Error) {
		return error.message;
	}

	if (typeof error === 'string') {
		return error;
	}

	return 'An unknown error occurred';
}

/**
 * Check if an error is a network error
 */
export function isNetworkError(error: Error | unknown): boolean {
	if (error instanceof NetworkError) {
		return true;
	}

	if (error instanceof Error) {
		const message = error.message.toLowerCase();
		return (
			message.includes('network') ||
			message.includes('fetch') ||
			message.includes('timeout') ||
			message.includes('connection')
		);
	}

	return false;
}

/**
 * Wrap an async function with error handling
 */
export function withErrorHandling<T extends (...args: any[]) => Promise<any>>(
	fn: T,
	errorMessage?: string
): T {
	return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
		try {
			return await fn(...args);
		} catch (error) {
			handleError(error, errorMessage);
			throw error;
		}
	}) as T;
}

/**
 * Retry an async function with exponential backoff
 */
export async function retryWithBackoff<T>(
	fn: () => Promise<T>,
	options: {
		maxRetries?: number;
		initialDelay?: number;
		maxDelay?: number;
		backoffMultiplier?: number;
	} = {}
): Promise<T> {
	const {
		maxRetries = 3,
		initialDelay = 1000,
		maxDelay = 10000,
		backoffMultiplier = 2,
	} = options;

	let lastError: Error | unknown;
	let delay = initialDelay;

	for (let attempt = 0; attempt <= maxRetries; attempt++) {
		try {
			return await fn();
		} catch (error) {
			lastError = error;

			if (attempt < maxRetries) {
				logger.warn(`Attempt ${attempt + 1} failed, retrying in ${delay}ms...`, error);
				await sleep(delay);
				delay = Math.min(delay * backoffMultiplier, maxDelay);
			}
		}
	}

	throw lastError;
}

/**
 * Sleep for a specified number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Safely parse JSON with error handling
 */
export function safeJsonParse<T>(json: string, fallback: T): T {
	try {
		return JSON.parse(json) as T;
	} catch (error) {
		logger.warn('Failed to parse JSON', error);
		return fallback;
	}
}

/**
 * Validate that a value is not null or undefined
 */
export function assertDefined<T>(
	value: T | null | undefined,
	message = 'Value is required'
): asserts value is T {
	if (value === null || value === undefined) {
		throw new PodcastPlayerError(message);
	}
}
