/**
 * TextInputModal - Simple modal for text input
 */

import { App, Modal, Setting } from 'obsidian';

export class TextInputModal extends Modal {
    private result: string | null = null;
    private onSubmit: (result: string | null) => void;
    private title: string;
    private message: string;
    private defaultValue: string;

    constructor(
        app: App,
        title: string,
        message: string,
        defaultValue: string,
        onSubmit: (result: string | null) => void
    ) {
        super(app);
        this.title = title;
        this.message = message;
        this.defaultValue = defaultValue;
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl('h2', { text: this.title });

        let inputValue = this.defaultValue;

        new Setting(contentEl)
            .setName(this.message)
            .addText(text => text
                .setValue(this.defaultValue)
                .onChange(value => {
                    inputValue = value;
                })
                .inputEl.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        this.result = inputValue;
                        this.close();
                    }
                }));

        // Buttons
        const buttonContainer = contentEl.createDiv({ cls: 'modal-button-container' });

        buttonContainer.createEl('button', { text: 'Cancel' })
            .addEventListener('click', () => {
                this.result = null;
                this.close();
            });

        buttonContainer.createEl('button', { text: 'OK', cls: 'mod-cta' })
            .addEventListener('click', () => {
                this.result = inputValue;
                this.close();
            });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
        this.onSubmit(this.result);
    }
}
