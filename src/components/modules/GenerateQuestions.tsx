import { useState, useEffect, useMemo } from 'react';
import { Card, Radio, Button, InputNumber, Select, message, Table, Tag, Progress, Empty, Divider, Input } from 'antd';
import { ThunderboltOutlined, FileTextOutlined } from '@ant-design/icons';
import { useAppStore } from '../../store/useAppStore';
import { createQuestionBank } from '../../utils/mockAI';
import { isAIConfigured } from '../../services/aiApi';
import type { QuestionType, TypeConfig } from '../../types';
import { Sparkles, HardDrive } from 'lucide-react';

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

const levels = ['五级', '四级', '三级', '二级', '一级'];

/** 预设题型模板：按题库类型提供一键套用的题量配置 */
const presetTemplates: Record<
  'theory' | 'skill',
  { key: string; label: string; desc: string; counts: Partial<Record<QuestionType, number>> }[]
> = {
  theory: [
    { key: 'standard', label: '初级认证·标准', desc: '单选192 + 多选64 + 判断64（共320题）', counts: { single: 192, multiple: 64, judge: 64 } },
    { key: 'lite', label: '初级认证·精简', desc: '单选96 + 多选32 + 判断32（共160题）', counts: { single: 96, multiple: 32, judge: 32 } },
    { key: 'demo', label: '入门体验', desc: '单选10 + 判断10（共20题）', counts: { single: 10, judge: 10 } },
  ],
  skill: [
    { key: 'standard', label: '案例技能·标准', desc: '案例10 + 计算5 + 单选20 + 判断10（共45题）', counts: { case: 10, calc: 5, single: 20, judge: 10 } },
    { key: 'demo', label: '入门体验', desc: '案例2 + 单选5 + 判断3（共10题）', counts: { case: 2, single: 5, judge: 3 } },
  ],
};

function buildConfigs(bankType: 'theory' | 'skill', counts: Partial<Record<QuestionType, number>>): TypeConfig[] {
  const types = bankType === 'theory'
    ? (['single', 'multiple', 'judge', 'short', 'essay', 'blank'] as QuestionType[])
    : (['case', 'calc', 'single', 'judge'] as QuestionType[]);
  return types.map((t) => ({
    type: t,
    count: counts[t] ?? 0,
    score: 2,
    difficulty: 0.5,
    ratio: counts[t] ? 30 : 0,
  }));
}

export function GenerateQuestions() {
  const { outlineItems, materialFiles, questionBanks, addQuestionBank, setCurrentStep } = useAppStore();

  const [bankType, setBankType] = useState<'theory' | 'skill'>('theory');
  const [dataSource, setDataSource] = useState<'standard' | 'ai'>('standard');
  const [aiModel, setAiModel] = useState('deepseek');
  const [level, setLevel] = useState('五级');
  const [bankName, setBankName] = useState('');
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);

  const defaultTheoryTypes: QuestionType[] = ['single', 'multiple', 'judge', 'short', 'essay', 'blank'];
  const defaultSkillTypes: QuestionType[] = ['case', 'calc', 'single', 'judge'];

  const initialConfigs = (bankType === 'theory' ? defaultTheoryTypes : defaultSkillTypes).map<TypeConfig>((t) => ({
    type: t,
    count: t === 'single' || t === 'multiple' || t === 'judge' ? 10 : 0,
    score: 2,
    difficulty: 0.5,
    ratio: t === 'single' || t === 'multiple' || t === 'judge' ? 30 : 0,
  }));

  const [typeConfigs, setTypeConfigs] = useState<TypeConfig[]>(initialConfigs);
  const [presetKey, setPresetKey] = useState<string>('standard');

  const applyTemplate = (key: string) => {
    setPresetKey(key);
    const template = presetTemplates[bankType].find((t) => t.key === key);
    if (!template) return;
    setTypeConfigs(buildConfigs(bankType, template.counts));
    message.success(`已套用模板「${template.label}」`);
  };

  const totalCount = useMemo(
    () => typeConfigs.reduce((sum, c) => sum + (c.count || 0), 0),
    [typeConfigs]
  );

  useEffect(() => {
    // 切换题库类型时，套用当前预设模板（若该类型下不存在该 key，则回退到第一个模板）
    const templates = presetTemplates[bankType];
    const matched = templates.find((t) => t.key === presetKey) || templates[0];
    setPresetKey(matched.key);
    setTypeConfigs(buildConfigs(bankType, matched.counts));
  }, [bankType]);

  const updateTypeConfig = (type: QuestionType, key: keyof TypeConfig, value: number) => {
    setTypeConfigs((prev) =>
      prev.map((c) => (c.type === type ? { ...c, [key]: value } : c))
    );
  };

  const handleGenerate = async () => {
    if (outlineItems.length === 0) {
      message.warning('请先在「导入标准」步骤中解析职业功能大纲');
      return;
    }

    const activeConfigs = typeConfigs.filter((c) => c.count > 0);
    if (activeConfigs.length === 0) {
      message.warning('请至少配置一种题型的题量大于 0');
      return;
    }

    if (dataSource === 'ai' && !isAIConfigured()) {
      message.error('使用 AI 生成需先配置 API：请在项目根目录 .env.local 中设置 VITE_AI_API_BASE_URL 和 VITE_AI_API_KEY');
      return;
    }

    const name = bankName.trim() || `${bankType === 'theory' ? '理论' : '技能'}题库·${level}`;

    setGenerating(true);
    setProgress(0);

    const progressTimer = setInterval(() => {
      setProgress((p) => (p >= 90 ? 90 : p + Math.floor(Math.random() * 10) + 5));
    }, 300);

    try {
      const useAI = dataSource === 'ai';
      // 收集已有题目，供 AI 生成时避开重复考点
      const existing = questionBanks.flatMap((b) => b.questions).slice(-300).map((q) => ({
        content: q.content,
        outlineName: q.outlineName,
        type: q.type,
      }));
      // 收集已解析的教材 / 资料内容，作为 AI 出题的参考依据
      const materialText = materialFiles
        .filter((f) => f.status === 'done' && f.content)
        .map((f) => `【${f.name}】\n${f.content}`)
        .join('\n\n');
      const bank = await createQuestionBank(name, bankType, outlineItems, level, useAI, typeConfigs, aiModel, existing, materialText);
      addQuestionBank(bank);
      clearInterval(progressTimer);
      setProgress(100);
      message.success(`已生成「${bank.name}」，共 ${bank.questionCount} 道题`);
    } catch (err: any) {
      clearInterval(progressTimer);
      message.error(err.message || '生成失败，请检查配置后重试');
    } finally {
      setGenerating(false);
    }
  };

  const typeConfigColumns = [
    { title: '题型', dataIndex: 'type', key: 'type', width: 120, render: (t: QuestionType) => typeLabels[t] || t },
    {
      title: '难度系数',
      dataIndex: 'difficulty',
      key: 'difficulty',
      width: 160,
      render: (_: unknown, record: TypeConfig) => (
        <InputNumber
          min={0.3}
          max={0.9}
          step={0.1}
          value={record.difficulty}
          style={{ width: 110 }}
          size="small"
          onChange={(v) => updateTypeConfig(record.type, 'difficulty', v ?? 0.5)}
        />
      ),
    },
    {
      title: '单题分值',
      dataIndex: 'score',
      key: 'score',
      width: 140,
      render: (_: unknown, record: TypeConfig) => (
        <InputNumber
          min={1}
          max={10}
          value={record.score}
          style={{ width: 100 }}
          size="small"
          onChange={(v) => updateTypeConfig(record.type, 'score', v ?? 2)}
        />
      ),
    },
    {
      title: '题量',
      dataIndex: 'count',
      key: 'count',
      width: 130,
      render: (_: unknown, record: TypeConfig) => (
        <InputNumber
          min={0}
          max={100}
          value={record.count}
          style={{ width: 90 }}
          size="small"
          onChange={(v) => updateTypeConfig(record.type, 'count', v ?? 0)}
        />
      ),
    },
    {
      title: '命题比例',
      dataIndex: 'ratio',
      key: 'ratio',
      width: 160,
      render: (_: unknown, record: TypeConfig) => (
        <InputNumber
          min={0}
          max={100}
          value={record.ratio}
          addonAfter="%"
          style={{ width: 130 }}
          size="small"
          onChange={(v) => updateTypeConfig(record.type, 'ratio', v ?? 0)}
        />
      ),
    },
  ];

  const recentBanks = questionBanks.slice(-5).reverse();

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-5 h-5 text-blue-500" />
          <h2 className="text-lg font-bold m-0">二、生成题库</h2>
        </div>
        <div className="text-gray-500 text-sm mb-4">选择数据源并配置出题参数，AI 将基于大纲自动生成规范化题目。</div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <div className="text-sm font-medium text-gray-700 mb-2">题库类型</div>
              <Radio.Group value={bankType} onChange={(e) => setBankType(e.target.value)} optionType="button" buttonStyle="solid">
                <Radio.Button value="theory">理论题库</Radio.Button>
                <Radio.Button value="skill">技能题库</Radio.Button>
              </Radio.Group>
            </div>

            <div>
              <div className="text-sm font-medium text-gray-700 mb-2">数据来源</div>
              <Radio.Group value={dataSource} onChange={(e) => setDataSource(e.target.value)} optionType="button" buttonStyle="solid">
                <Radio.Button value="standard">
                  <HardDrive className="inline w-3.5 h-3.5 mr-1" />国家标准解析
                </Radio.Button>
                <Radio.Button value="ai">
                  <Sparkles className="inline w-3.5 h-3.5 mr-1" />AI 大模型生成
                </Radio.Button>
              </Radio.Group>
            </div>

            {dataSource === 'ai' && (
              <div>
                <div className="text-sm font-medium text-gray-700 mb-2">选择 AI 模型</div>
                <Select value={aiModel} onChange={setAiModel} className="w-full max-w-[260px]" options={[
                  { value: 'deepseek', label: 'DeepSeek（推荐）' },
                  { value: 'qwen', label: '通义千问' },
                  { value: 'gpt4', label: 'GPT-4' },
                ]} />
              </div>
            )}

            <div>
              <div className="text-sm font-medium text-gray-700 mb-2">技能等级</div>
              <Select value={level} onChange={setLevel} className="w-full max-w-[200px]" options={levels.map((l) => ({ value: l, label: l }))} />
            </div>

            <div>
              <div className="text-sm font-medium text-gray-700 mb-2">题库名称</div>
              <Input
                placeholder="如：2026年五级茶艺师理论题库"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                style={{ width: '100%' }}
                maxLength={60}
                showCount
              />
            </div>

            <div>
              <div className="text-sm font-medium text-gray-700 mb-2">生成题量</div>
              <div className="text-2xl font-bold text-blue-600">
                {totalCount}<span className="text-sm font-normal text-gray-500 ml-1">道</span>
              </div>
              <div className="text-gray-400 text-xs mt-1">由下方题型配置自动汇总</div>
            </div>

            <Button type="primary" size="large" icon={<ThunderboltOutlined />} loading={generating} onClick={handleGenerate} block>
              {generating ? `正在生成 ${progress}%` : `开始生成${bankType === 'theory' ? '理论' : '技能'}题库`}
            </Button>
            {generating && <Progress percent={progress} status="active" />}
          </div>

          <div>
            <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
              <div className="text-sm font-medium text-gray-700">题型配置</div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">预设模板：</span>
                <Select
                  value={presetKey}
                  onChange={applyTemplate}
                  className="w-[180px]"
                  size="small"
                  options={presetTemplates[bankType].map((t) => ({ value: t.key, label: t.label }))}
                />
              </div>
            </div>
            <div className="mb-2 text-xs text-gray-400">
              {presetTemplates[bankType].find((t) => t.key === presetKey)?.desc}
            </div>
            <Table size="small" rowKey="type" columns={typeConfigColumns} dataSource={typeConfigs} pagination={false} scroll={{ x: 700 }} />
            <Divider />
            <Button icon={<FileTextOutlined />} onClick={() => setCurrentStep('review')} block>
              生成完成后前往「在线审核」
            </Button>
          </div>
        </div>
      </Card>

      <Card title="已生成的题库">
        {recentBanks.length === 0 ? (
          <Empty description="暂无生成的题库，配置参数后点击「开始生成」" />
        ) : (
          <Table
            rowKey="id"
            size="small"
            pagination={false}
            dataSource={recentBanks}
            scroll={{ x: 600 }}
            columns={[
              { title: '题库名称', dataIndex: 'name', key: 'name' },
              { title: '类型', dataIndex: 'type', key: 'type', width: 100, render: (t: string) => <Tag color={t === 'theory' ? 'blue' : 'purple'}>{t === 'theory' ? '理论' : '技能'}</Tag> },
              { title: '题量', dataIndex: 'questionCount', key: 'questionCount', width: 80 },
              { title: '生成时间', dataIndex: 'createdAt', key: 'createdAt', width: 170 },
            ]}
          />
        )}
      </Card>
    </div>
  );
}
