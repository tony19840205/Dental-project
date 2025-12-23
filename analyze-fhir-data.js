// 分析 FHIR 數據並生成本機模擬數據
const fs = require('fs');

const testData = JSON.parse(fs.readFileSync('./TestPatients.json', 'utf8'));

// 組織名稱映射
const orgMap = {
    'ORG-A': '仁愛牙醫診所',
    'ORG-B': '信義牙醫診所',
    'ORG-C': '大安牙醫診所'
};

// 處置類型映射
const procedureMap = {
    '129304002': '拔牙',
    'IMPLANT-PLACEMENT': '植牙',
    'ROOT-CANAL-THERAPY': '根管治療',
    'DENTAL-FILLING': '補牙',
    'CROWN-PLACEMENT': '牙冠製作'
};

// 按患者分組處理記錄
const patientRecords = {};

testData.entry.forEach(item => {
    const resource = item.resource;
    
    if (resource.resourceType === 'Procedure') {
        const patientRef = resource.subject.reference; // "Patient/P001"
        const patientId = patientRef.split('/')[1];
        
        if (!patientRecords[patientId]) {
            patientRecords[patientId] = [];
        }
        
        const encounterRef = resource.encounter.reference; // "Encounter/P001-ENC02"
        const toothCode = resource.bodySite?.[0]?.coding?.[0]?.code;
        const procedureCode = resource.code.coding[0].code;
        const procedureDisplay = resource.code.coding[0].display;
        const performedDate = resource.performedDateTime;
        const note = resource.note?.[0]?.text || '';
        
        // 找到對應的 Encounter 來獲取診所信息
        const encounter = testData.entry.find(e => 
            e.resource.resourceType === 'Encounter' && 
            e.resource.id === encounterRef.split('/')[1]
        )?.resource;
        
        const orgRef = encounter?.serviceProvider?.reference; // "Organization/ORG-A"
        const orgId = orgRef?.split('/')[1];
        const clinic = orgMap[orgId] || '本院';
        
        // 格式化日期
        const date = performedDate.split('T')[0];
        
        patientRecords[patientId].push({
            date,
            clinic,
            procedure: procedureDisplay,
            tooth: toothCode,
            note,
            rawDate: performedDate
        });
    }
});

// 排序並生成代碼
console.log('='.repeat(80));
console.log('FHIR 數據分析結果 - 生成本機模擬數據');
console.log('='.repeat(80));
console.log('');

for (const [patientId, records] of Object.entries(patientRecords)) {
    // 按日期降序排序
    records.sort((a, b) => new Date(b.rawDate) - new Date(a.rawDate));
    
    console.log(`} else if (patientId === '${patientId}') {`);
    console.log(`    // ${patientId}: 根據FHIR實際數據`);
    
    records.forEach(record => {
        const content = `${record.procedure} (#${record.tooth})${record.note ? ' - ' + record.note.replace(/✅|❌|⚠️/g, '').trim() : ''}`;
        console.log(`    crossClinicHistory.push({ date: '${record.date}', clinic: '${record.clinic}', content: '${content}', tooth: '${record.tooth}' });`);
    });
    
    console.log('');
}

console.log('');
console.log('='.repeat(80));
console.log('數據統計：');
console.log('='.repeat(80));
for (const [patientId, records] of Object.entries(patientRecords)) {
    console.log(`${patientId}: ${records.length} 筆處置記錄`);
}
