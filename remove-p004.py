import json

# 读取文件
with open('TestPatients_Transaction.json', 'r', encoding='utf-8') as f:
    bundle = json.load(f)

# 删除所有P004相关的资源
original_count = len(bundle['entry'])
bundle['entry'] = [
    entry for entry in bundle['entry']
    if 'Patient/P004' not in entry.get('fullUrl', '') and
       'P004-' not in entry.get('fullUrl', '') and
       (entry.get('resource', {}).get('subject', {}).get('reference', '') != 'Patient/P004') and
       (entry.get('resource', {}).get('encounter', {}).get('reference', '').find('P004-') == -1)
]

removed_count = original_count - len(bundle['entry'])

# 保存
with open('TestPatients_Transaction.json', 'w', encoding='utf-8') as f:
    json.dump(bundle, f, ensure_ascii=False, indent=2)

print(f'✅ 从 Transaction Bundle 删除了 {removed_count} 个P004资源')
print(f'   原始: {original_count} 个资源')
print(f'   删除后: {len(bundle["entry"])} 个资源')
