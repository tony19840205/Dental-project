# FHIR 真實連線指南

## 系統升級說明

dental-ehr.html 已從「演示模式」升級為「真實 FHIR 連線模式」。

### 主要變更

#### 1. FHIR API 整合
- **新增函數**: `fhirQuery(resourceType, params)` - 通用 FHIR 查詢函數
- **新增函數**: `testFHIRConnection()` - 測試 FHIR 服務器連線
- **新增函數**: `parseFHIRProcedures(procedures)` - 解析 FHIR Procedure 資源

#### 2. 真實數據查詢流程
當使用者選擇患者後點擊「送出檢測」：

```
1. 測試 FHIR 連線 (GET /metadata)
   ↓
2. 查詢患者資料 (GET /Patient?identifier=xxx)
   ↓
3. 查詢處置記錄 (GET /Procedure?patient=xxx&_sort=-date)
   ↓
4. 查詢就診記錄 (GET /Encounter?patient=xxx&_sort=-date)
   ↓
5. 執行 CQL 規則檢查 (使用真實數據)
   ↓
6. 顯示結果與 FHIR 跨院歷史記錄
```

#### 3. UI 改進
- ✅ 綠色「已連線到 FHIR 伺服器」狀態指示真實連線成功
- ❌ 紅色狀態指示連線失敗
- 📊 顯示查詢到的 FHIR 數據筆數（處置記錄、就診記錄）
- 🔍 跨院歷史記錄來源標示 "來源：https://thas.mohw.gov.tw/v/r4/fhir"

### 測試步驟

#### 方法 1: 直接開啟 HTML
1. 開啟 `dental-ehr.html`
2. 選擇患者（P001-P006）
3. 填寫診斷與處置
4. 點擊「送出檢測」
5. 觀察是否成功連線並查詢數據

#### 方法 2: 使用測試腳本
```bash
# 1. 上傳測試數據到 FHIR 服務器
node upload-to-sandbox.js

# 2. 測試 FHIR 端點
node test-endpoints.js

# 3. 開啟 dental-ehr.html 進行測試
```

### CORS 問題處理

如果遇到 CORS 錯誤（常見於瀏覽器控制台）：

```
Access to fetch at 'https://thas.mohw.gov.tw/v/r4/fhir/Patient' 
from origin 'null' has been blocked by CORS policy
```

**解決方案**：

#### 選項 1: 使用 CORS 擴展 (最簡單)
- Chrome: [CORS Unblock](https://chrome.google.com/webstore/detail/cors-unblock/lfhmikememgdcahcdlaciloancbhjino)
- Firefox: [CORS Everywhere](https://addons.mozilla.org/firefox/addon/cors-everywhere/)

#### 選項 2: 使用本地 HTTP 服務器
```bash
# Python 3
python -m http.server 8000

# Node.js
npx http-server

# 然後訪問 http://localhost:8000/dental-ehr.html
```

#### 選項 3: 架設代理服務器
在 Node.js 中使用 `cors-anywhere` 或 `http-proxy-middleware`

### 數據映射

#### 患者 ID 映射
| 系統 ID | 身份證字號 | FHIR identifier |
|---------|------------|-----------------|
| P001    | A123456789 | A123456789      |
| P002    | B234567890 | B234567890      |
| P003    | C345678901 | C345678901      |
| P004    | D456789012 | D456789012      |
| P005    | E567890123 | E567890123      |
| P006    | F678901234 | F678901234      |

#### FHIR 資源結構
```json
// Procedure 範例
{
  "resourceType": "Procedure",
  "id": "proc-001",
  "status": "completed",
  "code": {
    "text": "根管第一次療程",
    "coding": [...]
  },
  "subject": {
    "reference": "Patient/patient-001"
  },
  "performedDateTime": "2025-10-20T10:30:00+08:00",
  "bodySite": [
    {
      "text": "牙位 #36",
      "coding": [...]
    }
  ],
  "location": {
    "display": "信義牙醫診所"
  }
}
```

### 向下兼容

如果 FHIR 連線失敗或無數據，系統會：
1. 顯示連線錯誤訊息
2. 仍可使用預設的模擬數據進行演示

### 技術細節

#### API 請求頭
```javascript
headers: {
  'Accept': 'application/fhir+json',
  'Content-Type': 'application/fhir+json'
}
```

#### 查詢參數範例
```javascript
// 查詢患者
fhirQuery('Patient', { identifier: 'A123456789' })

// 查詢處置記錄（按日期降序）
fhirQuery('Procedure', { 
  patient: 'patient-001',
  _sort: '-date'
})

// 查詢就診記錄
fhirQuery('Encounter', { 
  patient: 'patient-001',
  _sort: '-date'
})
```

### 錯誤處理

系統會捕獲並顯示以下錯誤：
- ❌ 網絡連線失敗
- ❌ FHIR 服務器無回應
- ❌ CORS 策略阻擋
- ❌ 認證失敗 (401)
- ❌ 資源不存在 (404)

所有錯誤詳細訊息會顯示在：
1. UI 警告框
2. 瀏覽器控制台（按 F12 查看）

### 驗證真實連線

判斷是否成功使用真實 FHIR 數據：

✅ **真實連線指標**：
- 顯示「📊 FHIR 真實數據查詢成功」
- 處置記錄/就診記錄顯示實際數量（非固定值）
- 跨院歷史記錄來源標示 FHIR 服務器 URL
- 瀏覽器控制台可見 FHIR API 請求

❌ **模擬數據指標**：
- 無「FHIR 真實數據查詢成功」訊息
- 歷史記錄固定顯示預設內容
- 控制台無 FHIR API 請求

---

## 聯絡資訊

如有問題或需要協助，請檢查：
1. 瀏覽器控制台（F12）查看詳細錯誤訊息
2. FHIR 服務器狀態：https://thas.mohw.gov.tw/v/r4/fhir/metadata
3. 測試腳本輸出（test-endpoints.js）
