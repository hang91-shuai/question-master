import type { OutlineItem, Question, QuestionType, TypeConfig } from '../types';

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

export function buildPrompt(
  outlineItems: OutlineItem[],
  bankType: 'theory' | 'skill',
  level: string,
  typeConfigs: TypeConfig[]
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

  const configText = typeConfigs
    .filter((c) => c.count > 0)
    .map((c) => `- ${typeLabels[c.type]}：${c.count}道，难度${c.difficulty}，分值${c.score}`)
    .join('\n');

  return `你是一位职业技能鉴定命题专家。请严格根据以下要求生成规范的职业技能等级认定题库题目。

【题库类型】${bankType === 'theory' ? '理论题库' : '技能题库'}
【技能等级】${level}

【职业功能大纲】
${outlineText}

【题型配置】只生成以下题型，且严格按照数量生成：
${configText}

【要求】
1. 每道题必须是如下 JSON 对象：
{
  "type": "single/multiple/judge/short/essay/blank/case/calc 之一",
  "content": "题干",
  "options": ["选项A", "选项B", "选项C", "选项D"],
  "answer": "正确答案",
  "analysis": "解析",
  "outlineCode": "对应大纲编号",
  "outlineName": "对应大纲名称"
}
2. 单选必须有 4 个选项；多选必须有 4-6 个选项，答案用顿号分隔多个选项字母；判断题答案为"正确"或"错误"。
3. 简答、论述、案例分析、计算题答案应具体、可操作，不要只写"略"。
4. 填空题 content 中用"______"表示填空位置，answer 为完整答案或关键答案。
5. 题目必须贴合大纲中的具体职业功能，不能泛泛而谈。
6. 直接返回一个 JSON 数组，不要 Markdown 代码块，不要任何解释说明。
`;
}

export async function generateQuestionsByAI(
  outlineItems: OutlineItem[],
  bankType: 'theory' | 'skill',
  level: string,
  modelKey: string,
  typeConfigs: TypeConfig[]
): Promise<Question[]> {
  if (!isAIConfigured()) {
    throw new Error('AI API 未配置，请在 .env.local 中设置 VITE_AI_API_BASE_URL 和 VITE_AI_API_KEY');
  }

  const model = MODEL_MAP[modelKey] || modelKey;
  const prompt = buildPrompt(outlineItems, bankType, level, typeConfigs);

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

  return parsed.map((item, index) => ({
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
    source: `AI 大模型生成 (${modelKey})`,
    status: 'pending',
  })) as Question[];
}
