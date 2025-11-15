/**
 * Unit tests for NoteExporter
 */

import { NoteExporter, NoteExportOptions } from '../NoteExporter';
import { Vault, TFile } from 'obsidian';
import { Episode, Podcast, PlayProgress } from '../../model';

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
	formatDate: jest.fn((date: Date) => date.toISOString().split('T')[0]),
	formatDuration: jest.fn((seconds: number) => {
		const hours = Math.floor(seconds / 3600);
		const minutes = Math.floor((seconds % 3600) / 60);
		return `${hours}h ${minutes}m`;
	}),
	formatTime: jest.fn((seconds: number) => {
		const minutes = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${minutes}:${secs.toString().padStart(2, '0')}`;
	}),
}));

describe('NoteExporter', () => {
	let exporter: NoteExporter;
	let mockVault: jest.Mocked<Vault>;
	let mockFile: jest.Mocked<TFile>;

	const samplePodcast: Podcast = {
		id: 'podcast-123',
		title: 'Test Podcast',
		author: 'Test Author',
		description: 'Test podcast description',
		feedUrl: 'https://example.com/feed.rss',
		imageUrl: 'https://example.com/image.jpg',
		subscribedAt: new Date('2024-01-01'),
		lastFetchedAt: new Date('2024-01-01'),
	};

	const sampleEpisode: Episode = {
		id: 'ep-123',
		podcastId: 'podcast-123',
		title: 'Episode 1: Introduction',
		description: 'This is a test episode about testing',
		audioUrl: 'https://example.com/episode1.mp3',
		duration: 3600,
		publishDate: new Date('2024-01-15'),
		guid: 'episode-1-guid',
		episodeNumber: 1,
		seasonNumber: 1,
		episodeType: 'full',
	};

	const sampleProgress: PlayProgress = {
		episodeId: 'ep-123',
		podcastId: 'podcast-123',
		position: 1800,
		duration: 3600,
		completed: false,
		lastPlayedAt: new Date('2024-01-20'),
	};

	beforeEach(() => {
		mockFile = {
			path: 'Podcasts/Test Podcast - Episode 1 Introduction.md',
			name: 'Episode 1.md',
		} as any;

		mockVault = {
			create: jest.fn().mockResolvedValue(mockFile),
			modify: jest.fn().mockResolvedValue(undefined),
			createFolder: jest.fn().mockResolvedValue(undefined),
			getAbstractFileByPath: jest.fn().mockReturnValue(null),
			adapter: {
				exists: jest.fn().mockResolvedValue(false),
			},
		} as any;

		exporter = new NoteExporter(mockVault);

		jest.clearAllMocks();
	});

	describe('constructor', () => {
		it('should create exporter with vault', () => {
			expect(exporter).toBeInstanceOf(NoteExporter);
		});
	});

	describe('exportEpisode', () => {
		it('should export episode with default options', async () => {
			const result = await exporter.exportEpisode(sampleEpisode, samplePodcast);

			expect(result).toBe(mockFile);
			expect(mockVault.create).toHaveBeenCalled();

			const [filePath, content] = (mockVault.create as jest.Mock).mock.calls[0];
			expect(filePath).toContain('Podcasts/');
			expect(content).toContain('# Episode 1: Introduction');
			expect(content).toContain('---'); // Front matter
		});

		it('should include front matter when requested', async () => {
			await exporter.exportEpisode(sampleEpisode, samplePodcast, undefined, {
				includeFrontMatter: true,
			});

			const content = (mockVault.create as jest.Mock).mock.calls[0][1];
			expect(content).toContain('---');
			expect(content).toMatch(/title:.*Episode 1: Introduction/); // Title may be quoted
			expect(content).toContain('podcast: Test Podcast');
			expect(content).toContain('episodeNumber: 1');
		});

		it('should include episode description when requested', async () => {
			await exporter.exportEpisode(sampleEpisode, samplePodcast, undefined, {
				includeDescription: true,
			});

			const content = (mockVault.create as jest.Mock).mock.calls[0][1];
			expect(content).toContain('## Description');
			expect(content).toContain('This is a test episode about testing');
		});

		it('should include metadata section when requested', async () => {
			await exporter.exportEpisode(sampleEpisode, samplePodcast, undefined, {
				includeMetadata: true,
			});

			const content = (mockVault.create as jest.Mock).mock.calls[0][1];
			expect(content).toContain('## Episode Information');
			expect(content).toContain('**Podcast:** Test Podcast');
			expect(content).toContain('**Author:** Test Author');
			expect(content).toContain('**Episode:** 1');
			expect(content).toContain('**Season:** 1');
		});

		it('should include progress when provided', async () => {
			await exporter.exportEpisode(sampleEpisode, samplePodcast, sampleProgress, {
				includeProgress: true,
			});

			const content = (mockVault.create as jest.Mock).mock.calls[0][1];
			expect(content).toContain('## Listening Progress');
			expect(content).toContain('**Status:** In Progress');
			expect(content).toContain('**Progress:** 50%');
		});

		it('should include timestamps section when requested', async () => {
			await exporter.exportEpisode(sampleEpisode, samplePodcast, undefined, {
				includeTimestamps: true,
			});

			const content = (mockVault.create as jest.Mock).mock.calls[0][1];
			expect(content).toContain('## Timestamps');
			expect(content).toContain('<!-- Add your timestamps here -->');
		});

		it('should use custom template when provided', async () => {
			const template = '# {{episodeTitle}}\nPodcast: {{podcastTitle}}\nDuration: {{duration}}';

			await exporter.exportEpisode(sampleEpisode, samplePodcast, undefined, {
				template,
			});

			const content = (mockVault.create as jest.Mock).mock.calls[0][1];
			expect(content).toContain('# Episode 1: Introduction');
			expect(content).toContain('Podcast: Test Podcast');
			expect(content).toContain('Duration: 1h 0m');
		});

		it('should use custom output folder', async () => {
			await exporter.exportEpisode(sampleEpisode, samplePodcast, undefined, {
				outputFolder: 'My Podcasts',
			});

			const filePath = (mockVault.create as jest.Mock).mock.calls[0][0];
			expect(filePath).toContain('My Podcasts/');
		});

		it('should use custom file name template', async () => {
			await exporter.exportEpisode(sampleEpisode, samplePodcast, undefined, {
				fileNameTemplate: '{{podcastTitle}} - S{{seasonNumber}}E{{episodeNumber}}',
			});

			const filePath = (mockVault.create as jest.Mock).mock.calls[0][0];
			expect(filePath).toContain('Test Podcast - S1E1.md');
		});

		it('should create folder if it does not exist', async () => {
			mockVault.adapter.exists.mockResolvedValue(false);

			await exporter.exportEpisode(sampleEpisode, samplePodcast);

			expect(mockVault.createFolder).toHaveBeenCalledWith('Podcasts');
		});

		it('should not create folder if it exists', async () => {
			mockVault.adapter.exists.mockResolvedValue(true);

			await exporter.exportEpisode(sampleEpisode, samplePodcast);

			expect(mockVault.createFolder).not.toHaveBeenCalled();
		});

		it('should update existing file', async () => {
			// Create a mock TFile instance (needs to pass instanceof check)
			const existingFile = Object.create(TFile.prototype);
			existingFile.path = 'some/path.md';
			existingFile.name = 'some-file.md';

			mockVault.getAbstractFileByPath.mockReturnValue(existingFile);

			await exporter.exportEpisode(sampleEpisode, samplePodcast);

			expect(mockVault.modify).toHaveBeenCalledWith(existingFile, expect.any(String));
			expect(mockVault.create).not.toHaveBeenCalled();
		});

		it('should sanitize file name', async () => {
			const episodeWithSpecialChars: Episode = {
				...sampleEpisode,
				title: 'Episode: "Test" <with> |special| chars?',
			};

			await exporter.exportEpisode(episodeWithSpecialChars, samplePodcast);

			const filePath = (mockVault.create as jest.Mock).mock.calls[0][0];
			expect(filePath).not.toContain(':');
			expect(filePath).not.toContain('"');
			expect(filePath).not.toContain('?');
			expect(filePath).not.toContain('<');
			expect(filePath).not.toContain('>');
			expect(filePath).not.toContain('|');
		});
	});

	describe('front matter generation', () => {
		it('should generate complete front matter', async () => {
			await exporter.exportEpisode(sampleEpisode, samplePodcast, sampleProgress, {
				includeFrontMatter: true,
			});

			const content = (mockVault.create as jest.Mock).mock.calls[0][1];
			expect(content).toMatch(/title:.*Episode 1: Introduction/); // May be quoted
			expect(content).toContain('podcast: Test Podcast');
			expect(content).toContain('author: Test Author');
			expect(content).toContain('episodeNumber: 1');
			expect(content).toContain('seasonNumber: 1');
			expect(content).toContain('guid: episode-1-guid');
			expect(content).toContain('progress: 50');
			expect(content).toContain('completed: false');
		});

		it('should quote values with colons in front matter', async () => {
			const episodeWithColon: Episode = {
				...sampleEpisode,
				title: 'Episode 1: Test',
			};

			await exporter.exportEpisode(episodeWithColon, samplePodcast, undefined, {
				includeFrontMatter: true,
			});

			const content = (mockVault.create as jest.Mock).mock.calls[0][1];
			expect(content).toContain('title: "Episode 1: Test"');
		});

		it('should omit undefined values from front matter', async () => {
			const episodeWithoutOptionalFields: Episode = {
				...sampleEpisode,
				episodeNumber: undefined,
				seasonNumber: undefined,
				guid: undefined,
			};

			await exporter.exportEpisode(episodeWithoutOptionalFields, samplePodcast, undefined, {
				includeFrontMatter: true,
			});

			const content = (mockVault.create as jest.Mock).mock.calls[0][1];
			expect(content).not.toContain('episodeNumber:');
			expect(content).not.toContain('seasonNumber:');
			expect(content).not.toContain('guid:');
		});
	});

	describe('template variable replacement', () => {
		it('should replace all template variables', async () => {
			const template = [
				'{{episodeTitle}}',
				'{{episodeDescription}}',
				'{{podcastTitle}}',
				'{{podcastAuthor}}',
				'{{episodeNumber}}',
				'{{seasonNumber}}',
				'{{publishDate}}',
				'{{duration}}',
				'{{audioUrl}}',
			].join('\n');

			await exporter.exportEpisode(sampleEpisode, samplePodcast, undefined, {
				template,
			});

			const content = (mockVault.create as jest.Mock).mock.calls[0][1];
			expect(content).toContain('Episode 1: Introduction');
			expect(content).toContain('This is a test episode about testing');
			expect(content).toContain('Test Podcast');
			expect(content).toContain('Test Author');
			expect(content).toContain('1'); // Episode number
			expect(content).toContain('https://example.com/episode1.mp3');
		});

		it('should replace progress variables when available', async () => {
			const template = 'Progress: {{progress}} ({{completionPercentage}})';

			await exporter.exportEpisode(sampleEpisode, samplePodcast, sampleProgress, {
				template,
			});

			const content = (mockVault.create as jest.Mock).mock.calls[0][1];
			// formatDuration mock returns "0h 30m" format
			expect(content).toContain('Progress: 0h 30m (50%)');
		});
	});

	describe('exportEpisodes', () => {
		it('should export multiple episodes', async () => {
			const episodes = [
				{ episode: sampleEpisode, podcast: samplePodcast },
				{
					episode: { ...sampleEpisode, id: 'ep-2', title: 'Episode 2' },
					podcast: samplePodcast,
				},
			];

			const result = await exporter.exportEpisodes(episodes);

			expect(result).toHaveLength(2);
			expect(mockVault.create).toHaveBeenCalledTimes(2);
		});

		it('should continue exporting even if one fails', async () => {
			const episodes = [
				{ episode: sampleEpisode, podcast: samplePodcast },
				{
					episode: { ...sampleEpisode, id: 'ep-2', title: 'Episode 2' },
					podcast: samplePodcast,
				},
			];

			// Make second export fail
			mockVault.create
				.mockResolvedValueOnce(mockFile)
				.mockRejectedValueOnce(new Error('Failed to create'));

			const result = await exporter.exportEpisodes(episodes);

			expect(result).toHaveLength(1); // Only first succeeded
		});
	});

	describe('quickExport', () => {
		it('should export with default comprehensive options', async () => {
			await exporter.quickExport(sampleEpisode, samplePodcast, sampleProgress);

			const content = (mockVault.create as jest.Mock).mock.calls[0][1];
			expect(content).toContain('---'); // Front matter
			expect(content).toContain('## Episode Information'); // Metadata
			expect(content).toContain('## Description'); // Description
			expect(content).toContain('## Timestamps'); // Timestamps
			expect(content).toContain('## Listening Progress'); // Progress
		});

		it('should not include progress section when not provided', async () => {
			await exporter.quickExport(sampleEpisode, samplePodcast);

			const content = (mockVault.create as jest.Mock).mock.calls[0][1];
			expect(content).not.toContain('## Listening Progress');
		});
	});

	describe('file name sanitization', () => {
		it('should remove invalid file system characters', async () => {
			const podcastWithSpecialChars: Podcast = {
				...samplePodcast,
				title: 'Podcast/With\\Invalid:Chars*?<>|',
			};

			await exporter.exportEpisode(sampleEpisode, podcastWithSpecialChars);

			const filePath = (mockVault.create as jest.Mock).mock.calls[0][0];
			const fileName = filePath.split('/').pop();

			expect(fileName).not.toContain('/');
			expect(fileName).not.toContain('\\');
			expect(fileName).not.toContain(':');
			expect(fileName).not.toContain('*');
			expect(fileName).not.toContain('?');
			expect(fileName).not.toContain('<');
			expect(fileName).not.toContain('>');
			expect(fileName).not.toContain('|');
		});

		it('should normalize whitespace in file names', async () => {
			const episodeWithMultipleSpaces: Episode = {
				...sampleEpisode,
				title: 'Episode   with    multiple     spaces',
			};

			await exporter.exportEpisode(episodeWithMultipleSpaces, samplePodcast);

			const filePath = (mockVault.create as jest.Mock).mock.calls[0][0];
			expect(filePath).not.toContain('   ');
		});

		it('should ensure .md extension', async () => {
			await exporter.exportEpisode(sampleEpisode, samplePodcast, undefined, {
				fileNameTemplate: 'MyCustomName',
			});

			const filePath = (mockVault.create as jest.Mock).mock.calls[0][0];
			expect(filePath).toMatch(/\.md$/);
		});
	});

	describe('progress section', () => {
		it('should show "Completed" status for completed episodes', async () => {
			const completedProgress: PlayProgress = {
				...sampleProgress,
				completed: true,
				position: 3600,
			};

			await exporter.exportEpisode(sampleEpisode, samplePodcast, completedProgress, {
				includeProgress: true,
			});

			const content = (mockVault.create as jest.Mock).mock.calls[0][1];
			expect(content).toContain('**Status:** Completed');
			expect(content).toContain('**Progress:** 100%');
		});

		it('should show "In Progress" status for incomplete episodes', async () => {
			await exporter.exportEpisode(sampleEpisode, samplePodcast, sampleProgress, {
				includeProgress: true,
			});

			const content = (mockVault.create as jest.Mock).mock.calls[0][1];
			expect(content).toContain('**Status:** In Progress');
		});
	});

	describe('metadata section', () => {
		it('should include all available metadata', async () => {
			await exporter.exportEpisode(sampleEpisode, samplePodcast, undefined, {
				includeMetadata: true,
			});

			const content = (mockVault.create as jest.Mock).mock.calls[0][1];
			expect(content).toContain('**Podcast:** Test Podcast');
			expect(content).toContain('**Author:** Test Author');
			expect(content).toContain('**Episode:** 1');
			expect(content).toContain('**Season:** 1');
			expect(content).toContain('**Type:** full');
		});

		it('should omit optional metadata when not available', async () => {
			const minimalEpisode: Episode = {
				...sampleEpisode,
				episodeNumber: undefined,
				seasonNumber: undefined,
				episodeType: undefined,
			};

			await exporter.exportEpisode(minimalEpisode, samplePodcast, undefined, {
				includeMetadata: true,
			});

			const content = (mockVault.create as jest.Mock).mock.calls[0][1];
			expect(content).not.toContain('**Episode:**');
			expect(content).not.toContain('**Season:**');
			expect(content).not.toContain('**Type:**');
		});
	});
});
