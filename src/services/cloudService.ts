import type { Question, QuestionBank, WrongQuestion } from '../types';

// 云函数代理地址（HTTP 网关 /api 路径）
// 云函数在服务端转发对 PostgREST 数据库 API 的请求，从而绕开浏览器 CORS。
const PROXY_URL = import.meta.env.VITE_CLOUDBASE_PROXY_URL || '';

// 兼容旧配置：如果没有 PROXY_URL，则从 VITE_CLOUDBASE_URL 派生网关地址
// 但强烈建议显式配置 VITE_CLOUDBASE_PROXY_URL
export function isCloudConfigured(): boolean {
  return Boolean(PROXY_URL);
}

interface ProxyRequest {
  path: string;
  method?: string;
  query?: string;
  body?: unknown;
  prefer?: string;
}

interface ProxyResponse {
  statusCode?: number;
  body?: string;
}

/**
 * 通过云函数代理调用数据库 PostgREST API。
 * 返回解析后的 JSON 数据（数组/对象）或 null（204 等无内容响应）。
 *
 * 注意：云函数网关对单次响应体大小有限制（实测约 1MB 左右会被截断），
 * 因此调用方应避免一次拉取超大响应，必须分批/逐条拉取。
 */
async function proxyRequest(req: ProxyRequest): Promise<any> {
  if (!PROXY_URL) {
    throw new Error('云函数代理未配置，请设置 VITE_CLOUDBASE_PROXY_URL');
  }

  const res = await fetch(PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });

  // 云函数会返回我们业务层可识别的错误
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`云函数请求失败 (${res.status}): ${text || res.statusText}`);
  }

  let payload: ProxyResponse;
  try {
    payload = await res.json();
  } catch {
    return null;
  }

  // 云函数内部可能返回 statusCode/body 结构
  if (payload && typeof payload.statusCode === 'number') {
    if (payload.statusCode >= 200 && payload.statusCode < 300) {
      // 解析 body（可能为空）
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

  // 直接返回数据（兼容不同响应结构）
  return payload;
}

/**
 * 分批处理辅助：把数组按每批 size 个分成多批，每批内部并发执行，
 * 批与批之间串行，避免一次性发太多请求或单次响应体过大。
 */
async function runInBatches<T>(items: T[], batchSize: number, fn: (item: T) => Promise<void>) {
  for (let i = 0; i < items.length; i += batchSize) {
    const chunk = items.slice(i, i + batchSize);
    await Promise.all(chunk.map(fn));
  }
}

/**
 * 将本地题库同步（覆盖）到云端。
 * 采用「逐条覆盖」策略：先查询云端现有记录并删除，再逐条插入本地题库。
 * 避免一次性提交超大请求体 / 返回超大数据导致网关截断。
 */
export async function syncBanksToCloud(banks: QuestionBank[]): Promise<void> {
  // 1. 查询云端现有记录（只查轻量 id 字段）
  const existing = await proxyRequest({
    path: '/question_banks',
    method: 'GET',
    query: 'select=id',
  });

  const existingList: { id: string }[] = Array.isArray(existing) ? existing : [];

  // 2. 删除云端已有记录（覆盖式同步）
  if (existingList.length > 0) {
    const ids = existingList.map((r) => r.id).join(',');
    await proxyRequest({
      path: '/question_banks',
      method: 'DELETE',
      query: `id=in.(${ids})`,
    });
  }

  // 3. 逐条插入本地题库（每条一个请求，避免单次请求体过大）
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
}

/**
 * 对题库按「题干内容」去重。
 * 说明：云端/本地题库可能因多次导入同一批题而产生「内容相同但 id 不同」的重复题，
 * 按 id 去重无法消除，需按内容去重。
 * 每个重复组内优先保留「答案、解析、选项」更完整的那一题，其余删除。
 * 返回新数组（不改原对象）。
 */
export function dedupeBanksByContent(banks: QuestionBank[]): QuestionBank[] {
  // 质量评分：答案完整 +2，解析完整 +1，选项>=2 +1
  const score = (q: Question) => {
    let s = 0;
    if (q.answer && String(q.answer).trim()) s += 2;
    if (q.analysis && String(q.analysis).trim()) s += 1;
    if (Array.isArray(q.options) && q.options.length >= 2) s += 1;
    return s;
  };

  return banks.map((bank) => {
    const groups = new Map<string, Question[]>();
    for (const q of bank.questions) {
      const key = (q.content || '').trim() || q.id;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(q);
    }

    const kept: Question[] = [];
    for (const [, list] of groups) {
      if (list.length === 1) {
        kept.push(list[0]);
      } else {
        // 重复组：保留质量最高的那道
        const best = [...list].sort((a, b) => score(b) - score(a))[0];
        kept.push(best);
      }
    }

    return { ...bank, questions: kept, questionCount: kept.length };
  });
}

/**
 * 从云端拉取题库。
 * 由于云函数网关对单次响应体大小有限制（实测约 1MB 会被截断），
 * 不能一次 select=* 拉全部题库（1.6MB+ 会被截断导致解析失败）。
 * 改为两阶段：
 *   1. 先拉所有题库的轻量元数据（id/name/type/created_at/question_count）
 *   2. 再按 id 逐条拉取完整数据（含题目），每条一个请求
 * 这样每条响应都远小于网关限制，保证拉取稳定。
 */
// ==================================================================
// 考生账号 & 考生数据云端同步
// 云端为主，本地缓存为辅：账号/错题本/练习进度/练习统计全部按 userId 存云端
// ==================================================================

export interface CloudUser {
  id: string;
  username: string;
  name: string;
  role: 'student' | 'admin';
}

export interface CloudProgressData {
  questions: unknown[];
  index: number;
  answers: unknown[];
  questionBankIds: Record<string, string>;
  questionWrongMap: Record<string, string>;
  practiceWrongIds: string[];
  practiceMode?: string;
  sourceType?: string;
  mode?: string;
}

export interface CloudStatsData {
  answeredCount: number;
  correctCount: number;
  practicedIds: string[];
}

// 密码哈希：SHA-256(`${username}:${password}`)，与入库脚本算法一致
export async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** 云端验证账号密码（哈希比对），返回用户信息或 null */
export async function loginCloud(username: string, password: string): Promise<CloudUser | null> {
  if (!isCloudConfigured()) return null;
  const hash = await sha256Hex(`${username}:${password}`);
  const rows = await proxyRequest({
    path: '/student_accounts',
    method: 'GET',
    query: `select=id,username,name,role,status&username=eq.${encodeURIComponent(username)}&password_hash=eq.${hash}`,
  });
  const list = Array.isArray(rows) ? rows : [];
  if (list.length === 0) return null;
  const r = list[0];
  if (r.status !== 'active') return null;
  return {
    id: r.id,
    username: r.username,
    name: r.name || r.username,
    role: r.role === 'admin' ? 'admin' : 'student',
  };
}

/** 拉取某考生的错题本（云端 -> 本地） */
export async function fetchWrongQuestionsCloud(userId: string): Promise<WrongQuestion[]> {
  if (!isCloudConfigured()) return [];
  const rows = await proxyRequest({
    path: '/wrong_questions',
    method: 'GET',
    query: `select=*&user_id=eq.${encodeURIComponent(userId)}`,
  });
  const list = Array.isArray(rows) ? rows : [];
  return list.map((r: any) => ({
    id: r.id,
    userId: r.user_id,
    bankId: r.bank_id,
    questionId: r.question_id,
    addedAt: r.added_at,
    source: r.source,
    correctCount: r.correct_count ?? 0,
    wrongCount: r.wrong_count ?? 0,
  }));
}

/** 覆盖式上传某考生的错题本（本地 -> 云端） */
export async function overwriteWrongQuestionsCloud(userId: string, list: WrongQuestion[]): Promise<void> {
  if (!isCloudConfigured()) return;
  await proxyRequest({
    path: '/wrong_questions',
    method: 'DELETE',
    query: `user_id=eq.${encodeURIComponent(userId)}`,
  });
  if (list.length === 0) return;
  const rows = list.map((w) => ({
    id: w.id,
    user_id: w.userId,
    bank_id: w.bankId,
    question_id: w.questionId,
    added_at: w.addedAt,
    source: w.source,
    correct_count: w.correctCount ?? 0,
    wrong_count: w.wrongCount ?? 0,
  }));
  await runInBatches(rows, 5, (row) =>
    proxyRequest({ path: '/wrong_questions', method: 'POST', body: row, prefer: 'return=minimal' })
  );
}

/** 拉取某考生的未完成练习进度（云端 -> 本地） */
export async function fetchPracticeProgressCloud(userId: string): Promise<CloudProgressData | null> {
  if (!isCloudConfigured()) return null;
  const rows = await proxyRequest({
    path: '/practice_progress',
    method: 'GET',
    query: `select=data&user_id=eq.${encodeURIComponent(userId)}`,
  });
  const list = Array.isArray(rows) ? rows : [];
  if (list.length === 0) return null;
  return list[0].data ?? null;
}

/** 覆盖式保存某考生的练习进度（本地 -> 云端） */
export async function overwritePracticeProgressCloud(userId: string, data: CloudProgressData): Promise<void> {
  if (!isCloudConfigured()) return;
  await proxyRequest({
    path: '/practice_progress',
    method: 'DELETE',
    query: `user_id=eq.${encodeURIComponent(userId)}`,
  });
  await proxyRequest({
    path: '/practice_progress',
    method: 'POST',
    body: { user_id: userId, data, updated_at: new Date().toISOString() },
    prefer: 'return=minimal',
  });
}

/** 删除某考生的练习进度（完成/放弃练习时清理云端存档） */
export async function deletePracticeProgressCloud(userId: string): Promise<void> {
  if (!isCloudConfigured()) return;
  await proxyRequest({
    path: '/practice_progress',
    method: 'DELETE',
    query: `user_id=eq.${encodeURIComponent(userId)}`,
  });
}

/** 拉取某考生的练习统计（云端 -> 本地） */
export async function fetchPracticeStatsCloud(userId: string): Promise<CloudStatsData | null> {
  if (!isCloudConfigured()) return null;
  const rows = await proxyRequest({
    path: '/practice_stats',
    method: 'GET',
    query: `select=data&user_id=eq.${encodeURIComponent(userId)}`,
  });
  const list = Array.isArray(rows) ? rows : [];
  if (list.length === 0) return null;
  return list[0].data ?? null;
}

/** 覆盖式保存某考生的练习统计（本地 -> 云端） */
export async function overwritePracticeStatsCloud(userId: string, stats: CloudStatsData): Promise<void> {
  if (!isCloudConfigured()) return;
  await proxyRequest({
    path: '/practice_stats',
    method: 'DELETE',
    query: `user_id=eq.${encodeURIComponent(userId)}`,
  });
  await proxyRequest({
    path: '/practice_stats',
    method: 'POST',
    body: { user_id: userId, data: stats, updated_at: new Date().toISOString() },
    prefer: 'return=minimal',
  });
}

// ==================================================================
// 题库拉取（保留）
// ==================================================================
export async function fetchBanksFromCloud(): Promise<QuestionBank[]> {
  // 阶段一：拉取轻量元数据列表
  const meta = await proxyRequest({
    path: '/question_banks',
    method: 'GET',
    query: 'select=id,name,type,created_at,question_count',
  });

  const rows: any[] = Array.isArray(meta) ? meta : [];
  if (rows.length === 0) return [];

  // 阶段二：逐条拉取完整数据（每条一个请求，2 并发）
  const banks: QuestionBank[] = [];
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
      questionCount:
        typeof r.question_count === 'number' ? r.question_count : questions.length,
      questions,
    } as QuestionBank);
  });

  return banks;
}
