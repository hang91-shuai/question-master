import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { QuestionBank } from '../types';

// 从 .env.local 读取 CloudBase PostgreSQL 配置
// CloudBase 新版 PostgreSQL 兼容 Supabase/PostgREST 协议
const CLOUDBASE_URL = import.meta.env.VITE_CLOUDBASE_URL || '';
const CLOUDBASE_ANON_KEY = import.meta.env.VITE_CLOUDBASE_ANON_KEY || '';

let client: SupabaseClient | null = null;

export function isCloudConfigured(): boolean {
  return Boolean(CLOUDBASE_URL && CLOUDBASE_ANON_KEY);
}

function getClient(): SupabaseClient {
  if (!isCloudConfigured()) {
    throw new Error(
      'CloudBase 未配置：请在 .env.local 中设置 VITE_CLOUDBASE_URL 和 VITE_CLOUDBASE_ANON_KEY'
    );
  }
  if (!client) {
    client = createClient(CLOUDBASE_URL, CLOUDBASE_ANON_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return client;
}

const BANK_TABLE = 'question_banks';

export interface CloudBankRecord {
  id: string;
  name: string;
  type: 'theory' | 'skill';
  created_at: string;
  question_count: number;
  questions: QuestionBank['questions'];
}

/** 把本地题库全量同步到云端（覆盖式，保证共享一致） */
export async function syncBanksToCloud(banks: QuestionBank[]): Promise<void> {
  const supabase = getClient();

  // 先清空旧数据，再批量写入（简单可靠的覆盖策略）
  const { error: deleteError } = await supabase.from(BANK_TABLE).delete().neq('id', '');
  if (deleteError) {
    throw new Error(`清空云端题库失败：${deleteError.message}`);
  }

  if (banks.length === 0) return;

  const records: CloudBankRecord[] = banks.map((b) => ({
    id: b.id,
    name: b.name,
    type: b.type,
    created_at: b.createdAt,
    question_count: b.questionCount,
    questions: b.questions,
  }));

  // 云数据库单次写入有大小限制，分块写入
  const CHUNK = 20;
  for (let i = 0; i < records.length; i += CHUNK) {
    const { error } = await supabase.from(BANK_TABLE).insert(records.slice(i, i + CHUNK));
    if (error) {
      throw new Error(`同步题库到云端失败：${error.message}`);
    }
  }
}

/** 从云端拉取题库 */
export async function fetchBanksFromCloud(): Promise<QuestionBank[]> {
  const supabase = getClient();
  const { data, error } = await supabase.from(BANK_TABLE).select('*');
  if (error) {
    throw new Error(`从云端拉取题库失败：${error.message}`);
  }

  const rows: CloudBankRecord[] = (data as CloudBankRecord[]) || [];
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    type: r.type,
    createdAt: r.created_at,
    questionCount: r.question_count ?? (r.questions?.length || 0),
    questions: r.questions || [],
  }));
}
