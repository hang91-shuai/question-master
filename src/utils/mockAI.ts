import type { OutlineItem, Question, QuestionType, QuestionBank } from '../types';

// 简单自增 id
let idCounter = 0;
const genId = () => `id_${Date.now()}_${++idCounter}`;

const THEORY_TYPES: QuestionType[] = ['single', 'multiple', 'judge', 'short', 'essay', 'blank'];
const SKILL_TYPES: QuestionType[] = ['case', 'calc', 'single', 'judge'];

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

export function generateQuestions(
  outlineItems: OutlineItem[],
  type: 'theory' | 'skill',
  total: number,
  level: string,
  useAI: boolean
): Question[] {
  const questions: Question[] = [];
  const types = type === 'theory' ? THEORY_TYPES : SKILL_TYPES;
  const templates = type === 'theory' ? theoryTemplates : { ...theoryTemplates, ...skillTemplates };

  for (let i = 0; i < total; i++) {
    const outline = outlineItems[i % outlineItems.length];
    const qType = randomPick(types);
    const templateList = templates[qType] || theoryTemplates[qType] || ['请回答关于{name}的问题。'];
    const content = fillTemplate(randomPick(templateList), outline.name);
    const options = qType === 'single' || qType === 'multiple' ? randomPick(optionsPool) : undefined;
    const answer = qType === 'judge' ? (Math.random() > 0.5 ? '正确' : '错误') : '略';

    questions.push({
      id: genId(),
      type: qType,
      level,
      outlineCode: outline.code,
      outlineName: outline.name,
      content,
      options,
      answer,
      analysis: useAI ? `基于${outline.name}和${outline.code}考评点生成。` : '无',
      difficulty: randomPick(['easy', 'medium', 'hard']),
      source: useAI ? 'AI 大模型生成' : '本地规则生成',
      status: 'pending',
    });
  }

  return questions;
}

export function createQuestionBank(
  name: string,
  type: 'theory' | 'skill',
  outlineItems: OutlineItem[],
  total: number,
  level: string,
  useAI: boolean
): QuestionBank {
  const questions = generateQuestions(outlineItems, type, total, level, useAI);
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
