// 測試 FHIR 沙盒的各種方法
const https = require('https');

const BASE_URL = 'https://thas.mohw.gov.tw/v/r4/fhir';

function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    
    const options = {
      method: method,
      headers: {
        'Accept': 'application/fhir+json',
        'Content-Type': 'application/fhir+json'
      }
    };
    
    if (data) {
      const body = JSON.stringify(data);
      options.headers['Content-Length'] = Buffer.byteLength(body);
    }
    
    const req = https.request(url, options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        console.log(`${method} ${path}`);
        console.log(`Status: ${res.statusCode}`);
        console.log(`Headers:`, res.headers);
        console.log(`Body (first 500 chars):`, body.substring(0, 500));
        console.log('-'.repeat(80));
        resolve({ status: res.statusCode, body, headers: res.headers });
      });
    });
    
    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function test() {
  console.log('測試衛福部 FHIR 沙盒');
  console.log('='.repeat(80));
  
  // 測試 1: GET metadata
  console.log('\n測試 1: GET /metadata');
  await makeRequest('GET', '/metadata');
  
  // 測試 2: GET Patient
  console.log('\n測試 2: GET /Patient');
  await makeRequest('GET', '/Patient');
  
  // 測試 3: 創建一個簡單的 Patient
  console.log('\n測試 3: POST /Patient (創建)');
  const testPatient = {
    resourceType: 'Patient',
    id: 'TEST001',
    name: [{
      text: '測試病人',
      family: '測試',
      given: ['病人']
    }],
    gender: 'male',
    birthDate: '1990-01-01'
  };
  await makeRequest('POST', '/Patient', testPatient);
  
  // 測試 4: PUT 更新
  console.log('\n測試 4: PUT /Patient/TEST001 (更新)');
  await makeRequest('PUT', '/Patient/TEST001', testPatient);
}

test().catch(console.error);
