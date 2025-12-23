// 安全上傳完整測試資料到 FHIR 沙盒
const https = require('https');
const fs = require('fs');

const BASE_URL = 'https://thas.mohw.gov.tw/v/r4/fhir';

function uploadBundle() {
  return new Promise((resolve, reject) => {
    const bundle = JSON.parse(fs.readFileSync('./TestPatients_Transaction.json', 'utf8'));
    const body = JSON.stringify(bundle);
    
    const options = {
      hostname: 'thas.mohw.gov.tw',
      path: '/v/r4/fhir',
      method: 'POST',
      headers: {
        'Content-Type': 'application/fhir+json',
        'Accept': 'application/fhir+json',
        'Content-Length': Buffer.byteLength(body)
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });
    
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  console.log('🚀 上傳牙科測試資料到 FHIR 沙盒');
  console.log('='.repeat(80));
  console.log('伺服器：https://thas.mohw.gov.tw/v/r4/fhir');
  console.log('');
  
  try {
    console.log('📤 正在上傳 Transaction Bundle (41個資源)...');
    const result = await uploadBundle();
    
    console.log(`\n狀態碼：${result.status}`);
    
    if (result.status === 200) {
      console.log('\n✅ 上傳成功！');
      
      if (result.data.resourceType === 'Bundle') {
        console.log(`\n處理結果：`);
        const successful = result.data.entry?.filter(e => 
          e.response?.status?.startsWith('2')
        ).length || 0;
        const failed = result.data.entry?.filter(e => 
          !e.response?.status?.startsWith('2')
        ).length || 0;
        
        console.log(`  成功：${successful} 個資源`);
        console.log(`  失敗：${failed} 個資源`);
        
        if (failed > 0) {
          console.log('\n失敗的資源詳情：');
          result.data.entry?.forEach((entry, idx) => {
            if (!entry.response?.status?.startsWith('2')) {
              console.log(`  ${idx + 1}. ${entry.response?.status || '未知'}`);
              if (entry.response?.outcome) {
                console.log(`     ${JSON.stringify(entry.response.outcome).substring(0, 100)}`);
              }
            }
          });
        }
      }
      
      console.log('\n📊 已上傳的資料：');
      console.log('  - 2 個Organization（仁愛、信義牙醫診所）');
      console.log('  - 6 個Patient');
      console.log('  - 10 個Encounter');
      console.log('  - 6 個Condition');
      console.log('  - 10 個Procedure');
      console.log('  - 7 個ImagingStudy');
      console.log('');
      console.log('🔗 可以查看：');
      console.log('  https://thas.mohw.gov.tw/v/r4/fhir/Patient');
      console.log('  https://thas.mohw.gov.tw/v/r4/fhir/Patient/P001');
      console.log('  https://thas.mohw.gov.tw/v/r4/fhir/Patient/P002');
      
    } else if (result.status === 400) {
      console.log('\n⚠️  請求格式錯誤');
      if (result.data.issue) {
        console.log('\n錯誤詳情：');
        result.data.issue.forEach(issue => {
          console.log(`  - ${issue.diagnostics || issue.details?.text || '未知錯誤'}`);
        });
      }
    } else {
      console.log('\n❌ 上傳失敗');
      console.log(JSON.stringify(result.data, null, 2).substring(0, 500));
    }
    
  } catch (error) {
    console.log('\n❌ 錯誤：', error.message);
  }
}

main();
