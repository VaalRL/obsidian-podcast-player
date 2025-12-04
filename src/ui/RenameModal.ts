import { App, Modal, Setting, ButtonComponent } from 'obsidian';

export class RenameModal extends Modal {
    private name: string;
    private onSubmit: (name: string) => void;
    private onDelete?: () => void;
    private title: string;
    private placeholder: string;

    constructor(
        app: App,
        title: string,
        initialName: string,
        placeholder: string,
        onSubmit: (name: string) => void,
        onDelete?: () => void
    ) {
        super(app);
        this.title = title;
        this.name = initialName;
        this.placeholder = placeholder;
        this.onSubmit = onSubmit;
        this.onDelete = onDelete;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl('h2', { text: this.title });

        const inputSetting = new Setting(contentEl)
            .addText(text => text
                .setValue(this.name)
                .setPlaceholder(this.placeholder)
                .onChange(value => {
                    this.name = value;
                }));

        // Focus the input
        inputSetting.controlEl.querySelector('input')?.focus();

        const buttonContainer = contentEl.createDiv({ cls: 'modal-button-container' });
        buttonContainer.style.display = 'flex';
        buttonContainer.style.justifyContent = 'space-between';
        buttonContainer.style.marginTop = '20px';

        // Delete button (left side)
        if (this.onDelete) {
            const deleteBtn = new ButtonComponent(buttonContainer)
                .setButtonText('Delete')
                .setWarning()
                .onClick(() => {
                    if (this.onDelete) {
                        this.onDelete();
                        this.close();
                    }
                });
            deleteBtn.buttonEl.style.marginRight = 'auto';
        }

        // Cancel and Save buttons (right side)
        const rightButtons = buttonContainer.createDiv();
        rightButtons.style.display = 'flex';
        rightButtons.style.gap = '10px';

        new ButtonComponent(rightButtons)
            .setButtonText('Cancel')
            .onClick(() => this.close());

        new ButtonComponent(rightButtons)
            .setButtonText('Save')
            .setCta()
            .onClick(() => {
                this.onSubmit(this.name);
                this.close();
            });

        // Handle Enter key
        contentEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.onSubmit(this.name);
                this.close();
            }
        });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
