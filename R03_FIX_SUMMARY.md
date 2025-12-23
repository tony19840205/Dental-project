# 🔧 R03 牙位不一致檢測修復 - 快速摘要

## ❌ 問題
診斷牙位 **#34** 與處置牙位 **#33** 不一致時，CQL沒有示警。

## ✅ 根本原因
1. **牙位混合提取** - 系統將診斷和處置的牙位合併在一起，無法區分來源
2. **R03規則缺失** - `checkCQLRules()` 函數中完全沒有實作 R03 檢查邏輯

## 🔨 修復內容

### 1. 分離牙位提取（checkFHIR函數）
```javascript
// ❌ 修復前：混在一起
const combinedText = diagnosisNotes + procedureNotes + procedureNotes2;

// ✅ 修復後：分別提取
const diagnosisTeeth = new Set();  // 診斷牙位
const procedureTeeth = new Set();  // 處置牙位
```

### 2. 新增R03檢查邏輯（checkCQLRules函數）
```javascript
// 檢查處置牙位是否都有對應的診斷
if (diagnosisTeeth.size > 0 && procedureTeeth.size > 0) {
    const unmatchedTeeth = [...procedureTeeth].filter(t => !diagnosisTeeth.has(t));
    if (unmatchedTeeth.length > 0) {
        alerts.push({
            rule: 'R03',
            title: '處置和診斷的牙位不匹配',
            message: `⚠️ 處置牙位 ${unmatchedTeeth} 沒有對應診斷...`
        });
    }
}
```

## 📋 測試結果
| 測試案例 | 診斷 | 處置 | 預期 | 結果 |
|---------|------|------|------|------|
| 案例1 | #34 | #33 | 應示警 | ✅ PASS |
| 案例2 | #34 | #34 | 不示警 | ✅ PASS |
| 案例3 | #34+#35 | #34+#33 | 示警#33 | ✅ PASS |

## 🎯 如何觸發檢查
1. 診斷說明包含 **#34**
2. 處置說明包含 **#33**
3. 點擊「🔍 FHIR檢測」
4. 系統顯示 **🔴 ALERT** 警告

## 📁 修改的文件
- `dental-ehr.html` (2處修改)
  - `checkFHIR()` - 分離牙位提取
  - `checkCQLRules()` - 新增R03檢查

## ✅ 影響評估
- ✅ 不影響其他規則（R01, R02, R04-R09）
- ✅ 向後相容
- ✅ CQL文件無需修改

---
**修復完成** | 2025-12-21
