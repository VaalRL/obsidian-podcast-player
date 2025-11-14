/**
 * PodcastSettingsModal - Modal for configuring individual podcast settings
 *
 * Allows users to configure:
 * - Volume (0.0 - 1.0)
 * - Playback speed (0.5 - 3.0)
 * - Skip intro seconds
 * - Skip outro seconds
 */

import { App, Modal, Setting, Notice } from 'obsidian';
import type PodcastPlayerPlugin from '../../main';
import { Podcast, PodcastSettings } from '../model';

/**
 * Modal for configuring individual podcast settings
 */
export class PodcastSettingsModal extends Modal {
	plugin: PodcastPlayerPlugin;
	podcast: Podcast;
	onSubmit: (settings: PodcastSettings) => void;

	// Form values
	private volume: number;
	private playbackSpeed: number;
	private skipIntroSeconds: number;
	private skipOutroSeconds: number;

	constructor(
		app: App,
		plugin: PodcastPlayerPlugin,
		podcast: Podcast,
		onSubmit: (settings: PodcastSettings) => void
	) {
		super(app);
		this.plugin = plugin;
		this.podcast = podcast;
		this.onSubmit = onSubmit;

		// Initialize with current settings or defaults
		const currentSettings = podcast.settings || plugin.settings.defaultPlaybackSettings;
		this.volume = currentSettings.volume;
		this.playbackSpeed = currentSettings.playbackSpeed;
		this.skipIntroSeconds = currentSettings.skipIntroSeconds;
		this.skipOutroSeconds = currentSettings.skipOutroSeconds || 0;
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h2', { text: `Settings for ${this.podcast.title}` });

		// Info text
		contentEl.createEl('p', {
			text: 'These settings override the global defaults for this podcast only.',
			cls: 'setting-item-description'
		});

		// Volume setting
		new Setting(contentEl)
			.setName('Volume')
			.setDesc('Playback volume for this podcast (0% - 100%)')
			.addSlider(slider => slider
				.setLimits(0, 100, 5)
				.setValue(this.volume * 100)
				.setDynamicTooltip()
				.onChange((value) => {
					this.volume = value / 100;
				}));

		// Playback speed setting
		new Setting(contentEl)
			.setName('Playback speed')
			.setDesc('Playback speed for this podcast (0.5x - 3.0x)')
			.addSlider(slider => slider
				.setLimits(50, 300, 25)
				.setValue(this.playbackSpeed * 100)
				.setDynamicTooltip()
				.onChange((value) => {
					this.playbackSpeed = value / 100;
				}));

		// Skip intro seconds
		new Setting(contentEl)
			.setName('Skip intro')
			.setDesc('Number of seconds to skip at the beginning of each episode')
			.addText(text => text
				.setPlaceholder('0')
				.setValue(String(this.skipIntroSeconds))
				.onChange((value) => {
					const num = parseInt(value);
					if (!isNaN(num) && num >= 0) {
						this.skipIntroSeconds = num;
					}
				}));

		// Skip outro seconds
		new Setting(contentEl)
			.setName('Skip outro')
			.setDesc('Number of seconds to skip at the end of each episode')
			.addText(text => text
				.setPlaceholder('0')
				.setValue(String(this.skipOutroSeconds))
				.onChange((value) => {
					const num = parseInt(value);
					if (!isNaN(num) && num >= 0) {
						this.skipOutroSeconds = num;
					}
				}));

		// Buttons
		const buttonContainer = contentEl.createDiv({ cls: 'modal-button-container' });

		// Reset to defaults button
		buttonContainer.createEl('button', { text: 'Reset to Global Defaults' })
			.addEventListener('click', () => {
				this.resetToDefaults();
			});

		buttonContainer.createEl('button', { text: 'Cancel' })
			.addEventListener('click', () => this.close());

		buttonContainer.createEl('button', { text: 'Save', cls: 'mod-cta' })
			.addEventListener('click', () => {
				this.handleSave();
			});
	}

	/**
	 * Reset to global defaults
	 */
	private resetToDefaults(): void {
		const defaults = this.plugin.settings.defaultPlaybackSettings;
		this.volume = defaults.volume;
		this.playbackSpeed = defaults.playbackSpeed;
		this.skipIntroSeconds = defaults.skipIntroSeconds;
		this.skipOutroSeconds = defaults.skipOutroSeconds || 0;

		// Re-render the modal
		this.close();
		new PodcastSettingsModal(this.app, this.plugin, this.podcast, this.onSubmit).open();
	}

	/**
	 * Handle save button click
	 */
	private handleSave(): void {
		try {
			// Validate values
			if (this.volume < 0 || this.volume > 1) {
				new Notice('Volume must be between 0 and 1');
				return;
			}

			if (this.playbackSpeed < 0.5 || this.playbackSpeed > 3.0) {
				new Notice('Playback speed must be between 0.5x and 3.0x');
				return;
			}

			if (this.skipIntroSeconds < 0) {
				new Notice('Skip intro seconds must be positive');
				return;
			}

			if (this.skipOutroSeconds < 0) {
				new Notice('Skip outro seconds must be positive');
				return;
			}

			// Create settings object
			const settings: PodcastSettings = {
				volume: this.volume,
				playbackSpeed: this.playbackSpeed,
				skipIntroSeconds: this.skipIntroSeconds,
				skipOutroSeconds: this.skipOutroSeconds
			};

			// Call the callback
			this.onSubmit(settings);

			// Close the modal
			this.close();

			new Notice('Podcast settings saved');

		} catch (error) {
			console.error('Failed to save podcast settings:', error);
			new Notice('Failed to save settings');
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
