// 安全上傳測試 - 先上傳一個資源確認方式
const https = require('https');
const fs = require('fs');

const BASE_URL = 'https://thas.mohw.gov.tw/v/r4/fhir';

function fhirRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    
    const options = {
      method: method,
      hostname: url.hostname,
      path: url.pathname,
      headers: {
        'Accept': 'application/fhir+json',
        'Content-Type': 'application/fhir+json'
      }
    };
    
    if (data) {
      const body = JSON.stringify(data);
      options.headers['Content-Length'] = Buffer.byteLength(body);
    }
    
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, data: parsed });
        } catch {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });
    
    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function testUpload() {
  console.log('🧪 安全測試上傳功能');
  console.log('='.repeat(80));
  
  // 創建一個測試用的Organization
  const testOrg = {
    resourceType: 'Organization',
    id: 'DENTAL-TEST-ORG-001',
    name: '測試牙醫診所（可刪除）',
    identifier: [{
      system: 'http://test.example.org/',
      value: 'TEST-001'
    }]
  };
  
  console.log('\n步驟 1: 檢查測試資源是否已存在...');
  try {
    const checkResult = await fhirRequest('GET', '/Organization/DENTAL-TEST-ORG-001');
    if (checkResult.status === 200) {
      console.log('  ℹ️  測試資源已存在，將使用 PUT 更新');
    } else {
      console.log('  ℹ️  測試資源不存在，將使用 POST 創建');
    }
  } catch (error) {
    console.log('  ℹ️  測試資源不存在');
  }
  
  console.log('\n步驟 2: 嘗試 POST 創建...');
  try {
    const postResult = await fhirRequest('POST', '/Organization', testOrg);
    console.log(`  狀態: ${postResult.status}`);
    
    if (postResult.status >= 200 && postResult.status < 300) {
      console.log('  ✅ POST 成功！');
      console.log(`  資源 ID: ${postResult.data.id}`);
      return true;
    } else if (postResult.status === 409) {
      console.log('  ℹ️  資源已存在，嘗試 PUT...');
    } else {
      console.log('  錯誤:', JSON.stringify(postResult.data, null, 2));
    }
  } catch (error) {
    console.log(`  錯誤: ${error.message}`);
  }
  
  console.log('\n步驟 3: 嘗試 PUT 更新...');
  try {
    const putResult = await fhirRequest('PUT', '/Organization/DENTAL-TEST-ORG-001', testOrg);
    console.log(`  狀態: ${putResult.status}`);
    
    if (putResult.status >= 200 && putResult.status < 300) {
      console.log('  ✅ PUT 成功！');
      console.log(`  資源 ID: ${putResult.data.id}`);
      return true;
    } else {
      console.log('  錯誤:', JSON.stringify(putResult.data, null, 2));
    }
  } catch (error) {
    console.log(`  錯誤: ${error.message}`);
  }
  
  console.log('\n步驟 4: 測試 Transaction Bundle...');
  const transactionBundle = {
    resourceType: 'Bundle',
    type: 'transaction',
    entry: [{
      fullUrl: 'Organization/DENTAL-TEST-ORG-001',
      resource: testOrg,
      request: {
        method: 'PUT',
        url: 'Organization/DENTAL-TEST-ORG-001'
      }
    }]
  };
  
  try {
    const bundleResult = await fhirRequest('POST', '', transactionBundle);
    console.log(`  狀態: ${bundleResult.status}`);
    
    if (bundleResult.status >= 200 && bundleResult.status < 300) {
      console.log('  ✅ Transaction Bundle 成功！');
      return true;
    } else {
      console.log('  錯誤:', JSON.stringify(bundleResult.data, null, 2).substring(0, 500));
    }
  } catch (error) {
    console.log(`  錯誤: ${error.message}`);
  }
  
  return false;
}

async function main() {
  const success = await testUpload();
  
  console.log('\n' + '='.repeat(80));
  if (success) {
    console.log('✅ 測試成功！找到了正確的上傳方式');
    console.log('\n現在可以安全上傳完整的測試資料');
  } else {
    console.log('⚠️  需要進一步調查上傳方式');
  }
}

main().catch(console.error);
