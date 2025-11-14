# GEMINI.md（任務分配主文件）

> 本文件作為「入口與路由」，依任務情境指派要閱讀的任務指南。適用於 Obsidian Podcast Player 插件開發。

## 快速路由（你要做什麼？）

- **準備開始任何任務** → 讀《01_前置檢查清單》與《03_搜尋優先與架構定位》  
- **撰寫或修改功能** → 讀《04_程式品質與測試（TDD）》＋《03_搜尋優先與架構定位》＋《05_檔案與目錄規範》  
- **長時間或多步驟任務**（>30 秒或 ≥3 步）→ 讀《02_TodoWrite 與 Task Agents》  
- **需要重構 / 消除重複 / 整併** → 讀《03_搜尋優先與架構定位》＋《05_檔案與目錄規範》  
- **要動用外部工具或 CLI** → 讀《06_工具使用與限制》  
- **大範圍變更完成後** → 讀《07_多代理人協作與審查流程》  
- **出了狀況、違規或需要止血** → 讀《08_緊急處置手冊》  
- **想複習原則與心法** → 讀《09_最佳實務摘要》  
- **修復問題而非重建** → 讀《10_修正優先開發原則》

## 目錄
1. [01_前置檢查清單_Preflight-Checklist.md](./gemini/01_前置檢查清單_Preflight-Checklist.md)
2. [02_任務執行_TodoWrite_與_TaskAgents.md](./gemini/02_任務執行_TodoWrite_與_TaskAgents.md)
3. [03_搜尋優先與架構定位_SearchFirst_Architecture.md](./gemini/03_搜尋優先與架構定位_SearchFirst_Architecture.md)
4. [04_程式品質與測試_TDD.md](./gemini/04_程式品質與測試_TDD.md)
5. [05_檔案與目錄規範_Repo_Structure.md](./gemini/05_檔案與目錄規範_Repo_Structure.md)
6. [06_工具使用與限制_Tooling.md](./gemini/06_工具使用與限制_Tooling.md)
7. [07_多代理人協作與審查_Reviews.md](./gemini/07_多代理人協作與審查_Reviews.md)
8. [08_緊急處置_Emergency.md](./gemini/08_緊急處置_Emergency.md)
9. [09_最佳實務_BestPractices.md](./gemini/09_最佳實務_BestPractices.md)
10. [10_修正優先開發原則_Fix-First-Principle.md](./gemini/10_修正優先開發原則_Fix-First-Principle.md)

---

## 專案概況

**Obsidian Podcast Player** 是一個功能豐富的 Podcast 播放與管理插件，參考 Podnote 的基礎功能並提供更精細的管理能力。

### 核心功能
#### 基礎功能（參考 Podnote）
- Feed 管理（RSS/Atom）
- Podcast 播放器
- Podcast 快速匯入筆記

#### 進階功能（精細管理）
- 個別 Podcast 播放設定（音量、速度、跳過開頭秒數）
- 多個播放佇列管理
- 多個播放清單管理
- Podcast 訂閱與同步
- 筆記整合與時間戳記錄

### 技術堆疊
- **語言**：TypeScript
- **構建工具**：esbuild
- **測試框架**：Jest
- **架構**：Obsidian Plugin API

### 核心模組
- `src/podcast/` - Podcast 處理核心（訂閱、下載、解析）
- `src/player/` - 播放器核心（播放控制、佇列管理）
- `src/feed/` - Feed 管理（RSS/Atom 解析與同步）
- `src/playlist/` - 播放清單管理
- `src/queue/` - 播放佇列管理
- `src/model/` - 資料模型定義（Podcast、Episode、Playlist 等）
- `src/storage/` - 資料持久化（訂閱、播放進度、設定）
- `src/markdown/` - Markdown 整合與筆記匯出
- `src/ui/` - 使用者介面（播放器、列表、設定）
- `src/settings.ts` - 設定管理
- `main.ts` - 插件入口

---

## 全域硬規則（永遠適用）

- **單一真實來源（SSOT）**：不要重複實作；延伸既有功能，而不是平行新版本。
- **禁止在 root 目錄新增檔案**；輸出、文件請放到既定模組/目錄。
  - **例外**：`manifest.json`, `package.json`, `tsconfig.json`, `esbuild.config.mjs`, `main.ts`, `styles.css` 為 Obsidian 插件必要檔案。
- **不可使用互動式 git（`-i`）與 `find/grep/cat/head/tail/ls`**（請改用專用工具）。
- **可測、可維護**：一律 TDD，Red→Green→Refactor，測試即文件。
- **先找再做**：先搜尋現有程式，再閱讀與理解架構。
- **修正優先**：優先修正現有組件，而非創建新組件替代。

> 詳情與例外說明，請見各任務指南。
