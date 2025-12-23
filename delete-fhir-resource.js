const FHIR_BASE_URL = 'https://thas.mohw.gov.tw/v/r4/fhir';

// 要刪除的資源（按依賴順序排列：先刪子資源，再刪父資源）
const resourcesToDelete = [
    // P002 - 刪除舊的根管治療記錄
    'Procedure/P002-PROC01',
    'Encounter/P002-ENC01'
];

async function deleteResource(resourcePath) {
    try {
        const url = `${FHIR_BASE_URL}/${resourcePath}`;
        console.log(`🗑️  正在刪除: ${resourcePath}`);
        
        const response = await fetch(url, {
            method: 'DELETE',
            headers: {
                'Accept': 'application/fhir+json'
            }
        });
        
        if (response.status === 404 || response.status === 410) {
            console.log(`   ⚠️  資源不存在或已刪除: ${resourcePath}`);
        } else if (response.status >= 200 && response.status < 300) {
            console.log(`   ✅ 成功刪除: ${resourcePath}`);
        } else {
            console.log(`   ❌ 刪除失敗: ${resourcePath} (HTTP ${response.status})`);
            return false;
        }
        
        return true;
    } catch (error) {
        console.error(`   ❌ 刪除失敗: ${resourcePath}`);
        console.error(`      錯誤: ${error.message}`);
        return false;
    }
}

async function main() {
    console.log('🏥 FHIR 資源刪除工具');
    console.log('='.repeat(80));
    console.log(`目標伺服器：${FHIR_BASE_URL}\n`);
    
    console.log(`準備刪除 ${resourcesToDelete.length} 個資源：`);
    resourcesToDelete.forEach(r => console.log(`  - ${r}`));
    console.log('\n開始刪除...\n');
    
    let successCount = 0;
    let failCount = 0;
    
    for (const resource of resourcesToDelete) {
        const result = await deleteResource(resource);
        if (result) successCount++;
        else failCount++;
        
        // 延遲避免過快請求
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('📊 刪除結果統計');
    console.log('='.repeat(80));
    console.log(`✅ 成功：${successCount} 個`);
    console.log(`❌ 失敗：${failCount} 個`);
    console.log('\n✨ 完成！');
}

main().catch(error => {
    console.error('執行過程發生錯誤:', error);
    process.exit(1);
});
