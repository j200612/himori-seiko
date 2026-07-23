# 🏛️ 萬能播放器 SaaS 平台開發與版本安全規範 2.0

當前專案在開發與修正時，必須嚴格遵循以下行為約束與安全規則，以防止版本覆蓋或修改錯誤：

## 1. 📂 100% 雲端純淨開發與路徑規範
*   **全面定居 G 槽**：所有檔案之讀寫、重構、修正與刪除，必須一律在 G 槽路徑 `G:\我的雲端硬碟\ai\日森精工` (或白牌端的 `模組開發中心`) 目錄下直接進行。
*   **徹底斷開 C 槽**：禁止寫入、拷貝、鏡像或同步 any 程式碼至本機 C 槽。系統開發與備份路徑已全面與 C 槽脫鉤。

## 2. 🌿 雲端 Git 自動備份與商務版本控管
*   **變更前 Git 防護網**：在對平台任何核心檔案（`portal.html`、`global_shared.js`）或黃金三層模組（`01_Core_Base/`、`02_LINE_Office/`、`03_Industry_Modules/`）進行變更前，豆豆必須：
    1.  檢查工作區狀態 `git status`。
    2.  將當前穩定版本做一個 G 槽本地 Commit 提交備份（如：`git commit -m "變更前備份：[描述]"`）。
*   **商務版本登錄（Version Tag）**：凡涉及核心功能擴充、勞動法規身分（`laborType`）異動或新功能插拔，修改完成後，豆豆必須主動至 `global_shared.js` 與 `version_registry.md` 更新並登錄對應模組的商務版本號，確保換殼外銷時各行業歌曲互不覆蓋。

## 3. 📝 Planning Mode 流程控制與自動校對
*   **非微調重大變更**：豆豆必須先進入 Planning Mode，撰寫並更新 `implementation_plan.md`，詳列修改目標、受影響模組的相對路徑與修改代碼。等待總裁確認同意後，再進行修改。
*   **語法安全總檢驗**：每次修改完成後，豆豆必須自動執行 `verify_modified_syntax.js` 驗證腳本。若出現 HTML 標籤不對稱（div 不平衡）或 JavaScript 語法解析錯誤，必須立即執行 `git checkout .` 回滾，絕對禁止交付有瑕疵的代碼。

## 4. ⚖️ Antigravity AI 全局核心開發憲法與自我驗證鐵律
1. **【實體 DOM 節點與變數 100% 對齊】**：在 JS 呼叫 `getElementById`、`querySelector` 或綁定 `onclick` 時，必須搜尋全域 HTML，確認同名 ID / Class 100% 實體存在且大小寫完全吻合。絕不允許 JS 呼叫了某個元件，但 HTML 裡根本沒有該元件的情況。
2. **【GCP / Cloud Run 雲端全量打包驗證】**：部署至雲端前，必須檢查 Dockerfile 與打包路徑，確保所有 static / modules / 圖片 / 腳本資料夾 100% 包含在映像檔內，絕不允許出現 404 漏檔或破圖。
3. **【禁止私吞錯誤 (Error Boundary & Catch)】**：所有 API 請求（fetch）與 DOM 操作必須包裹 `try...catch`。若資源不存在或執行失敗，必須在 UI 彈出明確警示 (`alert`/`toast`)，絕不允許靜悄悄地 `return` 導致畫面變黑或按鈕形同死魚。
4. **【實體按鈕與預覽通電測試】**：交付前必須確認：檔案上傳、列表渲染、Modal 彈窗、手機預覽四大區塊實體線路 100% 通電，無任何 Uncaught Error。
