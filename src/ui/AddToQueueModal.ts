/**
 * AddToQueueModal - Modal for adding episodes to queue
 *
 * Allows users to:
 * - Select an existing queue
 * - Create a new queue
 * - Add episode(s) to the selected queue
 */

import { App, Modal, Setting, Notice } from 'obsidian';
import type PodcastPlayerPlugin from '../../main';
import { Queue, Episode } from '../model';

/**
 * Modal for adding episodes to a queue
 */
export class AddToQueueModal extends Modal {
	plugin: PodcastPlayerPlugin;
	episodes: Episode[];
	onSubmit: (queueId: string) => void;

	constructor(app: App, plugin: PodcastPlayerPlugin, episodes: Episode[], onSubmit: (queueId: string) => void) {
		super(app);
		this.plugin = plugin;
		this.episodes = episodes;
		this.onSubmit = onSubmit;
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h2', { text: 'Add to Queue' });

		// Load existing queues
		const queueManager = this.plugin.getQueueManager();
		const queues = await queueManager.getAllQueues();

		// Queue selection
		let selectedQueueId: string | null = null;

		if (queues.length > 0) {
			new Setting(contentEl)
				.setName('Select queue')
				.setDesc('Choose an existing queue or create a new one')
				.addDropdown(dropdown => {
					dropdown.addOption('', 'Create new queue...');
					queues.forEach(queue => {
						dropdown.addOption(queue.id, queue.name);
					});
					dropdown.onChange(value => {
						selectedQueueId = value || null;
						// Show/hide new queue name input
						const newQueueSetting = contentEl.querySelector('.new-queue-setting') as HTMLElement;
						if (newQueueSetting) {
							newQueueSetting.style.display = selectedQueueId ? 'none' : 'block';
						}
					});
				});
		}

		// New queue name input
		let newQueueName = '';
		const newQueueSetting = new Setting(contentEl)
			.setName('New queue name')
			.setDesc('Enter a name for the new queue')
			.addText(text => text
				.setPlaceholder('My Queue')
				.onChange(value => {
					newQueueName = value;
				}));

		newQueueSetting.settingEl.addClass('new-queue-setting');
		if (queues.length > 0 && selectedQueueId) {
			newQueueSetting.settingEl.style.display = 'none';
		}

		// Episode info
		const episodeInfo = contentEl.createDiv({ cls: 'episode-info' });
		if (this.episodes.length === 1) {
			episodeInfo.createEl('p', { text: `Adding: ${this.episodes[0].title}` });
		} else {
			episodeInfo.createEl('p', { text: `Adding ${this.episodes.length} episodes` });
		}

		// Buttons
		const buttonContainer = contentEl.createDiv({ cls: 'modal-button-container' });

		buttonContainer.createEl('button', { text: 'Cancel' })
			.addEventListener('click', () => this.close());

		buttonContainer.createEl('button', { text: 'Add', cls: 'mod-cta' })
			.addEventListener('click', async () => {
				try {
					let queueId: string;

					if (selectedQueueId) {
						// Add to existing queue
						queueId = selectedQueueId;
					} else {
						// Create new queue
						if (!newQueueName.trim()) {
							new Notice('Please enter a queue name');
							return;
						}

						const newQueue = await queueManager.createQueue(newQueueName.trim());
						queueId = newQueue.id;
					}

					// Add episodes to queue
					for (const episode of this.episodes) {
						await queueManager.addEpisode(queueId, episode.id);
					}

					this.onSubmit(queueId);
					this.close();

					new Notice(`Added to queue successfully`);
				} catch (error) {
					console.error('Failed to add to queue:', error);
					new Notice('Failed to add to queue');
				}
			});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
