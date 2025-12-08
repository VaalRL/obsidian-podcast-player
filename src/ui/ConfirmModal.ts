import { App, Modal, Setting, ButtonComponent } from 'obsidian';

/**
 * Options for the confirm modal
 */
export interface ConfirmModalOptions {
	title: string;
	message: string;
	confirmText?: string;
	cancelText?: string;
	confirmClass?: 'cta' | 'warning' | 'destructive';
	/** If set, user must type this text to confirm */
	requireInput?: string;
	/** Placeholder for the input field */
	inputPlaceholder?: string;
}

/**
 * A reusable confirmation modal in Obsidian style
 */
export class ConfirmModal extends Modal {
	private options: ConfirmModalOptions;
	private onConfirm: () => void;
	private onCancel?: () => void;
	private inputValue: string = '';

	constructor(
		app: App,
		options: ConfirmModalOptions,
		onConfirm: () => void,
		onCancel?: () => void
	) {
		super(app);
		this.options = {
			confirmText: 'Confirm',
			cancelText: 'Cancel',
			confirmClass: 'cta',
			...options
		};
		this.onConfirm = onConfirm;
		this.onCancel = onCancel;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('confirm-modal');

		// Title
		contentEl.createEl('h2', { text: this.options.title });

		// Message
		const messageEl = contentEl.createEl('p', { cls: 'confirm-modal-message' });
		messageEl.style.whiteSpace = 'pre-wrap';
		messageEl.setText(this.options.message);

		// Input field if required
		let inputEl: HTMLInputElement | null = null;
		if (this.options.requireInput) {
			const inputContainer = contentEl.createDiv({ cls: 'confirm-modal-input' });
			inputContainer.style.marginTop = '16px';

			inputContainer.createEl('p', {
				text: `Type "${this.options.requireInput}" to confirm:`,
				cls: 'confirm-modal-input-label'
			});

			const inputSetting = new Setting(inputContainer)
				.addText(text => {
					text.setPlaceholder(this.options.inputPlaceholder || this.options.requireInput || '')
						.onChange(value => {
							this.inputValue = value;
							// Enable/disable confirm button based on input
							if (confirmBtn) {
								confirmBtn.setDisabled(value !== this.options.requireInput);
							}
						});
					inputEl = text.inputEl;
				});

			inputSetting.settingEl.style.border = 'none';
			inputSetting.settingEl.style.padding = '0';
		}

		// Buttons
		const buttonContainer = contentEl.createDiv({ cls: 'modal-button-container' });
		buttonContainer.style.display = 'flex';
		buttonContainer.style.justifyContent = 'flex-end';
		buttonContainer.style.gap = '10px';
		buttonContainer.style.marginTop = '20px';

		new ButtonComponent(buttonContainer)
			.setButtonText(this.options.cancelText!)
			.onClick(() => {
				if (this.onCancel) {
					this.onCancel();
				}
				this.close();
			});

		let confirmBtn: ButtonComponent;
		confirmBtn = new ButtonComponent(buttonContainer)
			.setButtonText(this.options.confirmText!);

		// Set button style
		if (this.options.confirmClass === 'warning' || this.options.confirmClass === 'destructive') {
			confirmBtn.setWarning();
		} else {
			confirmBtn.setCta();
		}

		// Disable initially if input is required
		if (this.options.requireInput) {
			confirmBtn.setDisabled(true);
		}

		confirmBtn.onClick(() => {
			if (this.options.requireInput && this.inputValue !== this.options.requireInput) {
				return;
			}
			this.onConfirm();
			this.close();
		});

		// Focus input if present, otherwise focus confirm button
		setTimeout(() => {
			if (inputEl) {
				inputEl.focus();
			}
		}, 10);
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

/**
 * Helper function to show a confirmation modal and return a promise
 */
export function showConfirmModal(
	app: App,
	options: ConfirmModalOptions
): Promise<boolean> {
	return new Promise((resolve) => {
		const modal = new ConfirmModal(
			app,
			options,
			() => resolve(true),
			() => resolve(false)
		);
		modal.open();
	});
}
