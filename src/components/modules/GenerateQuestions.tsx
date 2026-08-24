import { useState } from 'react';
import { Card, Radio, Button, InputNumber, Select, message, Table, Tag, Progress, Empty, Divider } from 'antd';
import { ThunderboltOutlined, FileTextOutlined } from '@ant-design/icons';
import { useAppStore } from '../../store/useAppStore';
import { createQuestionBank } from '../../utils/mockAI';
import type { QuestionType } from '../../types';
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

export function GenerateQuestions() {
  const { outlineItems, questionBanks, addQuestionBank, setCurrentStep } = useAppStore();

  const [bankType, setBankType] = useState<'theory' | 'skill'>('theory');
  const [dataSource, setDataSource] = useState<'standard' | 'ai'>('standard');
  const [aiModel, setAiModel] = useState('deepseek');
  const [level, setLevel] = useState('五级');
  const [quantity, setQuantity] = useState(50);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleGenerate = () => {
    if (outlineItems.length === 0) {
      message.warning('请先在「导入标准」步骤中解析职业功能大纲');
      return;
    }
    setGenerating(true);
    setProgress(0);
    const timer = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(timer);
          const useAI = dataSource === 'ai';
          const bank = createQuestionBank(
            `${bankType === 'theory' ? '理论' : '技能'}题库·${level}`,
            bankType,
            outlineItems,
            quantity,
            level,
            useAI
          );
          addQuestionBank(bank);
          message.success(`已生成「${bank.name}」，共 ${bank.questionCount} 道题`);
          setGenerating(false);
          return 100;
        }
        return p + 8;
      });
    }, 100);
  };

  const typeConfigColumns = [
    { title: '题型', dataIndex: 'type', key: 'type', width: 120, render: (t: QuestionType) => typeLabels[t] || t },
    { title: '难度系数', dataIndex: 'diff', key: 'diff', width: 160, render: () => <InputNumber min={0.3} max={0.9} step={0.1} defaultValue={0.5} style={{ width: 110 }} size="small" /> },
    { title: '单题分值', dataIndex: 'score', key: 'score', width: 140, render: () => <InputNumber min={1} max={10} defaultValue={2} style={{ width: 100 }} size="small" /> },
    { title: '题量', dataIndex: 'count', key: 'count', width: 130, render: () => <InputNumber min={0} max={100} defaultValue={10} style={{ width: 90 }} size="small" /> },
    { title: '命题比例', dataIndex: 'ratio', key: 'ratio', width: 160, render: () => <InputNumber min={0} max={100} defaultValue={30} addonAfter="%" style={{ width: 130 }} size="small" /> },
  ];

  const typeRows = (bankType === 'theory' ? ['single', 'multiple', 'judge', 'short', 'essay', 'blank'] : ['case', 'calc', 'single', 'judge']).map((t) => ({
    type: t,
  }));

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
                <Select value={aiModel} onChange={setAiModel} style={{ width: 260 }} options={[
                  { value: 'deepseek', label: 'DeepSeek（推荐）' },
                  { value: 'qwen', label: '通义千问' },
                  { value: 'gpt4', label: 'GPT-4' },
                ]} />
              </div>
            )}

            <div>
              <div className="text-sm font-medium text-gray-700 mb-2">技能等级</div>
              <Select value={level} onChange={setLevel} style={{ width: 200 }} options={levels.map((l) => ({ value: l, label: l }))} />
            </div>

            <div>
              <div className="text-sm font-medium text-gray-700 mb-2">生成题量</div>
              <InputNumber min={1} max={500} value={quantity} onChange={(v) => setQuantity(v || 10)} style={{ width: 200 }} addonAfter="道" />
            </div>

            <Button type="primary" size="large" icon={<ThunderboltOutlined />} loading={generating} onClick={handleGenerate} block>
              {generating ? `正在生成 ${progress}%` : `开始生成${bankType === 'theory' ? '理论' : '技能'}题库`}
            </Button>
            {generating && <Progress percent={progress} status="active" />}
          </div>

          <div>
            <div className="text-sm font-medium text-gray-700 mb-2">题型配置</div>
            <Table size="small" rowKey="type" columns={typeConfigColumns} dataSource={typeRows} pagination={false} />
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
