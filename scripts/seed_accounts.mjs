// 将账号批量入库云端 student_accounts（幂等：先清空再插入）
// 前置条件：已在 CloudBase 控制台执行 scripts/init_student_db.sql 建表
// 运行：node scripts/seed_accounts.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const PROXY = process.env.VITE_CLOUDBASE_PROXY_URL || 'https://hang-91-d5g44hojk64d3da49-1474804677.ap-shanghai.app.tcloudbase.com/api';

async function proxy(payload) {
  const res = await fetch(PROXY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`[${payload.method}] ${payload.path}?${payload.query || ''} => ${res.status}: ${text.slice(0, 300)}`);
  }
  return text ? JSON.parse(text) : null;
}

const rows = JSON.parse(
  readFileSync(fileURLToPath(new URL('./accounts_data.json', import.meta.url)), 'utf-8')
);
console.log(`读取 ${rows.length} 条账号记录`);

// 1. 清空现有账号（防止重复执行产生脏数据）
await proxy({ path: '/student_accounts', method: 'DELETE' });
console.log('✓ 已清空 student_accounts');

// 2. 批量插入
let ok = 0;
for (const r of rows) {
  await proxy({ path: '/student_accounts', method: 'POST', body: r, prefer: 'return=minimal' });
  ok += 1;
}
console.log(`✓ 已插入 ${ok} 条账号`);

// 3. 验证
const check = await proxy({ path: '/student_accounts', method: 'GET', query: 'select=id,username,name,role&order=id' });
console.log(`✓ 云端现有 ${check.length} 个账号:`);
for (const c of check) {
  console.log(`  ${c.id}  ${c.username}  ${c.name || ''}  ${c.role}`);
}
