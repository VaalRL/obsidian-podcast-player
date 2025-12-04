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
import { Podcast, PodcastSettings, AutoAddRule } from '../model';

/**
 * Modal for configuring individual podcast settings
 */
export class PodcastSettingsModal extends Modal {
	plugin: PodcastPlayerPlugin;
	podcast: Podcast;
	onSubmit: (settings: PodcastSettings, autoAddRule?: AutoAddRule) => void;

	// Form values
	private volume: number;
	private playbackSpeed: number;
	private skipIntroSeconds: number;
	private skipOutroSeconds: number;

	// Auto-add settings
	private autoAddEnabled: boolean;
	private autoAddTargetType: 'playlist' | 'queue';
	private autoAddTargetId: string;
	private autoAddPosition: 'top' | 'bottom';

	constructor(
		app: App,
		plugin: PodcastPlayerPlugin,
		podcast: Podcast,
		onSubmit: (settings: PodcastSettings, autoAddRule?: AutoAddRule) => void
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

		// Initialize auto-add settings
		const rule = podcast.autoAddRule;
		this.autoAddEnabled = rule?.enabled || false;
		this.autoAddTargetType = rule?.targetType || 'queue';
		this.autoAddTargetId = rule?.targetId || '';
		this.autoAddPosition = rule?.position || 'bottom';
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

		// Auto-add Section
		contentEl.createEl('h3', { text: 'Auto-add New Episodes' });

		new Setting(contentEl)
			.setName('Enable auto-add')
			.setDesc('Automatically add new episodes to a playlist or queue')
			.addToggle(toggle => toggle
				.setValue(this.autoAddEnabled)
				.onChange(async (value) => {
					this.autoAddEnabled = value;
					this.onOpen(); // Re-render to show/hide options
				}));

		if (this.autoAddEnabled) {
			const playlistManager = this.plugin.getPlaylistManager();
			const queueManager = this.plugin.getQueueManager();

			const playlists = await playlistManager.getAllPlaylists();
			const queues = await queueManager.getAllQueues();

			// Target selection
			const targetSetting = new Setting(contentEl)
				.setName('Target')
				.setDesc('Select where to add new episodes');

			targetSetting.addDropdown(dropdown => {
				dropdown.addOption('', 'Select a target...');

				if (queues.length > 0) {
					queues.forEach(q => dropdown.addOption(`queue:${q.id}`, `Queue: ${q.name}`));
				}

				if (playlists.length > 0) {
					playlists.forEach(p => dropdown.addOption(`playlist:${p.id}`, `Playlist: ${p.name}`));
				}

				// Set initial value
				if (this.autoAddTargetId) {
					dropdown.setValue(`${this.autoAddTargetType}:${this.autoAddTargetId}`);
				}

				dropdown.onChange(value => {
					if (value) {
						const [type, id] = value.split(':');
						this.autoAddTargetType = type as 'playlist' | 'queue';
						this.autoAddTargetId = id;
					} else {
						this.autoAddTargetId = '';
					}
				});
			});

			// Position selection
			new Setting(contentEl)
				.setName('Position')
				.setDesc('Where to add the episode in the list')
				.addDropdown(dropdown => dropdown
					.addOption('top', 'Top (Beginning)')
					.addOption('bottom', 'Bottom (End)')
					.setValue(this.autoAddPosition)
					.onChange(value => {
						this.autoAddPosition = value as 'top' | 'bottom';
					}));
		}

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

			// Create auto-add rule
			let autoAddRule: AutoAddRule | undefined;
			if (this.autoAddEnabled) {
				if (!this.autoAddTargetId) {
					new Notice('Please select a target for auto-add');
					return;
				}

				autoAddRule = {
					enabled: true,
					targetType: this.autoAddTargetType,
					targetId: this.autoAddTargetId,
					position: this.autoAddPosition
				};
			} else {
				// If disabled but previously existed, we might want to keep it but disabled,
				// or just remove it. Let's keep it disabled if we have values, or undefined if not.
				if (this.podcast.autoAddRule) {
					autoAddRule = {
						...this.podcast.autoAddRule,
						enabled: false
					};
				}
			}

			// Call the callback
			this.onSubmit(settings, autoAddRule);

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
