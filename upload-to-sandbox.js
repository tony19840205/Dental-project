// 安全上傳測試資料到 FHIR 沙盒
// URL: https://thas.mohw.gov.tw/v/r4/fhir

const fs = require('fs');
const https = require('https');
const http = require('http');

const FHIR_BASE_URL = 'https://thas.mohw.gov.tw/v/r4/fhir';

// 讀取測試資料
const testData = JSON.parse(fs.readFileSync('./TestPatients.json', 'utf8'));

console.log('🏥 FHIR 沙盒上傳工具');
console.log('='.repeat(80));
console.log(`目標伺服器：${FHIR_BASE_URL}`);
console.log('');

// FHIR HTTP 請求函數
function fhirRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, FHIR_BASE_URL);
    const options = {
      method: method,
      headers: {
        'Content-Type': 'application/fhir+json',
        'Accept': 'application/fhir+json'
      }
    };

    if (data) {
      options.headers['Content-Length'] = Buffer.byteLength(JSON.stringify(data));
    }

    const protocol = url.protocol === 'https:' ? https : http;
    
    const req = protocol.request(url, options, (res) => {
      let body = '';
      
      res.on('data', (chunk) => {
        body += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = body ? JSON.parse(body) : {};
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: response
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: body
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

// 測試伺服器連接
async function testConnection() {
  console.log('🔍 步驟 1：測試伺服器連接...');
  try {
    // 嘗試查詢 Patient 資源來測試連接
    const response = await fhirRequest('GET', '/Patient?_count=1');
    if (response.status === 200 || response.status === 404) {
      console.log('   ✅ 伺服器連接正常');
      return true;
    } else {
      console.log(`   ⚠️  伺服器回應異常：HTTP ${response.status}`);
      console.log('   ℹ️  但將繼續嘗試上傳...');
      return true; // 繼續嘗試
    }
  } catch (error) {
    console.log(`   ❌ 連接失敗：${error.message}`);
    return false;
  }
}

// 檢查資源是否已存在
async function resourceExists(resourceType, id) {
  try {
    const response = await fhirRequest('GET', `/${resourceType}/${id}`);
    return response.status === 200;
  } catch (error) {
    return false;
  }
}

// 上傳單一資源
async function uploadResource(resource, index, total) {
  const resourceType = resource.resourceType;
  const id = resource.id;
  
  console.log(`\n📤 [${index}/${total}] 上傳 ${resourceType}/${id}`);
  
  try {
    // 先嘗試 POST 方法創建資源
    const response = await fhirRequest('POST', `/${resourceType}`, resource);
    
    if (response.status >= 200 && response.status < 300) {
      console.log(`   ✅ 成功 (HTTP ${response.status})`);
      return { success: true, resource: resourceType, id: id };
    } else if (response.status === 409 || response.status === 412) {
      // 資源已存在，嘗試 PUT 更新
      console.log(`   ℹ️  資源已存在，嘗試更新...`);
      const updateResponse = await fhirRequest('PUT', `/${resourceType}/${id}`, resource);
      if (updateResponse.status >= 200 && updateResponse.status < 300) {
        console.log(`   ✅ 更新成功 (HTTP ${updateResponse.status})`);
        return { success: true, resource: resourceType, id: id };
      } else {
        console.log(`   ⚠️  更新失敗 (HTTP ${updateResponse.status})`);
        return { success: false, resource: resourceType, id: id, error: updateResponse.data };
      }
    } else {
      console.log(`   ⚠️  失敗 (HTTP ${response.status})`);
      if (response.data) {
        const errorMsg = typeof response.data === 'string' ? response.data : JSON.stringify(response.data, null, 2);
        console.log(`   錯誤：${errorMsg.substring(0, 200)}`);
      }
      return { success: false, resource: resourceType, id: id, error: response.data };
    }
  } catch (error) {
    console.log(`   ❌ 錯誤：${error.message}`);
    return { success: false, resource: resourceType, id: id, error: error.message };
  }
}

// 主程式
async function main() {
  // 步驟 1：測試連接
  const connected = await testConnection();
  if (!connected) {
    console.log('\n❌ 無法連接到 FHIR 伺服器，請檢查網路或 URL');
    process.exit(1);
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('📦 步驟 2：準備上傳資源');
  console.log('='.repeat(80));
  
  // 按順序上傳：Organization → Patient → Encounter → Condition → Procedure → ImagingStudy
  const resourceOrder = [
    'Organization',
    'Patient', 
    'Encounter',
    'Condition',
    'Procedure',
    'ImagingStudy'
  ];
  
  const orderedResources = [];
  resourceOrder.forEach(type => {
    testData.entry.forEach(entry => {
      if (entry.resource.resourceType === type) {
        orderedResources.push(entry.resource);
      }
    });
  });
  
  console.log(`\n總共 ${orderedResources.length} 個資源待上傳`);
  console.log('資源類型分布：');
  resourceOrder.forEach(type => {
    const count = orderedResources.filter(r => r.resourceType === type).length;
    if (count > 0) {
      console.log(`  - ${type}: ${count} 個`);
    }
  });
  
  console.log('\n⏸️  請確認是否繼續？(按 Ctrl+C 取消，或等待 5 秒自動繼續)');
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  console.log('\n' + '='.repeat(80));
  console.log('🚀 步驟 3：開始上傳');
  console.log('='.repeat(80));
  
  const results = [];
  
  for (let i = 0; i < orderedResources.length; i++) {
    const resource = orderedResources[i];
    const result = await uploadResource(resource, i + 1, orderedResources.length);
    results.push(result);
    
    // 每個請求之間暫停 500ms，避免過度負載
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // 統計結果
  console.log('\n' + '='.repeat(80));
  console.log('📊 上傳結果統計');
  console.log('='.repeat(80));
  
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`✅ 成功：${successful} 個`);
  console.log(`❌ 失敗：${failed} 個`);
  
  if (failed > 0) {
    console.log('\n失敗的資源：');
    results.filter(r => !r.success).forEach(r => {
      console.log(`  - ${r.resource}/${r.id}`);
    });
  }
  
  console.log('\n✨ 上傳完成！');
  console.log(`\n可以前往查看：${FHIR_BASE_URL}/Patient`);
}

// 執行主程式
main().catch(error => {
  console.error('\n❌ 程式執行錯誤：', error);
  process.exit(1);
});
