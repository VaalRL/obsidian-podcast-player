# Podcast Sidebar View 規格文件

**文件版本**: 1.0  
**最後更新**: 2025-12-03  
**檔案路徑**: `src/ui/PodcastSidebarView.ts`  
**View Type**: `podcast-sidebar-view`

---

## 目錄

1. [概述](#概述)
2. [核心功能](#核心功能)
3. [UI 結構](#ui-結構)
4. [狀態管理](#狀態管理)
5. [事件處理](#事件處理)
6. [CSS 類別](#css-類別)
7. [排序與篩選](#排序與篩選)
8. [上下文菜單](#上下文菜單)
9. [依賴項](#依賴項)

---

## 概述

`PodcastSidebarView` 是 Obsidian Podcast Player 插件的主要側邊欄視圖，提供 Podcast 和 Playlist 的瀏覽與管理功能。

### 主要職責
- 顯示已訂閱的 Podcast 列表
- 顯示 Podcast 的單集列表
- 提供搜尋和排序功能
- 處理播放、加入播放列表等操作
- 管理 Podcast 和 Playlist 的切換

---

## 核心功能

### 1. 雙模式視圖
- **Podcasts 模式**: 顯示已訂閱的 Podcast 列表
- **Playlists 模式**: 顯示使用者建立的播放列表

### 2. 三層導航結構
1. **主列表層**: Podcast/Playlist 列表
2. **詳情層**: 選中的 Podcast 單集列表
3. **單集詳情**: 透過 Modal 顯示

### 3. 搜尋功能
- 即時搜尋（keydown 事件）
- 支援 Podcast 標題、作者、描述搜尋
- 支援單集標題、描述搜尋
- 搜尋框帶有放大鏡圖標

### 4. 排序功能
- 單一按鈕切換升序/降序（↑/↓ 圖標）
- 點擊按鈕開啟 Menu 選擇排序欄位
- 支援的排序欄位：
  - **Podcast**: Title, Date (訂閱日期)
  - **Episode**: Title, Date (發布日期), Duration
  - **Playlist**: Title, Date (建立日期)

---

## UI 結構

### Header 區域

```
┌─────────────────────────────────────────────┐
│ [← Back]  [Title]              [⚙️] [+] [🔄] │
└─────────────────────────────────────────────┘
```

#### 組成元素
1. **Back Button** (僅在詳情層顯示)
   - Class: `sidebar-back-button`
   - Icon: `arrow-left`
   - 功能: 返回主列表

2. **Title**
   - Class: `sidebar-title`
   - 內容:
     - 主列表: "My Podcasts" / "My Playlists"
     - 詳情層: Podcast/Playlist 名稱

3. **Action Buttons**
   - Class: `sidebar-actions`
   - Podcasts 模式:
     - `+` (plus): 訂閱新 Podcast
     - `🔄` (refresh-cw): 刷新所有 Feed
   - Playlists 模式:
     - `+` (plus): 建立新 Playlist
   - 詳情層:
     - `⚙️` (settings): Podcast 設定

### 搜尋與排序區域

```
┌─────────────────────────────────────────────┐
│ [🔍 Search...              ] [↑]             │
└─────────────────────────────────────────────┘
```

#### 組成元素
1. **Search Container**
   - Class: `sidebar-search-container`
   - 使用 Flexbox 水平排列

2. **Search Input**
   - Class: `sidebar-search-input`
   - Placeholder 根據當前模式變化:
     - Podcast 列表: "Search podcasts..."
     - Episode 列表: "Search episodes..."
     - Playlist 列表: "Search playlists..."

3. **Search Icon Button**
   - Class: `sidebar-search-button`
   - Icon: `search`
   - 功能: 視覺提示（不可點擊）

4. **Sort Button**
   - Class: `sort-direction-button`
   - Icon: `arrow-up` (升序) / `arrow-down` (降序)
   - 點擊開啟排序選單

### 模式切換區域 (僅主列表層)

```
┌─────────────────────────────────────────────┐
│ [Podcasts] [Playlists]                      │
└─────────────────────────────────────────────┘
```

- Class: `sidebar-mode-toggle`
- 按鈕 Class:
  - Active: `mode-active`
  - Inactive: `mode-inactive`

### 列表區域

#### Podcast 列表項目

```
┌─────────────────────────────────────────────┐
│ [Image] Podcast Title                       │
│         by Author                            │
│         X episodes • Last updated: Date      │
└─────────────────────────────────────────────┘
```

- Container Class: `podcast-list-container`
- Item Class: `podcast-item`
- 子元素:
  - `podcast-image`: Podcast 封面圖
  - `podcast-info`: 資訊容器
    - `podcast-title`: 標題
    - `podcast-author`: 作者
    - `podcast-metadata`: 元數據（單集數、更新日期）

#### Episode 列表項目

```
┌─────────────────────────────────────────────┐
│ Episode Title                                │
│ 2024/12/03 • 45:30                  [▶] [+] │
└─────────────────────────────────────────────┘
```

- Container Class: `episode-list-container`
- Item Class: `episode-item`
- 子元素:
  - `episode-info`: 資訊容器
    - `episode-title` (h4): 標題
    - `episode-metadata`: 元數據
      - `episode-date`: 發布日期
      - `episode-duration`: 時長
  - `episode-item-actions`: 操作按鈕容器
    - Play Button (icon: `play`)
    - Add to Playlist Button (icon: `plus`)

---

## 狀態管理

### 私有狀態屬性

```typescript
private viewMode: 'podcasts' | 'playlists' = 'podcasts'
private selectedPodcast: Podcast | null = null
private selectedPlaylist: Playlist | null = null
private searchQuery: string = ''

// Podcast 排序
private podcastSortBy: 'title' | 'date' = 'title'
private podcastSortDirection: 'asc' | 'desc' = 'asc'

// Episode 排序
private episodeSortBy: 'title' | 'date' | 'duration' = 'date'
private episodeSortDirection: 'asc' | 'desc' = 'desc'

// Playlist 排序
private playlistSortBy: 'title' | 'date' = 'title'
private playlistSortDirection: 'asc' | 'desc' = 'asc'

// 統計數據快取
private podcastStats: Map<string, { episodeCount: number; lastUpdated: Date }> = new Map()
```

### 狀態轉換

1. **主列表 ↔ 詳情層**
   - 點擊 Podcast → 設定 `selectedPodcast`
   - 點擊 Back → 清空 `selectedPodcast`

2. **模式切換**
   - 點擊 Podcasts/Playlists 按鈕 → 更新 `viewMode`
   - 自動清空選擇狀態

3. **搜尋**
   - 輸入變化 → 更新 `searchQuery`
   - 觸發列表重新渲染

---

## 事件處理

### 主要事件處理器

| 方法名稱 | 觸發時機 | 功能 |
|---------|---------|------|
| `handleAddPodcast()` | 點擊 + 按鈕 | 開啟訂閱 Modal |
| `handleRefreshFeeds()` | 點擊刷新按鈕 | 刷新所有 Feed |
| `handlePodcastSettings()` | 點擊設定按鈕 | 開啟 Podcast 設定 |
| `handlePlayEpisode()` | 點擊播放按鈕 | 播放單集 |
| `handleEpisodeClick()` | 點擊單集項目 | 開啟單集詳情 Modal |
| `showAddToPlaylistMenu()` | 點擊 + 按鈕 | 顯示加入播放列表選單 |
| `showPodcastContextMenu()` | 右鍵 Podcast | 顯示 Podcast 上下文菜單 |
| `showEpisodeContextMenu()` | 右鍵 Episode | 顯示 Episode 上下文菜單 |

### 搜尋事件

```typescript
searchInput.addEventListener('keydown', () => {
    setTimeout(() => {
        const newQuery = searchInput.value.trim();
        if (newQuery !== this.searchQuery) {
            this.searchQuery = newQuery;
            this.render();
        }
    }, 0);
});
```

- 使用 `keydown` 事件（非 `input`）
- 使用 `setTimeout` 確保值已更新
- 只在查詢變化時重新渲染

---

## CSS 類別

### 佈局類別

| 類別名稱 | 用途 | 重要屬性 |
|---------|------|---------|
| `sidebar-header` | Header 容器 | `display: flex`, `justify-content: space-between` |
| `sidebar-title` | 標題 | `flex: 1`, `text-overflow: ellipsis` |
| `sidebar-actions` | 操作按鈕容器 | `display: flex`, `gap: var(--size-4-2)` |
| `sidebar-search-container` | 搜尋容器 | `display: flex`, `align-items: center` |
| `sidebar-mode-toggle` | 模式切換容器 | - |

### 按鈕類別

| 類別名稱 | 用途 | 樣式特點 |
|---------|------|---------|
| `sidebar-back-button` | Back 按鈕 | 透明背景，hover 變色 |
| `sidebar-action-button` | 操作按鈕 | 圓形圖標按鈕 |
| `sidebar-search-button` | 搜尋圖標 | 不可點擊，純視覺 |
| `sort-direction-button` | 排序按鈕 | 顯示升降序圖標 |
| `mode-active` | 啟用的模式按鈕 | 高亮顯示 |
| `mode-inactive` | 未啟用的模式按鈕 | 灰色顯示 |

### 列表項目類別

| 類別名稱 | 用途 | 樣式特點 |
|---------|------|---------|
| `podcast-list-container` | Podcast 列表容器 | `display: flex`, `flex-direction: column` |
| `podcast-item` | Podcast 項目 | 可點擊，hover 效果 |
| `podcast-image` | Podcast 封面 | 固定尺寸，圓角 |
| `podcast-info` | Podcast 資訊容器 | - |
| `podcast-title` | Podcast 標題 | 粗體 |
| `podcast-author` | Podcast 作者 | 灰色文字 |
| `podcast-metadata` | Podcast 元數據 | 小字體，灰色 |
| `episode-list-container` | Episode 列表容器 | `gap: 2px` (緊湊間距) |
| `episode-item` | Episode 項目 | `padding: var(--size-4-1)`, `margin-bottom: var(--size-4-1)` |
| `episode-info` | Episode 資訊容器 | - |
| `episode-title` | Episode 標題 (h4) | `margin-bottom: 2px` |
| `episode-metadata` | Episode 元數據 | `margin-top: 0` |
| `episode-date` | Episode 日期 | - |
| `episode-duration` | Episode 時長 | - |
| `episode-item-actions` | Episode 操作按鈕容器 | `margin-top: var(--size-4-1)` |
| `episode-action-button` | Episode 操作按鈕 | 圓形圖標按鈕 |

### 空狀態類別

| 類別名稱 | 用途 |
|---------|------|
| `empty-state` | 空狀態容器 |
| `empty-state-hint` | 空狀態提示文字 |

---

## 排序與篩選

### 排序邏輯

#### Podcast 排序

```typescript
sortPodcasts(podcasts: Podcast[], sortBy: 'title' | 'date', direction: 'asc' | 'desc'): Podcast[]
```

- **title**: 按標題字母順序
- **date**: 按訂閱日期 (`subscribedAt`)

#### Episode 排序

```typescript
sortEpisodes(episodes: Episode[], sortBy: 'title' | 'date' | 'duration', direction: 'asc' | 'desc'): Episode[]
```

- **title**: 按標題字母順序
- **date**: 按發布日期 (`publishDate`)
- **duration**: 按時長

#### Playlist 排序

```typescript
sortPlaylists(playlists: Playlist[], sortBy: 'title' | 'date', direction: 'asc' | 'desc'): Playlist[]
```

- **title**: 按名稱字母順序
- **date**: 按建立日期 (`createdAt`)

### 篩選邏輯

#### Podcast 篩選

```typescript
filterPodcasts(podcasts: Podcast[], query: string): Podcast[]
```

搜尋欄位：
- `title` (標題)
- `author` (作者)
- `description` (描述)

#### Episode 篩選

```typescript
filterEpisodes(episodes: Episode[], query: string): Episode[]
```

搜尋欄位：
- `title` (標題)
- `description` (描述)

#### Playlist 篩選

```typescript
filterPlaylists(playlists: Playlist[], query: string): Playlist[]
```

搜尋欄位：
- `name` (名稱)
- `description` (描述)

---

## 上下文菜單

### Podcast 上下文菜單

觸發: 右鍵點擊 Podcast 項目

選項:
1. **Refresh Feed** (刷新 Feed)
   - Icon: `refresh-cw`
   - 功能: 刷新該 Podcast 的 Feed

2. **Unsubscribe** (取消訂閱)
   - Icon: `trash`
   - 功能: 取消訂閱該 Podcast
   - 需要確認

### Episode 上下文菜單

觸發: 右鍵點擊 Episode 項目

選項:
1. **Play** (播放)
   - Icon: `play`
   - 功能: 播放單集

2. **Add to Queue** (加入佇列)
   - Icon: `list-plus`
   - 功能: 加入播放佇列

3. **Add to Playlist** (加入播放列表)
   - Icon: `folder-plus`
   - 功能: 開啟播放列表選單

4. **Mark as Played** (標記為已播放)
   - Icon: `check`
   - 功能: 標記為已完成

5. **Export to Note** (匯出到筆記)
   - Icon: `file-text`
   - 功能: 匯出單集資訊到筆記

6. **Copy Episode Link** (複製單集連結)
   - Icon: `link`
   - 功能: 複製音訊 URL

---

## 依賴項

### Obsidian API

```typescript
import { ItemView, WorkspaceLeaf, Menu, Notice, setIcon } from 'obsidian';
```

### 插件服務

```typescript
import type PodcastPlayerPlugin from '../../main';
```

透過 `plugin` 屬性存取:
- `plugin.getSubscriptionStore()`: 訂閱管理
- `plugin.getEpisodeManager()`: 單集管理
- `plugin.getPlaylistManager()`: 播放列表管理
- `plugin.getQueueManager()`: 佇列管理
- `plugin.getPodcastService()`: Podcast 服務
- `plugin.getNoteExporter()`: 筆記匯出

### 內部依賴

```typescript
import { Episode, Podcast, Playlist } from '../model';
import { EpisodeDetailModal } from './EpisodeDetailModal';
import { TextInputModal } from './TextInputModal';
```

---

## 工具方法

### formatDuration(seconds: number): string

格式化時長為人類可讀格式。

**範例**:
- `3661` → `"1:01:01"`
- `125` → `"2:05"`
- `45` → `"0:45"`

### formatDate(date: Date): string

格式化日期為相對時間。

**範例**:
- 今天 → `"Today"`
- 昨天 → `"Yesterday"`
- 本週 → `"X days ago"`
- 更早 → `"YYYY/MM/DD"`

### promptForInput(title: string, message: string, defaultValue?: string): Promise<string | null>

顯示文字輸入對話框。

**用途**:
- 建立播放列表
- 重新命名項目
- 其他需要使用者輸入的場景

---

## 重要注意事項

### 1. 渲染流程

```
render() 
  ↓
sidebarContentEl.empty()  // 清空容器
  ↓
renderHeader()            // 渲染 Header
  ↓
renderSearchBox()         // 渲染搜尋與排序
  ↓
根據狀態渲染內容:
  - renderPodcastList()   // Podcast 列表
  - renderEpisodeList()   // Episode 列表
  - renderPlaylistList()  // Playlist 列表
  - renderPlaylistDetails() // Playlist 詳情
```

### 2. 狀態同步

- 所有狀態變更後必須呼叫 `render()` 重新渲染
- 搜尋查詢變更時自動觸發重新渲染
- 排序設定變更時自動觸發重新渲染

### 3. 效能考量

- 使用 `podcastStats` Map 快取統計數據
- 避免在渲染過程中進行大量異步操作
- 搜尋使用 `setTimeout` 避免過於頻繁的重新渲染

### 4. CSS 間距規範

為確保 UI 緊湊且一致:
- Episode 列表間距: `gap: 2px`
- Episode 項目內距: `padding: var(--size-4-1)` (4px)
- Episode 項目下邊距: `margin-bottom: var(--size-4-1)` (4px)
- 標題下邊距: `margin-bottom: 2px`
- 操作按鈕上邊距: `margin-top: var(--size-4-1)` (4px)

### 5. Header 佈局規範

- Header 使用 Flexbox 水平排列
- Back 按鈕、標題、操作按鈕在同一行
- Back 按鈕和操作按鈕設為 `flex-shrink: 0`
- 標題設為 `flex: 1` 佔據剩餘空間
- 標題過長時使用 `text-overflow: ellipsis` 截斷

---

## 版本歷史

### v1.0 (2025-12-03)
- 初始版本
- 實現雙模式視圖 (Podcasts/Playlists)
- 實現搜尋與排序功能
- 實現上下文菜單
- 優化 UI 間距和佈局
- Header 佈局優化（Back 按鈕與標題同行）

---

## 恢復指南

如果檔案損壞，請按照以下步驟恢復：

1. **檢查類別結構**: 確保 `PodcastSidebarView` 繼承自 `ItemView`
2. **驗證狀態屬性**: 確認所有私有狀態屬性存在且類型正確
3. **檢查渲染方法**: 確保 `render()` 方法正確呼叫所有子渲染方法
4. **驗證事件處理器**: 確認所有事件處理器正確綁定
5. **檢查 CSS 類別**: 確保所有 CSS 類別名稱與樣式表一致
6. **測試排序與篩選**: 驗證排序和篩選邏輯正常運作
7. **測試上下文菜單**: 確認右鍵菜單正確顯示

---

**文件結束**
