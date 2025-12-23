# 牙科跨院 FHIR 測試資料使用說明

## 📦 已生成的測試資料

### 檔案清單
- `TestPatients.json` - 6位病人的完整FHIR資源（Bundle格式）
- `DentalCrossClinicRules.cql` - 10個CQL規則定義
- `test-cql.js` - CQL規則測試腳本（已驗證成功）

### 測試資料摘要
- **2位跨院矛盾病例**：P001（已拔牙再治療）、P002（跨院重複根管第一次療程）
- **2位正常病例**：P003（完整根管流程）、P004（標準補牙）
- **2位單院病例**：P005（拔牙）、P006（根管治療）
- **總計41個FHIR資源**：2 Organization + 6 Patient + 10 Encounter + 6 Condition + 10 Procedure + 7 ImagingStudy

## 🚀 如何使用衛福部沙盒

根據您提供的截圖，`https://thas.mohw.gov.tw/v/r4/fhir` 是**EHR Launch入口**，不是直接的FHIR API端點。

### 正確使用步驟

#### 步驟 1：找到實際的FHIR Server URL
您需要先找到真正的FHIR REST API端點，通常是：
- `https://[server]/fhir/` 
- 或其他提供的測試用FHIR Server

#### 步驟 2：使用Postman上傳測試資料

1. **開啟Postman**

2. **匯入Collection**（使用下方生成的 `postman_collection.json`）

3. **逐一上傳資源**（建議順序）：
   - Organization（院所） → 2個
   - Patient（病人） → 6個
   - Encounter（就診） → 10個
   - Condition（診斷） → 6個
   - Procedure（處置） → 10個
   - ImagingStudy（影像） → 7個

4. **HTTP方法**：
   ```
   POST [FHIR_BASE_URL]/Patient
   Content-Type: application/fhir+json
   Body: {Patient資源內容}
   ```

#### 步驟 3：測試CQL規則

上傳完成後，可以：
1. 使用本地測試腳本驗證：`npm test`
2. 或整合到臨床決策支援系統（CDS Hooks）

#### 步驟 4：使用EHR Launch
完成資料上傳後，再到 `https://thas.mohw.gov.tw/v/r4/fhir` 進行應用程式的EHR Launch測試

## 📋 Postman使用方式

### 手動上傳步驟

#### 1. 上傳Organization
```
POST {{FHIR_BASE_URL}}/Organization
Content-Type: application/fhir+json

{
  "resourceType": "Organization",
  "id": "ORG-A",
  "name": "仁愛牙醫診所",
  ...
}
```

#### 2. 上傳Patient
```
POST {{FHIR_BASE_URL}}/Patient
Content-Type: application/fhir+json

{
  "resourceType": "Patient",
  "id": "P001",
  "name": [{"text": "王小明", ...}],
  ...
}
```

以此類推，依序上傳所有資源。

## 🔍 測試CQL規則

### 已驗證的規則觸發

執行 `npm test` 後應該看到：

```
🔴 R01｜已拔除牙再次被處置
  ⚠️  王小明 (P001)
      牙位 16 已於 2025-10-01 拔除
      ❌ 卻於 2025-11-15 在 信義牙醫診所 進行 RCT-FIRST

🔴 R02｜跨院重複記錄「根管第一次療程」
  ⚠️  李美玲 (P002)
      牙位 36 在不同院所重複記錄「根管第一次療程」：
      - 2025-09-10 @ 仁愛牙醫診所
      - 2025-10-20 @ 信義牙醫診所
```

## 💡 備註

1. **沙盒URL說明**：
   - `https://thas.mohw.gov.tw/v/r4/fhir` 是EHR Launch的入口頁面
   - 需要另外取得實際的FHIR REST API端點進行資料上傳

2. **本地測試**：
   - CQL規則已在本地測試成功 ✅
   - 測試資料符合預期設計 ✅
   - 成功偵測跨院矛盾 ✅

3. **下一步建議**：
   - 詢問沙盒管理員取得實際的FHIR REST API URL
   - 或使用其他公開的FHIR測試伺服器（如HAPI FHIR）
   - 將測試資料整合到您的臨床系統中

## 📞 聯絡資訊

如需協助或有疑問，請聯繫沙盒管理單位取得：
- 正確的FHIR REST API端點
- 認證方式（如需要）
- 使用限制和注意事項
