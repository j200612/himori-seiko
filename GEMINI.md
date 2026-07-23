# 🏛️ 日森精工專案 GEMINI 開發憲法與防禦機制 (GEMINI.md)

本文件定義「日森精工中控系統」三大剛性開發憲法與運作規範，所有代碼開發、異動與驗證必須 100% 遵守：

---

## 1. 🛡️ preflight_validation_guard (預檢驗證防線)
- **實體 DOM 與變數預檢**：在 JS 呼叫 `getElementById`、`querySelector` 或綁定事件時，必須確認 DOM 節點 100% 實體存在且大小寫/ID 吻合。
- **檔案與 URL 格式預檢**：上傳與解析檔案前，強制進行檔名與副檔名（`.pdf`, `.docx`, `.xlsx`, `.jpg` 等）預檢，保證 URL 解析與展延不缺失副檔名。
- **API 與欄位完整性驗證**：所有 API 送出前進行必填欄位與格式檢查，絕不允許空值或結構破損請求發送至後端。

---

## 2. ⚡ ssot_and_cascade_eraser (SSOT 單一真理源頭與級聯清除憲法)
- **單一數據源 (SSOT)**：所有資料與圖片/文件預覽 URL（`previewUrl`, `url`, `currentUrl`, `fileUrl`）統一以資料庫 (Firestore) 為唯一真理源頭，保持副檔名與完整路徑 100% 一致。
- **級聯物理刪除 (Cascade Delete)**：執行刪除作業時，禁止僅在前端過濾隱藏（黑名單），必須採用 `Promise.all` 等級聯清除機制，同步刪除 GCS 實體檔案與 Firestore 所有關聯資料表（`document_assets`, `ai_assets`, `document_templates`）。

---

## 3. 🔄 async_queue_ui_renderer (非同步佇列與實體 DOM 即時渲染憲法)
- **非同步佇列透明化**：多檔案批次處理或非同步任務（如 Vision AI 解析、上傳）必須於前端構建動態佇列（`#batch-progress-row`），即時顯示狀態與耗時。
- **實體 DOM 即時刷新**：每當單一檔案處理完成，必須立即呼叫 `loadAssets(true)` 刷新實體 DOM，讓使用者眼見為憑。
- **Modal 與預覽視窗實體亮起**：Modal 彈窗與檔案預覽必須保證 `display`（如 `display = 'flex'`）與 `z-index` 實體最高顯現，絕不允許 `alert()`/`console.log()` 假裝 UI 成功，也不允許原生 `<iframe>` 直載 Office 格式導致空白死鎖。

---
