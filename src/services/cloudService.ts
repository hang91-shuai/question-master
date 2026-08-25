import cloudbase from '@cloudbase/js-sdk';
import type { QuestionBank } from '../types';

// 从 .env.local 读取 CloudBase 配置
const CLOUD_ENV_ID = import.meta.env.VITE_CLOUDBASE_ENV_ID || '';

let app: any = null;
let db: any = null;

export function isCloudConfigured(): boolean {
  return Boolean(CLOUD_ENV_ID);
}

function getDB() {
  if (!isCloudConfigured()) {
    throw new Error('CloudBase 未配置：请在 .env.local 中设置 VITE_CLOUDBASE_ENV_ID');
  }
  if (db) return db;
  app = cloudbase.init({ env: CLOUD_ENV_ID });
  app.auth({ persistence: 'local' }).anonymousAuthProvider().signIn();
  db = app.database();
  return db;
}

const BANK_COLLECTION = 'question_banks';

export interface CloudBankRecord {
  _id: string;
  name: string;
  type: 'theory' | 'skill';
  createdAt: string;
  questionCount: number;
  questions: QuestionBank['questions'];
}

/** 把本地题库全量同步到云端（覆盖式，保证共享一致） */
export async function syncBanksToCloud(banks: QuestionBank[]): Promise<void> {
  const _db = getDB();
  const coll = _db.collection(BANK_COLLECTION);

  // 先清空旧数据，再批量写入（简单可靠的覆盖策略）
  try {
    await coll.where({ _id: _db.command.exists(true) }).remove();
  } catch (e) {
    // 集合不存在或为空时忽略
  }

  if (banks.length === 0) return;

  const records: CloudBankRecord[] = banks.map((b) => ({
    _id: b.id,
    name: b.name,
    type: b.type,
    createdAt: b.createdAt,
    questionCount: b.questionCount,
    questions: b.questions,
  }));

  // 云数据库单次写入有大小限制，分块写入
  const CHUNK = 20;
  for (let i = 0; i < records.length; i += CHUNK) {
    await coll.add(records.slice(i, i + CHUNK));
  }
}

/** 从云端拉取题库 */
export async function fetchBanksFromCloud(): Promise<QuestionBank[]> {
  const _db = getDB();
  const coll = _db.collection(BANK_COLLECTION);
  const res = await coll.limit(1000).get();
  const data: CloudBankRecord[] = res.data || [];
  return data.map((r) => ({
    id: r._id,
    name: r.name,
    type: r.type,
    createdAt: r.createdAt,
    questionCount: r.questionCount ?? (r.questions?.length || 0),
    questions: r.questions || [],
  }));
}
