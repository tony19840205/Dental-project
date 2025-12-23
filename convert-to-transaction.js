// 將 collection Bundle 轉換為 transaction Bundle
const fs = require('fs');

const bundle = JSON.parse(fs.readFileSync('./TestPatients.json', 'utf8'));

// 為每個 entry 添加 request 方法
bundle.type = 'transaction';
bundle.entry = bundle.entry.map(entry => {
  const resource = entry.resource;
  return {
    fullUrl: entry.fullUrl,
    resource: resource,
    request: {
      method: 'PUT',
      url: `${resource.resourceType}/${resource.id}`
    }
  };
});

// 儲存為 transaction bundle
fs.writeFileSync('./TestPatients_Transaction.json', JSON.stringify(bundle, null, 2));

console.log('✅ 已生成 TestPatients_Transaction.json');
console.log(`   包含 ${bundle.entry.length} 個資源，使用 transaction 模式`);
console.log('');
console.log('📤 使用方式：');
console.log('   POST [FHIR_BASE_URL]');
console.log('   Content-Type: application/fhir+json');
console.log('   Body: TestPatients_Transaction.json 的內容');
console.log('');
console.log('   這會一次性上傳所有資源到 FHIR 伺服器');
