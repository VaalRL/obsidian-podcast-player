# Privacy Policy for Podcast Plugin

**Last Updated: December 8, 2025**

## Introduction

This Privacy Policy describes how the Podcast plugin for Obsidian ("the Plugin", "we", "our") handles your information. We are committed to protecting your privacy and being transparent about our data practices.

## Summary

**The Podcast plugin does not collect, store, or transmit any personal data to external servers controlled by the plugin developer.** All your data remains stored locally within your Obsidian vault.

## Information We Do NOT Collect

The Plugin does **not**:
- Collect any personal information
- Track your usage or behavior
- Send analytics or telemetry data
- Access your Obsidian account information
- Store any data on external servers
- Share any information with third parties

## Data Stored Locally

The Plugin stores the following data **locally within your Obsidian vault**:

### Podcast Subscriptions
- RSS/Atom feed URLs you subscribe to
- Podcast metadata (title, author, description, cover image URLs)
- Episode information (title, description, duration, publish date, audio URLs)

### Playback Data
- Episode playback progress and position
- Last played timestamps
- Completed episode markers

### User Preferences
- Plugin settings (volume, playback speed, skip intro/outro seconds)
- Per-podcast custom settings
- Daily note configuration

### Playlists and Queues
- User-created playlist names and episode lists
- Playback queue configurations

### Cache Data
- Cached RSS feed data (to reduce network requests)
- Cached podcast cover images (optional, for offline access)

**Location of Data:**
All data is stored as JSON files in your configured data folder (default: `.obsidian/plugins/podcast-player/data/`). This data syncs with your vault if you use a syncing service.

## Network Requests

The Plugin makes the following network requests:

### RSS/Atom Feed Fetching
- **Purpose**: To retrieve podcast episodes and metadata
- **Data Sent**: Only the feed URL
- **Destination**: The podcast publisher's RSS feed server
- **Frequency**: When you subscribe or when feeds are refreshed (configurable interval)

### Podcast Cover Images
- **Purpose**: To display podcast artwork
- **Data Sent**: Image URL request only
- **Destination**: The image hosting server specified in the podcast feed

### iTunes Search API (Optional)
- **Purpose**: To search for podcasts when using the search feature
- **Data Sent**: Search query terms
- **Destination**: Apple's iTunes Search API (`itunes.apple.com`)
- **Apple's Privacy Policy**: https://www.apple.com/legal/privacy/

### CORS Proxy (When Required)
- **Purpose**: Some RSS feeds require a proxy to bypass browser CORS restrictions
- **Data Sent**: The feed URL being requested
- **Destination**: Third-party CORS proxy services (if enabled)

## Third-Party Services

### Podcast Publishers
When you subscribe to podcasts, you interact directly with the podcast publishers' servers:
- The podcast publisher may log your IP address and access times
- Refer to each podcast's individual privacy policy for details

### Apple iTunes Search API
If you use the podcast search feature:
- Search queries are sent to Apple's servers
- Apple's privacy practices apply: https://www.apple.com/legal/privacy/

### Buy Me A Coffee (Optional)
If you choose to support the plugin via the "Buy Me A Coffee" link in settings:
- You are redirected to buymeacoffee.com
- Their privacy policy applies: https://www.buymeacoffee.com/privacy-policy
- This is entirely optional and no data is shared unless you voluntarily choose to support

## Data Retention

- **Local Data**: Stored indefinitely until you manually delete it or uninstall the plugin
- **Backup Files**: Automatic backups are retained for 30 days by default
- **Cache**: Feed and image cache can be cleared manually in settings

## Your Rights and Control

You have full control over your data:

### Access Your Data
All data is stored as readable JSON files in your vault. You can view, edit, or delete any file directly.

### Export Your Data
- Export OPML: Export all subscriptions in standard OPML format
- Export Full Backup: Export all data as a JSON file

### Delete Your Data
- Use "Delete All Data" in plugin settings to remove all plugin data
- Manually delete the plugin's data folder
- Uninstall the plugin to remove all plugin files

### Modify Settings
Adjust data collection in settings:
- Disable auto-download of episodes
- Adjust cache size and retention
- Configure feed update intervals

## Children's Privacy

The Plugin is not designed for or directed at children under 13 years of age. We do not knowingly collect any information from children.

## Security

- All data is stored locally in your vault's file system
- Data security depends on your device's security and any vault encryption you may use
- No data is transmitted to developer-controlled servers

## Changes to This Policy

We may update this Privacy Policy from time to time. Changes will be documented in the CHANGELOG and reflected in the "Last Updated" date above.

## Open Source

This plugin is open source. You can review the complete source code to verify our privacy practices:
- **Repository**: https://github.com/VaalRL/obsidian-podcast-player

## Contact

If you have questions about this Privacy Policy or the Plugin's data practices:
- **GitHub Issues**: https://github.com/VaalRL/obsidian-podcast-player/issues
- **Author**: VaalRL

---

## Compliance

This plugin is designed to be compliant with:
- **GDPR** (General Data Protection Regulation): No personal data is collected or processed by the plugin developer
- **CCPA** (California Consumer Privacy Act): No personal information is sold or shared
- **COPPA** (Children's Online Privacy Protection Act): Not directed at children under 13

---

*This privacy policy applies to the Podcast plugin for Obsidian. For Obsidian's own privacy practices, please refer to [Obsidian's Privacy Policy](https://obsidian.md/privacy).*
