# Changelog

All notable changes to the Obsidian Podcast Player plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Comprehensive README.md with features, installation, and usage guide
- CHANGELOG.md for version history tracking
- Unit tests for core modules:
  - SettingsStore (10 tests) - Settings management
  - QueueManager (30 tests) - Queue operations, navigation, shuffle/repeat
  - PlaylistManager (39 tests) - Playlist CRUD, episode management, search, merge/duplicate
  - ProgressStore (23 tests) - Progress tracking, statistics, import/export
  - PlayerController (37 tests) - Player control, episode loading, playback, seeking
  - ProgressTracker (40 tests) - Progress tracking, periodic save, resume, completion
  - PlaybackEngine (46 tests) - Audio playback, controls, event handling, lifecycle
  - audioUtils (46 tests) - Audio utility functions, validation, formatting
  - timeUtils (30 tests) - Time formatting, parsing, relative time
- Jest testing infrastructure with Obsidian API mocks
- Test coverage reporting (301 tests passing)
  - **Utility modules: 76% overall coverage**
    - audioUtils: 100% coverage 🎯
    - timeUtils: 100% coverage 🎯
  - **Player module: 90% coverage** 🎉
    - ProgressTracker: 95% coverage
    - PlaybackEngine: 92% coverage
    - PlayerController: 85% coverage
  - **Storage module: 84% coverage**
    - ProgressStore: 84% coverage
  - **Playlist/Queue modules:**
    - PlaylistManager: 95% coverage
    - QueueManager: 57% coverage
  - SettingsStore: 52% coverage

## [0.1.0] - 2025-11-15

### Added

#### Core Features
- Podcast subscription management via RSS/Atom feeds
- Built-in audio player with standard controls
- Automatic playback progress tracking
- Resume playback from last position

#### Playlist & Queue Management
- Create and manage multiple playlists
- Create and manage multiple playback queues
- Shuffle, repeat, and auto-play options
- Drag-and-drop episode reordering
- Add episodes to queue or playlist from context menu

#### Search & Filtering
- Full-text search across podcasts and episodes
- Search in podcast sidebar (podcasts by title, author, description; episodes by title, description)
- Search in playlist/queue view (playlists/queues by name, description)
- Real-time search filtering with clear button

#### Sorting
- Sort podcasts by title, author, or subscribed date
- Sort episodes by title, publish date, or duration
- Sort playlists/queues by name, created date, or episode count
- Ascending/descending sort direction toggle

#### Per-Podcast Settings
- Individual volume control for each podcast
- Custom playback speed per podcast (0.5x - 3.0x)
- Custom intro skip time per podcast
- Custom outro skip time per podcast
- Override global defaults on a per-podcast basis
- Reset to global defaults option

#### Episode Details
- Episode detail modal with comprehensive information
- Display episode metadata (title, description, duration, publish date)
- Display podcast information (show name, author)
- Visual playback progress indicator
- Episode and season numbers (when available)
- Episode artwork display

#### Note Integration
- Export episode details to markdown notes
- Include episode metadata in exported notes
- Include podcast information in exported notes
- Include playback progress in exported notes
- Automatic note creation and opening

#### User Interface
- Podcast sidebar view for browsing subscriptions and episodes
- Player view with playback controls
- Playlist/Queue management view
- Unified interface for playlists and queues
- Context menus for quick actions
- Episode detail modal
- Subscribe podcast modal
- Add to queue modal
- Add to playlist modal
- Podcast settings modal

#### Storage & Sync
- File-based storage using JSON files
- Configurable data folder location
- Automatic feed synchronization
- Cached feed data for performance
- Image caching for podcast artwork

#### Settings
- Comprehensive settings tab
- Data storage configuration
- Default playback settings (volume, speed, skip intro/outro)
- Download & cache settings
- Feed update interval configuration
- Notification preferences
- Settings export/import functionality
- Reset to defaults option

### Technical

#### Architecture
- TypeScript implementation with strict typing
- Modular architecture with clear separation of concerns
- Single Source of Truth (SSOT) principle
- File-based storage system (SingleFileStore, MultiFileStore)
- Event-driven player controller
- RSS/Atom feed parsing with rss-parser

#### Storage Structure
- `subscriptions.json` - Podcast subscriptions with individual settings
- `progress.json` - Playback progress for all episodes
- `settings.json` - Plugin settings
- `playlists/<id>.json` - Individual playlist files
- `queues/<id>.json` - Individual queue files
- `cache/feeds/<id>.json` - Cached feed data
- `cache/images/<id>` - Cached cover images

#### Core Modules
- `src/model/` - Data models and interfaces
- `src/storage/` - File-based storage implementation
- `src/podcast/` - Podcast subscription management
- `src/player/` - Audio player engine
- `src/feed/` - RSS/Atom feed parsing
- `src/playlist/` - Playlist management
- `src/queue/` - Queue management
- `src/markdown/` - Note export functionality
- `src/ui/` - User interface components
- `src/utils/` - Utility functions and logging

### Build System
- esbuild for fast compilation
- TypeScript type checking
- Jest for testing
- Development and production build modes
- Test vault integration for development

### Dependencies
- Obsidian API (latest)
- rss-parser (3.13.0)
- TypeScript (5.3.3)

## Release Notes

### Version 0.1.0 - Initial Release

This is the initial release of the Obsidian Podcast Player plugin, providing a comprehensive podcast management and playback solution within Obsidian.

**Key Highlights:**
- Subscribe to podcasts via RSS/Atom feeds
- Play episodes with full playback controls
- Create playlists and queues for organizing episodes
- Customize settings per podcast (volume, speed, skip times)
- Search and sort across all content
- Export episode information to markdown notes
- All data stored as files in your vault for easy backup and sync

**What's Working:**
- All core UI features are implemented and functional
- Podcast subscription and episode browsing
- Full playback controls with progress tracking
- Playlist and queue management
- Search and sorting across all views
- Per-podcast settings configuration
- Note export functionality

**Known Limitations:**
- No keyboard shortcuts yet (planned for future release)
- No podcast discovery feature (planned for future release)
- No offline episode downloads (planned for future release)
- Limited testing coverage (in progress)
- Documentation is being expanded

**Next Steps:**
- Add comprehensive test coverage
- Implement keyboard shortcuts
- Add podcast discovery and search
- Implement offline downloads
- Performance optimizations
- Submit to Obsidian Community Plugins

---

## Version History

- **0.1.0** (2025-11-15) - Initial release with core features

[Unreleased]: https://github.com/VaalRL/obsidian-podcast-player/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/VaalRL/obsidian-podcast-player/releases/tag/v0.1.0
