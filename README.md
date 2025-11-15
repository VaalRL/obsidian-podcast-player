# Obsidian Podcast Player

A feature-rich podcast player and manager for Obsidian. Subscribe to podcasts, play episodes, manage playlists and queues, and seamlessly integrate with your notes.

## Features

### Core Functionality

- **Podcast Subscription Management**
  - Subscribe to podcasts via RSS/Atom feed URLs
  - Automatic feed synchronization and updates
  - Browse subscribed podcasts with cover art
  - Search and filter podcasts by title, author, or description

- **Episode Playback**
  - Built-in audio player with standard controls (play, pause, seek, volume)
  - Adjustable playback speed (0.5x - 3.0x)
  - Skip intro/outro (customizable per podcast)
  - Automatic playback progress tracking
  - Resume playback from last position

- **Playlist & Queue Management**
  - Create multiple playlists for organizing episodes
  - Multiple playback queues with different modes
  - Shuffle, repeat (none/one/all), and auto-play options
  - Drag-and-drop episode reordering
  - Add episodes to queue or playlist from context menu

- **Per-Podcast Settings**
  - Individual volume control for each podcast
  - Custom playback speed per podcast
  - Custom intro/outro skip times per podcast
  - Override global defaults on a per-podcast basis

- **Search & Organization**
  - Full-text search across podcasts and episodes
  - Sort by title, date, author, duration, or episode count
  - Filter episodes by podcast
  - View detailed episode information

- **Note Integration**
  - Export episode details to markdown notes
  - Include episode metadata (title, description, duration, publish date)
  - Add playback progress and timestamps
  - Customize note templates

- **File-Based Storage**
  - All data stored as JSON files in your vault
  - Configurable data folder location
  - Easy backup and sync with your vault
  - No external database required

## Installation

### From Obsidian Community Plugins (Coming Soon)

1. Open Obsidian Settings
2. Navigate to **Community Plugins**
3. Click **Browse** and search for "Podcast Player"
4. Click **Install**
5. Enable the plugin in the **Installed Plugins** list

### Manual Installation

1. Download the latest release from [GitHub Releases](https://github.com/VaalRL/obsidian-podcast-player/releases)
2. Extract the files to your vault's plugins folder:
   ```
   <vault>/.obsidian/plugins/podcast-player/
   ```
3. Reload Obsidian
4. Enable the plugin in **Settings → Community Plugins**

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

4. Copy `main.js`, `manifest.json`, and `styles.css` to your vault's plugins folder:
   ```
   <vault>/.obsidian/plugins/podcast-player/
   ```

## Usage

### Getting Started

1. **Open the Podcast Sidebar**
   - Click the podcast icon in the left ribbon
   - Or use the command palette: `Podcast Player: Open Podcast Sidebar`

2. **Subscribe to a Podcast**
   - Click the "➕ Subscribe" button
   - Enter the podcast RSS/Atom feed URL
   - Click "Subscribe"

3. **Browse Episodes**
   - Click on a podcast to view its episodes
   - Episodes are sorted by publish date (newest first)

4. **Play an Episode**
   - Click on an episode to view details
   - Click "▶️ Play" to start playback
   - Or use the play button next to the episode in the list

### Playback Controls

The player view appears at the bottom of Obsidian when an episode is playing:

- **Play/Pause**: Click the play/pause button
- **Seek**: Click on the progress bar or drag the slider
- **Volume**: Adjust the volume slider
- **Speed**: Change playback speed (0.5x - 3.0x)
- **Skip**: Skip forward/backward 15 seconds
- **Next/Previous**: Navigate queue (when playing from queue)

### Managing Playlists

1. **Create a Playlist**
   - Open the Playlist/Queue view (ribbon icon or command palette)
   - Click "➕ Create Playlist"
   - Enter name and description
   - Click "Create"

2. **Add Episodes to Playlist**
   - Right-click an episode in the podcast view
   - Select "📁 Add to Playlist"
   - Choose the target playlist
   - Click "Add"

3. **Manage Playlist Episodes**
   - Open the playlist in the Playlist/Queue view
   - Drag episodes to reorder
   - Right-click to remove episodes
   - Click "Play All" to add all episodes to queue

### Managing Queues

1. **Create a Queue**
   - Open the Playlist/Queue view
   - Switch to "Queues" tab
   - Click "➕ Create Queue"
   - Configure queue settings (shuffle, repeat, auto-play)
   - Click "Create"

2. **Add Episodes to Queue**
   - Right-click an episode
   - Select "➕ Add to Queue"
   - Choose the target queue
   - Click "Add"

3. **Queue Playback Options**
   - **Shuffle**: Randomize playback order
   - **Repeat**: None, repeat one episode, or repeat all
   - **Auto-play**: Automatically play next episode when current finishes

### Searching and Filtering

**Podcast View:**
- Use the search box to filter podcasts by title, author, or description
- Use the sort dropdown to sort by:
  - Title (A-Z or Z-A)
  - Author (A-Z or Z-A)
  - Subscribed date (oldest/newest first)

**Episode View:**
- Search episodes by title or description
- Sort by:
  - Title (A-Z or Z-A)
  - Publish date (oldest/newest first)
  - Duration (shortest/longest first)

**Playlist/Queue View:**
- Search playlists/queues by name or description
- Sort by:
  - Name (A-Z or Z-A)
  - Created date (oldest/newest first)
  - Episode count (least/most first)

### Per-Podcast Settings

1. Browse to a podcast in the sidebar
2. Right-click on the podcast
3. Select "⚙️ Settings"
4. Configure:
   - **Volume**: Custom volume for this podcast (0% - 100%)
   - **Playback Speed**: Custom speed (0.5x - 3.0x)
   - **Skip Intro**: Seconds to skip at episode start
   - **Skip Outro**: Seconds to skip at episode end
5. Click "Save" or "Reset to Global Defaults"

### Export to Note

1. View episode details (right-click → "View Details")
2. Click "📝 Export to Note"
3. A new markdown note is created with:
   - Episode title and description
   - Podcast information
   - Duration and publish date
   - Playback progress (if any)
   - Direct link to audio file

## Configuration

Access settings via **Settings → Podcast Player**

### Data Storage

- **Data Folder Path**: Where podcast data is stored (default: `.obsidian/plugins/podcast-player/data`)
  - `subscriptions.json`: Podcast subscriptions
  - `progress.json`: Playback progress
  - `playlists/`: Individual playlist files
  - `queues/`: Individual queue files
  - `cache/`: Feed and image cache

### Default Playback Settings

These apply to all podcasts by default (can be overridden per-podcast):

- **Default Volume**: 0% - 100% (default: 100%)
- **Default Playback Speed**: 0.5x - 3.0x (default: 1.0x)
- **Skip Intro Seconds**: Seconds to skip at episode start (default: 0)
- **Skip Outro Seconds**: Seconds to skip at episode end (default: 0)

### Download & Cache

- **Auto Download New Episodes**: Automatically download new episodes when feeds update (default: off)
- **Maximum Cached Episodes**: Number of episodes to keep in cache (default: 50)

### Feed Sync

- **Feed Update Interval**: How often to check for new episodes
  - Options: 15 min, 30 min, 1 hour, 2 hours, 6 hours, 12 hours, 24 hours
  - Default: 1 hour

### Notifications

- **Enable Notifications**: Show notifications for new episodes and playback events (default: on)

### Advanced

- **Reset to Defaults**: Reset all settings to default values
- **Export Settings**: Export settings to JSON file for backup
- **Import Settings**: Import settings from JSON file

## Data Storage Structure

All plugin data is stored in the configured data folder (default: `.obsidian/plugins/podcast-player/data/`):

```
data/
├── subscriptions.json          # Podcast subscriptions with individual settings
├── progress.json               # Playback progress for all episodes
├── settings.json               # Plugin settings
├── playlists/
│   ├── <playlist-id>.json     # Individual playlist files
│   └── ...
├── queues/
│   ├── <queue-id>.json        # Individual queue files
│   └── ...
└── cache/
    ├── feeds/
    │   ├── <podcast-id>.json  # Cached feed data
    │   └── ...
    └── images/
        ├── <image-id>         # Cached cover images
        └── ...
```

## Keyboard Shortcuts

Coming soon! Planned shortcuts:
- Play/Pause: `Space`
- Skip forward: `→`
- Skip backward: `←`
- Volume up: `↑`
- Volume down: `↓`
- Speed up: `Shift + >`
- Speed down: `Shift + <`

## Troubleshooting

### Podcast Won't Subscribe

- Verify the feed URL is correct (should be RSS or Atom XML feed)
- Check if the feed is accessible (try opening in browser)
- Look for errors in the Developer Console (`Ctrl+Shift+I` → Console tab)

### Episodes Won't Play

- Check your internet connection
- Verify the audio URL is accessible
- Some podcasts may have regional restrictions
- Check browser console for errors

### Feed Not Updating

- Check the feed update interval in settings
- Manually refresh by unsubscribing and re-subscribing
- Some feeds may have rate limiting

### Progress Not Saving

- Ensure the data folder path is writable
- Check for file permission issues
- Verify vault sync is not causing conflicts

### Performance Issues

- Reduce the number of cached episodes in settings
- Increase feed update interval
- Clear cache by deleting the `cache/` folder in data directory

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

# Run tests with coverage
npm run test:coverage
```

### Project Structure

```
src/
├── model/                # Data models and interfaces
├── storage/              # File-based storage (JSON)
├── podcast/              # Podcast subscription management
├── player/               # Audio player engine
├── feed/                 # RSS/Atom feed parsing
├── playlist/             # Playlist management
├── queue/                # Queue management
├── markdown/             # Note export functionality
├── ui/                   # User interface components
├── utils/                # Utility functions and logging
└── main.ts               # Plugin entry point
```

### Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

See [CONTRIBUTING.md](./CONTRIBUTING.md) for detailed guidelines (coming soon).

## Roadmap

- [ ] Advanced keyboard shortcuts
- [ ] Podcast discovery and search
- [ ] Offline episode downloads
- [ ] Playback statistics and analytics
- [ ] Chapter markers support
- [ ] Variable speed playback with pitch correction
- [ ] Sleep timer
- [ ] Custom note templates
- [ ] Integration with other Obsidian plugins

## Credits

Inspired by [Podnote](https://github.com/chhoumann/podnote) by Christian B. B. Houmann.

## License

MIT License - see [LICENSE](./LICENSE) for details.

## Support

- 🐛 [Report a bug](https://github.com/VaalRL/obsidian-podcast-player/issues)
- 💡 [Request a feature](https://github.com/VaalRL/obsidian-podcast-player/issues)
- 📖 [Documentation](https://github.com/VaalRL/obsidian-podcast-player/wiki) (coming soon)
- 💬 [Discussions](https://github.com/VaalRL/obsidian-podcast-player/discussions)

---

**Note**: This plugin is in active development. Features and documentation may change. Please report any issues or suggestions!
