import { Plugin, Notice } from 'obsidian';

/**
 * Podcast Player Plugin for Obsidian
 *
 * A feature-rich podcast player and manager that allows you to:
 * - Subscribe to and manage podcast feeds (RSS/Atom)
 * - Play podcast episodes with custom settings
 * - Manage playlists and playback queues
 * - Export episode information to notes with timestamps
 */
export default class PodcastPlayerPlugin extends Plugin {
	/**
	 * Plugin lifecycle: Called when the plugin is loaded
	 */
	async onload() {
		console.log('Loading Podcast Player plugin');

		// Add ribbon icon for quick access
		this.addRibbonIcon('podcast', 'Podcast Player', (evt: MouseEvent) => {
			new Notice('Podcast Player - Coming Soon!');
		});

		// Register commands
		this.addCommand({
			id: 'open-podcast-player',
			name: 'Open Podcast Player',
			callback: () => {
				new Notice('Podcast Player view - Coming Soon!');
			}
		});

		this.addCommand({
			id: 'subscribe-to-podcast',
			name: 'Subscribe to Podcast',
			callback: () => {
				new Notice('Subscribe to Podcast - Coming Soon!');
			}
		});

		console.log('Podcast Player plugin loaded successfully');
	}

	/**
	 * Plugin lifecycle: Called when the plugin is unloaded
	 */
	onunload() {
		console.log('Unloading Podcast Player plugin');
	}
}
