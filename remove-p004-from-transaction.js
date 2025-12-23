const fs = require('fs');

// 读取Transaction Bundle
const bundle = JSON.parse(fs.readFileSync('./TestPatients_Transaction.json', 'utf8'));

const originalCount = bundle.entry.length;

// 删除所有P004相关的资源
bundle.entry = bundle.entry.filter(entry => {
    const fullUrl = entry.fullUrl || '';
    const subject = entry.resource?.subject?.reference || '';
    const encounter = entry.resource?.encounter?.reference || '';
    
    // 保留不包含P004的资源
    return !fullUrl.includes('Patient/P004') &&
           !fullUrl.includes('P004-') &&
           subject !== 'Patient/P004' &&
           !encounter.includes('P004-');
});

const removedCount = originalCount - bundle.entry.length;

// 保存
fs.writeFileSync('./TestPatients_Transaction.json', JSON.stringify(bundle, null, 2));

console.log(`✅ 从 Transaction Bundle 删除了 ${removedCount} 个P004资源`);
console.log(`   原始: ${originalCount} 个资源`);
console.log(`   删除后: ${bundle.entry.length} 个资源`);
