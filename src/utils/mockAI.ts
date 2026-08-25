import type { OutlineItem, Question, QuestionType, QuestionBank, TypeConfig } from '../types';
import { generateQuestionsByAI, isAIConfigured } from '../services/aiApi';

let idCounter = 0;
const genId = () => `id_${Date.now()}_${++idCounter}`;

const theoryTemplates: Record<string, string[]> = {
  single: [
    '以下关于{name}的说法，正确的是？',
    '在{name}过程中，首要原则是？',
    '{name}的核心目标不包括以下哪项？',
  ],
  multiple: [
    '关于{name}，以下说法正确的有？',
    '在{name}中，需要重点关注哪些方面？',
  ],
  judge: [
    '{name}是职业活动中的必要环节。',
    '在{name}中，操作顺序可以任意调整。',
  ],
  short: [
    '简述{name}的基本流程。',
    '说明{name}的主要注意事项。',
  ],
  essay: [
    '结合工作实际，论述{name}的重要性及实施要点。',
    '请阐述{name}对提升工作质量的意义。',
  ],
  blank: [
    '{name}的关键要素包括______、______和______。',
    '在进行{name}时，应首先检查______。',
  ],
};

const skillTemplates: Record<string, string[]> = {
  case: [
    '某工作场景中出现{name}相关任务，请分析操作步骤并提出解决方案。',
    '针对{name}任务，设计一个完整的操作方案。',
  ],
  calc: [
    '根据{name}相关参数，计算所需结果并说明依据。',
    '在{name}任务中，若已知条件为 A=10，B=20，请计算结果。',
  ],
};

const optionsPool = [
  ['提高工作效率', '降低成本', '保证安全', '提升质量'],
  ['先检查后操作', '按规程执行', '及时记录', '随意处置'],
  ['规范流程', '强化培训', '监督管理', '忽视细节'],
];

/**
 * 将用户手动粘贴的"整本知识点清单"解析为标准大纲结构。
 * 支持格式（每行一个知识点主题）：
 *   01 数字化管理概述：数字化转型定义；数字经济发展背景；管理变革趋势
 *   02 数字化组织管理：组织架构设计；组织机制；人员数字化管理
 * 也支持不带编号：数字化管理概述：考点1；考点2
 * 以及不带冒号考点：仅一个主题名
 */
export function parseOutlineList(text: string): OutlineItem[] {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const items: OutlineItem[] = [];
  let fallback = 1;

  for (const line of lines) {
    // 去掉行首编号，如 "01 "、"1."、"01、"
    let content = line.replace(/^\s*\d+[\.、:：)）]?\s*/, '').trim();
    if (!content) continue;

    // 拆出主题名与考点（以中英文冒号或分号分隔）
    const sepIndex = content.search(/[:：;；]/);
    let name = content;
    let points: string[] = [];

    if (sepIndex !== -1) {
      name = content.slice(0, sepIndex).trim();
      const rest = content.slice(sepIndex + 1).trim();
      points = rest
        .split(/[;；]/)
        .map((p) => p.trim())
        .filter((p) => p.length > 0);
    }

    if (!name) continue;
    const weight = Math.max(1, Math.round(100 / Math.max(items.length + 1, 1)));
    items.push({
      id: genId(),
      code: `X.${String(fallback++).padStart(2, '0')}`,
      name: name.slice(0, 40),
      level: '五级',
      weight,
      points: points.length > 0 ? points : [`掌握${name}基本原理`, `能够完成${name}基础操作`],
    });
  }

  return items;
}

export function generateOutlineFromText(text: string): OutlineItem[] {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 3);

  const items: OutlineItem[] = [];
  let code = 1;

  for (let i = 0; i < Math.min(lines.length, 8); i++) {
    const name = lines[i].slice(0, 30).replace(/[:：]/g, '');
    if (!name) continue;
    items.push({
      id: genId(),
      code: `X.${code}`,
      name,
      level: '五级',
      weight: Math.round((1 / Math.min(lines.length, 8)) * 100),
      points: [`掌握${name}基本原理`, `能够完成${name}基础操作`],
    });
    code++;
  }

  if (items.length === 0) {
    items.push(
      { id: genId(), code: 'X.1', name: '职业道德与规范', level: '五级', weight: 20, points: ['了解职业守则', '遵守行业规范'] },
      { id: genId(), code: 'X.2', name: '基础知识', level: '五级', weight: 20, points: ['掌握基础理论', '熟悉相关标准'] },
      { id: genId(), code: 'X.3', name: '核心操作技能', level: '五级', weight: 40, points: ['熟练操作流程', '具备问题分析能力'] },
      { id: genId(), code: 'X.4', name: '安全与质量管理', level: '五级', weight: 20, points: ['掌握安全规范', '具备质量意识'] }
    );
  }

  return items;
}

function fillTemplate(template: string, name: string) {
  return template.replace(/{name}/g, name);
}

function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDifficulty(coefficient: number): 'easy' | 'medium' | 'hard' {
  if (coefficient <= 0.4) return 'easy';
  if (coefficient >= 0.7) return 'hard';
  return 'medium';
}

function generateLocalQuestion(
  outline: OutlineItem,
  qType: QuestionType,
  level: string,
  difficulty: number
): Question {
  const templates = { ...theoryTemplates, ...skillTemplates };
  const templateList = templates[qType] || theoryTemplates[qType] || ['请回答关于{name}的问题。'];
  const content = fillTemplate(randomPick(templateList), outline.name);
  const options = qType === 'single' || qType === 'multiple' ? randomPick(optionsPool) : undefined;
  const answer = qType === 'judge' ? (Math.random() > 0.5 ? '正确' : '错误') : '略';

  return {
    id: genId(),
    type: qType,
    level,
    outlineCode: outline.code,
    outlineName: outline.name,
    content,
    options,
    answer,
    analysis: `基于${outline.name}（${outline.code}）考评点生成本地示例题。`,
    difficulty: randomDifficulty(difficulty),
    source: '本地规则生成',
    status: 'pending',
  };
}

export async function generateQuestions(
  outlineItems: OutlineItem[],
  type: 'theory' | 'skill',
  level: string,
  useAI: boolean,
  typeConfigs: TypeConfig[],
  modelKey: string = 'deepseek',
  existingQuestions?: Array<{ content: string; outlineName?: string; type?: string }>,
  materialText?: string
): Promise<Question[]> {
  const activeConfigs = typeConfigs.filter((c) => c.count > 0);

  if (activeConfigs.length === 0) {
    return [];
  }

  if (useAI) {
    if (!isAIConfigured()) {
      throw new Error('AI API 未配置，请在 .env.local 中设置 VITE_AI_API_BASE_URL 和 VITE_AI_API_KEY');
    }
    return generateQuestionsByAI(outlineItems, type, level, modelKey, activeConfigs, existingQuestions, materialText);
  }

  const questions: Question[] = [];
  let outlineIndex = 0;

  for (const config of activeConfigs) {
    for (let i = 0; i < config.count; i++) {
      const outline = outlineItems[outlineIndex % outlineItems.length];
      questions.push(generateLocalQuestion(outline, config.type, level, config.difficulty));
      outlineIndex++;
    }
  }

  return questions;
}

export async function createQuestionBank(
  name: string,
  type: 'theory' | 'skill',
  outlineItems: OutlineItem[],
  level: string,
  useAI: boolean,
  typeConfigs: TypeConfig[],
  modelKey: string = 'deepseek',
  existingQuestions?: Array<{ content: string; outlineName?: string; type?: string }>,
  materialText?: string
): Promise<QuestionBank> {
  const questions = await generateQuestions(outlineItems, type, level, useAI, typeConfigs, modelKey, existingQuestions, materialText);
  return {
    id: genId(),
    name,
    type,
    createdAt: new Date().toLocaleString(),
    questionCount: questions.length,
    questions,
  };
}

export function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
