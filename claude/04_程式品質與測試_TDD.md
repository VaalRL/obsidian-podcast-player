# 04｜程式品質與測試（TDD）

> 適用於 Obsidian Podcast Player 插件開發

## 指南
- **先寫測試**：Red → Green → Refactor
- **覆蓋率**：維持關鍵路徑與風險區域的高覆蓋；測試即文件
- **避免重複**：共用邏輯抽成測試工具/fixtures

## 專案測試策略

### 單元測試重點
- `src/feed/RSSParser.ts` - RSS Feed 解析
- `src/feed/AtomParser.ts` - Atom Feed 解析
- `src/player/PlayerController.ts` - 播放器控制邏輯
- `src/storage/ProgressStore.ts` - 播放進度儲存
- `src/playlist/PlaylistManager.ts` - 播放清單管理
- `src/queue/QueueManager.ts` - 播放佇列管理

### 測試檔案規範
- 與源檔案同目錄
- 命名：`原檔名.test.ts`
- 示例：`PlayerController.test.ts`, `RSSParser.test.ts`

### 測試工具函數
```typescript
// 示例：建立測試用的 Podcast 物件
export function createTestPodcast(overrides?: Partial<Podcast>): Podcast {
  return {
    id: 'test-podcast-1',
    title: 'Test Podcast',
    feedUrl: 'https://example.com/feed.rss',
    author: 'Test Author',
    description: 'Test Description',
    imageUrl: 'https://example.com/image.jpg',
    episodes: [],
    settings: {
      volume: 1.0,
      playbackSpeed: 1.0,
      skipIntroSeconds: 0
    },
    ...overrides
  };
}

// 示例：建立測試用的 Episode 物件
export function createTestEpisode(overrides?: Partial<Episode>): Episode {
  return {
    id: 'test-episode-1',
    podcastId: 'test-podcast-1',
    title: 'Test Episode',
    audioUrl: 'https://example.com/audio.mp3',
    duration: 3600,
    publishDate: new Date(),
    description: 'Test episode description',
    ...overrides
  };
}
```

### 避免測試
- Obsidian API（使用模擬）
- UI 渲染（依賴 Obsidian 環境）
- 實際網路請求（使用測試替身）

## 完成定義（DoD）
- 測試通過且可讀性佳
- 未新增重複來源；延伸既有實作
- 關鍵決策記錄清楚
- 構建無錯誤：`npm run build`
