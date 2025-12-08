/**
 * SubscribePodcastModal - Modal for subscribing to a new podcast
 *
 * Allows users to:
 * - Search for podcasts online
 * - Enter an RSS/Atom feed URL directly
 * - Subscribe to the podcast
 * - Handle validation and errors
 */

import { App, Modal, Setting, Notice, setIcon } from 'obsidian';
import type PodcastPlayerPlugin from '../../main';
import { PodcastSearchResult } from '../model';

/**
 * Modal for subscribing to a new podcast via search or RSS/Atom feed URL
 */
export class SubscribePodcastModal extends Modal {
	plugin: PodcastPlayerPlugin;
	onSubmit: (podcastId: string) => void;

	private searchResults: PodcastSearchResult[] = [];
	private selectedFeeds: Set<string> = new Set();
	private currentPage = 0;
	private readonly resultsPerPage = 5;
	private searchResultsContainer: HTMLElement | null = null;
	private feedUrl = '';
	private feedUrlInput: HTMLInputElement | null = null;

	constructor(app: App, plugin: PodcastPlayerPlugin, onSubmit: (podcastId: string) => void) {
		super(app);
		this.plugin = plugin;
		this.onSubmit = onSubmit;
	}

	private activeTab: 'search' | 'url' = 'search';
	private contentContainer: HTMLElement | null = null;

	async onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('subscribe-podcast-modal');

		contentEl.createEl('h2', { text: 'Subscribe to Podcast' });

		// Render Tabs
		this.renderTabs(contentEl);

		// Content Container
		this.contentContainer = contentEl.createDiv({ cls: 'subscribe-modal-content' });

		this.renderContent();
	}

	private renderTabs(container: HTMLElement) {
		const tabsContainer = container.createDiv({ cls: 'subscribe-modal-tabs' });

		const searchTab = tabsContainer.createEl('button', {
			text: 'Search Online',
			cls: 'subscribe-modal-tab'
		});
		if (this.activeTab === 'search') searchTab.addClass('active');

		searchTab.onclick = () => {
			if (this.activeTab === 'search') return;
			this.activeTab = 'search';
			this.updateTabStyles(tabsContainer);
			this.renderContent();
		};

		const urlTab = tabsContainer.createEl('button', {
			text: 'Add by URL',
			cls: 'subscribe-modal-tab'
		});
		if (this.activeTab === 'url') urlTab.addClass('active');

		urlTab.onclick = () => {
			if (this.activeTab === 'url') return;
			this.activeTab = 'url';
			this.updateTabStyles(tabsContainer);
			this.renderContent();
		};
	}

	private updateTabStyles(tabsContainer: HTMLElement) {
		const tabs = tabsContainer.querySelectorAll('.subscribe-modal-tab');
		tabs[0].className = `subscribe-modal-tab ${this.activeTab === 'search' ? 'active' : ''}`;
		tabs[1].className = `subscribe-modal-tab ${this.activeTab === 'url' ? 'active' : ''}`;
	}

	private renderContent() {
		if (!this.contentContainer) return;
		this.contentContainer.empty();

		if (this.activeTab === 'search') {
			this.renderSearchSection(this.contentContainer);
			// Restore search results if available
			if (this.searchResults.length > 0) {
				this.renderSearchResults();
			}
		} else {
			this.renderUrlSection(this.contentContainer);
		}
	}

	/**
	 * Render the search section
	 */
	private renderSearchSection(container: HTMLElement): void {
		const searchSection = container.createDiv({ cls: 'subscribe-search-section' });

		// Search input container
		const searchContainer = searchSection.createDiv({ cls: 'subscribe-search-container' });

		let searchQuery = '';
		const searchInput = searchContainer.createEl('input', {
			type: 'text',
			placeholder: 'Search podcasts...',
			cls: 'subscribe-search-input'
		});

		searchInput.addEventListener('input', (e) => {
			searchQuery = (e.target as HTMLInputElement).value;
		});

		searchInput.addEventListener('keydown', (e) => {
			if (e.key === 'Enter') {
				e.preventDefault();
				this.performSearch(searchQuery);
			}
		});

		const searchBtn = searchContainer.createEl('button', {
			cls: 'subscribe-search-button',
			attr: { 'aria-label': 'Search' }
		});
		setIcon(searchBtn, 'search');
		searchBtn.addEventListener('click', () => {
			this.performSearch(searchQuery);
		});

		// Search results container
		this.searchResultsContainer = searchSection.createDiv({ cls: 'subscribe-search-results' });
	}

	/**
	 * Render the URL input section
	 */
	private renderUrlSection(container: HTMLElement): void {
		const urlSection = container.createDiv({ cls: 'subscribe-url-section' });

		urlSection.createEl('p', {
			text: 'Enter the RSS or Atom feed URL of the podcast you want to subscribe to.',
			cls: 'subscribe-url-desc'
		});

		new Setting(urlSection)
			.setName('Feed URL')
			.setDesc('Example: https://example.com/podcast/feed.xml')
			.addText(text => {
				text
					.setPlaceholder('https://...')
					.setValue(this.feedUrl)
					.onChange(value => {
						this.feedUrl = value;
					});
				this.feedUrlInput = text.inputEl;
			});

		// Buttons
		const buttonContainer = urlSection.createDiv({ cls: 'modal-button-container' });

		buttonContainer.createEl('button', { text: 'Cancel' })
			.addEventListener('click', () => this.close());

		const subscribeBtn = buttonContainer.createEl('button', { text: 'Subscribe', cls: 'mod-cta' });
		subscribeBtn.addEventListener('click', async () => {
			if (this.feedUrl.trim()) {
				await this.handleSubscribeByUrl(this.feedUrl.trim());
			} else {
				new Notice('Please enter a URL');
			}
		});
	}

	/**
	 * Perform online search
	 */
	private async performSearch(query: string): Promise<void> {
		if (!query.trim()) {
			new Notice('Please enter a search query');
			return;
		}

		if (!this.searchResultsContainer) return;

		try {
			// Show loading state
			this.searchResultsContainer.empty();
			this.searchResultsContainer.createDiv({
				cls: 'subscribe-loading',
				text: 'Searching...'
			});

			// Perform search
			const podcastService = this.plugin.getPodcastService();
			this.searchResults = await podcastService.searchOnline(query, { limit: 50 });
			this.currentPage = 0;

			// Render results
			this.renderSearchResults();

		} catch (error) {
			console.error('Search failed:', error);
			this.searchResultsContainer.empty();

			const errorDiv = this.searchResultsContainer.createDiv({
				cls: 'subscribe-error'
			});

			errorDiv.createEl('p', {
				text: '搜尋失敗'
			});

			errorDiv.createEl('p', {
				text: '無法連接到 iTunes API。這可能是由於：',
				cls: 'subscribe-error-detail'
			});

			const reasonsList = errorDiv.createEl('ul', {
				cls: 'subscribe-error-reasons'
			});

			reasonsList.createEl('li', { text: '網路連線問題' });
			reasonsList.createEl('li', { text: 'Obsidian 的網路請求限制' });
			reasonsList.createEl('li', { text: 'iTunes API 暫時無法使用' });

			errorDiv.createEl('p', {
				text: '建議：請嘗試直接輸入 RSS Feed URL 來訂閱 Podcast',
				cls: 'subscribe-error-suggestion'
			});
		}
	}

	/**
	 * Render search results with pagination
	 */
	private renderSearchResults(): void {
		if (!this.searchResultsContainer) return;

		this.searchResultsContainer.empty();

		if (this.searchResults.length === 0) {
			this.searchResultsContainer.createDiv({
				cls: 'subscribe-no-results',
				text: 'No podcasts found'
			});
			return;
		}

		// Calculate pagination
		const startIndex = this.currentPage * this.resultsPerPage;
		const endIndex = Math.min(startIndex + this.resultsPerPage, this.searchResults.length);
		const pageResults = this.searchResults.slice(startIndex, endIndex);

		// Render results
		const resultsList = this.searchResultsContainer.createDiv({ cls: 'subscribe-results-list' });

		for (const result of pageResults) {
			this.renderSearchResultItem(resultsList, result);
		}

		// Render pagination controls
		if (this.searchResults.length > this.resultsPerPage) {
			this.renderPagination();
		}
	}

	/**
	 * Render a single search result item
	 */
	private renderSearchResultItem(container: HTMLElement, result: PodcastSearchResult): void {
		const item = container.createDiv({ cls: 'subscribe-result-item' });
		if (this.selectedFeeds.has(result.feedUrl)) {
			item.addClass('selected');
		}

		// Artwork
		if (result.artworkUrl) {
			const artwork = item.createEl('img', {
				cls: 'subscribe-result-artwork',
				attr: {
					src: result.artworkUrl,
					alt: result.title
				}
			});
		} else {
			const placeholder = item.createDiv({ cls: 'subscribe-result-artwork-placeholder' });
			setIcon(placeholder, 'mic');
		}

		// Info
		const info = item.createDiv({ cls: 'subscribe-result-info' });
		info.createEl('h4', { text: result.title, cls: 'subscribe-result-title' });
		if (result.author) {
			info.createEl('p', { text: result.author, cls: 'subscribe-result-author' });
		}
		if (result.description) {
			const desc = info.createEl('p', {
				text: result.description,
				cls: 'subscribe-result-description'
			});
			// Truncate long descriptions
			if (result.description.length > 100) {
				desc.setText(result.description.substring(0, 100) + '...');
			}
		}

		// Select checkbox (replacing button for multi-select)
		const checkboxContainer = item.createDiv({ cls: 'subscribe-result-checkbox-container' });
		const checkbox = checkboxContainer.createEl('input', {
			type: 'checkbox',
			cls: 'subscribe-result-checkbox'
		});
		checkbox.checked = this.selectedFeeds.has(result.feedUrl);

		const toggleSelection = () => {
			if (this.selectedFeeds.has(result.feedUrl)) {
				this.selectedFeeds.delete(result.feedUrl);
				item.removeClass('selected');
				checkbox.checked = false;
			} else {
				this.selectedFeeds.add(result.feedUrl);
				item.addClass('selected');
				checkbox.checked = true;
			}
		};

		checkbox.addEventListener('click', (e) => {
			e.stopPropagation();
			toggleSelection();
		});

		// Click anywhere on item to toggle selection
		item.addEventListener('click', () => {
			toggleSelection();
		});
	}

	/**
	 * Render pagination controls
	 */
	private renderPagination(): void {
		if (!this.searchResultsContainer) return;

		const totalPages = Math.ceil(this.searchResults.length / this.resultsPerPage);
		const pagination = this.searchResultsContainer.createDiv({ cls: 'subscribe-pagination' });

		// Previous button
		const prevBtn = pagination.createEl('button', {
			text: '← Previous',
			cls: 'subscribe-pagination-button'
		});
		prevBtn.disabled = this.currentPage === 0;
		prevBtn.addEventListener('click', () => {
			if (this.currentPage > 0) {
				this.currentPage--;
				this.renderSearchResults();
			}
		});

		// Page info
		pagination.createSpan({
			text: `Page ${this.currentPage + 1} of ${totalPages}`,
			cls: 'subscribe-pagination-info'
		});

		// Next button
		const nextBtn = pagination.createEl('button', {
			text: 'Next →',
			cls: 'subscribe-pagination-button'
		});
		nextBtn.disabled = this.currentPage >= totalPages - 1;
		nextBtn.addEventListener('click', () => {
			if (this.currentPage < totalPages - 1) {
				this.currentPage++;
				this.renderSearchResults();
			}
		});
	}

	/**
	 * Handle subscribing to multiple podcasts
	 */
	private async handleSubscribeMultiple(feedUrls: string[]): Promise<void> {
		if (feedUrls.length === 0) return;

		try {
			const loadingNotice = new Notice(`Subscribing to ${feedUrls.length} podcasts...`, 0);
			const podcastService = this.plugin.getPodcastService();

			let successCount = 0;
			let failCount = 0;

			for (const url of feedUrls) {
				const result = await podcastService.subscribe(url);
				if (result.success) {
					successCount++;
				} else {
					failCount++;
					console.error(`Failed to subscribe to ${url}:`, result.error);
				}
			}

			loadingNotice.hide();

			if (successCount > 0) {
				new Notice(`Successfully subscribed to ${successCount} podcasts`);
				this.close();
				// Trigger callback with the last successful ID (or handle differently if needed)
				// For now, we just refresh the view via the callback if at least one succeeded
				this.onSubmit('');
			}

			if (failCount > 0) {
				new Notice(`Failed to subscribe to ${failCount} podcasts`);
			}

		} catch (error) {
			console.error('Batch subscription failed:', error);
			new Notice('Failed to subscribe to podcasts');
		}
	}

	/**
	 * Handle subscribe by URL
	 */
	private async handleSubscribeByUrl(feedUrl: string): Promise<void> {
		// Validate URL
		if (!feedUrl) {
			new Notice('Please enter a feed URL');
			return;
		}

		if (!this.isValidUrl(feedUrl)) {
			new Notice('Please enter a valid URL');
			return;
		}

		try {
			// Show loading notification
			const loadingNotice = new Notice('Subscribing to podcast...', 0);

			// Subscribe to the podcast
			const podcastService = this.plugin.getPodcastService();
			const result = await podcastService.subscribe(feedUrl);

			// Hide loading notification
			loadingNotice.hide();

			// Check if subscription was successful
			if (result.success && result.podcast) {
				// Show success notification
				new Notice(`Successfully subscribed to: ${result.podcast.title}`);

				// Close the modal
				this.close();

				// Trigger the callback
				this.onSubmit(result.podcast.id);
			} else {
				// Show error message
				const errorMessage = result.error || 'Failed to subscribe to podcast';
				new Notice(errorMessage);
			}

		} catch (error) {
			console.error('Failed to subscribe to podcast:', error);

			// Determine the error message
			let errorMessage = 'Failed to subscribe to podcast';

			if (error instanceof Error) {
				if (error.message.includes('already subscribed')) {
					errorMessage = 'You are already subscribed to this podcast';
				} else if (error.message.includes('Invalid feed')) {
					errorMessage = 'Invalid RSS/Atom feed URL';
				} else if (error.message.includes('Network')) {
					errorMessage = 'Network error. Please check your connection.';
				} else if (error.message.includes('timeout')) {
					errorMessage = 'Request timed out. Please try again.';
				}
			}

			new Notice(errorMessage);
		}
	}

	/**
	 * Validate if the string is a valid URL
	 */
	private isValidUrl(urlString: string): boolean {
		try {
			const url = new URL(urlString);
			// Only accept http and https protocols
			return url.protocol === 'http:' || url.protocol === 'https:';
		} catch {
			return false;
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
		this.searchResults = [];
		this.currentPage = 0;
		this.searchResultsContainer = null;
		this.feedUrl = '';
		this.feedUrlInput = null;
		this.selectedFeeds.clear();
	}
}
