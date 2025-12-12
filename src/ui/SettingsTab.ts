/**
 * SettingsTab - Obsidian settings UI for Podcast Player
 *
 * Provides a user-friendly interface for configuring plugin settings.
 */

import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import type PodcastPlayerPlugin from '../../main';
import { PluginSettings } from '../model';
import { showConfirmModal } from './ConfirmModal';
import { logger } from '../utils/Logger';

/**
 * PodcastPlayerSettingTab - Settings UI for the Podcast Player plugin
 */
export class PodcastPlayerSettingTab extends PluginSettingTab {
	plugin: PodcastPlayerPlugin;
	private settings: PluginSettings;

	constructor(app: App, plugin: PodcastPlayerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	/**
	 * Display the settings UI
	 */
	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		// Load current settings
		this.loadSettings();


		// === Data Storage ===
		this.addStorageSection(containerEl);

		// === Default Playback Settings ===
		this.addPlaybackSection(containerEl);

		// === Daily Note Settings ===
		this.addDailyNoteSection(containerEl);

		// === Download & Cache ===
		this.addCacheSection(containerEl);

		// === Sync Settings ===
		this.addSyncSection(containerEl);

		// === Notification Settings ===
		this.addNotificationSection(containerEl);

		// === Backup & Restore ===
		this.addBackupSection(containerEl);

		// === Advanced ===
		this.addAdvancedSection(containerEl);

		// === Support ===
		this.addSupportSection(containerEl);
	}

	/**
	 * Load current settings from plugin
	 */
	private loadSettings(): void {
		// In future, this will load from SettingsStore
		// For now, we use default settings as placeholder
		this.settings = this.plugin.settings;
	}

	/**
	 * Save settings to plugin and store
	 */
	private async saveSettings(): Promise<void> {
		// In future, this will save to SettingsStore
		await this.plugin.saveSettings();
	}

	/**
	 * Add storage section
	 */
	private addStorageSection(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName('Data storage')
			.setHeading();

		new Setting(containerEl)
			.setName('Data folder path')
			.setDesc('Folder where podcast data will be stored (relative to vault root)')
			.addText(text => text
				.setPlaceholder(this.settings.dataFolderPath || 'config/plugins/podcast-player/data')
				.setValue(this.settings.dataFolderPath)
				.onChange(async (value) => {
					this.settings.dataFolderPath = value;
					await this.saveSettings();
				}));
	}

	/**
	 * Add playback settings section
	 */
	private addPlaybackSection(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName('Default playback')
			.setDesc('These settings apply to all podcasts by default. Individual podcasts can override these.')
			.setHeading();

		// Volume
		new Setting(containerEl)
			.setName('Default volume')
			.setDesc('Default playback volume (0.0 to 1.0)')
			.addSlider(slider => slider
				.setLimits(0, 100, 5)
				.setValue(this.settings.defaultPlaybackSettings.volume * 100)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.settings.defaultPlaybackSettings.volume = value / 100;
					await this.saveSettings();
				}));

		// Playback Speed
		new Setting(containerEl)
			.setName('Default playback speed')
			.setDesc('Default playback speed (0.5x to 3.0x)')
			.addSlider(slider => slider
				.setLimits(50, 300, 5)
				.setValue(this.settings.defaultPlaybackSettings.playbackSpeed * 100)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.settings.defaultPlaybackSettings.playbackSpeed = value / 100;
					await this.saveSettings();
				}));

		// Skip Intro
		new Setting(containerEl)
			.setName('Skip intro seconds')
			.setDesc('Number of seconds to skip at the beginning of each episode')
			.addText(text => text
				.setPlaceholder('0')
				.setValue(String(this.settings.defaultPlaybackSettings.skipIntroSeconds))
				.onChange(async (value) => {
					const seconds = parseInt(value, 10);
					if (!isNaN(seconds) && seconds >= 0) {
						this.settings.defaultPlaybackSettings.skipIntroSeconds = seconds;
						await this.saveSettings();
					}
				}));

		// Skip Outro
		new Setting(containerEl)
			.setName('Skip outro seconds')
			.setDesc('Number of seconds to skip at the end of each episode')
			.addText(text => text
				.setPlaceholder('0')
				.setValue(String(this.settings.defaultPlaybackSettings.skipOutroSeconds || 0))
				.onChange(async (value) => {
					const seconds = parseInt(value, 10);
					if (!isNaN(seconds) && seconds >= 0) {
						this.settings.defaultPlaybackSettings.skipOutroSeconds = seconds;
						await this.saveSettings();
					}
				}));
	}

	/**
	 * Add daily note settings section
	 */
	private addDailyNoteSection(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName('Daily note integration')
			.setDesc('Configure how podcast notes are added to your daily notes.')
			.setHeading();

		// Daily note folder path
		new Setting(containerEl)
			.setName('Daily note folder')
			.setDesc('Folder where your daily notes are stored (leave empty for vault root)')
			.addText(text => text
				.setPlaceholder('e.g., daily notes')
				.setValue(this.settings.dailyNoteFolderPath)
				.onChange((value) => {
					this.settings.dailyNoteFolderPath = value;
					void this.saveSettings();
				}));

		// Daily note date format
		new Setting(containerEl)
			.setName('Daily note date format')
			.setDesc('Date format for daily note filenames (uses moment.js format)')
			.addText(text => text
				.setPlaceholder('YYYY-MM-DD')
				.setValue(this.settings.dailyNoteDateFormat)
				.onChange((value) => {
					this.settings.dailyNoteDateFormat = value || 'YYYY-MM-DD';
					void this.saveSettings();
				}));

		// Note insert position
		new Setting(containerEl)
			.setName('Note insert position')
			.setDesc('Where to insert podcast notes in your daily note')
			.addDropdown(dropdown => dropdown
				.addOption('top', 'Top of file')
				.addOption('bottom', 'Bottom of file')
				.setValue(this.settings.dailyNoteInsertPosition)
				.onChange((value) => {
					this.settings.dailyNoteInsertPosition = value as 'top' | 'bottom' | 'cursor';
					void this.saveSettings();
				}));
	}

	/**
	 * Add cache settings section
	 */
	private addCacheSection(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName('Download and cache')
			.setHeading();

		// Auto Download
		new Setting(containerEl)
			.setName('Auto download new episodes')
			.setDesc('Automatically download new episodes when feeds are updated')
			.addToggle(toggle => toggle
				.setValue(this.settings.autoDownload)
				.onChange(async (value) => {
					this.settings.autoDownload = value;
					await this.saveSettings();
				}));

		// Max Cache Episodes
		new Setting(containerEl)
			.setName('Maximum cached episodes')
			.setDesc('Maximum number of episodes to keep in cache. Older episodes will be removed.')
			.addText(text => text
				.setPlaceholder('50')
				.setValue(String(this.settings.maxCacheEpisodes))
				.onChange(async (value) => {
					const count = parseInt(value, 10);
					if (!isNaN(count) && count >= 0) {
						this.settings.maxCacheEpisodes = count;
						await this.saveSettings();
					}
				}));
	}

	/**
	 * Add sync settings section
	 */
	private addSyncSection(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName('Feed sync')
			.setHeading();

		// Feed Update Interval
		new Setting(containerEl)
			.setName('Feed update interval')
			.setDesc('How often to check for new episodes (in minutes)')
			.addDropdown(dropdown => dropdown
				.addOption('15', '15 minutes')
				.addOption('30', '30 minutes')
				.addOption('60', '1 hour')
				.addOption('120', '2 hours')
				.addOption('360', '6 hours')
				.addOption('720', '12 hours')
				.addOption('1440', '24 hours')
				.setValue(String(this.settings.feedUpdateInterval))
				.onChange(async (value) => {
					this.settings.feedUpdateInterval = parseInt(value, 10);
					await this.saveSettings();
				}));
	}

	/**
	 * Add notification settings section
	 */
	private addNotificationSection(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName('Notifications')
			.setHeading();

		new Setting(containerEl)
			.setName('Enable notifications')
			.setDesc('Show notifications for new episodes and playback events')
			.addToggle(toggle => toggle
				.setValue(this.settings.enableNotifications)
				.onChange(async (value) => {
					this.settings.enableNotifications = value;
					await this.saveSettings();
				}));
	}

	/**
	 * Add backup section
	 */
	private addBackupSection(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName('Backup and restore')
			.setHeading();

		// OPML Export
		new Setting(containerEl)
			.setName('Export to OPML')
			.setDesc('Export your podcast subscriptions to OPML format (compatible with other podcast apps)')
			.addButton(button => button
				.setButtonText('Export')
				.onClick(() => {
					void this.exportOPML();
				}));

		// OPML Import
		new Setting(containerEl)
			.setName('Import from OPML')
			.setDesc('Import podcast subscriptions from an OPML file')
			.addButton(button => button
				.setButtonText('Import')
				.onClick(() => {
					void this.importOPML();
				}));

		// Full Backup Export
		new Setting(containerEl)
			.setName('Export full backup')
			.setDesc('Export all data including subscriptions, playlists, queues, progress, and settings')
			.addButton(button => button
				.setButtonText('Export backup')
				.onClick(() => {
					void this.exportFullBackup();
				}));

		// Full Backup Import
		new Setting(containerEl)
			.setName('Import full backup')
			.setDesc('Restore all data from a backup file')
			.addButton(button => button
				.setButtonText('Import backup')
				.setWarning()
				.onClick(() => {
					void this.importFullBackup();
				}));

		// Auto backup info
		containerEl.createEl('p', {
			text: 'Auto-backup: daily backups are automatically created and kept for 30 days.',
			cls: 'setting-item-description'
		});
	}

	/**
	 * Add advanced section
	 */
	private addAdvancedSection(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName('Advanced')
			.setHeading();

		// Reset to defaults
		new Setting(containerEl)
			.setName('Reset to defaults')
			.setDesc('Reset all settings to their default values')
			.addButton(button => button
				.setButtonText('Reset')
				.setWarning()
				.onClick(() => {
					void (async () => {
						const confirmed = await showConfirmModal(this.app, {
							title: 'Reset settings',
							message: 'Are you sure you want to reset all settings to their default values?\n\nThis cannot be undone.',
							confirmText: 'Reset',
							confirmClass: 'warning'
						});

						if (confirmed) {
							await this.plugin.resetSettings();
							this.display();
							new Notice('Settings reset to defaults');
						}
					})();
				}));

		// Delete all data
		new Setting(containerEl)
			.setName('Delete all data')
			.setDesc('Delete all subscriptions, playlists, queues, progress, and cache. This cannot be undone!')
			.addButton(button => button
				.setButtonText('Delete all')
				.setWarning()
				.onClick(() => {
					void this.deleteAllData();
				}));
	}

	/**
	 * Add support section with Buy Me A Coffee button
	 */
	private addSupportSection(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName('Support')
			.setDesc('If you find this plugin useful, consider supporting the development!')
			.setHeading();

		// Buy Me A Coffee button container
		const buttonContainer = containerEl.createDiv({ cls: 'podcast-support-button-container' });

		// Buy Me A Coffee link
		const coffeeLink = buttonContainer.createEl('a', {
			href: 'https://buymeacoffee.com/whoami885',
			attr: { target: '_blank', rel: 'noopener noreferrer' }
		});

		coffeeLink.createEl('img', {
			cls: 'podcast-support-button',
			attr: {
				src: 'https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png',
				alt: 'Buy Me A Coffee'
			}
		});
	}

	/**
	 * Export settings to JSON file
	 */
	private exportSettings(): void {
		try {
			const settingsJson = JSON.stringify(this.settings, null, 2);
			const blob = new Blob([settingsJson], { type: 'application/json' });
			const url = URL.createObjectURL(blob);

			const a = document.createElement('a');
			a.href = url;
			a.download = `podcast-player-settings-${Date.now()}.json`;
			a.click();

			URL.revokeObjectURL(url);
			new Notice('Settings exported successfully');
		} catch (error) {
			logger.error('Failed to export settings', error);
			new Notice('Failed to export settings');
		}
	}

	/**
	 * Import settings from JSON file
	 */
	private importSettings(): void {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = '.json';

		input.onchange = async (e: Event) => {
			const target = e.target as HTMLInputElement;
			const file = target.files?.[0];

			if (!file) {
				return;
			}

			try {
				const text = await file.text();
				const importedSettings = JSON.parse(text) as PluginSettings;

				// Validate imported settings (basic check)
				if (!importedSettings.dataFolderPath || !importedSettings.defaultPlaybackSettings) {
					throw new Error('Invalid settings file format');
				}

				// Apply imported settings
				this.settings = importedSettings;
				await this.saveSettings();
				this.display(); // Refresh the display

				new Notice('Settings imported successfully');
			} catch (error) {
				logger.error('Failed to import settings', error);
				new Notice('Failed to import settings: invalid file format');
			}
		};

		input.click();
	}

	/**
	 * Export OPML file
	 */
	private async exportOPML(): Promise<void> {
		try {
			const backupService = this.plugin.getBackupService();
			const opmlContent = await backupService.exportOPML();

			const blob = new Blob([opmlContent], { type: 'text/xml' });
			const url = URL.createObjectURL(blob);

			const a = document.createElement('a');
			a.href = url;
			a.download = `podcast-subscriptions-${new Date().toISOString().split('T')[0]}.opml`;
			a.click();

			URL.revokeObjectURL(url);
			new Notice('Subscriptions exported to OPML');
		} catch (error) {
			logger.error('Failed to export OPML', error);
			new Notice('Failed to export subscriptions');
		}
	}

	/**
	 * Import OPML file
	 */
	private importOPML(): void {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = '.opml,.xml';

		input.onchange = async (e: Event) => {
			const target = e.target as HTMLInputElement;
			const file = target.files?.[0];

			if (!file) {
				return;
			}

			try {
				const text = await file.text();
				const backupService = this.plugin.getBackupService();
				const feedUrls = backupService.parseOPML(text);

				if (feedUrls.length === 0) {
					new Notice('No podcast feeds found in file');
					return;
				}

				// Subscribe to each feed
				const podcastService = this.plugin.getPodcastService();
				let successCount = 0;
				let failCount = 0;

				new Notice(`Importing ${feedUrls.length} podcasts...`);

				for (const feedUrl of feedUrls) {
					try {
						const result = await podcastService.subscribe(feedUrl);
						if (result.success) {
							successCount++;
						} else {
							failCount++;
						}
					} catch {
						failCount++;
					}
				}

				new Notice(`Imported ${successCount} podcasts (${failCount} failed)`);
			} catch (error) {
				logger.error('Failed to import OPML', error);
				new Notice('Failed to import subscriptions: invalid file format');
			}
		};

		input.click();
	}

	/**
	 * Export full backup
	 */
	private async exportFullBackup(): Promise<void> {
		try {
			const backupService = this.plugin.getBackupService();
			const backupJson = await backupService.exportFullBackupJSON(this.settings);

			const blob = new Blob([backupJson], { type: 'application/json' });
			const url = URL.createObjectURL(blob);

			const a = document.createElement('a');
			a.href = url;
			a.download = `podcast-player-backup-${new Date().toISOString().split('T')[0]}.json`;
			a.click();

			URL.revokeObjectURL(url);
			new Notice('Full backup exported successfully');
		} catch (error) {
			logger.error('Failed to export backup', error);
			new Notice('Failed to export backup');
		}
	}

	/**
	 * Import full backup
	 */
	private importFullBackup(): void {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = '.json';

		input.onchange = async (e: Event) => {
			const target = e.target as HTMLInputElement;
			const file = target.files?.[0];

			if (!file) {
				return;
			}

			try {
				const text = await file.text();
				const backupData = JSON.parse(text);

				const backupService = this.plugin.getBackupService();
				if (!backupService.validateBackupData(backupData)) {
					throw new Error('Invalid backup file format');
				}

				// Confirm before restore
				const confirmed = await showConfirmModal(this.app, {
					title: 'Restore backup',
					message: 'This will overwrite all current data. Are you sure you want to restore from this backup?',
					confirmText: 'Restore',
					confirmClass: 'warning'
				});
				if (!confirmed) {
					return;
				}

				// Restore settings
				if (backupData.settings) {
					this.settings = backupData.settings;
					await this.saveSettings();
				}

				// Note: Full data restore would require additional implementation
				// For now, we restore settings and notify user about manual subscription restoration
				new Notice('Settings restored. Please restart Obsidian for full effect.');
				this.display(); // Refresh the display

			} catch (error) {
				logger.error('Failed to import backup', error);
				new Notice('Failed to import backup: invalid file format');
			}
		};

		input.click();
	}

	/**
	 * Delete all plugin data
	 */
	private async deleteAllData(): Promise<void> {
		// First confirmation with details
		const firstConfirm = await showConfirmModal(this.app, {
			title: 'Delete all data',
			message: 'WARNING: This will permanently delete ALL your podcast data including:\n\n• All podcast subscriptions\n• All playlists\n• All queues\n• All playback progress\n• All cached feeds and images\n• All backups\n\nThis action cannot be undone!',
			confirmText: 'Continue',
			confirmClass: 'warning'
		});

		if (!firstConfirm) {
			return;
		}

		// Second confirmation requiring text input
		const finalConfirm = await showConfirmModal(this.app, {
			title: 'Final confirmation',
			message: 'You are about to permanently delete all podcast data.\n\nThis is your last chance to cancel.',
			confirmText: 'Delete all',
			confirmClass: 'destructive',
			requireInput: 'DELETE',
			inputPlaceholder: 'Type DELETE to confirm'
		});

		if (!finalConfirm) {
			new Notice('Deletion cancelled');
			return;
		}

		try {
			new Notice('Deleting all data...');

			const backupService = this.plugin.getBackupService();
			const result = await backupService.deleteAllData();

			if (result.success) {
				new Notice(`All data deleted successfully (${result.deletedItems} items)`);
			} else {
				new Notice(`Data deleted with some errors: ${result.errors.join(', ')}`);
			}

			// Refresh the display
			this.display();
		} catch (error) {
			logger.error('Failed to delete all data', error);
			new Notice('Failed to delete all data');
		}
	}
}
