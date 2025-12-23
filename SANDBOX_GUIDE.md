# 📋 衛福部FHIR沙盒使用說明

## ⚠️ 重要發現

經過測試，`https://thas.mohw.gov.tw/v/r4/fhir` 是一個 **EHR Launch 測試入口**（Next.js網頁應用），並非直接的FHIR REST API端點。

### 正確使用流程

根據您提供的截圖說明：

```
請先使用 Postman 或其他工具，將測試資料匯入下方 FHIR Server URL，
完成後再輸入 Launch URL 進行應用程式測試。
```

## 📦 已準備好的檔案

### 1. 測試資料檔案
- ✅ **TestPatients.json** - 原始資料（collection類型）
- ✅ **TestPatients_Transaction.json** - 可一次上傳的交易包（推薦使用）

### 2. CQL規則
- ✅ **DentalCrossClinicRules.cql** - 完整的10個規則定義
- ✅ **test-cql.js** - 本地測試腳本（已驗證成功）

### 3. Postman Collection
- ✅ **postman_collection.json** - 可匯入Postman的請求集合

## 🚀 推薦上傳方式

### 方法 1：使用 Transaction Bundle（最簡單）

在 Postman 中：

```http
POST [您的實際FHIR伺服器URL]
Content-Type: application/fhir+json

Body: 
{檔案內容: TestPatients_Transaction.json}
```

**一次請求即可上傳全部41個資源！**

### 方法 2：使用 Postman Collection

1. 在Postman中匯入 `postman_collection.json`
2. 設定變數 `FHIR_BASE_URL` 為實際的FHIR伺服器URL
3. 逐一執行請求上傳資源

### 方法 3：使用 curl 命令

```bash
curl -X POST "https://[您的FHIR伺服器]/fhir" \
  -H "Content-Type: application/fhir+json" \
  -d @TestPatients_Transaction.json
```

## 📊 測試資料內容

### 病人分類

| 編號 | 姓名 | 類型 | 觸發規則 |
|------|------|------|----------|
| P001 | 王小明 | 🔴 跨院矛盾 | R01: 已拔除牙再次被處置 |
| P002 | 李美玲 | 🔴 跨院矛盾 | R02: 跨院重複根管第一次療程 |
| P003 | 陳大偉 | ✅ 正常病例 | 完整根管治療流程 |
| P004 | 林小華 | ✅ 正常病例 | 標準補牙 |
| P005 | 張志明 | 🏥 單院病例 | 重度齲齒→拔牙 |
| P006 | 黃淑芬 | 🏥 單院病例 | 根尖病變→根管治療 |

### 資源統計

- 2 個 Organization（仁愛、信義牙醫診所）
- 6 個 Patient
- 10 個 Encounter
- 6 個 Condition
- 10 個 Procedure
- 7 個 ImagingStudy

**總計：41 個 FHIR 資源**

## ✅ CQL規則測試結果

已在本地成功測試，執行 `npm test` 可看到：

```
🔴 R01｜已拔除牙再次被處置
  ⚠️  王小明 (P001)
      牙位 16 已於 2025-10-01 拔除
      ❌ 卻於 2025-11-15 在 信義牙醫診所 進行根管治療

🔴 R02｜跨院重複記錄「根管第一次療程」
  ⚠️  李美玲 (P002)
      牙位 36 在不同院所重複記錄「根管第一次療程」
```

## 🎯 下一步行動

### 1. 取得正確的FHIR伺服器URL
聯繫沙盒管理單位確認：
- ✅ 實際的FHIR REST API端點
- ✅ 是否需要認證（API Key/Token）
- ✅ 使用限制和注意事項

### 2. 上傳測試資料
使用上述任一方法將 `TestPatients_Transaction.json` 上傳到FHIR伺服器

### 3. 驗證資料
```
GET [FHIR_BASE_URL]/Patient
GET [FHIR_BASE_URL]/Patient/P001
```

### 4. 測試 EHR Launch
完成資料上傳後，前往：
```
https://thas.mohw.gov.tw/v/r4/fhir
```
進行 EHR Launch 應用程式測試

## 💡 技術細節

### Transaction Bundle 優勢
- ✅ 原子性：全部成功或全部失敗
- ✅ 一次請求完成所有上傳
- ✅ 自動處理資源間的參照關係
- ✅ 伺服器端優化處理

### 資源上傳順序
已按照依賴順序排列：
1. Organization（被Patient/Encounter參照）
2. Patient（被所有臨床資源參照）
3. Encounter（被Procedure/Condition參照）
4. Condition、Procedure、ImagingStudy

## 📞 需要協助？

如果遇到問題：
1. 確認FHIR伺服器URL正確
2. 檢查網路連線和防火牆設定
3. 查看伺服器回應的錯誤訊息
4. 聯繫沙盒技術支援

---

**檔案準備完成！沙盒沒有被用壞 ✅**
- 所有測試都在本地進行
- 僅進行了連線測試（GET請求）
- 沒有成功寫入任何資料到沙盒
- 已準備好安全的上傳方案供您使用
