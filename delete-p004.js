const https = require('https');

const FHIR_BASE_URL = 'https://thas.mohw.gov.tw/v/r4/fhir';

// P004患者的所有资源（按依赖顺序：先删子资源，再删父资源）
const resourcesToDelete = [
    // ImagingStudy
    'ImagingStudy/P004-IMG01',
    'ImagingStudy/P004-IMG02',
    'ImagingStudy/P004-IMG03',
    'ImagingStudy/P004-IMG04',
    'ImagingStudy/P004-IMG05',
    'ImagingStudy/P004-IMG06',
    'ImagingStudy/P004-IMG07',
    
    // Procedures
    'Procedure/P004-PROC01',
    'Procedure/P004-PROC02',
    'Procedure/P004-PROC03',
    'Procedure/P004-PROC04',
    'Procedure/P004-PROC05',
    'Procedure/P004-PROC06',
    'Procedure/P004-PROC07',
    
    // Conditions
    'Condition/P004-COND01',
    'Condition/P004-COND02',
    'Condition/P004-COND03',
    'Condition/P004-COND04',
    'Condition/P004-COND05',
    
    // Encounters
    'Encounter/P004-ENC01',
    'Encounter/P004-ENC02',
    'Encounter/P004-ENC03',
    'Encounter/P004-ENC04',
    'Encounter/P004-ENC05',
    'Encounter/P004-ENC06',
    
    // Patient (最后删除)
    'Patient/P004'
];

function deleteResource(resourcePath) {
    return new Promise((resolve, reject) => {
        const url = new URL(`${FHIR_BASE_URL}/${resourcePath}`);
        
        const options = {
            hostname: url.hostname,
            path: url.pathname,
            method: 'DELETE',
            headers: {
                'Accept': 'application/fhir+json'
            }
        };
        
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 404 || res.statusCode === 410) {
                    resolve({ success: true, status: res.statusCode, notFound: true });
                } else if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve({ success: true, status: res.statusCode });
                } else {
                    resolve({ success: false, status: res.statusCode, data });
                }
            });
        });
        
        req.on('error', (error) => {
            reject(error);
        });
        
        req.end();
    });
}

async function main() {
    console.log('🗑️  刪除 P004 患者資料');
    console.log('='.repeat(80));
    console.log(`患者：林小華 (D456789012)`);
    console.log(`伺服器：${FHIR_BASE_URL}\n`);
    
    console.log(`準備刪除 ${resourcesToDelete.length} 個資源\n`);
    
    let successCount = 0;
    let notFoundCount = 0;
    let failCount = 0;
    
    for (const resourcePath of resourcesToDelete) {
        try {
            console.log(`🗑️  刪除: ${resourcePath}`);
            const result = await deleteResource(resourcePath);
            
            if (result.notFound) {
                console.log(`   ⚠️  資源不存在或已刪除 (HTTP ${result.status})`);
                notFoundCount++;
            } else if (result.success) {
                console.log(`   ✅ 成功刪除 (HTTP ${result.status})`);
                successCount++;
            } else {
                console.log(`   ❌ 刪除失敗 (HTTP ${result.status})`);
                failCount++;
            }
            
            // 避免请求过快
            await new Promise(resolve => setTimeout(resolve, 100));
            
        } catch (error) {
            console.log(`   ❌ 錯誤: ${error.message}`);
            failCount++;
        }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('📊 刪除結果：');
    console.log(`   ✅ 成功刪除: ${successCount} 個`);
    console.log(`   ⚠️  資源不存在: ${notFoundCount} 個`);
    console.log(`   ❌ 刪除失敗: ${failCount} 個`);
    console.log(`   📝 總計: ${resourcesToDelete.length} 個`);
}

main().catch(console.error);
