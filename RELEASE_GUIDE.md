# Plugin Release & Submission Guide

This guide documents the steps to release the **Podcast** plugin and submit it to the official Obsidian Community Plugins list.

## 1. Prerequisites (Done for v0.1.0)
Before releasing, ensure:
- `manifest.json` version is updated (e.g., `0.1.0`).
- `package.json` version matches.
- `versions.json` is updated with minAppVersion.
- No `console.log` debug statements in critical code.
- Production build is ready (`npm run build`).

## 2. Create a GitHub Release

1.  Go to your repository's Releases page:
    [https://github.com/VaalRL/obsidian-podcast-player/releases/new](https://github.com/VaalRL/obsidian-podcast-player/releases/new)

2.  Fill in the release details:
    *   **Tag version**: `0.1.0` (Create new tag)
    *   **Target**: `main` (or your feature branch `claude/...` if not merged)
    *   **Release title**: `v0.1.0 - Initial Release`
    *   **Description**:
        ```markdown
        First release of the **Podcast** plugin for Obsidian!

        ## 🎉 Features
        *   **Complete Podcast Player**: Play, queue, and manage podcasts directly in Obsidian.
        *   **Daily Note Integration**: Add formatted notes with timestamps to your daily note while listening.
        *   **Search & Subscribe**: Search the iTunes/Apple Podcasts catalog and subscribe instantly.
        *   **Per-Podcast Settings**: Customize playback speed, volume, and skip intervals for individual podcasts.
        *   **Privacy Focused**: All data is stored locally in your vault; no external tracking.

        ## ⬇️ Installation
        Download the attached `main.js`, `styles.css`, and `manifest.json` and place them in your `.obsidian/plugins/podcast-player/` folder.
        ```

3.  **Attach Binaries**:
    Upload the following 3 files from your project root to the "Attach binaries" section:
    *   `main.js`
    *   `styles.css`
    *   `manifest.json`

4.  Click **Publish release**.

---

## 3. Submit to Obsidian Community Plugins

Once your GitHub Release is published, follow these steps to add it to the official list.

1.  **Open the Official Registry**:
    Go to [https://github.com/obsidianmd/obsidian-releases/blob/master/community-plugins.json](https://github.com/obsidianmd/obsidian-releases/blob/master/community-plugins.json).

2.  **Edit the File**:
    *   Click the **Pencil icon (Edit)**.
    *   If prompted, click the green **Fork this repository** button.

3.  **Add Your Plugin**:
    *   Scroll to the very bottom of the file.
    *   Add a **comma `,`** after the closing brace `}` of the last item.
    *   Paste your plugin entry:
        ```json
        {
            "id": "podcast-player",
            "name": "Podcast",
            "author": "VaalRL",
            "description": "A feature-rich podcast player and manager. Subscribe, play, and integrate with notes.",
            "repo": "VaalRL/obsidian-podcast-player"
        }
        ```

4.  **Create Pull Request**:
    *   Click **Propose changes** (or Commit changes).
    *   Title the commit: `Add Podcast plugin`.
    *   Follow the prompts to **Create pull request** to `obsidianmd/obsidian-releases`.
    *   Fill out the PR checklist confirming you have a valid release, license, etc.

## 4. Future Updates

When releasing a new version (e.g., `0.1.1`):
1.  Run `npm version patch` (or `minor`).
2.  Run `npm run build`.
3.  Commit changes.
4.  Create a new GitHub Release with the new assets.
5.  (Optional) You don't need to submit a PR to Obsidian again unless you change the plugin description or author. Updates are detected automatically from your GitHub Releases.
