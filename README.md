# Obsidian Podcast

A feature-rich podcast player and manager for Obsidian. Subscribe to podcasts, play episodes, manage playlists and queues, and seamlessly integrate with your notes.

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-Support-yellow?style=for-the-badge&logo=buy-me-a-coffee)](https://buymeacoffee.com/whoami885)

## Features

### 🎧 Podcast Subscription Management
- Subscribe to podcasts via RSS/Atom feed URLs
- **Search podcasts online** using iTunes Search API
- **Import subscriptions** from OPML files
- Automatic feed synchronization and updates
- Browse subscribed podcasts with cover art
- Search and filter podcasts by title, author, or description

### ▶️ Episode Playback
- Built-in audio player with standard controls (play, pause, seek, volume)
- Adjustable playback speed (0.5x - 3.0x)
- Skip intro/outro (customizable per podcast)
- Automatic playback progress tracking
- Resume playback from last position
- **Play from first queue** when clicking play with no episode loaded

### 📋 Playlist & Queue Management
- Create multiple playlists for organizing episodes
- Multiple playback queues with different modes
- Auto-play next episode in queue
- Add episodes to queue or playlist from context menu
- **Play from playlist** without creating separate queues

### ⚙️ Per-Podcast Settings
- Individual volume control for each podcast
- Custom playback speed per podcast
- Custom intro/outro skip times per podcast
- Override global defaults on a per-podcast basis
- **Settings automatically applied** when playing episodes

### 🔍 Search & Organization
- Full-text search across podcasts and episodes
- Sort by title, date, author, duration, or episode count
- Filter episodes by podcast
- View detailed episode information

### 📝 Note Integration
- **Add timestamped notes while listening** - notes are saved to your daily note
- Export episode details to markdown notes
- Include episode metadata (title, description, duration, publish date)
- Customize daily note folder and date format
- Choose note insertion position (top or bottom)

### 💾 File-Based Storage
- All data stored as JSON files in your vault
- Configurable data folder location
- Easy backup and sync with your vault
- OPML import/export for portability
- Full backup and restore functionality

## Installation

### From Obsidian Community Plugins

1. Open Obsidian Settings
2. Navigate to **Community Plugins**
3. Click **Browse** and search for "Podcast"
4. Click **Install**
5. Enable the plugin in the **Installed Plugins** list

### Manual Installation

1. Download the latest release from [GitHub Releases](https://github.com/VaalRL/obsidian-podcast-player/releases)
2. Extract the files to your vault's plugins folder:
   ```
   <vault>/.obsidian/plugins/podcast-player/
   ```
3. Copy these files:
   - `main.js`
   - `manifest.json`
   - `styles.css`
4. Reload Obsidian
5. Enable the plugin in **Settings → Community Plugins**

### Build from Source

1. Clone the repository:
   ```bash
   git clone https://github.com/VaalRL/obsidian-podcast-player.git
   cd obsidian-podcast-player
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the plugin:
   ```bash
   npm run build
   ```

4. Copy `main.js`, `manifest.json`, and `styles.css` to your vault's plugins folder.

## Usage

### Getting Started

1. **Open the Podcast Sidebar**
   - Click the podcast icon (🎙️) in the left ribbon
   - Or use the command palette: `Podcast: Open Podcast Sidebar`

2. **Subscribe to a Podcast**
   - Click the "➕ Subscribe" button
   - Choose from three methods:
     - **Search**: Search for podcasts by keyword
     - **URL**: Enter the podcast RSS/Atom feed URL directly
     - **From File**: Import from an OPML file

3. **Browse Episodes**
   - Click on a podcast to view its episodes
   - Episodes are sorted by publish date (newest first)

4. **Play an Episode**
   - Click on an episode to start playback
   - Use the player controls in the right sidebar

### Playback Controls

The player view appears in the right sidebar:

- **Play/Pause**: Click the play/pause button
- **Seek**: Click on the progress bar or drag the slider
- **Volume**: Adjust the volume slider
- **Speed**: Change playback speed (0.5x - 3.0x)
- **Skip**: Skip forward 30s / backward 15s
- **Previous/Next**: Navigate queue or playlist
- **Episode Info**: Click ℹ️ to view episode details
- **Add Note**: Click 📝 to add a timestamped note to your daily note

### Adding Notes While Listening

1. While playing an episode, click the **Add Note** button (📝)
2. A modal appears showing:
   - Current podcast name
   - Current episode title
   - Current playback timestamp
3. Enter your note content
4. Click **Add Note** or press `Ctrl/Cmd + Enter`
5. The note is automatically added to your daily note with full context

### Managing Playlists

1. **Create a Playlist**
   - Open the Playlist/Queue view (ribbon icon or command palette)
   - Click "➕ Create Playlist"
   - Enter name and description

2. **Add Episodes to Playlist**
   - Right-click an episode
   - Select "📁 Add to Playlist"
   - Choose the target playlist

3. **Play from Playlist**
   - Open a playlist
   - Click "Play All" or click individual episodes
   - Previous/Next navigation works within the playlist

### Managing Queues

1. **Create a Queue**
   - Open the Playlist/Queue view
   - Switch to "Queues" tab
   - Click "➕ Create Queue"

2. **Add Episodes to Queue**
   - Right-click an episode
   - Select "➕ Add to Queue"
   - Choose the target queue

3. **Queue Features**
   - Auto-play next episode when current finishes
   - Episodes are removed from queue after playing

### Per-Podcast Settings

1. Right-click on a podcast in the sidebar
2. Select "⚙️ Settings"
3. Configure:
   - **Volume**: Custom volume (0% - 100%)
   - **Playback Speed**: Custom speed (0.5x - 3.0x)
   - **Skip Intro**: Seconds to skip at episode start
   - **Skip Outro**: Seconds to skip at episode end
4. Settings are **automatically applied** when playing episodes from that podcast

## Configuration

Access settings via **Settings → Podcast**

### Data Storage
- **Data Folder Path**: Where podcast data is stored

### Default Playback Settings
- **Default Volume**: 0% - 100%
- **Default Playback Speed**: 0.5x - 3.0x
- **Skip Intro/Outro Seconds**: Seconds to skip

### Daily Note Integration
- **Daily Note Folder**: Folder where your daily notes are stored
- **Daily Note Date Format**: Date format for filenames (moment.js format)
- **Note Insert Position**: Top or bottom of the daily note

### Download & Cache
- **Auto Download New Episodes**: Automatically download when feeds update
- **Maximum Cached Episodes**: Number of episodes to keep in cache

### Feed Sync
- **Feed Update Interval**: How often to check for new episodes (15 min - 24 hours)

### Notifications
- **Enable Notifications**: Show notifications for new episodes and playback events

### Backup & Restore
- **Export/Import OPML**: Standard podcast subscription format
- **Export/Import Full Backup**: Complete data backup as JSON

### Support
- **Buy Me A Coffee**: Support the plugin development

## Data Storage Structure

All plugin data is stored in the configured data folder:

```
data/
├── subscriptions.json      # Podcast subscriptions with settings
├── progress.json           # Playback progress for all episodes
├── settings.json           # Plugin settings
├── playlists/
│   └── <playlist-id>.json  # Individual playlist files
├── queues/
│   └── <queue-id>.json     # Individual queue files
├── cache/
│   ├── feeds/              # Cached feed data
│   └── images/             # Cached cover images
└── backups/                # Automatic daily backups
```

## Troubleshooting

### Podcast Won't Subscribe
- Verify the feed URL is correct (should be RSS or Atom XML feed)
- Check if the feed is accessible (try opening in browser)
- Some feeds may require CORS proxy

### Episodes Won't Play
- Check your internet connection
- Verify the audio URL is accessible
- Some podcasts may have regional restrictions

### Feed Not Updating
- Check the feed update interval in settings
- Manually refresh feeds by clicking the refresh button
- Some feeds may have rate limiting

### Progress Not Saving
- Ensure the data folder path is writable
- Check for file permission issues

### Per-Podcast Settings Not Applied
- Settings are applied when loading an episode
- Try pausing and resuming, or reload the episode

## Development

### Prerequisites
- Node.js 16+ and npm
- TypeScript 5.3+
- Obsidian 0.15.0+

### Setup

```bash
# Clone repository
git clone https://github.com/VaalRL/obsidian-podcast-player.git
cd obsidian-podcast-player

# Install dependencies
npm install

# Build for development (with watch mode)
npm run dev

# Build for production
npm run build

# Run tests
npm test
```

### Project Structure

```
src/
├── model/        # Data models and interfaces
├── storage/      # File-based storage (JSON)
├── podcast/      # Podcast subscription management
├── player/       # Audio player engine
├── feed/         # RSS/Atom feed parsing
├── playlist/     # Playlist management
├── queue/        # Queue management
├── markdown/     # Note export functionality
├── cleanup/      # Automatic cleanup service
├── backup/       # Backup and restore service
├── ui/           # User interface components
├── utils/        # Utility functions and logging
main.ts           # Plugin entry point
```

## Privacy

This plugin respects your privacy:
- **No data collection**: We don't collect any personal information
- **Local storage only**: All data stays in your vault
- **No tracking**: No analytics or telemetry

See our full [Privacy Policy](https://chlien.pages.dev/post/obsidian-podcast/) for details.

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Roadmap

- [ ] Keyboard shortcuts
- [ ] Offline episode downloads
- [ ] Playback statistics
- [ ] Chapter markers support
- [ ] Sleep timer
- [ ] Custom note templates
- [ ] Transcription support

## Credits

Inspired by [Podnote](https://github.com/chhoumann/podnote) by Christian B. B. Houmann.

## License

MIT License - see [LICENSE](./LICENSE) for details.

## Support

If you find this plugin useful, consider supporting the development:

<a href="https://buymeacoffee.com/whoami885" target="_blank">
  <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" height="50">
</a>

---

- 🐛 [Report a bug](https://github.com/VaalRL/obsidian-podcast-player/issues)
- 💡 [Request a feature](https://github.com/VaalRL/obsidian-podcast-player/issues)
- 💬 [Discussions](https://github.com/VaalRL/obsidian-podcast-player/discussions)

---

**Note**: This plugin is in active development. Features and documentation may change. Please report any issues or suggestions!
