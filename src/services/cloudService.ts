import cloudbase from '@cloudbase/js-sdk';
import type { QuestionBank } from '../types';

const CLOUDBASE_URL = import.meta.env.VITE_CLOUDBASE_URL || '';
const CLOUDBASE_PUBLISHABLE_KEY = import.meta.env.VITE_CLOUDBASE_ANON_KEY || '';

// 从 REST URL 中解析环境 ID，例如：
// https://hang-91-d5g44hojk64d3da49.api.tcloudbasegateway.com/v1/rdb/rest
// => hang-91-d5g44hojk64d3da49
function extractEnvId(url: string): string | null {
  const match = url.match(/https?:\/\/([^.]+)\.api\.tcloudbasegateway\.com/);
  return match?.[1] || null;
}

const envId = extractEnvId(CLOUDBASE_URL);
const restBaseUrl = CLOUDBASE_URL;

let accessToken: string | null = null;
let tokenExpiresAt = 0;

export function isCloudConfigured(): boolean {
  return Boolean(envId && CLOUDBASE_PUBLISHABLE_KEY);
}

async function ensureAnonymousAuth(): Promise<string> {
  const now = Date.now();
  if (accessToken && tokenExpiresAt > now + 60_000) {
    return accessToken;
  }

  const app = cloudbase.init({
    env: envId!,
    accessKey: CLOUDBASE_PUBLISHABLE_KEY,
  });

  const auth = app.auth as any;
  const { data, error } = await auth.signInAnonymously();
  if (error) {
    throw new Error(`CloudBase 匿名登录失败: ${error.message || JSON.stringify(error)}`);
  }

  const token = data?.session?.access_token;
  if (!token) {
    throw new Error('CloudBase 匿名登录未返回 access_token');
  }

  accessToken = token;
  // 令牌过期时间，预留 60 秒缓冲
  tokenExpiresAt = now + (data.session.expires_in || 3600) * 1000;
  return token;
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await ensureAnonymousAuth();
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

function parseResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    return res.text().then((text) => {
      throw new Error(`CloudBase 请求失败 (${res.status}): ${text || res.statusText}`);
    });
  }
  // 204 / DELETE 等可能没有 body
  if (res.status === 204 || res.headers.get('content-length') === '0') {
    return Promise.resolve({} as T);
  }
  return res.json() as Promise<T>;
}

/**
 * 将本地题库同步（覆盖）到云端
 */
export async function syncBanksToCloud(banks: QuestionBank[]): Promise<void> {
  if (!isCloudConfigured()) {
    throw new Error('CloudBase 未配置，请先设置 VITE_CLOUDBASE_URL 与 VITE_CLOUDBASE_ANON_KEY');
  }

  const headers = await getAuthHeaders();

  // 1. 查询云端现有记录的 id
  const listRes = await fetch(`${restBaseUrl}/question_banks?id=not.is.null`, {
    method: 'GET',
    headers,
  });
  const existing: { id: string }[] = await parseResponse(listRes);

  // 2. 删除云端已有记录
  if (existing.length > 0) {
    const ids = existing.map((r) => r.id).join(',');
    const deleteRes = await fetch(`${restBaseUrl}/question_banks?id=in.(${ids})`, {
      method: 'DELETE',
      headers,
    });
    await parseResponse(deleteRes);
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

  const insertRes = await fetch(`${restBaseUrl}/question_banks`, {
    method: 'POST',
    headers: {
      ...headers,
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(rows),
  });
  await parseResponse(insertRes);
}

/**
 * 从云端拉取题库
 */
export async function fetchBanksFromCloud(): Promise<QuestionBank[]> {
  if (!isCloudConfigured()) {
    throw new Error('CloudBase 未配置，请先设置 VITE_CLOUDBASE_URL 与 VITE_CLOUDBASE_ANON_KEY');
  }

  const headers = await getAuthHeaders();
  const res = await fetch(`${restBaseUrl}/question_banks?select=*`, {
    method: 'GET',
    headers,
  });
  const data: any[] = await parseResponse(res);

  return data.map((row) => {
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
