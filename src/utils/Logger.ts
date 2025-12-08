/**
 * Logger Utility
 *
 * Provides structured logging for the Podcast Player plugin.
 * Logs are prefixed with [Podcast Player] for easy identification.
 */

export enum LogLevel {
	DEBUG = 0,
	INFO = 1,
	WARN = 2,
	ERROR = 3,
}

export class Logger {
	private static instance: Logger;
	private logLevel: LogLevel = LogLevel.ERROR;
	private readonly prefix = '[Podcast Player]';

	private constructor() {
		// Private constructor for singleton pattern
	}

	/**
	 * Get the singleton Logger instance
	 */
	static getInstance(): Logger {
		if (!Logger.instance) {
			Logger.instance = new Logger();
		}
		return Logger.instance;
	}

	/**
	 * Set the minimum log level
	 */
	setLogLevel(level: LogLevel): void {
		this.logLevel = level;
	}

	/**
	 * Get the current log level
	 */
	getLogLevel(): LogLevel {
		return this.logLevel;
	}

	/**
	 * Log a debug message
	 */
	debug(message: string, ...args: unknown[]): void {
		if (this.logLevel <= LogLevel.DEBUG) {
			console.debug(`${this.prefix} [DEBUG]`, message, ...args);
		}
	}

	/**
	 * Log an info message
	 */
	info(message: string, ...args: unknown[]): void {
		if (this.logLevel <= LogLevel.INFO) {
			console.info(`${this.prefix} [INFO]`, message, ...args);
		}
	}

	/**
	 * Log a warning message
	 */
	warn(message: string, ...args: unknown[]): void {
		if (this.logLevel <= LogLevel.WARN) {
			console.warn(`${this.prefix} [WARN]`, message, ...args);
		}
	}

	/**
	 * Log an error message
	 */
	error(message: string, error?: Error | unknown, ...args: unknown[]): void {
		if (this.logLevel <= LogLevel.ERROR) {
			if (error instanceof Error) {
				console.error(`${this.prefix} [ERROR]`, message, error.message, error.stack, ...args);
			} else {
				console.error(`${this.prefix} [ERROR]`, message, error, ...args);
			}
		}
	}

	/**
	 * Log a method entry (useful for debugging)
	 */
	methodEntry(className: string, methodName: string, ...args: unknown[]): void {
		this.debug(`${className}.${methodName}() called`, ...args);
	}

	/**
	 * Log a method exit (useful for debugging)
	 */
	methodExit(className: string, methodName: string, result?: unknown): void {
		this.debug(`${className}.${methodName}() completed`, result);
	}
}

// Export a default instance for convenience
export const logger = Logger.getInstance();
