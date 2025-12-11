/**
 * NoteExporter - Exports podcast episode information to markdown notes
 *
 * Creates markdown notes with episode metadata, show notes, and timestamps.
 * Supports templates and front matter generation.
 */

import { Vault, TFile, normalizePath } from 'obsidian';
import { logger } from '../utils/Logger';
import { Episode, Podcast, PlayProgress } from '../model';
import { formatDate, formatDuration } from '../utils/timeUtils';

/**
 * Note export options
 */
export interface NoteExportOptions {
	/** Include front matter */
	includeFrontMatter?: boolean;
	/** Include episode description */
	includeDescription?: boolean;
	/** Include episode metadata */
	includeMetadata?: boolean;
	/** Include timestamps section */
	includeTimestamps?: boolean;
	/** Include progress information */
	includeProgress?: boolean;
	/** Custom template */
	template?: string;
	/** Output folder path */
	outputFolder?: string;
	/** File name template */
	fileNameTemplate?: string;
}

/**
 * Note template variables
 */
export interface TemplateVariables {
	episodeTitle: string;
	episodeDescription: string;
	podcastTitle: string;
	podcastAuthor: string;
	episodeNumber?: number;
	seasonNumber?: number;
	publishDate: string;
	duration: string;
	audioUrl: string;
	episodeUrl?: string;
	imageUrl?: string;
	progress?: string;
	completionPercentage?: string;
	[key: string]: string | number | undefined;
}

/**
 * Note Exporter
 */
export class NoteExporter {
	private vault: Vault;

	constructor(vault: Vault) {
		this.vault = vault;
	}

	/**
	 * Export episode to a markdown note
	 */
	async exportEpisode(
		episode: Episode,
		podcast: Podcast,
		progress?: PlayProgress,
		options: NoteExportOptions = {}
	): Promise<TFile> {
		logger.methodEntry('NoteExporter', 'exportEpisode', episode.id);

		const {
			includeFrontMatter = true,
			includeDescription = true,
			includeMetadata = true,
			includeTimestamps = true,
			includeProgress = true,
			template,
			outputFolder = 'Podcasts',
			fileNameTemplate,
		} = options;

		// Generate template variables
		const variables = this.generateTemplateVariables(episode, podcast, progress);

		// Generate note content
		let content = '';

		if (template) {
			// Use custom template
			content = this.applyTemplate(template, variables);
		} else {
			// Use default template
			content = this.generateDefaultNote(
				episode,
				podcast,
				progress,
				{
					includeFrontMatter,
					includeDescription,
					includeMetadata,
					includeTimestamps,
					includeProgress,
				}
			);
		}

		// Generate file name
		const fileName = this.generateFileName(episode, podcast, fileNameTemplate);
		const filePath = normalizePath(`${outputFolder}/${fileName}`);

		// Ensure folder exists
		await this.ensureFolderExists(outputFolder);

		// Create or update file
		const file = await this.createOrUpdateFile(filePath, content);

		logger.info('Episode exported to note', filePath);
		logger.methodExit('NoteExporter', 'exportEpisode');

		return file;
	}

	/**
	 * Generate default note content
	 */
	private generateDefaultNote(
		episode: Episode,
		podcast: Podcast,
		progress: PlayProgress | undefined,
		options: {
			includeFrontMatter: boolean;
			includeDescription: boolean;
			includeMetadata: boolean;
			includeTimestamps: boolean;
			includeProgress: boolean;
		}
	): string {
		const sections: string[] = [];

		// Front matter
		if (options.includeFrontMatter) {
			sections.push(this.generateFrontMatter(episode, podcast, progress));
		}

		// Title
		sections.push(`# ${episode.title}\n`);

		// Metadata
		if (options.includeMetadata) {
			sections.push(this.generateMetadataSection(episode, podcast));
		}

		// Progress
		if (options.includeProgress && progress) {
			sections.push(this.generateProgressSection(progress));
		}

		// Description
		if (options.includeDescription) {
			sections.push(this.generateDescriptionSection(episode));
		}

		// Timestamps section (empty by default, user can fill in)
		if (options.includeTimestamps) {
			sections.push(this.generateTimestampsSection());
		}

		// Notes section
		sections.push(this.generateNotesSection());

		return sections.join('\n');
	}

	/**
	 * Generate front matter
	 */
	private generateFrontMatter(
		episode: Episode,
		podcast: Podcast,
		progress?: PlayProgress
	): string {
		const frontMatter: Record<string, unknown> = {
			title: episode.title,
			podcast: podcast.title,
			author: podcast.author,
			episodeNumber: episode.episodeNumber,
			seasonNumber: episode.seasonNumber,
			publishDate: formatDate(episode.publishDate),
			duration: formatDuration(episode.duration),
			audioUrl: episode.audioUrl,
			episodeId: episode.id,
			podcastId: episode.podcastId,
		};

		if (progress) {
			frontMatter.progress = Math.round((progress.position / progress.duration) * 100);
			frontMatter.completed = progress.completed;
			frontMatter.lastPlayed = formatDate(progress.lastPlayedAt);
		}

		if (episode.guid) {
			frontMatter.guid = episode.guid;
		}

		if (podcast.imageUrl) {
			frontMatter.image = podcast.imageUrl;
		}

		const lines = ['---'];
		for (const [key, value] of Object.entries(frontMatter)) {
			if (value !== undefined && value !== null) {
				if (typeof value === 'string' && value.includes(':')) {
					lines.push(`${key}: "${value}"`);
				} else {
					lines.push(`${key}: ${value}`);
				}
			}
		}
		lines.push('---\n');

		return lines.join('\n');
	}

	/**
	 * Generate metadata section
	 */
	private generateMetadataSection(episode: Episode, podcast: Podcast): string {
		const lines = [
			'## Episode Information\n',
			`**Podcast:** ${podcast.title}`,
			`**Author:** ${podcast.author}`,
			`**Published:** ${formatDate(episode.publishDate)}`,
			`**Duration:** ${formatDuration(episode.duration)}`,
		];

		if (episode.episodeNumber) {
			lines.push(`**Episode:** ${episode.episodeNumber}`);
		}

		if (episode.seasonNumber) {
			lines.push(`**Season:** ${episode.seasonNumber}`);
		}

		if (episode.episodeType) {
			lines.push(`**Type:** ${episode.episodeType}`);
		}

		lines.push('');
		return lines.join('\n');
	}

	/**
	 * Generate progress section
	 */
	private generateProgressSection(progress: PlayProgress): string {
		const percentage = Math.round((progress.position / progress.duration) * 100);
		const status = progress.completed ? 'Completed' : 'In Progress';

		return [
			'## Listening Progress\n',
			`**Status:** ${status}`,
			`**Progress:** ${percentage}%`,
			`**Last Played:** ${formatDate(progress.lastPlayedAt)}`,
			'',
		].join('\n');
	}

	/**
	 * Generate description section
	 */
	private generateDescriptionSection(episode: Episode): string {
		return [
			'## Description\n',
			episode.description,
			'',
		].join('\n');
	}

	/**
	 * Generate timestamps section
	 */
	private generateTimestampsSection(): string {
		return [
			'## Timestamps\n',
			'<!-- Add your timestamps here -->',
			'<!-- Example: [12:34] Topic discussion -->',
			'',
		].join('\n');
	}

	/**
	 * Generate notes section
	 */
	private generateNotesSection(): string {
		return [
			'## Notes\n',
			'<!-- Add your notes here -->',
			'',
		].join('\n');
	}

	/**
	 * Generate template variables
	 */
	private generateTemplateVariables(
		episode: Episode,
		podcast: Podcast,
		progress?: PlayProgress
	): TemplateVariables {
		const variables: TemplateVariables = {
			episodeTitle: episode.title,
			episodeDescription: episode.description,
			podcastTitle: podcast.title,
			podcastAuthor: podcast.author,
			episodeNumber: episode.episodeNumber,
			seasonNumber: episode.seasonNumber,
			publishDate: formatDate(episode.publishDate),
			duration: formatDuration(episode.duration),
			audioUrl: episode.audioUrl,
			episodeUrl: episode.guid,
			imageUrl: episode.imageUrl || podcast.imageUrl,
		};

		if (progress) {
			const percentage = Math.round((progress.position / progress.duration) * 100);
			variables.progress = formatDuration(progress.position);
			variables.completionPercentage = `${percentage}%`;
		}

		return variables;
	}

	/**
	 * Apply custom template
	 */
	private applyTemplate(template: string, variables: TemplateVariables): string {
		let result = template;

		// Replace all variables
		for (const [key, value] of Object.entries(variables)) {
			if (value !== undefined && value !== null) {
				const regex = new RegExp(`{{${key}}}`, 'g');
				result = result.replace(regex, value.toString());
			}
		}

		return result;
	}

	/**
	 * Generate file name
	 */
	private generateFileName(
		episode: Episode,
		podcast: Podcast,
		template?: string
	): string {
		if (template) {
			const variables = this.generateTemplateVariables(episode, podcast);
			let fileName = this.applyTemplate(template, variables);

			// Sanitize file name
			fileName = this.sanitizeFileName(fileName);

			if (!fileName.endsWith('.md')) {
				fileName += '.md';
			}

			return fileName;
		}

		// Default file name format
		const sanitizedPodcast = this.sanitizeFileName(podcast.title);
		const sanitizedEpisode = this.sanitizeFileName(episode.title);

		return `${sanitizedPodcast} - ${sanitizedEpisode}.md`;
	}

	/**
	 * Sanitize file name (remove invalid characters)
	 */
	private sanitizeFileName(name: string): string {
		return name
			.replace(/[\\/:*?"<>|]/g, '-')
			.replace(/\s+/g, ' ')
			.trim();
	}

	/**
	 * Ensure folder exists
	 */
	private async ensureFolderExists(folderPath: string): Promise<void> {
		const normalizedPath = normalizePath(folderPath);

		if (!(await this.vault.adapter.exists(normalizedPath))) {
			await this.vault.createFolder(normalizedPath);
			logger.info('Created folder', normalizedPath);
		}
	}

	/**
	 * Create or update file
	 */
	private async createOrUpdateFile(filePath: string, content: string): Promise<TFile> {
		const normalizedPath = normalizePath(filePath);

		// Check if file exists
		const existingFile = this.vault.getAbstractFileByPath(normalizedPath);

		if (existingFile instanceof TFile) {
			// Update existing file
			await this.vault.modify(existingFile, content);
			logger.info('Updated existing file', normalizedPath);
			return existingFile;
		} else {
			// Create new file
			const file = await this.vault.create(normalizedPath, content);
			logger.info('Created new file', normalizedPath);
			return file;
		}
	}

	/**
	 * Export multiple episodes
	 */
	async exportEpisodes(
		episodes: Array<{ episode: Episode; podcast: Podcast; progress?: PlayProgress }>,
		options: NoteExportOptions = {}
	): Promise<TFile[]> {
		logger.methodEntry('NoteExporter', 'exportEpisodes', `count=${episodes.length}`);

		const files: TFile[] = [];

		for (const { episode, podcast, progress } of episodes) {
			try {
				const file = await this.exportEpisode(episode, podcast, progress, options);
				files.push(file);
			} catch (error) {
				logger.error(`Failed to export episode: ${episode.title}`, error);
				// Continue with other episodes
			}
		}

		logger.info(`Exported ${files.length} episodes`);
		logger.methodExit('NoteExporter', 'exportEpisodes');

		return files;
	}

	/**
	 * Quick export with minimal options
	 */
	async quickExport(
		episode: Episode,
		podcast: Podcast,
		progress?: PlayProgress
	): Promise<TFile> {
		return await this.exportEpisode(episode, podcast, progress, {
			includeFrontMatter: true,
			includeDescription: true,
			includeMetadata: true,
			includeTimestamps: true,
			includeProgress: !!progress,
		});
	}
}
