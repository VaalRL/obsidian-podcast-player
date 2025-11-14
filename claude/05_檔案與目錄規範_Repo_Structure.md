# 05｜檔案與目錄規範（Repo Structure）

> 適用於 Obsidian Podcast Player 插件開發

## 目錄分工

### 核心目錄
- `src/` - TypeScript 實作檔案
  - `podcast/` - Podcast 處理核心（訂閱、下載、解析）
  - `player/` - 播放器核心（播放控制、佇列管理）
  - `feed/` - Feed 管理（RSS/Atom 解析與同步）
  - `playlist/` - 播放清單管理
  - `queue/` - 播放佇列管理
  - `model/` - 資料模型定義（Podcast、Episode、Playlist 等）
  - `storage/` - 資料持久化（訂閱、播放進度、設定）
  - `markdown/` - Markdown 整合與筆記匯出
  - `types/` - TypeScript 類型定義
  - `ui/` - 使用者介面組件（播放器、列表、設定）
  - `utils/` - 工具函數
  - `settings.ts` - 設定管理
- `claude/` - 開發規範與指南（Claude AI 專用）
- `gemini/` - 開發規範與指南（Gemini AI 專用）
- `dist/` - 編譯輸出（由 esbuild 產生）
- `node_modules/` - 依賴套件

### Obsidian 插件必要檔案（允許在 root）
- `main.ts` - 插件入口
- `manifest.json` - 插件資訊
- `package.json` - NPM 配置
- `tsconfig.json` - TypeScript 配置
- `esbuild.config.mjs` - 構建配置
- `jest.config.js` - 測試配置
- `styles.css` - 樣式檔案
- `version-bump.mjs` - 版本管理腳本
- `versions.json` - 版本資訊

## 強制規範
- **嚴禁**在 **root** 新增非必要檔案
- 新增檔案請放入對應的 `src/` 子目錄
- 避免新增與既有概念重疊的檔案
- 測試檔案命名：`*.test.ts`（與源檔案同目錄）

## 檔案命名規範
- TypeScript 檔案：PascalCase（類別、接口）或 camelCase（函數）
  - 示例：`PodcastService.ts`, `feedParser.ts`, `PlayerController.ts`
- 測試檔案：`原檔名.test.ts`
  - 示例：`PodcastService.test.ts`, `PlayerController.test.ts`
- Markdown 文件：中文描述 + 英文備註

## 模組組織原則
- 單一職責：每個檔案/模組只做一件事
- 高內聚低耦合：相關功能集中，模組間依賴最小
- 分層清晰：UI → Service → Storage → Model

## 新增功能時的正確流程
1. 確定功能所屬模組
2. 檢查是否已有相似功能
3. 若有，延伸既有；若無，在正確目錄新增
4. 更新相關類型定義
5. 撰寫測試檔案
