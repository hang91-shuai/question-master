import type { OutlineItem, Question, QuestionType, TypeConfig } from '../types';
import { cleanQuestion, isQuestionCorrupt } from '../utils/questionCleaner';

const BASE_URL = import.meta.env.VITE_AI_API_BASE_URL || '';
const API_KEY = import.meta.env.VITE_AI_API_KEY || '';

const MODEL_MAP: Record<string, string> = {
  deepseek: 'deepseek-chat',
  qwen: 'qwen-max',
  gpt4: 'gpt-4',
};

export function isAIConfigured(): boolean {
  return Boolean(BASE_URL && API_KEY);
}

const MAX_MATERIAL_LENGTH = 4000;

export function buildPrompt(
  outlineItems: OutlineItem[],
  bankType: 'theory' | 'skill',
  level: string,
  typeConfigs: TypeConfig[],
  existingQuestions?: Array<{ content: string; outlineName?: string; type?: string }>,
  materialText?: string
): string {
  const typeLabels: Record<QuestionType, string> = {
    single: '单选',
    multiple: '多选',
    judge: '判断',
    short: '简答',
    essay: '论述',
    case: '案例分析',
    calc: '计算',
    blank: '填空',
    ethics: '职业道德',
  };

  const outlineText = outlineItems
    .map((o) => `- ${o.code} ${o.name}：${o.points.join('；')}`)
    .join('\n');

  const scopeNote = outlineItems.length > 0
    ? `【本次出题范围】\n本次仅围绕上面列出的 ${outlineItems.length} 个知识点出题。\n每道题的 outlineCode / outlineName 必须取自上述大纲中的某一项；禁止超出本范围编写考点，禁止臆造未列出的大纲内容。\n题目应尽量均匀覆盖本范围内各知识点。\n`
    : '';

  const configText = typeConfigs
    .filter((c) => c.count > 0)
    .map((c) => `- ${typeLabels[c.type]}：${c.count}道，难度${c.difficulty}，分值${c.score}`)
    .join('\n');

  // 去重清单：把已有题目压缩成"知识点 + 题干"单行，避免重复出题
  const dedupText = existingQuestions && existingQuestions.length > 0
    ? existingQuestions
        .map((q) => {
          const tag = q.outlineName ? `【${q.outlineName}】` : '';
          const head = q.content.replace(/\s+/g, ' ').slice(0, 30);
          return `- ${tag}${head}`;
        })
        .join('\n')
    : '';

  const dedupSection = dedupText
    ? `\n【已出题目·必须避开以下已有题目，不得重复或近似出题】
${dedupText}
`
    : '';

  const trimmedMaterial = materialText && materialText.trim().length > 0
    ? materialText.trim().slice(0, MAX_MATERIAL_LENGTH)
    : '';

  const materialSection = trimmedMaterial
    ? `\n【教材原文参考·请严格依据以下内容出题，不要超纲】\n${trimmedMaterial}${materialText!.length > MAX_MATERIAL_LENGTH ? '\n（教材内容较长，以上为前段参考）' : ''}\n`
    : '\n【教材依据】\n依据职业技能等级认定指定教材出题，严格依托教材原文，不超纲、不臆造。\n';

  return `你是一位职业技能鉴定命题专家。请严格根据以下要求生成规范的职业技能等级认定题库题目。

【题库类型】${bankType === 'theory' ? '理论题库' : '技能题库'}
【技能等级】${level}

【职业功能大纲】
${outlineText}
${scopeNote}${materialSection}${dedupSection}
【题型配置】只生成以下题型，且严格按照数量生成：
${configText}

【要求】
1. 每道题必须是如下 JSON 对象：
{
  "type": "single/multiple/judge 之一",
  "content": "题干",
  "options": ["第一个选项内容", "第二个选项内容", "第三个选项内容", "第四个选项内容"],
  "answer": "正确答案",
  "analysis": "解析（50字以上，须说明正确项为何正确、错误项为何错误）",
  "outlineCode": "对应大纲编号，如01",
  "outlineName": "对应大纲名称，如数字化组织管理",
  "source": "教材出处，如《基础知识》P20"
}
2. 单选必须有 4 个选项；多选必须有 4-6 个选项；判断题答案只能为"正确"或"错误"，选项固定为"正确、错误"，不得使用"对/错"。答案只用字母，如单选"A"，多选"A、B、C"。
3. options 数组中的每个元素必须是选项正文本身，禁止带 A./B./C./D. 等前缀，前端会自动渲染 A/B/C/D 字母。例如正确写法："options": ["提高工作效率", "降低成本", "保证安全", "提升质量"]，错误写法："options": ["A. 提高工作效率", "B. 降低成本", ...]。
4. 题目必须严格贴合上述大纲中已列出的知识点，不能超出本次范围、不能泛泛而谈。
5. 严格依托教材原文，不超纲、不臆造。
6. 答案解析不得敷衍，须有实质内容。
7. 本批次内所有题目必须互不重复：任何两道题的题干不得相同或高度相似；同一知识点不得重复考查同一考点。若需围绕同一知识点出多道题，必须从不同角度、不同场景或不同难度编写，且题干表述必须有明显区别。
8. 所有文本字段（content、options、analysis、source）必须使用标准 UTF-8 中文字符，严禁出现乱码符号 \uFFFD、Emoji 或不可见控制字符。题干中尽量使用常见职业技能术语，避免使用生僻字。
9. 直接返回一个 JSON 数组，不要 Markdown 代码块，不要任何解释说明。
`;
}

export async function generateQuestionsByAI(
  outlineItems: OutlineItem[],
  bankType: 'theory' | 'skill',
  level: string,
  modelKey: string,
  typeConfigs: TypeConfig[],
  existingQuestions?: Array<{ content: string; outlineName?: string; type?: string }>,
  materialText?: string
): Promise<Question[]> {
  if (!isAIConfigured()) {
    throw new Error('AI API 未配置，请在 .env.local 中设置 VITE_AI_API_BASE_URL 和 VITE_AI_API_KEY');
  }

  const model = MODEL_MAP[modelKey] || modelKey;
  const prompt = buildPrompt(outlineItems, bankType, level, typeConfigs, existingQuestions, materialText);

  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: '你是一个专业的职业技能鉴定命题助手，只输出 JSON 数组。' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`AI API 请求失败 (${res.status})：${text}`);
  }

  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content || '';

  // 尝试提取 JSON 数组
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  const jsonStr = jsonMatch ? jsonMatch[0] : raw;

  let parsed: any[];
  try {
    parsed = JSON.parse(jsonStr);
  } catch (e) {
    throw new Error('AI 返回内容无法解析为 JSON 数组，请检查模型输出格式');
  }

  if (!Array.isArray(parsed)) {
    throw new Error('AI 返回的不是 JSON 数组');
  }

  // 运行时兜底去重：剔除本批次内题干完全相同的重复题（AI 偶发偷懒时保证不重复入库）
  const seen = new Set<string>();
  const uniqueItems = parsed.filter((item) => {
    const key = String(item.content || '').trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const cleaned = uniqueItems.map((item, index) =>
    cleanQuestion({
      id: `ai_${Date.now()}_${index}`,
      type: item.type || 'single',
      level,
      outlineCode: item.outlineCode || outlineItems[0]?.code || '',
      outlineName: item.outlineName || outlineItems[0]?.name || '',
      content: item.content || '',
      options: Array.isArray(item.options) ? item.options : undefined,
      answer: item.answer ?? '略',
      analysis: item.analysis || '无',
      difficulty: ['easy', 'medium', 'hard'].includes(item.difficulty)
        ? item.difficulty
        : 'medium',
      source: item.source || `AI 大模型生成 (${modelKey})`,
      status: 'pending',
    } as Question)
  );

  // 过滤掉 AI 返回中仍带有乱码替换字符（\uFFFD）的题目，避免前端显示"??"
  const valid = cleaned.filter((q) => !isQuestionCorrupt(q));
  if (valid.length === 0 && cleaned.length > 0) {
    throw new Error('AI 返回的题目全部包含乱码字符（\\uFFFD），请稍后重试或检查 AI 输出编码');
  }
  return valid;
}
