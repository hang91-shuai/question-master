/**
 * import_doc_to_bank.mjs
 * 将 lianxi_doc.txt（由 Word .doc 转换而来）解析为系统标准题库 JSON（QuestionBank 结构）。
 * 输出：question-master/scripts/lianxi_bank.json
 *
 * 用法：node import_doc_to_bank.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, '..', '..', 'lianxi_doc.txt'); // 项目根下的转换产物
const OUT = path.join(__dirname, 'lianxi_bank.json');

let text = fs.readFileSync(SRC, 'utf8');
// Word 导出的文本用 \r 分段、且开头带 BOM，统一归一化
text = text.replace(/^\uFEFF/, '').replace(/\r/g, '\n');
const lines = text.split('\n');

const questions = [];
const skippedList = [];
let cur = null;

// 题目编号统一用顿号"、"（全角点"．"也兼容）；半角点"1. "多为解析内列表，不视为题号
const newQuestionRe = /^(\d+)[、．]\s*(.*)/;

for (const raw of lines) {
  const line = raw.trimEnd();

  const m = line.match(newQuestionRe);
  if (m) {
    if (cur) {
      const inferredAnswer = cur.options.length === 0 ? null : inferJudgeAnswer(cur.analysis.join('\n'));
      const missingAnswer = cur.options.length === 0 || (!cur.answer && !inferredAnswer);
      if (missingAnswer) {
        skippedList.push({ num: cur.num, reason: cur.options.length === 0 ? '无选项' : '无答案且解析无法推断' });
      } else {
        questions.push(cur);
      }
    }
    cur = {
      num: Number(m[1]),
      content: m[2].trim(),
      options: [],
      answer: null,
      analysis: [],
      phase: 'content', // content -> options -> after_answer
    };
    continue;
  }

  if (!cur) continue;

  // 选项行（A. / A、 / A．）
  if (cur.phase === 'content' || cur.phase === 'options') {
    const am = line.match(/^([A-H])[.、．]\s*/);
    if (am && cur.phase === 'content') {
      cur.phase = 'options';
    }
    if (am && cur.phase === 'options') {
      cur.options.push(line.slice(am[0].length).trim());
      continue;
    }
  }

  // 答案行（兼容原文档个别位置漏写"答"字，如"案：D"）
  const ans = line.match(/^(答)?案[:：]\s*([A-Ha-h√×对错正确错误]+)/);
  if (ans) {
    cur.answer = ans[2].toUpperCase();
    cur.phase = 'after_answer';
    continue;
  }

  if (cur.phase === 'content') {
    // 题干续行
    cur.content += line;
  } else if (cur.phase === 'options') {
    // 选项之间出现的杂行（极少见），并入题干末尾作为说明
    cur.content += line;
  } else {
    // after_answer：解析内容（含空行）
    if (line.startsWith('解析')) {
      cur.analysis.push(line.replace(/^解析[:：]?\s*/, ''));
    } else {
      cur.analysis.push(line);
    }
  }
}
if (cur) {
  const inferredAnswer = cur.options.length === 0 ? null : inferJudgeAnswer(cur.analysis.join('\n'));
  const missingAnswer = cur.options.length === 0 || (!cur.answer && !inferredAnswer);
  if (missingAnswer) {
    skippedList.push({ num: cur.num, reason: cur.options.length === 0 ? '无选项' : '无答案且解析无法推断' });
  } else {
    questions.push(cur);
  }
}

// 校验：按题号排序，检查连续性
questions.sort((a, b) => a.num - b.num);
const nums = questions.map((q) => q.num);
let missing = [];
for (let i = nums[0]; i <= nums[nums.length - 1]; i++) {
  if (!nums.includes(i)) missing.push(i);
}

// 题型判定
function detectType(q) {
  const ans = q.answer || '';
  if (ans.length > 1 && /^[A-H]+$/.test(ans)) return 'multiple';
  const low = q.options.map((o) => o.trim());
  if (
    low.length === 2 &&
    low.every((o) => o.includes('正确') || o.includes('错误') || o.includes('对') || o.includes('错'))
  ) {
    return 'judge';
  }
  return 'single';
}

const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const created = `${now.getFullYear()}/${pad(now.getMonth() + 1)}/${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

// 从解析文本推断判断题答案（兜底：部分 Word 题库答案录为“略”，但解析含结论）
function inferJudgeAnswer(analysis) {
  if (!analysis) return null;
  const text = String(analysis);
  if (/该说法错误|该题错误|此说法错误|这种说法错误|是不正确的|是错误的|不正确|不对|不成立|有误|该说法不/.test(text)) return '错误';
  if (/该说法正确|该题正确|此说法正确|这种说法正确|是正确的|是对的|该说法对|正确|对/.test(text)) return '正确';
  return null;
}

function isPlaceholderAnswer(ans) {
  if (!ans) return true;
  const t = String(ans).trim();
  return t === '' || t === '略' || t === '无';
}

function normalizeAnswer(q, type) {
  let answer = q.answer || '';
  if (type === 'multiple' && /^[A-H]+$/.test(answer)) {
    // 前端 parseAnswerToLetters 需要分隔符，否则 "ABCD" 无法解析
    return answer.split('').join(',');
  }
  if (type === 'judge' && /^[A-H]$/.test(answer)) {
    // 判断题前端按「正确/错误」文本判分，转成对应选项文本
    const idx = answer.charCodeAt(0) - 65;
    return q.options[idx] || answer;
  }
  // 判断题答案为占位符时，尝试从解析推断
  if (type === 'judge' && isPlaceholderAnswer(answer)) {
    const inferred = inferJudgeAnswer(q.analysis?.join('\n'));
    if (inferred) return inferred;
  }
  return answer;
}

const bank = {
  id: `bank_lianxi_${Date.now()}`,
  name: '数字化管理师练习题（张杰）',
  type: 'theory',
  createdAt: created,
  questionCount: questions.length,
  questions: questions.map((q, i) => ({
    id: `lx_${Date.now()}_${i}`,
    type: detectType(q),
    level: '三级',
    outlineCode: '00',
    outlineName: '综合练习',
    content: q.content,
    options: q.options,
    answer: normalizeAnswer(q, detectType(q)),
    analysis: q.analysis.join('\n').trim() || undefined,
    difficulty: 'medium',
    source: '练习题资料(1).doc',
    status: 'approved',
  })),
};

fs.writeFileSync(OUT, JSON.stringify(bank, null, 2), 'utf8');

// 统计报告
console.log('================ 解析报告 ================');
console.log('题号范围: ' + nums[0] + ' ~ ' + nums[nums.length - 1] + '，题数: ' + questions.length);
console.log('缺失题号: ' + (missing.length ? missing.join(', ') : '无'));
console.log('跳过题: ' + (skippedList.length ? skippedList.map((s) => `#${s.num}(${s.reason})`).join(' ') : '无'));
console.log('多选: ' + questions.filter((q) => detectType(q) === 'multiple').length);
console.log('判断: ' + questions.filter((q) => detectType(q) === 'judge').length);
console.log('单选: ' + questions.filter((q) => detectType(q) === 'single').length);
const bad = questions.filter((q) => {
  const type = detectType(q);
  const ans = q.answer || '';
  if (type === 'judge') return !ans || !/(正确|错误|对|错)/.test(ans);
  return !ans || !/^[A-H,，、]+$/.test(ans);
});
if (bad.length) {
  console.log('--- 异常题目（无答案或答案格式不对）---');
  bad.forEach((q) => console.log(`#${q.num}: ${q.content.slice(0, 40)} | 类型=${detectType(q)} | 答案=${q.answer} | 选项数=${q.options.length}`));
}
console.log('输出: ' + OUT);
