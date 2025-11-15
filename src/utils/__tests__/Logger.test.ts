/**
 * Unit tests for Logger
 */

import { Logger, LogLevel, logger } from '../Logger';

describe('Logger', () => {
	let consoleDebugSpy: jest.SpyInstance;
	let consoleInfoSpy: jest.SpyInstance;
	let consoleWarnSpy: jest.SpyInstance;
	let consoleErrorSpy: jest.SpyInstance;

	beforeEach(() => {
		// Spy on console methods
		consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation();
		consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation();
		consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
		consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

		// Reset log level to default
		logger.setLogLevel(LogLevel.INFO);
	});

	afterEach(() => {
		// Restore console methods
		consoleDebugSpy.mockRestore();
		consoleInfoSpy.mockRestore();
		consoleWarnSpy.mockRestore();
		consoleErrorSpy.mockRestore();
	});

	describe('singleton pattern', () => {
		it('should return the same instance', () => {
			const instance1 = Logger.getInstance();
			const instance2 = Logger.getInstance();
			expect(instance1).toBe(instance2);
		});

		it('should return the default logger instance', () => {
			expect(logger).toBe(Logger.getInstance());
		});
	});

	describe('log level', () => {
		it('should set and get log level', () => {
			logger.setLogLevel(LogLevel.DEBUG);
			expect(logger.getLogLevel()).toBe(LogLevel.DEBUG);

			logger.setLogLevel(LogLevel.WARN);
			expect(logger.getLogLevel()).toBe(LogLevel.WARN);
		});

		it('should default to INFO level', () => {
			const freshLogger = Logger.getInstance();
			expect(freshLogger.getLogLevel()).toBe(LogLevel.INFO);
		});
	});

	describe('debug', () => {
		it('should log debug message when level is DEBUG', () => {
			logger.setLogLevel(LogLevel.DEBUG);
			logger.debug('Test debug message', 'arg1', 'arg2');

			expect(consoleDebugSpy).toHaveBeenCalledWith(
				'[Podcast Player] [DEBUG]',
				'Test debug message',
				'arg1',
				'arg2'
			);
		});

		it('should not log debug message when level is INFO', () => {
			logger.setLogLevel(LogLevel.INFO);
			logger.debug('Test debug message');

			expect(consoleDebugSpy).not.toHaveBeenCalled();
		});

		it('should not log debug message when level is WARN', () => {
			logger.setLogLevel(LogLevel.WARN);
			logger.debug('Test debug message');

			expect(consoleDebugSpy).not.toHaveBeenCalled();
		});

		it('should not log debug message when level is ERROR', () => {
			logger.setLogLevel(LogLevel.ERROR);
			logger.debug('Test debug message');

			expect(consoleDebugSpy).not.toHaveBeenCalled();
		});
	});

	describe('info', () => {
		it('should log info message when level is DEBUG', () => {
			logger.setLogLevel(LogLevel.DEBUG);
			logger.info('Test info message', 'arg1');

			expect(consoleInfoSpy).toHaveBeenCalledWith(
				'[Podcast Player] [INFO]',
				'Test info message',
				'arg1'
			);
		});

		it('should log info message when level is INFO', () => {
			logger.setLogLevel(LogLevel.INFO);
			logger.info('Test info message');

			expect(consoleInfoSpy).toHaveBeenCalledWith(
				'[Podcast Player] [INFO]',
				'Test info message'
			);
		});

		it('should not log info message when level is WARN', () => {
			logger.setLogLevel(LogLevel.WARN);
			logger.info('Test info message');

			expect(consoleInfoSpy).not.toHaveBeenCalled();
		});

		it('should not log info message when level is ERROR', () => {
			logger.setLogLevel(LogLevel.ERROR);
			logger.info('Test info message');

			expect(consoleInfoSpy).not.toHaveBeenCalled();
		});
	});

	describe('warn', () => {
		it('should log warn message when level is DEBUG', () => {
			logger.setLogLevel(LogLevel.DEBUG);
			logger.warn('Test warn message', 'arg1', 'arg2');

			expect(consoleWarnSpy).toHaveBeenCalledWith(
				'[Podcast Player] [WARN]',
				'Test warn message',
				'arg1',
				'arg2'
			);
		});

		it('should log warn message when level is INFO', () => {
			logger.setLogLevel(LogLevel.INFO);
			logger.warn('Test warn message');

			expect(consoleWarnSpy).toHaveBeenCalledWith(
				'[Podcast Player] [WARN]',
				'Test warn message'
			);
		});

		it('should log warn message when level is WARN', () => {
			logger.setLogLevel(LogLevel.WARN);
			logger.warn('Test warn message');

			expect(consoleWarnSpy).toHaveBeenCalledWith(
				'[Podcast Player] [WARN]',
				'Test warn message'
			);
		});

		it('should not log warn message when level is ERROR', () => {
			logger.setLogLevel(LogLevel.ERROR);
			logger.warn('Test warn message');

			expect(consoleWarnSpy).not.toHaveBeenCalled();
		});
	});

	describe('error', () => {
		it('should log error with Error object', () => {
			logger.setLogLevel(LogLevel.ERROR);
			const error = new Error('Test error');
			logger.error('Test error message', error, 'arg1');

			expect(consoleErrorSpy).toHaveBeenCalledWith(
				'[Podcast Player] [ERROR]',
				'Test error message',
				'Test error',
				error.stack,
				'arg1'
			);
		});

		it('should log error without Error object', () => {
			logger.setLogLevel(LogLevel.ERROR);
			logger.error('Test error message', 'some error');

			expect(consoleErrorSpy).toHaveBeenCalledWith(
				'[Podcast Player] [ERROR]',
				'Test error message',
				'some error'
			);
		});

		it('should log error when level is DEBUG', () => {
			logger.setLogLevel(LogLevel.DEBUG);
			logger.error('Test error message');

			expect(consoleErrorSpy).toHaveBeenCalled();
		});

		it('should log error when level is INFO', () => {
			logger.setLogLevel(LogLevel.INFO);
			logger.error('Test error message');

			expect(consoleErrorSpy).toHaveBeenCalled();
		});

		it('should log error when level is WARN', () => {
			logger.setLogLevel(LogLevel.WARN);
			logger.error('Test error message');

			expect(consoleErrorSpy).toHaveBeenCalled();
		});
	});

	describe('methodEntry', () => {
		it('should log method entry when level is DEBUG', () => {
			logger.setLogLevel(LogLevel.DEBUG);
			logger.methodEntry('TestClass', 'testMethod', 'arg1', 'arg2');

			expect(consoleDebugSpy).toHaveBeenCalledWith(
				'[Podcast Player] [DEBUG]',
				'TestClass.testMethod() called',
				'arg1',
				'arg2'
			);
		});

		it('should not log method entry when level is INFO', () => {
			logger.setLogLevel(LogLevel.INFO);
			logger.methodEntry('TestClass', 'testMethod');

			expect(consoleDebugSpy).not.toHaveBeenCalled();
		});
	});

	describe('methodExit', () => {
		it('should log method exit when level is DEBUG', () => {
			logger.setLogLevel(LogLevel.DEBUG);
			logger.methodExit('TestClass', 'testMethod', { result: 'success' });

			expect(consoleDebugSpy).toHaveBeenCalledWith(
				'[Podcast Player] [DEBUG]',
				'TestClass.testMethod() completed',
				{ result: 'success' }
			);
		});

		it('should log method exit without result', () => {
			logger.setLogLevel(LogLevel.DEBUG);
			logger.methodExit('TestClass', 'testMethod');

			expect(consoleDebugSpy).toHaveBeenCalledWith(
				'[Podcast Player] [DEBUG]',
				'TestClass.testMethod() completed',
				undefined
			);
		});

		it('should not log method exit when level is INFO', () => {
			logger.setLogLevel(LogLevel.INFO);
			logger.methodExit('TestClass', 'testMethod');

			expect(consoleDebugSpy).not.toHaveBeenCalled();
		});
	});

	describe('log level filtering', () => {
		it('should only log messages at or above the set level', () => {
			logger.setLogLevel(LogLevel.WARN);

			logger.debug('Debug message');
			logger.info('Info message');
			logger.warn('Warn message');
			logger.error('Error message');

			expect(consoleDebugSpy).not.toHaveBeenCalled();
			expect(consoleInfoSpy).not.toHaveBeenCalled();
			expect(consoleWarnSpy).toHaveBeenCalled();
			expect(consoleErrorSpy).toHaveBeenCalled();
		});

		it('should log all messages when level is DEBUG', () => {
			logger.setLogLevel(LogLevel.DEBUG);

			logger.debug('Debug message');
			logger.info('Info message');
			logger.warn('Warn message');
			logger.error('Error message');

			expect(consoleDebugSpy).toHaveBeenCalled();
			expect(consoleInfoSpy).toHaveBeenCalled();
			expect(consoleWarnSpy).toHaveBeenCalled();
			expect(consoleErrorSpy).toHaveBeenCalled();
		});
	});
});
