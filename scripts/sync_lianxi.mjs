/**
 * sync_lianxi.mjs
 * 将 scripts/lianxi_bank.json（由 import_doc_to_bank.mjs 生成）合并进云端题库。
 * 流程（与前端 CloudSync 完全一致）：
 *   1. 拉取云端现有题库（两阶段：轻量 meta + 逐条全量）
 *   2. 追加新题库
 *   3. 按题干内容去重（保留质量更高的一题）
 *   4. 全量覆盖同步：DELETE 云端全部 question_banks → POST 合并后的题库
 *
 * 用法：node sync_lianxi.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

// 读取 .env.local 中的代理地址
const envText = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8');
const PROXY_URL = (envText.match(/^VITE_CLOUDBASE_PROXY_URL=(.+)$/m) || [])[1]?.trim();
if (!PROXY_URL) {
  console.error('未找到 VITE_CLOUDBASE_PROXY_URL，请检查 .env.local');
  process.exit(1);
}
console.log('代理地址:', PROXY_URL);

async function proxyRequest(req) {
  const res = await fetch(PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`云函数请求失败 (${res.status}): ${text}`);
  }
  let payload;
  try {
    payload = await res.json();
  } catch {
    return null;
  }
  if (payload && typeof payload.statusCode === 'number') {
    if (payload.statusCode >= 200 && payload.statusCode < 300) {
      if (payload.body) {
        try {
          return JSON.parse(payload.body);
        } catch {
          return payload.body;
        }
      }
      return null;
    }
    throw new Error(`数据库请求失败 (${payload.statusCode}): ${payload.body || ''}`);
  }
  return payload;
}

async function runInBatches(items, batchSize, fn) {
  for (let i = 0; i < items.length; i += batchSize) {
    const chunk = items.slice(i, i + batchSize);
    await Promise.all(chunk.map(fn));
  }
}

// 复刻前端 fetchBanksFromCloud
async function fetchBanksFromCloud() {
  const meta = await proxyRequest({
    path: '/question_banks',
    method: 'GET',
    query: 'select=id,name,type,created_at,question_count',
  });
  const rows = Array.isArray(meta) ? meta : [];
  if (rows.length === 0) return [];

  const banks = [];
  await runInBatches(rows, 2, async (row) => {
    const full = await proxyRequest({
      path: '/question_banks',
      method: 'GET',
      query: `select=*&id=eq.${encodeURIComponent(row.id)}`,
    });
    const list = Array.isArray(full) ? full : [];
    if (list.length === 0) return;
    const r = list[0];
    const questions = Array.isArray(r.questions) ? r.questions : [];
    banks.push({
      id: r.id,
      name: r.name,
      type: r.type,
      createdAt: r.created_at,
      questionCount: typeof r.question_count === 'number' ? r.question_count : questions.length,
      questions,
    });
  });
  return banks;
}

// 复刻前端 dedupeBanksByContent（按题干内容去重，保留质量高的一题）
function dedupeBanksByContent(banks) {
  const score = (q) => {
    let s = 0;
    if (q.answer && String(q.answer).trim()) s += 2;
    if (q.analysis && String(q.analysis).trim()) s += 1;
    if (Array.isArray(q.options) && q.options.length >= 2) s += 1;
    return s;
  };
  return banks.map((bank) => {
    const groups = new Map();
    for (const q of bank.questions) {
      const key = (q.content || '').trim() || q.id;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(q);
    }
    const kept = [];
    for (const list of groups.values()) {
      if (list.length === 1) kept.push(list[0]);
      else kept.push([...list].sort((a, b) => score(b) - score(a))[0]);
    }
    return { ...bank, questions: kept, questionCount: kept.length };
  });
}

// 复刻前端 syncBanksToCloud
async function syncBanksToCloud(banks) {
  const existing = await proxyRequest({
    path: '/question_banks',
    method: 'GET',
    query: 'select=id',
  });
  const existingList = Array.isArray(existing) ? existing : [];
  if (existingList.length > 0) {
    const ids = existingList.map((r) => r.id).join(',');
    await proxyRequest({
      path: '/question_banks',
      method: 'DELETE',
      query: `id=in.(${ids})`,
    });
    console.log(`已删除云端旧题库 ${existingList.length} 条`);
  }
  const rows = banks.map((b) => ({
    id: b.id,
    name: b.name,
    type: b.type,
    created_at: b.createdAt,
    question_count: b.questionCount ?? b.questions.length,
    questions: b.questions,
  }));
  await runInBatches(rows, 2, (row) =>
    proxyRequest({
      path: '/question_banks',
      method: 'POST',
      body: row,
      prefer: 'return=minimal',
    })
  );
  console.log(`已写入题库 ${rows.length} 条`);
}

// ==================== 主流程 ====================
const newBank = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'lianxi_bank.json'), 'utf8')
);
console.log(`新题库「${newBank.name}」共 ${newBank.questions.length} 题`);

console.log('\n正在拉取云端现有题库...');
const cloudBanks = await fetchBanksFromCloud();
console.log('云端现有题库:');
cloudBanks.forEach((b) => console.log(`  - ${b.name}（${b.questions.length} 题）`));

// 已存在同名（或旧名称）题库则跳过/替换，避免重复叠加
const REPLACE_NAMES = ['数字化管理师练习题（张杰）']; // 改名前的旧名称，同步时从云端移除
const merged = cloudBanks.filter(
  (b) => b.name !== newBank.name && !REPLACE_NAMES.includes(b.name)
);
merged.push(newBank);

const deduped = dedupeBanksByContent(merged);
const totalBefore = merged.reduce((s, b) => s + b.questions.length, 0);
const totalAfter = deduped.reduce((s, b) => s + b.questions.length, 0);
console.log(`\n合并后题库数: ${deduped.length}，去重前题数 ${totalBefore} → 去重后 ${totalAfter}（去除 ${totalBefore - totalAfter} 道重复题）`);

console.log('\n正在同步到云端...');
await syncBanksToCloud(deduped);
console.log('\n✅ 同步完成！考生在答题端登录后即可看到新题库。');
