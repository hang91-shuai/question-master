import type { Question, QuestionBank } from '../types';

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
 * 将本地题库同步（覆盖）到云端
 */
export async function syncBanksToCloud(banks: QuestionBank[]): Promise<void> {
  // 1. 查询云端现有记录
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

  // 3. 批量插入本地题库
  const rows = banks.map((b) => ({
    id: b.id,
    name: b.name,
    type: b.type,
    created_at: b.createdAt,
    question_count: b.questionCount ?? b.questions.length,
    questions: b.questions,
  }));

  await proxyRequest({
    path: '/question_banks',
    method: 'POST',
    body: rows,
    prefer: 'return=minimal',
  });
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
 * 从云端拉取题库
 */
export async function fetchBanksFromCloud(): Promise<QuestionBank[]> {
  const data = await proxyRequest({
    path: '/question_banks',
    method: 'GET',
    query: 'select=*',
  });

  const rows: any[] = Array.isArray(data) ? data : [];

  return rows.map((row) => {
    const questions = Array.isArray(row.questions) ? row.questions : [];
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      createdAt: row.created_at,
      questionCount: typeof row.question_count === 'number' ? row.question_count : questions.length,
      questions,
    } as QuestionBank;
  });
}
