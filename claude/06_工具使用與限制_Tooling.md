# 06｜工具使用與限制（Tooling）

> 適用於 Obsidian Podcast Player 插件開發

## 禁用與替代
- 禁用：`git -i`、`find`、`grep`、`cat`、`head`、`tail`、`ls`
- 請改用：**Read / LS / Grep / Glob** 專用工具

## 專案開發工具

### 構建與測試
```bash
npm run dev      # 開發模式構建
npm run build    # 生產構建
npm test         # 執行測試
```

### TypeScript 相關
- 編譯檢查：`tsc -noEmit -skipLibCheck`
- 使用 `esbuild` 而非 `tsc` 直接構建（見 `esbuild.config.mjs`）

### 依賴管理
- `dependencies`（預計需要）：
  - `rss-parser` - RSS/Atom Feed 解析
  - `howler` 或原生 Audio API - 音訊播放
- `devDependencies`：
  - `esbuild` - 構建工具
  - `jest` - 測試框架
  - `ts-jest` - TypeScript 測試轉換器
  - `typescript` - TypeScript 編譯器

## 允許的命令行工具
- `npm` - 套件管理
- `git`（非互動模式）- 版本控制
- `esbuild` - 構建
- `jest` - 測試

## 其他注意
- **learning/** 目錄為個人學習，不作為專案依據，請忽略
- 開發時關注 `dist/` 目錄（編譯輸出）
