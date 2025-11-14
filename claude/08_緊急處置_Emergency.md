# 08｜緊急處置手冊（Emergency Procedures）

> 適用於 Obsidian Podcast Player 插件開發

## 如果違反規則
1. **立刻停止**
2. **評估影響**
3. **修正**：改以正確流程處理
4. **防範再犯**：補強規劃與檢查清單

## 常見緊急狀況

### 構建失敗
```bash
# 清理構建產物
rm -rf dist/
npm run build
```

### 測試失敗
```bash
# 檢查測試輸出
npm test
# 檢查特定測試
npm test -- PlayerController.test.ts
npm test -- RSSParser.test.ts
```

### 插件載入錯誤
1. 檢查 `manifest.json` 版本號
2. 檢查 `main.ts` 是否有語法錯誤
3. 檢查 console 日誌訊息
4. 使用 `npm run dev` 重新構建

### 播放器錯誤
1. 檢查音訊檔案 URL 是否有效
2. 檢查播放器狀態同步
3. 清除播放進度快取
4. 檢查瀏覽器 Audio API 支援

### 資料遺失風險
1. 立即備份 `SubscriptionStore` 和 `ProgressStore` 資料
2. 檢查 Git 歷史
3. 必要時還原最近的工作狀態

## 情境管理
- 使用 `/compact` 簡化上下文
- 重要節點建立 Git checkpoint 與備份
- 將大型任務拆解，預留切換與回復點

## 預防措施
- **定期檢查構建**：每次修改後執行 `npm run build`
- **測試覆蓋**：關鍵功能保持高測試覆蓋率
- **版本控制**：重要變更前建立 Git 分支
