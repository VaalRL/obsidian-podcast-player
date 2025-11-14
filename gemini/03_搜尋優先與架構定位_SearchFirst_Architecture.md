# 03｜搜尋優先與架構定位（Search-First & Architecture-First）

## 原則
- **先搜尋**：用 Grep/Glob（專用工具）找既有實作與相似邏輯。
- **理解架構**：閱讀 `main.ts` 和核心模組（見 CLAUDE.md 專案概況）。
- **延伸，不複製**：不要產生 `*_v2`, `enhanced_*`, `*_new` 類別或平行檔案。

## 專案架構概覽

### 核心入口
- `main.ts` - 插件主類別，管理生命週期與註冊功能

### 功能模組
- `src/podcast/` - Podcast 處理核心
  - `PodcastService.ts` - Podcast 服務核心
  - `PodcastParser.ts` - Podcast 元數據解析器
  - `EpisodeManager.ts` - 單集管理

- `src/player/` - 播放器核心
  - `PlayerController.ts` - 播放器控制器
  - `PlaybackEngine.ts` - 播放引擎
  - `ProgressTracker.ts` - 進度追蹤

- `src/feed/` - Feed 管理
  - `FeedService.ts` - Feed 服務核心
  - `RSSParser.ts` - RSS 解析器
  - `AtomParser.ts` - Atom 解析器
  - `FeedSyncManager.ts` - Feed 同步管理

- `src/playlist/` - 播放清單管理
  - `PlaylistManager.ts` - 播放清單管理器
  - `PlaylistStore.ts` - 播放清單儲存

- `src/queue/` - 播放佇列管理
  - `QueueManager.ts` - 佇列管理器
  - `QueueStore.ts` - 佇列儲存

- `src/markdown/` - Markdown 整合
  - `NoteExporter.ts` - 筆記匯出器
  - `TimestampFormatter.ts` - 時間戳格式化

- `src/model/` - 資料模型
  - `index.ts` - 核心模型定義（Podcast、Episode、Playlist、Queue）

- `src/storage/` - 資料持久化
  - `SubscriptionStore.ts` - 訂閱儲存
  - `ProgressStore.ts` - 播放進度儲存
  - `SettingsStore.ts` - 設定儲存
  - `LocalCache.ts` - 本地快取

- `src/ui/` - 使用者介面
  - `PlayerView.ts` - 播放器檢視
  - `PodcastListView.ts` - Podcast 列表檢視
  - `EpisodeListView.ts` - 單集列表檢視
  - `PlaylistView.ts` - 播放清單檢視
  - `QueueView.ts` - 佇列檢視
  - `SettingsTab.ts` - 設定頁籤

- `src/utils/` - 工具函數
  - `Logger.ts` - 日誌工具
  - `errorUtils.ts` - 錯誤處理
  - `timeUtils.ts` - 時間處理工具
  - `audioUtils.ts` - 音訊處理工具

## 禁止事項
- 重複檔案／重複邏輯（造成多個 SSOT）
- 硬寫常數（應改用 `src/settings.ts` 管理）
- 繞過既有架構直接實作（破壞 Obsidian 插件模式）

## 整併策略（Consolidate Early）
- 發現相似功能儘早抽取共用模組
- 主動償還技術債，保持結構乾淨
- 優先修正現有組件，而非創建替代組件

## 推薦流程
1. 搜尋現有實作 → 2. 閱讀核心檔案 → 3. 理解設計意圖 → 4. 設計延伸方案 → 5. 實作＋測試 → 6. 整併與文件

## 快速定位指南
```typescript
// 要找某功能？先搜尋：
- PodcastService - Podcast 核心功能
- PlayerController - 播放器控制
- FeedService - Feed 訂閱與同步
- PlaylistManager / QueueManager - 播放清單與佇列
- SettingsManager - 設定存取
- SubscriptionStore / ProgressStore - 資料儲存
- PlayerView / PodcastListView - UI 組件
```
