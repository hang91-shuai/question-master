// 生成账号数据 + 交付 Excel（考生账号发放表）
// 运行：node scripts/generate_accounts.mjs
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------- 账号清单 ----------
const STUDENT_PASSWORDS = [
  'qZ7vN2mK', 'jK4pR8wT', 'mN6sX3dF', 'rT2wB5hG', 'vC9kL4nM',
  'bH3nG7vR', 'sD5tY8kP', 'fG6hJ2wQ', 'kL8jH4xZ', 'pQ3rS6cV',
  'nB7vC5mX', 'xZ4cV8nB', 'wS2dF6gH', 'jK9lM3nP', 'tG5hJ7kL',
  'mV3nB6cX', 'cF8vB2nM', 'hJ4kL7pQ', 'bN6mC3xZ', 'zX2wS5dV',
  'rC9vB4nM', 'gH3jK6mP', 'sD7fG2wR', 'kP5lQ8nT', 'nV4bC7xZ',
  'wM6nB3dF', 'tR8jH5kL', 'cB2vN6mX', 'jH7kL4pQ', 'dF3gH8wS',
  'hK5mP9wR',
];

const ADMIN_ACCOUNT = { username: 'zhangjie', password: 'zhang123', name: '张杰', userId: '90001', role: 'admin' };

// 密码哈希：SHA-256(`${username}:${password}`)，前端 Web Crypto 同算法
function hashPassword(username, password) {
  return createHash('sha256').update(`${username}:${password}`).digest('hex');
}

const accounts = STUDENT_PASSWORDS.map((pwd, i) => {
  const no = String(i + 1).padStart(4, '0');
  return {
    userId: String(10001 + i),
    username: `sjzxy202608${no}`,
    password: pwd,
    name: `考生${no}`,
    role: 'student',
    status: 'active',
  };
});
accounts.push({ ...ADMIN_ACCOUNT, status: 'active' });

const rows = accounts.map((a) => ({
  id: a.userId,
  username: a.username,
  password_hash: hashPassword(a.username, a.password),
  name: a.name,
  role: a.role,
  status: a.status,
  created_at: new Date().toLocaleString(),
}));

// ---------- 输出 1：入库数据 JSON（含哈希，不含明文密码） ----------
const dataPath = path.join(__dirname, 'accounts_data.json');
writeFileSync(dataPath, JSON.stringify(rows, null, 2));
console.log(`✓ 入库数据已生成: ${dataPath} (${rows.length} 条)`);

// ---------- 输出 2：发放表 Excel（含明文初始密码，仅本地交付，不进 git） ----------
const sheet1 = accounts.map((a) => ({
  账号: a.username,
  初始密码: a.password,
  姓名: a.role === 'admin' ? `${a.name}（管理员）` : a.name,
  角色: a.role === 'admin' ? '管理员（后台+答题）' : '考生',
}));
const sheet2 = rows.map((r) => ({
  userId: r.id,
  username: r.username,
  passwordHash: r.password_hash,
  name: r.name,
  role: r.role,
  status: r.status,
  createdAt: r.created_at,
}));

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheet1), '发放表');
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheet2), '入库数据');

// 列宽
const widths = { A: 22, B: 16, C: 20, D: 24, E: 16, F: 14, G: 26 };
for (const sheetName of ['发放表', '入库数据']) {
  const ws = wb.Sheets[sheetName];
  ws['!cols'] = Object.keys(widths).map((k) => ({ wch: widths[k] }));
}

const excelPath = path.resolve(__dirname, '..', '..', '考生账号发放表.xlsx');
XLSX.writeFile(wb, excelPath);
console.log(`✓ Excel 已生成: ${excelPath}`);
console.log(`  共 ${accounts.length} 个账号（31 考生 + 1 管理员）`);
