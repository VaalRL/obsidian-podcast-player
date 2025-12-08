/**
 * AddNoteModal - Modal for adding notes while listening to podcasts
 *
 * Allows users to add timestamped notes that will be inserted into their daily note.
 */

import { App, Modal, Notice, TextAreaComponent } from 'obsidian';
import type PodcastPlayerPlugin from '../../main';
import { Episode, Podcast } from '../model';

declare global {
    interface Window {
        moment: typeof import('moment');
    }
}

/**
 * Modal for adding podcast notes
 */
export class AddNoteModal extends Modal {
    plugin: PodcastPlayerPlugin;
    episode: Episode;
    podcast: Podcast | null;
    currentPosition: number;
    noteContent: string = '';
    onSubmit: (note: string) => void;

    constructor(
        app: App,
        plugin: PodcastPlayerPlugin,
        episode: Episode,
        podcast: Podcast | null,
        currentPosition: number,
        onSubmit: (note: string) => void
    ) {
        super(app);
        this.plugin = plugin;
        this.episode = episode;
        this.podcast = podcast;
        this.currentPosition = currentPosition;
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('add-note-modal');

        // Header
        contentEl.createEl('h2', { text: 'Add Note' });

        // Show current context
        const contextEl = contentEl.createDiv({ cls: 'add-note-context' });

        if (this.podcast) {
            contextEl.createEl('p', {
                text: `📻 ${this.podcast.title}`,
                cls: 'add-note-podcast'
            });
        }

        contextEl.createEl('p', {
            text: `🎙️ ${this.episode.title}`,
            cls: 'add-note-episode'
        });

        contextEl.createEl('p', {
            text: `⏱️ ${this.formatTime(this.currentPosition)}`,
            cls: 'add-note-timestamp'
        });

        // Note input
        const noteContainer = contentEl.createDiv({ cls: 'add-note-input-container' });
        noteContainer.createEl('label', {
            text: 'Your note:',
            cls: 'add-note-label'
        });

        const textArea = new TextAreaComponent(noteContainer);
        textArea
            .setPlaceholder('Enter your note here...')
            .setValue(this.noteContent)
            .onChange(value => {
                this.noteContent = value;
            });
        textArea.inputEl.addClass('add-note-textarea');
        textArea.inputEl.rows = 5;

        // Auto-focus the textarea
        setTimeout(() => textArea.inputEl.focus(), 50);

        // Buttons
        const buttonContainer = contentEl.createDiv({ cls: 'add-note-buttons' });

        buttonContainer.createEl('button', { text: 'Cancel' })
            .addEventListener('click', () => this.close());

        const submitBtn = buttonContainer.createEl('button', {
            text: 'Add Note',
            cls: 'mod-cta'
        });
        submitBtn.addEventListener('click', () => this.handleSubmit());

        // Handle Enter+Ctrl/Cmd to submit
        textArea.inputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                this.handleSubmit();
            }
        });
    }

    private async handleSubmit(): Promise<void> {
        if (!this.noteContent.trim()) {
            new Notice('Please enter a note');
            return;
        }

        try {
            await this.insertNoteIntoDailyNote();
            this.onSubmit(this.noteContent);
            new Notice('Note added to daily note');
            this.close();
        } catch (error) {
            console.error('Failed to add note:', error);
            new Notice('Failed to add note');
        }
    }

    private async insertNoteIntoDailyNote(): Promise<void> {
        const settings = this.plugin.settings;
        const now = window.moment();

        // Format the daily note filename
        const dateFormat = settings.dailyNoteDateFormat || 'YYYY-MM-DD';
        const dailyNoteFilename = now.format(dateFormat) + '.md';

        // Build the full path
        const folderPath = settings.dailyNoteFolderPath || '';
        const fullPath = folderPath ? `${folderPath}/${dailyNoteFilename}` : dailyNoteFilename;

        // Format the note content
        const timestamp = now.format('HH:mm:ss');
        const playbackTimestamp = this.formatTime(this.currentPosition);

        const noteEntry = this.formatNoteEntry(timestamp, playbackTimestamp);

        // Get or create the daily note
        let file = this.app.vault.getAbstractFileByPath(fullPath);

        if (!file) {
            // Create the file if it doesn't exist
            const folderExists = folderPath ? this.app.vault.getAbstractFileByPath(folderPath) : true;
            if (folderPath && !folderExists) {
                await this.app.vault.createFolder(folderPath);
            }
            file = await this.app.vault.create(fullPath, '');
        }

        if (file && 'path' in file) {
            // Read existing content
            const content = await this.app.vault.read(file as any);

            // Insert based on position setting
            let newContent: string;
            const position = settings.dailyNoteInsertPosition || 'bottom';

            if (position === 'top') {
                newContent = noteEntry + '\n\n' + content;
            } else {
                // bottom is default
                newContent = content + (content.endsWith('\n') ? '' : '\n') + '\n' + noteEntry;
            }

            await this.app.vault.modify(file as any, newContent);
        }
    }

    private formatNoteEntry(timestamp: string, playbackTimestamp: string): string {
        const podcastName = this.podcast?.title || 'Unknown Podcast';
        const episodeName = this.episode.title;

        return `## 🎧 Podcast Note - ${timestamp}

- **Podcast**: ${podcastName}
- **Episode**: ${episodeName}
- **Playback Position**: ${playbackTimestamp}

${this.noteContent}

---`;
    }

    private formatTime(seconds: number): string {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);

        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        } else {
            return `${minutes}:${secs.toString().padStart(2, '0')}`;
        }
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
