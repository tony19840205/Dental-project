// 測試簡化版 CQL 規則
// 使用 TestPatients_Transaction.json

const fs = require('fs');

// 讀取測試資料
const bundle = JSON.parse(fs.readFileSync('./TestPatients_Transaction.json', 'utf8'));

console.log('='.repeat(80));
console.log('🦷 牙科 FHIR - 簡化版規則測試');
console.log('='.repeat(80));
console.log('');

// 建立資源索引
const patients = new Map();
const procedures = new Map();
const encounters = new Map();
const conditions = new Map();

bundle.entry.forEach(entry => {
  const resource = entry.resource;
  switch(resource.resourceType) {
    case 'Patient':
      patients.set(resource.id, resource);
      break;
    case 'Procedure':
      if (!procedures.has(resource.subject.reference)) {
        procedures.set(resource.subject.reference, []);
      }
      procedures.get(resource.subject.reference).push(resource);
      break;
    case 'Encounter':
      encounters.set(resource.id, resource);
      break;
    case 'Condition':
      if (!conditions.has(resource.subject.reference)) {
        conditions.set(resource.subject.reference, []);
      }
      conditions.get(resource.subject.reference).push(resource);
      break;
  }
});

console.log(`✅ 已載入: ${patients.size} 位患者`);
console.log('');

// =============================================================================
// R01：同一就診 - 輕度齲齒卻拔牙
// =============================================================================
function testR01_MildCariesWithExtraction() {
  const alerts = [];
  
  encounters.forEach((encounter, encId) => {
    const encounterRef = 'Encounter/' + encId;
    
    // 找出此次就診的所有診斷和處置
    const encConditions = [];
    const encProcedures = [];
    
    conditions.forEach(condList => {
      condList.forEach(cond => {
        if (cond.encounter?.reference === encounterRef) {
          encConditions.push(cond);
        }
      });
    });
    
    procedures.forEach(procList => {
      procList.forEach(proc => {
        if (proc.encounter?.reference === encounterRef) {
          encProcedures.push(proc);
        }
      });
    });
    
    // 檢查：輕度齲齒 + 拔牙
    encConditions.forEach(cond => {
      if (cond.code?.coding?.some(c => c.code === 'CARIES-MILD')) {
        const toothCode = cond.bodySite?.[0]?.coding?.[0]?.code;
        if (toothCode) {
          encProcedures.forEach(proc => {
            const procToothCode = proc.bodySite?.[0]?.coding?.[0]?.code;
            const isExtraction = proc.code?.coding?.some(c => 
              c.code === 'EXTRACTION' || c.code === '129304002'
            );
            
            if (procToothCode === toothCode && isExtraction) {
              alerts.push({
                encounter: encId,
                tooth: toothCode,
                diagnosis: '輕度齲齒',
                procedure: '拔牙',
                severity: '🟡 WARNING',
                message: '診斷為輕度齲齒但進行拔牙，建議補充重度齲齒或其他嚴重診斷'
              });
            }
          });
        }
      }
    });
  });
  
  return alerts;
}

// =============================================================================
// R02：同一就診 - 輕度/中度齲齒卻根管治療
// =============================================================================
function testR02_MildCariesWithRCT() {
  const alerts = [];
  
  encounters.forEach((encounter, encId) => {
    const encounterRef = 'Encounter/' + encId;
    
    const encConditions = [];
    const encProcedures = [];
    
    conditions.forEach(condList => {
      condList.forEach(cond => {
        if (cond.encounter?.reference === encounterRef) {
          encConditions.push(cond);
        }
      });
    });
    
    procedures.forEach(procList => {
      procList.forEach(proc => {
        if (proc.encounter?.reference === encounterRef) {
          encProcedures.push(proc);
        }
      });
    });
    
    // 檢查：輕度/中度齲齒 + 根管治療
    encConditions.forEach(cond => {
      const isMildOrModerate = cond.code?.coding?.some(c => 
        c.code === 'CARIES-MILD' || c.code === 'CARIES-MOD'
      );
      
      if (isMildOrModerate) {
        const toothCode = cond.bodySite?.[0]?.coding?.[0]?.code;
        if (toothCode) {
          // 檢查是否有嚴重診斷
          const hasSevereDiagnosis = encConditions.some(c => {
            const severeTooth = c.bodySite?.[0]?.coding?.[0]?.code;
            return severeTooth === toothCode && c.code?.coding?.some(code =>
              code.code === 'PULPITIS' || 
              code.code === 'APICAL-DIS' || 
              code.code === 'CARIES-SEV'
            );
          });
          
          if (!hasSevereDiagnosis) {
            encProcedures.forEach(proc => {
              const procToothCode = proc.bodySite?.[0]?.coding?.[0]?.code;
              const isRCT = proc.code?.coding?.some(c => 
                c.code === 'RCT-FIRST' || 
                c.code === 'RCT-CLEAN' || 
                c.code === 'RCT-FILL' ||
                c.code === '234567'
              );
              
              if (procToothCode === toothCode && isRCT) {
                const diagnosisName = cond.code?.coding?.[0]?.display || '輕度/中度齲齒';
                alerts.push({
                  encounter: encId,
                  tooth: toothCode,
                  diagnosis: diagnosisName,
                  procedure: '根管治療',
                  severity: '🟡 WARNING',
                  message: '目前診斷為輕度/中度齲齒，建議補登牙髓炎或根尖病變診斷以支持根管治療'
                });
              }
            });
          }
        }
      }
    });
  });
  
  return alerts;
}

// =============================================================================
// R03：同一就診 - 處置和診斷的牙位不匹配
// =============================================================================
function testR03_InconsistentToothPosition() {
  const alerts = [];
  
  procedures.forEach(procList => {
    procList.forEach(proc => {
      if (proc.encounter?.reference && proc.bodySite) {
        const encounterRef = proc.encounter.reference;
        const procTooth = proc.bodySite?.[0]?.coding?.[0]?.code;
        const procType = proc.code?.coding?.[0]?.display || '處置';
        
        // 找出此次就診的所有診斷
        const encConditions = [];
        conditions.forEach(condList => {
          condList.forEach(cond => {
            if (cond.encounter?.reference === encounterRef && cond.bodySite) {
              encConditions.push(cond);
            }
          });
        });
        
        // 檢查是否有該就診的診斷記錄
        if (encConditions.length > 0) {
          // 檢查是否有對應牙位的診斷
          const hasMatchingDiagnosis = encConditions.some(cond => {
            const condTooth = cond.bodySite?.[0]?.coding?.[0]?.code;
            return condTooth === procTooth;
          });
          
          if (!hasMatchingDiagnosis) {
            const availableTeeth = encConditions.map(c => 
              c.bodySite?.[0]?.coding?.[0]?.code
            ).filter(Boolean);
            
            alerts.push({
              encounter: encounterRef.split('/')[1],
              procedureTooth: procTooth,
              procedureType: procType,
              availableDiagnosisTeeth: [...new Set(availableTeeth)],
              severity: '🔴 ALERT',
              message: '處置的牙位沒有對應的診斷記錄，請檢查牙位標記或補充診斷'
            });
          }
        }
      }
    });
  });
  
  return alerts;
}

// =============================================================================
// R04：歷史驗證 - 已拔除的牙位又被處置
// =============================================================================
function testR04_ExtractedToothRetreated() {
  const alerts = [];
  
  procedures.forEach(procList => {
    procList.forEach(currentProc => {
      const isExtraction = currentProc.code?.coding?.some(c => 
        c.code === 'EXTRACTION' || c.code === '129304002'
      );
      
      if (!isExtraction && currentProc.bodySite) {
        const currentTooth = currentProc.bodySite?.[0]?.coding?.[0]?.code;
        const currentDate = new Date(currentProc.performedDateTime);
        
        // 查找之前的拔牙記錄
        procList.forEach(prevProc => {
          const isPrevExtraction = prevProc.code?.coding?.some(c => 
            c.code === 'EXTRACTION' || c.code === '129304002'
          );
          
          if (isPrevExtraction && prevProc.bodySite && prevProc.status === 'completed') {
            const prevTooth = prevProc.bodySite?.[0]?.coding?.[0]?.code;
            const prevDate = new Date(prevProc.performedDateTime);
            
            if (prevTooth === currentTooth && prevDate < currentDate) {
              alerts.push({
                tooth: currentTooth,
                extractionDate: prevProc.performedDateTime,
                currentProcedure: currentProc.code?.coding?.[0]?.display || '處置',
                currentDate: currentProc.performedDateTime,
                severity: '🔴 ALERT',
                message: '此牙位已拔除，不應再進行治療處置'
              });
            }
          }
        });
      }
    });
  });
  
  return alerts;
}

// =============================================================================
// R05：歷史驗證 - 植牙位置又根管治療
// =============================================================================
function testR05_ImplantFollowedByRCT() {
  const alerts = [];
  
  procedures.forEach(procList => {
    procList.forEach(currentProc => {
      const isRCT = currentProc.code?.coding?.some(c => 
        c.code === 'RCT-FIRST' || 
        c.code === 'RCT-CLEAN' || 
        c.code === 'RCT-FILL' ||
        c.code === '234567'
      );
      
      if (isRCT && currentProc.bodySite) {
        const currentTooth = currentProc.bodySite?.[0]?.coding?.[0]?.code;
        const currentDate = new Date(currentProc.performedDateTime);
        
        // 查找之前的植牙記錄
        procList.forEach(prevProc => {
          const isImplant = prevProc.code?.coding?.some(c => 
            c.code === 'IMPLANT' || c.code === 'IMPLANT-PLACEMENT'
          );
          
          if (isImplant && prevProc.bodySite && prevProc.status === 'completed') {
            const prevTooth = prevProc.bodySite?.[0]?.coding?.[0]?.code;
            const prevDate = new Date(prevProc.performedDateTime);
            
            if (prevTooth === currentTooth && prevDate < currentDate) {
              alerts.push({
                tooth: currentTooth,
                implantDate: prevProc.performedDateTime,
                currentProcedure: currentProc.code?.coding?.[0]?.display || '根管治療',
                currentDate: currentProc.performedDateTime,
                severity: '🔴 ALERT',
                message: '植體無牙髓組織，不應進行根管治療，請確認牙位是否正確'
              });
            }
          }
        });
      }
    });
  });
  
  return alerts;
}

// =============================================================================
// R06：同一就診 - 有處置但無相應診斷
// =============================================================================
function testR06_ProcedureWithoutDiagnosis() {
  const alerts = [];
  
  encounters.forEach((encounter, encId) => {
    const encounterRef = 'Encounter/' + encId;
    
    const encConditions = [];
    const encProcedures = [];
    
    conditions.forEach(condList => {
      condList.forEach(cond => {
        if (cond.encounter?.reference === encounterRef) {
          encConditions.push(cond);
        }
      });
    });
    
    procedures.forEach(procList => {
      procList.forEach(proc => {
        if (proc.encounter?.reference === encounterRef && proc.bodySite) {
          encProcedures.push(proc);
        }
      });
    });
    
    const proceduresWithoutDiagnosis = [];
    
    encProcedures.forEach(proc => {
      const procTooth = proc.bodySite?.[0]?.coding?.[0]?.code;
      if (procTooth) {
        const hasDiagnosis = encConditions.some(cond => {
          const condTooth = cond.bodySite?.[0]?.coding?.[0]?.code;
          return condTooth === procTooth;
        });
        
        if (!hasDiagnosis) {
          proceduresWithoutDiagnosis.push(procTooth);
        }
      }
    });
    
    if (proceduresWithoutDiagnosis.length > 0) {
      alerts.push({
        encounter: encId,
        teeth: [...new Set(proceduresWithoutDiagnosis)],
        severity: '💡 INFO',
        message: '有處置記錄但無相應的診斷，建議補充診斷記錄'
      });
    }
  });
  
  return alerts;
}

// =============================================================================
// R07：跨院所重複記錄「根管第一次療程」
// =============================================================================
function testR07_DuplicateFirstRCTAcrossClinics() {
  const alerts = [];
  const processed = new Set(); // 用於去重
  
  procedures.forEach(procList => {
    procList.forEach(firstRCT => {
      const isFirstRCT = firstRCT.code?.coding?.some(c => c.code === 'RCT-FIRST');
      
      if (isFirstRCT && firstRCT.bodySite && firstRCT.encounter) {
        const tooth = firstRCT.bodySite?.[0]?.coding?.[0]?.code;
        const encounterRef = firstRCT.encounter.reference;
        const encId = encounterRef?.split('/')[1];
        const currentEnc = encounters.get(encId);
        const currentClinic = currentEnc?.serviceProvider?.reference;
        const currentDate = firstRCT.performedDateTime;
        
        // 查找其他「根管第一次療程」記錄
        procedures.forEach(otherProcList => {
          otherProcList.forEach(otherRCT => {
            const isOtherFirstRCT = otherRCT.code?.coding?.some(c => c.code === 'RCT-FIRST');
            
            if (isOtherFirstRCT && 
                otherRCT.id !== firstRCT.id && 
                otherRCT.bodySite && 
                otherRCT.encounter) {
              const otherTooth = otherRCT.bodySite?.[0]?.coding?.[0]?.code;
              const otherEncRef = otherRCT.encounter.reference;
              const otherEncId = otherEncRef?.split('/')[1];
              const otherEnc = encounters.get(otherEncId);
              const otherClinic = otherEnc?.serviceProvider?.reference;
              const otherDate = otherRCT.performedDateTime;
              
              // 同一牙位、不同院所
              if (tooth === otherTooth && 
                  currentClinic && 
                  otherClinic && 
                  currentClinic !== otherClinic &&
                  encounterRef !== otherEncRef) {
                
                // 創建唯一標識（使用排序後的ID避免重複）
                const ids = [firstRCT.id, otherRCT.id].sort();
                const uniqueKey = `${tooth}-${ids[0]}-${ids[1]}`;
                
                if (!processed.has(uniqueKey)) {
                  processed.add(uniqueKey);
                  
                  // 確定哪個是較早的、哪個是較晚的
                  const currentTime = new Date(currentDate);
                  const otherTime = new Date(otherDate);
                  
                  let firstClinic, firstDate, laterClinic, laterDate;
                  if (currentTime < otherTime) {
                    firstClinic = currentClinic;
                    firstDate = currentDate;
                    laterClinic = otherClinic;
                    laterDate = otherDate;
                  } else {
                    firstClinic = otherClinic;
                    firstDate = otherDate;
                    laterClinic = currentClinic;
                    laterDate = currentDate;
                  }
                  
                  alerts.push({
                    tooth: tooth,
                    firstClinic: firstClinic,
                    firstDate: firstDate,
                    laterClinic: laterClinic,
                    laterDate: laterDate,
                    severity: '🔴 ALERT',
                    message: `後續院所記錄「根管第一次療程」，但先前院所已於 ${firstDate.split('T')[0]} 做過第一次疗程，應記錄為續療或根管充填`
                  });
                }
              }
            }
          });
        });
      }
    });
  });
  
  return alerts;
}

// =============================================================================
// R08: 植牙牙位卻診斷為蛀牙
// =============================================================================
function testR08_ImplantWithCariesDiagnosis() {
  const alerts = [];
  const bundle = JSON.parse(fs.readFileSync('./TestPatients_Transaction.json', 'utf8'));
  
  // 建立牙位到植牙日期的映射
  const implantTeeth = new Map();
  
  // 收集所有植牙處置
  bundle.entry.forEach(entry => {
    if (entry.resource.resourceType === 'Procedure') {
      const proc = entry.resource;
      const code = proc.code?.coding?.[0]?.code;
      const tooth = proc.bodySite?.[0]?.coding?.[0]?.code;
      const date = proc.performedDateTime;
      
      if (tooth && (code === 'IMPLANT' || code === 'IMPLANT-PLACEMENT')) {
        implantTeeth.set(tooth, date);
      }
    }
  });
  
  // 檢查診斷
  bundle.entry.forEach(entry => {
    if (entry.resource.resourceType === 'Condition') {
      const cond = entry.resource;
      const diagnosisCode = cond.code?.coding?.[0]?.code;
      const tooth = cond.bodySite?.[0]?.coding?.[0]?.code;
      const diagnosisDate = cond.onsetDateTime;
      
      if (tooth && implantTeeth.has(tooth) && 
          (diagnosisCode === 'CARIES-MILD' || diagnosisCode === 'CARIES-MOD' || diagnosisCode === 'CARIES-SEV')) {
        const implantDate = implantTeeth.get(tooth);
        
        // 如果診斷晚於植牙，就是錯誤
        if (new Date(diagnosisDate) > new Date(implantDate)) {
          alerts.push({
            tooth: tooth,
            diagnosis: cond.code?.coding?.[0]?.display || diagnosisCode,
            diagnosisDate: diagnosisDate,
            implantDate: implantDate,
            severity: '🔴 ALERT',
            message: `植體不會蛀牙，請確認牙位是否正確或診斷是否誤植`
          });
        }
      }
    }
  });
  
  return alerts;
}

// =============================================================================
// 執行所有測試
// =============================================================================

console.log('📋 R01: 同一就診 - 輕度齲齒卻拔牙');
console.log('-'.repeat(80));
const r01Results = testR01_MildCariesWithExtraction();
if (r01Results.length > 0) {
  r01Results.forEach(alert => {
    console.log(`${alert.severity} 就診: ${alert.encounter} | 牙位: #${alert.tooth}`);
    console.log(`   診斷: ${alert.diagnosis} | 處置: ${alert.procedure}`);
    console.log(`   ⚠️  ${alert.message}`);
    console.log('');
  });
} else {
  console.log('✅ 無警告');
}
console.log('');

console.log('📋 R02: 同一就診 - 輕度/中度齲齒卻根管治療');
console.log('-'.repeat(80));
const r02Results = testR02_MildCariesWithRCT();
if (r02Results.length > 0) {
  r02Results.forEach(alert => {
    console.log(`${alert.severity} 就診: ${alert.encounter} | 牙位: #${alert.tooth}`);
    console.log(`   診斷: ${alert.diagnosis} | 處置: ${alert.procedure}`);
    console.log(`   ⚠️  ${alert.message}`);
    console.log('');
  });
} else {
  console.log('✅ 無警告');
}
console.log('');

console.log('📋 R03: 同一就診 - 處置和診斷的牙位不匹配');
console.log('-'.repeat(80));
const r03Results = testR03_InconsistentToothPosition();
if (r03Results.length > 0) {
  r03Results.forEach(alert => {
    console.log(`${alert.severity} 就診: ${alert.encounter}`);
    console.log(`   處置: ${alert.procedureType} (牙位 #${alert.procedureTooth})`);
    console.log(`   該次就診的診斷牙位: ${alert.availableDiagnosisTeeth.map(t => '#'+t).join(', ')}`);
    console.log(`   ⚠️  ${alert.message}`);
    console.log('');
  });
} else {
  console.log('✅ 無警告');
}
console.log('');

console.log('📋 R04: 歷史驗證 - 已拔除的牙位又被處置');
console.log('-'.repeat(80));
const r04Results = testR04_ExtractedToothRetreated();
if (r04Results.length > 0) {
  r04Results.forEach(alert => {
    console.log(`${alert.severity} 牙位: #${alert.tooth}`);
    console.log(`   拔牙日期: ${alert.extractionDate}`);
    console.log(`   當前處置: ${alert.currentProcedure} (${alert.currentDate})`);
    console.log(`   ⚠️  ${alert.message}`);
    console.log('');
  });
} else {
  console.log('✅ 無警告');
}
console.log('');

console.log('📋 R05: 歷史驗證 - 植牙位置又根管治療');
console.log('-'.repeat(80));
const r05Results = testR05_ImplantFollowedByRCT();
if (r05Results.length > 0) {
  r05Results.forEach(alert => {
    console.log(`${alert.severity} 牙位: #${alert.tooth}`);
    console.log(`   植牙日期: ${alert.implantDate}`);
    console.log(`   當前處置: ${alert.currentProcedure} (${alert.currentDate})`);
    console.log(`   ⚠️  ${alert.message}`);
    console.log('');
  });
} else {
  console.log('✅ 無警告');
}
console.log('');

console.log('📋 R06: 同一就診 - 有處置但無相應診斷');
console.log('-'.repeat(80));
const r06Results = testR06_ProcedureWithoutDiagnosis();
if (r06Results.length > 0) {
  r06Results.forEach(alert => {
    console.log(`${alert.severity} 就診: ${alert.encounter}`);
    console.log(`   牙位: ${alert.teeth.join(', ')}`);
    console.log(`   💡 ${alert.message}`);
    console.log('');
  });
} else {
  console.log('✅ 無警告');
}
console.log('');

console.log('📋 R07: 跨院所重複記錄「根管第一次療程」');
console.log('-'.repeat(80));
const r07Results = testR07_DuplicateFirstRCTAcrossClinics();
if (r07Results.length > 0) {
  r07Results.forEach(alert => {
    console.log(`${alert.severity} 牙位: #${alert.tooth}`);
    console.log(`   首次記錄: ${alert.firstClinic} (${alert.firstDate})`);
    console.log(`   後續記錄: ${alert.laterClinic} (${alert.laterDate})`);
    console.log(`   ⚠️  ${alert.message}`);
    console.log('');
  });
} else {
  console.log('✅ 無警告');
}
console.log('');

console.log('📋 R08: 植牙牙位卻診斷為蛀牙');
console.log('-'.repeat(80));
const r08Results = testR08_ImplantWithCariesDiagnosis();
if (r08Results.length > 0) {
  r08Results.forEach(alert => {
    console.log(`${alert.severity} 牙位: #${alert.tooth}`);
    console.log(`   診斷: ${alert.diagnosis} (${alert.diagnosisDate})`);
    console.log(`   植牙日期: ${alert.implantDate}`);
    console.log(`   ⚠️  ${alert.message}`);
    console.log('');
  });
} else {
  console.log('✅ 無警告');
}
console.log('');

// 彙總統計
const totalAlerts = r01Results.length + r02Results.length + r03Results.length + 
                    r04Results.length + r05Results.length + r06Results.length +
                    r07Results.length + r08Results.length;

console.log('='.repeat(80));
console.log('📊 測試結果彙總');
console.log('='.repeat(80));
console.log(`R01 (輕度齲齒卻拔牙):        ${r01Results.length} 個警告`);
console.log(`R02 (輕度齲齒卻根管治療):    ${r02Results.length} 個警告`);
console.log(`R03 (處置牙位無對應診斷):    ${r03Results.length} 個警告`);
console.log(`R04 (已拔牙位又處置):        ${r04Results.length} 個警告`);
console.log(`R05 (植牙位又根管治療):      ${r05Results.length} 個警告`);
console.log(`R06 (有處置無診斷):          ${r06Results.length} 個提示`);
console.log(`R07 (跨院所重複根管第一次):  ${r07Results.length} 個警告`);
console.log(`R08 (植牙牙位診斷蛀牙):      ${r08Results.length} 個警告`);
console.log('-'.repeat(80));
console.log(`總計: ${totalAlerts} 個警告/提示`);
console.log('='.repeat(80));
