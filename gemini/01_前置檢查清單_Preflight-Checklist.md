# 01｜前置檢查清單（Preflight Checklist）

> 在任何變更開始前，逐條勾選。適用於 Obsidian Podcast Player 插件開發。

## Step 1：規範確認與專案脈絡
- [ ] 我已理解並承諾遵守所有**關鍵規則**（檔案規範、工具限制、SSOT、修正優先原則）。
- [ ] 我已了解目前專案位於 `obsidian-podcast-player/` 目錄。
- [ ] 我能描述目前所處的**實作階段**與方向。

## Step 2：任務特性判斷
- [ ] 是否會在 root 產生檔案？→ **若會且非必要檔案**，請改寫入正確模組/資料夾。
  - **允許的 root 檔案**：`main.ts`, `manifest.json`, `package.json`, `tsconfig.json`, `esbuild.config.mjs`, `styles.css`
- [ ] 是否可能超過 **30 秒**？→ **是**：改以 **Task Agent** 執行。
- [ ] 是否 ≥ **3 步驟**？→ **是**：先做 **TodoWrite** 任務分解。
- [ ] 我是否打算用 shell 的 grep/find/cat？→ **改用**專用 Read/LS/Grep/Glob 工具。

## Step 3：避免技術債（Mandatory Search First）
- [ ] **先搜尋庫內**：以關鍵字（功能＋名詞）搜尋可能的既有實作。
- [ ] **閱讀原始碼**：理解現有架構與設計模式（參見 CLAUDE.md 的專案概況）。
- [ ] **閱讀與比對**：如果有相似功能，**延伸**它而非另起爐灶。
- [ ] 我是否會導致多個真實來源或重複類別？→ **避免**。

## Step 4：Obsidian 插件特殊注意事項
- [ ] 修改 `main.ts` 必須遵守 Obsidian Plugin 生命週期（onload/onunload）。
- [ ] UI 元件需繼承 Obsidian ItemView 或使用官方 UI API。
- [ ] 設定變更需要透過 SettingsManager 統一管理。
- [ ] 構建前需確認：`npm run build` 無錯誤。

## Step 5：情境管理與紀錄
- [ ] 任務是長/複雜？→ 規劃**檢查點**與最小可回復單位。
- [ ] 完成重大里程碑？→ 記錄關鍵設計決策與完成定義。
- [ ] 修改播放器功能時？→ 確認音訊播放、進度保存與佇列管理的正確性。
- [ ] 修改 Feed 解析時？→ 確認 RSS/Atom 格式相容性。

> 勾選完成前 **不要動手**。
