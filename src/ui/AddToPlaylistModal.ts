/**
 * AddToPlaylistModal - Modal for adding episodes to playlist
 *
 * Allows users to:
 * - Select an existing playlist
 * - Create a new playlist
 * - Add episode(s) to the selected playlist
 */

import { App, Modal, Setting, Notice } from 'obsidian';
import type PodcastPlayerPlugin from '../../main';
import { Playlist, Episode } from '../model';

/**
 * Modal for adding episodes to a playlist
 */
export class AddToPlaylistModal extends Modal {
	plugin: PodcastPlayerPlugin;
	episodes: Episode[];
	onSubmit: (playlistId: string) => void;

	constructor(app: App, plugin: PodcastPlayerPlugin, episodes: Episode[], onSubmit: (playlistId: string) => void) {
		super(app);
		this.plugin = plugin;
		this.episodes = episodes;
		this.onSubmit = onSubmit;
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h2', { text: 'Add to Playlist' });

		// Load existing playlists
		const playlistManager = this.plugin.getPlaylistManager();
		const playlists = await playlistManager.getAllPlaylists();

		// Playlist selection
		let selectedPlaylistId: string | null = null;

		if (playlists.length > 0) {
			new Setting(contentEl)
				.setName('Select playlist')
				.setDesc('Choose an existing playlist or create a new one')
				.addDropdown(dropdown => {
					dropdown.addOption('', 'Create new playlist...');
					playlists.forEach(playlist => {
						dropdown.addOption(playlist.id, playlist.name);
					});
					dropdown.onChange(value => {
						selectedPlaylistId = value || null;
						// Show/hide new playlist inputs
						const newPlaylistSettings = contentEl.querySelector('.new-playlist-settings') as HTMLElement;
						if (newPlaylistSettings) {
							newPlaylistSettings.style.display = selectedPlaylistId ? 'none' : 'block';
						}
					});
				});
		}

		// New playlist inputs
		let newPlaylistName = '';
		let newPlaylistDescription = '';

		const newPlaylistSettings = contentEl.createDiv({ cls: 'new-playlist-settings' });

		new Setting(newPlaylistSettings)
			.setName('Playlist name')
			.setDesc('Enter a name for the new playlist')
			.addText(text => text
				.setPlaceholder('My Playlist')
				.onChange(value => {
					newPlaylistName = value;
				}));

		new Setting(newPlaylistSettings)
			.setName('Description (optional)')
			.setDesc('Add a description for the playlist')
			.addTextArea(text => text
				.setPlaceholder('Description...')
				.onChange(value => {
					newPlaylistDescription = value;
				}));

		if (playlists.length > 0 && selectedPlaylistId) {
			newPlaylistSettings.style.display = 'none';
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
					let playlistId: string;

					if (selectedPlaylistId) {
						// Add to existing playlist
						playlistId = selectedPlaylistId;
					} else {
						// Create new playlist
						if (!newPlaylistName.trim()) {
							new Notice('Please enter a playlist name');
							return;
						}

						const newPlaylist = await playlistManager.createPlaylist(
							newPlaylistName.trim(),
							newPlaylistDescription.trim() || undefined
						);
						playlistId = newPlaylist.id;
					}

					// Add episodes to playlist
					for (const episode of this.episodes) {
						await playlistManager.addEpisode(playlistId, episode.id);
					}

					this.onSubmit(playlistId);
					this.close();

					new Notice(`Added to playlist successfully`);
				} catch (error) {
					console.error('Failed to add to playlist:', error);
					new Notice('Failed to add to playlist');
				}
			});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
