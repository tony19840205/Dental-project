// 謹慎測試 FHIR 沙盒的正確端點
const https = require('https');

const BASE_URL = 'https://thas.mohw.gov.tw/v/r4/fhir';

function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const fullUrl = path.startsWith('http') ? path : `${BASE_URL}${path}`;
    const url = new URL(fullUrl);
    
    const options = {
      method: method,
      hostname: url.hostname,
      path: url.pathname + url.search,
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
          resolve({ status: res.statusCode, data: parsed, headers: res.headers });
        } catch {
          resolve({ status: res.statusCode, data: body, headers: res.headers });
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

async function testEndpoints() {
  console.log('🔍 謹慎測試 FHIR 沙盒端點');
  console.log('='.repeat(80));
  console.log('基礎 URL:', BASE_URL);
  console.log('');
  
  const testCases = [
    { name: '測試 1: 根路徑', path: '' },
    { name: '測試 2: /Patient', path: '/Patient' },
    { name: '測試 3: /Patient?_count=0', path: '/Patient?_count=0' },
    { name: '測試 4: /$metadata', path: '/$metadata' },
    { name: '測試 5: /metadata', path: '/metadata' }
  ];
  
  for (const test of testCases) {
    console.log(`\n${test.name}: GET ${test.path}`);
    try {
      const result = await makeRequest('GET', test.path);
      console.log(`  狀態: ${result.status}`);
      console.log(`  內容類型: ${result.headers['content-type']}`);
      
      if (result.status === 200) {
        console.log('  ✅ 成功！');
        if (typeof result.data === 'object' && result.data.resourceType) {
          console.log(`  資源類型: ${result.data.resourceType}`);
          if (result.data.total !== undefined) {
            console.log(`  總數: ${result.data.total}`);
          }
        }
      } else if (result.status === 401 || result.status === 403) {
        console.log('  ⚠️  需要認證');
      } else if (result.status === 404) {
        console.log('  ❌ 找不到端點');
      } else {
        console.log(`  ℹ️  HTTP ${result.status}`);
      }
      
      // 等待一下避免過度請求
      await new Promise(r => setTimeout(r, 1000));
    } catch (error) {
      console.log(`  ❌ 錯誤: ${error.message}`);
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('測試完成');
}

testEndpoints().catch(console.error);
