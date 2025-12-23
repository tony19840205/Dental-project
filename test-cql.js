// 牙科跨院 FHIR CQL 規則測試
// 由於 CQL 需要編譯，我們先用 JavaScript 模擬 CQL 邏輯來驗證規則

const fs = require('fs');

// 讀取測試資料
const testData = JSON.parse(fs.readFileSync('./TestPatients.json', 'utf8'));

console.log('='.repeat(80));
console.log('🦷 牙科跨院 FHIR CQL 規則測試');
console.log('='.repeat(80));
console.log('');

// 建立資源索引
const patients = {};
const procedures = {};
const encounters = {};
const conditions = {};
const imagingStudies = {};
const organizations = {};

testData.entry.forEach(entry => {
  const resource = entry.resource;
  switch(resource.resourceType) {
    case 'Patient':
      patients[resource.id] = resource;
      break;
    case 'Procedure':
      if (!procedures[resource.subject.reference]) {
        procedures[resource.subject.reference] = [];
      }
      procedures[resource.subject.reference].push(resource);
      break;
    case 'Encounter':
      encounters[resource.id] = resource;
      break;
    case 'Condition':
      if (!conditions[resource.subject.reference]) {
        conditions[resource.subject.reference] = [];
      }
      conditions[resource.subject.reference].push(resource);
      break;
    case 'ImagingStudy':
      if (!imagingStudies[resource.subject.reference]) {
        imagingStudies[resource.subject.reference] = [];
      }
      imagingStudies[resource.subject.reference].push(resource);
      break;
    case 'Organization':
      organizations[resource.id] = resource;
      break;
  }
});

// 輔助函數：取得牙位代碼
function getToothCode(bodySite) {
  if (!bodySite || !bodySite[0]) return null;
  return bodySite[0].coding[0].code;
}

// 輔助函數：取得處置代碼
function getProcedureCode(procedure) {
  return procedure.code.coding[0].code || procedure.code.coding[0].display;
}

// 輔助函數：取得診斷代碼
function getConditionCode(condition) {
  return condition.code.coding[0].code || condition.code.coding[0].display;
}

// 輔助函數：取得院所
function getServiceProvider(encounter) {
  if (!encounter || !encounter.serviceProvider) return null;
  const orgId = encounter.serviceProvider.reference.split('/')[1];
  return organizations[orgId]?.name;
}

console.log('📊 測試資料統計：');
console.log(`  - 病人數量：${Object.keys(patients).length}`);
console.log(`  - 院所數量：${Object.keys(organizations).length}`);
console.log('');

let totalAlerts = 0;

// =============================================================================
// 🔴 R01 測試：已拔除牙再次被處置
// =============================================================================
console.log('🔴 R01｜已拔除牙再次被處置');
console.log('-'.repeat(80));

Object.keys(patients).forEach(patientId => {
  const patient = patients[patientId];
  const patientRef = `Patient/${patient.id}`;
  const patientProcedures = procedures[patientRef] || [];
  
  // 找出拔牙處置
  const extractions = patientProcedures.filter(p => 
    getProcedureCode(p).includes('拔牙') || p.code.coding[0].code === '129304002'
  );
  
  extractions.forEach(extraction => {
    const extractedTooth = getToothCode(extraction.bodySite);
    const extractionDate = new Date(extraction.performedDateTime);
    
    // 檢查是否有後續處置
    const subsequentProcs = patientProcedures.filter(p => 
      p.id !== extraction.id &&
      getToothCode(p.bodySite) === extractedTooth &&
      new Date(p.performedDateTime) > extractionDate &&
      !getProcedureCode(p).includes('拔牙')
    );
    
    if (subsequentProcs.length > 0) {
      totalAlerts++;
      console.log(`  ⚠️  ${patient.name[0].text} (${patient.id})`);
      console.log(`      牙位 ${extractedTooth} 已於 ${extraction.performedDateTime.split('T')[0]} 拔除`);
      subsequentProcs.forEach(proc => {
        const enc = encounters[proc.encounter.reference.split('/')[1]];
        console.log(`      ❌ 卻於 ${proc.performedDateTime.split('T')[0]} 在 ${getServiceProvider(enc)} 進行 ${getProcedureCode(proc)}`);
      });
      console.log('');
    }
  });
});

console.log('');

// =============================================================================
// 🔴 R02 測試：跨院重複記錄「根管第一次療程」
// =============================================================================
console.log('🔴 R02｜跨院重複記錄「根管第一次療程」');
console.log('-'.repeat(80));

Object.keys(patients).forEach(patientId => {
  const patient = patients[patientId];
  const patientRef = `Patient/${patient.id}`;
  const patientProcedures = procedures[patientRef] || [];
  
  // 找出所有「根管第一次療程」
  const firstRCTs = patientProcedures.filter(p => 
    getProcedureCode(p).includes('根管第一次療程') || p.code.coding[0].code === 'RCT-FIRST'
  );
  
  // 按牙位分組
  const toothGroups = {};
  firstRCTs.forEach(proc => {
    const tooth = getToothCode(proc.bodySite);
    if (!toothGroups[tooth]) toothGroups[tooth] = [];
    toothGroups[tooth].push(proc);
  });
  
  // 檢查每個牙位是否有跨院重複
  Object.keys(toothGroups).forEach(tooth => {
    const procs = toothGroups[tooth];
    if (procs.length > 1) {
      // 檢查是否跨院
      const clinics = new Set();
      procs.forEach(proc => {
        const enc = encounters[proc.encounter.reference.split('/')[1]];
        clinics.add(getServiceProvider(enc));
      });
      
      if (clinics.size > 1) {
        totalAlerts++;
        console.log(`  ⚠️  ${patient.name[0].text} (${patient.id})`);
        console.log(`      牙位 ${tooth} 在不同院所重複記錄「根管第一次療程」：`);
        procs.forEach(proc => {
          const enc = encounters[proc.encounter.reference.split('/')[1]];
          console.log(`      - ${proc.performedDateTime.split('T')[0]} @ ${getServiceProvider(enc)}`);
        });
        console.log('');
      }
    }
  });
});

console.log('');

// =============================================================================
// 🔴 R03 測試：重大處置缺乏影像依據
// =============================================================================
console.log('🔴 R03｜重大處置缺乏影像依據');
console.log('-'.repeat(80));

Object.keys(patients).forEach(patientId => {
  const patient = patients[patientId];
  const patientRef = `Patient/${patient.id}`;
  const patientProcedures = procedures[patientRef] || [];
  const patientImages = imagingStudies[patientRef] || [];
  
  // 找出重大處置（根管/拔牙）
  const majorProcs = patientProcedures.filter(p => {
    const code = getProcedureCode(p);
    return code.includes('根管') || code.includes('拔牙') || 
           p.code.coding[0].code === '129304002';
  });
  
  majorProcs.forEach(proc => {
    const tooth = getToothCode(proc.bodySite);
    const procDate = new Date(proc.performedDateTime);
    
    // 檢查是否有相關影像（前後30天內）
    const hasRelatedImage = patientImages.some(img => {
      const imgTooth = img.bodySite?.coding?.[0]?.code;
      const imgDate = new Date(img.started);
      const daysDiff = Math.abs((procDate - imgDate) / (1000 * 60 * 60 * 24));
      return imgTooth === tooth && daysDiff <= 30;
    });
    
    if (!hasRelatedImage) {
      totalAlerts++;
      console.log(`  ⚠️  ${patient.name[0].text} (${patient.id})`);
      console.log(`      牙位 ${tooth} 執行 ${getProcedureCode(proc)}`);
      console.log(`      日期：${proc.performedDateTime.split('T')[0]}`);
      console.log(`      ❌ 缺乏影像依據`);
      console.log('');
    }
  });
});

console.log('');

// =============================================================================
// 🟠 R04 測試：診斷嚴重度不足以支持處置
// =============================================================================
console.log('🟠 R04｜診斷嚴重度不足以支持處置');
console.log('-'.repeat(80));

Object.keys(patients).forEach(patientId => {
  const patient = patients[patientId];
  const patientRef = `Patient/${patient.id}`;
  const patientProcedures = procedures[patientRef] || [];
  const patientConditions = conditions[patientRef] || [];
  
  // 找出根管治療
  const rctProcs = patientProcedures.filter(p => {
    const code = getProcedureCode(p);
    return code.includes('根管');
  });
  
  rctProcs.forEach(proc => {
    const tooth = getToothCode(proc.bodySite);
    
    // 找出該牙位的診斷
    const toothConditions = patientConditions.filter(c => 
      getToothCode(c.bodySite) === tooth
    );
    
    // 檢查是否只有輕度診斷
    const hasMildOnly = toothConditions.some(c => 
      getConditionCode(c).includes('MILD') || getConditionCode(c).includes('輕度')
    );
    
    const hasSevere = toothConditions.some(c => {
      const code = getConditionCode(c);
      return code.includes('牙髓炎') || code.includes('根尖') || 
             code.includes('重度') || code.includes('PULPITIS') ||
             code.includes('APICAL') || code.includes('SEV');
    });
    
    if (hasMildOnly && !hasSevere) {
      totalAlerts++;
      console.log(`  ⚠️  ${patient.name[0].text} (${patient.id})`);
      console.log(`      牙位 ${tooth} 執行 ${getProcedureCode(proc)}`);
      console.log(`      但診斷為：${toothConditions.map(c => getConditionCode(c)).join(', ')}`);
      console.log(`      💡 建議補登牙髓炎或根尖病變診斷`);
      console.log('');
    }
  });
});

console.log('');

// =============================================================================
// 總結
// =============================================================================
console.log('='.repeat(80));
console.log('📈 測試結果總結');
console.log('='.repeat(80));
console.log(`總共觸發警示：${totalAlerts} 個`);
console.log('');

console.log('✅ 測試完成！');
console.log('');
console.log('💡 說明：');
console.log('  - 以上為前4個最重要的規則測試（R01-R04）');
console.log('  - 其他規則（R05-R10）的邏輯已在 CQL 檔案中完整定義');
console.log('  - 實際運行需要完整的 CQL 編譯和執行環境');
console.log('');
