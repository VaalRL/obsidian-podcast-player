# Obsidian Podcast Player - 開發任務清單

> 本專案目標：建立功能完整的 Podcast 播放與管理插件，參考 Podnote 基礎功能並提供更精細的管理能力

## 專案狀態
- **當前階段**：階段十一 - 測試與優化
- **最後更新**：2025-11-15
- **開發分支**：`claude/obsidian-podcast-plugin-013CvMVJ3jvNFJNGN2svacbT`
- **測試覆蓋率**：25.33% overall (301 tests passing)
  - Player module: 90% 🎉
  - Utils module: 76%
  - Core business logic: excellent coverage
- **完成度**：約 75%（7/12 階段完全完成，1 個階段進行中）

---

## 🎯 當前優先任務

### 高優先級（立即執行）
1. **Test Vault 開發環境設定**
   - 建立測試環境以便在真實 Obsidian 中測試插件
   - 準備測試用 Podcast Feed 資料

2. **補充單元測試**
   - Feed 模組（RSSParser, AtomParser, FeedService, FeedSyncManager）
   - Podcast 模組（PodcastService, EpisodeManager）
   - Markdown 模組（NoteExporter, TimestampFormatter）
   - Storage Store 類別（PlaylistStore, QueueStore, SubscriptionStore, CacheStore）

### 中優先級（後續執行）
3. **整合測試**
   - 播放器完整流程測試
   - 訂閱與同步流程測試

4. **準備發布**
   - 截圖與使用示範 GIF
   - 授權聲明確認
   - 貢獻指南撰寫

### 低優先級（可選）
5. **性能優化**
   - UI 渲染優化
   - Feed 同步效能優化

6. **樣式優化**
   - 響應式設計改進
   - 深色主題相容性

---

## 📋 階段一：專案基礎建設 ✅ 已完成

### ✅ 已完成
- [x] 專案規範文件更新（CLAUDE.md, gemini.md, agents.md）
- [x] 開發指南文件更新（claude/ 和 gemini/ 目錄）
- [x] 專案架構規劃與模組定義
- [x] 資料持久化策略定義（檔案系統儲存）
- [x] 基礎專案設定
  - [x] manifest.json（插件資訊）
  - [x] package.json（依賴與腳本）
  - [x] tsconfig.json（TypeScript 配置）
  - [x] esbuild.config.mjs（構建配置）
  - [x] Jest 測試環境設定
  - [x] main.ts（插件入口）
- [x] 核心資料模型（src/model/）
  - [x] Podcast.ts - Podcast 介面定義
  - [x] Episode.ts - Episode 介面定義
  - [x] Playlist.ts - Playlist 介面定義
  - [x] Queue.ts - Queue 介面定義
  - [x] Settings.ts - 設定介面定義
- [x] 基礎工具函數（src/utils/）
  - [x] Logger.ts (84% 覆蓋率)
  - [x] errorUtils.ts (已實作)
  - [x] timeUtils.ts (100% 覆蓋率，30 tests) 🎯
  - [x] audioUtils.ts (100% 覆蓋率，46 tests) 🎯

### 📝 待辦
- [ ] Test Vault 開發環境設定
  - [ ] 建立 `Test Vault/.obsidian/plugins/podcast-player/` 目錄
  - [ ] 設定符號連結或構建腳本，將編譯輸出導向 Test Vault
  - [ ] 設定熱重載（開發模式）
  - [ ] 建立測試用的 Podcast 資料與範例筆記

---

## 📋 階段二：核心功能開發（Feed 管理）✅ 已完成

### ✅ Feed 解析模組（src/feed/）已完成
- [x] RSSParser.ts - RSS Feed 解析器
  - [x] 實作 RSS 2.0 格式解析
  - [ ] 單元測試（RSSParser.test.ts）❌ 待補充
- [x] AtomParser.ts - Atom Feed 解析器
  - [x] 實作 Atom 1.0 格式解析
  - [ ] 單元測試（AtomParser.test.ts）❌ 待補充
- [x] FeedService.ts - Feed 服務核心
  - [x] Feed 訂閱功能
  - [x] Feed 更新檢測
  - [x] 錯誤處理與重試機制
  - [ ] 單元測試（FeedService.test.ts）❌ 待補充
- [x] FeedSyncManager.ts - Feed 同步管理
  - [x] 背景同步排程
  - [x] 增量更新策略
  - [ ] 單元測試（FeedSyncManager.test.ts）❌ 待補充

---

## 📋 階段三：核心功能開發（Podcast 管理）✅ 已完成

### ✅ Podcast 處理模組（src/podcast/）已完成
- [x] PodcastService.ts - Podcast 服務核心
  - [x] Podcast 訂閱管理
  - [x] Podcast 資訊更新
  - [x] Podcast 刪除
  - [ ] 單元測試（PodcastService.test.ts）❌ 待補充
- [x] EpisodeManager.ts - Episode 管理
  - [x] Episode 列表管理
  - [x] Episode 標記（已聽、收藏）
  - [x] Episode 搜尋與篩選
  - [ ] 單元測試（EpisodeManager.test.ts）❌ 待補充

---

## 📋 階段四：核心功能開發（播放器）✅ 已完成 🎉

### ✅ 播放器模組（src/player/）已完成（90% 覆蓋率）
- [x] PlayerController.ts - 播放器控制器
  - [x] 播放/暫停/停止控制
  - [x] 音量控制
  - [x] 播放速度控制
  - [x] 跳躍控制（前進/後退）
  - [x] 單元測試（PlayerController.test.ts）✅ 37 tests, 85% 覆蓋率
- [x] PlaybackEngine.ts - 播放引擎
  - [x] HTML5 Audio API 整合
  - [x] 音訊預載
  - [x] 錯誤恢復機制
  - [x] 事件處理系統
  - [x] 單元測試（PlaybackEngine.test.ts）✅ 46 tests, 92% 覆蓋率 🎯
- [x] ProgressTracker.ts - 進度追蹤
  - [x] 播放進度記錄
  - [x] 斷點續播支援
  - [x] 進度同步（週期性儲存）
  - [x] 完成度檢測
  - [x] 單元測試（ProgressTracker.test.ts）✅ 40 tests, 95% 覆蓋率 🎯

---

## 📋 階段五：進階功能開發（清單與佇列）✅ 已完成

### ✅ 播放清單模組（src/playlist/）已完成
- [x] PlaylistManager.ts - 播放清單管理器
  - [x] 建立/刪除播放清單
  - [x] 新增/移除 Episode（單一與批次）
  - [x] 播放清單排序與重新排序
  - [x] 播放清單複製與合併
  - [x] 播放清單搜尋與篩選
  - [x] 單元測試（PlaylistManager.test.ts）✅ 39 tests, 95% 覆蓋率 🎯
- [x] PlaylistStore.ts - 播放清單儲存
  - [x] 資料持久化（JSON）
  - [x] 資料匯入/匯出
  - [ ] 單元測試（PlaylistStore.test.ts）❌ 待補充

### ✅ 播放佇列模組（src/queue/）已完成
- [x] QueueManager.ts - 佇列管理器
  - [x] 佇列建立與管理
  - [x] Episode 加入佇列（單一與批次）
  - [x] 佇列導航（next/previous）
  - [x] Shuffle 與 Repeat 模式
  - [x] 單元測試（QueueManager.test.ts）✅ 30 tests, 57% 覆蓋率
- [x] QueueStore.ts - 佇列儲存
  - [x] 佇列狀態持久化（JSON）
  - [ ] 單元測試（QueueStore.test.ts）❌ 待補充

---

## 📋 階段六：資料持久化 ✅ 已完成

> **資料儲存策略**：使用可設定的資料夾（預設 `.obsidian/plugins/podcast-player/data/`）中的 JSON 檔案來儲存所有資料

### ✅ 儲存模組（src/storage/）已完成
- [x] FileSystemStore.ts - 檔案系統儲存基礎類別
  - [x] 檔案讀寫抽象層（支援 JSON）
  - [x] 資料夾路徑設定與管理
  - [x] 錯誤處理與備份機制
  - [x] 資料驗證機制
  - [ ] 單元測試（FileSystemStore.test.ts）❌ 待補充（44% 覆蓋率）

- [x] SubscriptionStore.ts - 訂閱儲存
  - [x] 儲存格式：`subscriptions.json`
  - [x] Podcast 訂閱資料管理（CRUD）
  - [x] 資料遷移機制（版本升級）
  - [x] 自動備份機制
  - [ ] 單元測試（SubscriptionStore.test.ts）❌ 待補充

- [x] ProgressStore.ts - 播放進度儲存
  - [x] 儲存格式：`progress.json`
  - [x] Episode 播放進度記錄
  - [x] 歷史記錄管理
  - [x] 進度統計與查詢
  - [x] 資料匯入/匯出
  - [x] 單元測試（ProgressStore.test.ts）✅ 23 tests, 84% 覆蓋率

- [x] SettingsStore.ts - 設定儲存
  - [x] 儲存格式：`settings.json`
  - [x] 全域設定管理
  - [x] Podcast 個別設定（覆寫全域設定）
  - [x] 設定驗證與預設值
  - [x] 設定遷移機制
  - [x] 單元測試（SettingsStore.test.ts）✅ 10 tests, 52% 覆蓋率

- [x] CacheStore.ts - 本地快取儲存
  - [x] 儲存格式：`cache/` 資料夾
  - [x] Feed 快取管理
  - [x] 圖片快取管理
  - [x] 快取過期策略（基於時間戳）
  - [x] 快取清理與大小限制
  - [ ] 單元測試（CacheStore.test.ts）❌ 待補充

- [x] DataPathManager.ts - 資料路徑管理
  - [x] 可設定的資料夾路徑
  - [x] 自動建立必要的子目錄結構
  - [x] 路徑驗證
  - [ ] 單元測試（DataPathManager.test.ts）❌ 待補充（21% 覆蓋率）

### 資料夾結構設計
```
.obsidian/plugins/podcast-player/data/
├── settings.json              # 全域設定
├── subscriptions.json         # 訂閱列表（或用 subscriptions/ 資料夾）
├── progress.json              # 播放進度（或用 progress/ 資料夾）
├── playlists/                 # 播放清單
│   ├── [playlist-id].json
│   └── ...
├── queues/                    # 播放佇列
│   ├── [queue-id].json
│   └── ...
├── cache/                     # 快取資料
│   ├── feeds/                 # Feed 快取
│   │   └── [feed-hash].json
│   └── images/                # 圖片快取
│       └── [image-hash].jpg
└── backups/                   # 自動備份
    └── [timestamp]/
```

---

## 📋 階段七：Markdown 整合 ✅ 已完成

### ✅ Markdown 模組（src/markdown/）已完成
- [x] NoteExporter.ts - 筆記匯出器
  - [x] Episode 資訊匯出
  - [x] Front Matter 生成
  - [x] 模板系統（支援自訂模板）
  - [x] 時間戳記錄
  - [ ] 單元測試（NoteExporter.test.ts）❌ 待補充
- [x] TimestampFormatter.ts - 時間戳格式化
  - [x] 播放位置時間戳
  - [x] 多種時間戳格式支援
  - [x] Markdown 連結生成
  - [ ] 單元測試（TimestampFormatter.test.ts）❌ 待補充

---

## 📋 階段八：使用者介面 ✅ 已完成

### ✅ UI 模組（src/ui/）已完成
- [x] PlayerView.ts - 播放器檢視
  - [x] 播放控制 UI（播放/暫停/停止/跳轉）
  - [x] 進度條與拖曳控制
  - [x] Episode 資訊顯示
  - [x] 音量與速度控制
  - [ ] 整合測試 ❌ 待補充
- [x] PodcastSidebarView.ts - Podcast 側邊欄檢視
  - [x] 訂閱 Podcast 列表
  - [x] Episode 列表顯示
  - [x] 搜尋與篩選功能
  - [x] 狀態標記（已聽、未聽）
  - [x] 快速操作（播放、加入清單）
  - [ ] 整合測試 ❌ 待補充
- [x] PlaylistQueueView.ts - 播放清單與佇列檢視
  - [x] 播放清單管理 UI
  - [x] 當前佇列顯示
  - [x] 佇列編輯與重新排序
  - [x] 清單切換功能
  - [ ] 整合測試 ❌ 待補充
- [x] SettingsTab.ts - 設定頁籤
  - [x] 全域設定 UI
  - [x] Podcast 個別設定
  - [x] 資料路徑設定
  - [x] 快取管理
  - [ ] 整合測試 ❌ 待補充
- [x] 各種 Modal 組件
  - [x] SubscribePodcastModal.ts - 訂閱 Podcast
  - [x] EpisodeDetailModal.ts - Episode 詳情
  - [x] PodcastSettingsModal.ts - Podcast 設定
  - [x] AddToPlaylistModal.ts - 加入播放清單
  - [x] AddToQueueModal.ts - 加入佇列

---

## 📋 階段九：插件整合 ✅ 已完成

### ✅ 主程式（根目錄）已完成
- [x] main.ts - 插件入口
  - [x] Plugin 類別實作
  - [x] onload 生命週期（初始化所有服務）
  - [x] onunload 清理
  - [x] 命令註冊（播放控制、訂閱管理等）
  - [x] Ribbon 圖示與選單
  - [x] 檢視註冊（PlayerView, PodcastSidebarView 等）
  - [ ] 整合測試 ❌ 待補充
- [x] settings.ts - 設定管理
  - [x] 設定介面定義（PodcastPlayerSettings）
  - [x] 預設值（DEFAULT_SETTINGS）
  - [x] 設定載入/儲存整合
- [x] styles.css - 樣式
  - [x] 播放器樣式
  - [x] 列表樣式
  - [x] 按鈕與控制項樣式
  - [x] Modal 樣式
  - [ ] 響應式設計優化 🔄 可改進
  - [ ] 深色主題相容性優化 🔄 可改進

---

## 📋 階段十：進階功能 ✅ 已完成

### ✅ 個別 Podcast 設定已完成
- [x] 音量設定（個別 Podcast 可覆寫全域設定）
- [x] 播放速度設定
- [x] 跳過開頭秒數設定
- [x] 跳過結尾秒數設定
- [x] 設定繼承與覆寫邏輯

### ✅ 快捷操作已完成
- [x] 快速匯入到筆記（透過 NoteExporter）
- [x] 命令面板整合
- [x] 右鍵選單整合（Episode 操作）

### ✅ 同步與備份已完成
- [x] 訂閱資料匯出（JSON）
- [x] 訂閱資料匯入
- [x] 播放進度匯出/匯入
- [x] 自動備份機制（設定與資料）

---

## 📋 階段十一：測試與優化（當前階段）🔄

### 🔄 測試覆蓋（進行中）
- [x] 單元測試基礎建設 ✅
  - [x] Jest 設定與配置
  - [x] Obsidian API Mocks
  - [x] 測試工具函數
- [x] 核心模組單元測試（301 tests）✅
  - [x] Player module (90% 覆蓋率) 🎯
    - [x] PlaybackEngine (46 tests, 92%)
    - [x] ProgressTracker (40 tests, 95%)
    - [x] PlayerController (37 tests, 85%)
  - [x] Utils module (76% 覆蓋率)
    - [x] audioUtils (46 tests, 100%) 🎯
    - [x] timeUtils (30 tests, 100%) 🎯
    - [x] Logger (84%)
  - [x] Storage module
    - [x] ProgressStore (23 tests, 84%)
    - [x] SettingsStore (10 tests, 52%)
  - [x] Playlist/Queue module
    - [x] PlaylistManager (39 tests, 95%)
    - [x] QueueManager (30 tests, 57%)
- [ ] 待補充測試的模組 ❌
  - [ ] Feed 模組測試（RSSParser, AtomParser, FeedService）
  - [ ] Podcast 模組測試（PodcastService, EpisodeManager）
  - [ ] Storage 基礎測試（FileSystemStore, CacheStore, DataPathManager）
  - [ ] Markdown 模組測試（NoteExporter, TimestampFormatter）
  - [ ] Store 類別測試（PlaylistStore, QueueStore, SubscriptionStore）
- [ ] 整合測試 ❌
  - [ ] 播放器完整流程測試
  - [ ] 訂閱與同步流程測試
  - [ ] 資料持久化測試
- [ ] E2E 測試（選用）❌

### 📝 性能優化（待處理）
- [ ] Feed 同步效能分析與優化
- [ ] UI 渲染效能優化（虛擬滾動等）
- [ ] 記憶體使用優化
- [ ] 大量 Episode 處理優化

### ✅ 錯誤處理（已實作）
- [x] 網路錯誤處理（重試機制）
- [x] Feed 格式錯誤處理
- [x] 音訊載入錯誤處理
- [x] 使用者友好的錯誤訊息
- [ ] 錯誤追蹤與報告機制 ❌ 待補充

---

## 📋 階段十二：文件與發布

### 🔄 文件（部分完成）
- [x] README.md ✅
  - [x] 功能介紹
  - [x] 安裝說明
  - [x] 使用教學
  - [ ] 截圖/GIF 示範 ❌ 待補充
- [x] CHANGELOG.md ✅
  - [x] 版本歷史記錄
  - [x] 測試覆蓋率統計
- [ ] 貢獻指南 ❌ 待建立
- [ ] 授權聲明 ❌ 待確認

### 📝 發布準備（待處理）
- [ ] 版本號管理（遵循語義化版本）
- [ ] 完整構建測試
  - [ ] 測試在真實 Obsidian 環境中運行
  - [ ] 跨平台測試（Windows, macOS, Linux）
- [ ] Test Vault 設定與測試
  - [ ] 建立完整的測試環境
  - [ ] 測試用 Podcast Feed 準備
  - [ ] 範例筆記與使用案例
- [ ] 插件市場資料準備
  - [ ] 插件描述
  - [ ] 截圖與示範 GIF
  - [ ] 標籤與分類
- [ ] 發布到 Obsidian 插件市場
  - [ ] 提交 PR 到官方插件倉庫
  - [ ] 等待審核

---

## 🎯 里程碑進度

### ✅ M1: 基礎架構完成（已完成）
- ✅ 專案設定完成
- ✅ 核心資料模型定義
- ✅ 基礎工具函數（100% 測試覆蓋）

### ✅ M2: Feed 管理功能（已完成）
- ✅ RSS/Atom 解析器實作
- ✅ Feed 訂閱與同步
- ✅ Podcast 管理服務

### ✅ M3: 播放器核心（已完成）
- ✅ 播放控制（90% 測試覆蓋）
- ✅ 進度追蹤（95% 測試覆蓋）
- ✅ 播放引擎（92% 測試覆蓋）

### ✅ M4: 進階功能（已完成）
- ✅ 播放清單（95% 測試覆蓋）
- ✅ 播放佇列（57% 測試覆蓋）
- ✅ Markdown 整合

### ✅ M5: 完整 UI（已完成）
- ✅ 所有檢視完成
- ✅ 設定頁面
- ✅ 基礎樣式

### 🔄 M6: 測試與優化（進行中 - 60%）
- ✅ 核心模組測試覆蓋（301 tests）
- ❌ 待補充測試（Feed, Podcast, Markdown 等模組）
- ❌ 整合測試
- ❌ 性能優化

### 📝 M7: 發布準備（待開始）
- ✅ 基礎文件（README, CHANGELOG）
- ❌ Test Vault 環境設定
- ❌ 截圖與示範
- ❌ 市場發布

---

## 📝 注意事項

### 開發原則（遵循 CLAUDE.md）
- ✅ **先找再做**：搜尋現有實作，延伸而非重寫
- ✅ **測試先行**：TDD，Red → Green → Refactor
- ✅ **修正優先**：優先修正現有組件，而非新建
- ✅ **單一真實來源**：避免重複實作
- ✅ **檔案規範**：不在 root 新增非必要檔案
- ✅ **Test Vault 開發**：所有實作直接在 Test Vault 中開發與測試

### 開發流程
1. **開發環境**：使用 `Test Vault` 作為實際開發與測試環境
2. **即時測試**：編譯輸出直接到 `Test Vault/.obsidian/plugins/podcast-player/`
3. **快速迭代**：修改程式碼 → 自動編譯 → Obsidian 重載 → 測試
4. **真實場景**：使用真實的 Podcast Feed 和筆記進行測試

### 技術堆疊
- TypeScript
- Obsidian Plugin API
- esbuild（構建，輸出到 Test Vault）
- Jest（測試）
- rss-parser（Feed 解析）
- HTML5 Audio API（播放器）

### 參考專案
- Podnote - Obsidian Podcast 插件（基礎功能參考）

---

## 🐛 已知問題與待解決

（目前無）

---

## 💡 未來功能構想

- [ ] Podcast 搜尋與探索
- [ ] 離線下載 Episode
- [ ] 播放統計與分析
- [ ] 社群分享功能
- [ ] 與其他 Obsidian 插件整合
- [ ] 跨裝置同步（透過第三方服務）
