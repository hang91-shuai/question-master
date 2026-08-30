import type { Question, QuestionBank } from '../types';

/**
 * 去掉文本中的非法/乱码字符。
 * - Unicode 替换字符 U+FFFD（显示为 \uFFFD）
 * - ASCII 控制字符（除换行、制表符外）
 * 清洗后如果只剩空白则返回空字符串。
 */
export function sanitizeText(text: string): string {
  if (!text || typeof text !== 'string') return text;
  return text
    .replace(/\uFFFD/g, '')
    .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F]/g, '')
    .trim();
}

/**
 * 判断文本是否含有乱码替换字符。
 */
export function hasGarbageText(text: string): boolean {
  return typeof text === 'string' && text.includes('\uFFFD');
}

/**
 * 去掉选项文本前导的 A./B./C./D. 等字母前缀。
 * 用于解决 AI 返回或外部导入时选项本身带字母前缀，前端再次渲染字母导致"A. A. xxx"的问题。
 * 支持的括号/标点：. . 。 、 , ， ; ； : 空格 以及 、
 */
export function cleanOptionText(text: string): string {
  if (!text || typeof text !== 'string') return text;
  return text.replace(/^\s*[A-Za-z][\.．。、,，;；:\s]\s*/, '').trim();
}

/**
 * 清洗单个题目：去掉 options 和 answer 中多余的字母前缀，并清理乱码字符。
 * 返回新对象，不修改原对象。
 */
export function cleanQuestion(q: Question): Question {
  if (!q) return q;
  const content = sanitizeText(q.content ?? '');
  const analysis = sanitizeText(q.analysis ?? '');
  const source = sanitizeText(q.source ?? '');
  const outlineName = sanitizeText(q.outlineName ?? '');
  const options = Array.isArray(q.options)
    ? q.options.map((o) => sanitizeText(cleanOptionText(o)))
    : q.options;

  let answer = q.answer;
  if (answer && typeof answer === 'string') {
    // 把 "A. xxx" / "A、B. xxx" / "A, B. xxx" 这类带前缀的答案统一成纯字母
    // 拆分按中英文逗号、顿号、分号、空格
    const parts = answer.split(/[，、,;；\s]+/).filter(Boolean);
    const letters = parts.map((p) => {
      const m = p.match(/^\s*([A-Za-z])\s*[\.．。、,，;；:\s]\s*/);
      return m ? m[1].toUpperCase() : p;
    });
    // 如果拆分后全是单字母，按 A,B 形式输出（兼容单选/多选）
    if (letters.length > 0 && letters.every((l) => /^[A-Za-z]$/.test(l))) {
      answer = letters.join(',');
    }
  }

  return { ...q, content, analysis, source, outlineName, options, answer };
}

/**
 * 判断一道题在清洗后是否仍包含无法自动修复的乱码，应被丢弃。
 */
export function isQuestionCorrupt(q: Question): boolean {
  if (!q) return true;
  const fields = [q.content, q.analysis, q.source, q.outlineName, ...(q.options || [])];
  return fields.some((f) => hasGarbageText(String(f ?? '')));
}

/**
 * 清洗整个题库。
 */
export function cleanQuestionBank(bank: QuestionBank): QuestionBank {
  if (!bank) return bank;
  const questions = bank.questions.map(cleanQuestion);
  return {
    ...bank,
    questions,
    questionCount: questions.length,
  };
}

/**
 * 批量清洗题库列表。
 */
export function cleanQuestionBanks(banks: QuestionBank[]): QuestionBank[] {
  return banks.map(cleanQuestionBank);
}
