import { useState } from 'react';
import { Card, Select, Button, Table, Tag, message, InputNumber, Typography } from 'antd';
import { CalendarOutlined, DownloadOutlined, SaveOutlined } from '@ant-design/icons';
import { useAppStore } from '../../store/useAppStore';
import { exportToExcel } from '../../utils/fileParser';
import { v4 as uuid } from 'uuid';
import type { QuestionType, ExamPlanItem } from '../../types';

const { Paragraph } = Typography;

const typeLabels: Record<QuestionType, string> = {
  single: '单选题', multiple: '多选题', judge: '判断题', short: '简答题', essay: '论述题',
  case: '案例分析题', calc: '计算题', blank: '填空题', ethics: '职业道德题',
};

const scoreMap: Record<QuestionType, number> = {
  single: 1, multiple: 2, judge: 1, short: 5, essay: 10, case: 10, calc: 5, blank: 2, ethics: 2,
};

export function ExamPlan() {
  const { questionBanks, examPlans, addExamPlan } = useAppStore();
  const [level, setLevel] = useState('五级');
  const [planType, setPlanType] = useState<'theory' | 'skill'>('theory');
  const [counts, setCounts] = useState<Record<QuestionType, number>>({
    single: 20, multiple: 10, judge: 10, short: 4, essay: 2, case: 2, calc: 2, blank: 6, ethics: 3,
  });
  const [generated, setGenerated] = useState<ExamPlanItem | null>(null);
  const [totalScore, setTotalScore] = useState(100);

  const updateCount = (t: QuestionType, v: number | null) => {
    const next = { ...counts, [t]: v || 0 };
    setCounts(next);
    const score = Object.entries(next).reduce((acc, [type, cnt]) => acc + scoreMap[type as QuestionType] * cnt, 0);
    setTotalScore(score);
  };

  const handleGenerate = () => {
    const configs = { ...counts };
    const plan: ExamPlanItem = {
      id: uuid(),
      level,
      type: planType,
      createdAt: new Date().toLocaleString(),
      configs,
    };
    setGenerated(plan);
    message.success(`已生成${level}级${planType === 'theory' ? '理论' : '技能'}组卷计划书`);
  };

  const handleSave = () => {
    if (!generated) return;
    addExamPlan(generated);
    message.success('组卷计划书已保存到系统数据库');
  };

  const handleExport = () => {
    if (!generated) return;
    const rows: any[][] = [
      ['《组卷计划书》', `${generated.level}级 · ${generated.type === 'theory' ? '理论' : '技能'}`],
      [],
      ['序号', '题型', '题量', '单题分值', '小计'],
    ];
    (Object.entries(generated.configs) as [QuestionType, number][]).forEach(([t, cnt], i) => {
      if (cnt > 0) rows.push([i + 1, typeLabels[t], cnt, scoreMap[t], cnt * scoreMap[t]]);
    });
    rows.push([], ['合计', '', '', '', totalScore]);
    exportToExcel(rows, `组卷计划书_${generated.level}_${generated.type}.xlsx`);
    message.success('计划书已导出为 Excel');
  };

  const typeRows = (planType === 'theory'
    ? ['single', 'multiple', 'judge', 'short', 'essay', 'blank'] as QuestionType[]
    : ['case', 'calc', 'single', 'judge'] as QuestionType[]);

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex items-center gap-2 mb-1">
          <CalendarOutlined className="text-blue-500 text-lg" />
          <h2 className="text-lg font-bold m-0">六、组卷计划书</h2>
        </div>
        <div className="text-gray-500 text-sm mb-5">依据已审核题库，按级别自动生成理论 / 技能组卷计划书，支持导出 Excel 或保存到数据库。</div>

        <div className="flex flex-wrap gap-4 items-center mb-4">
          <div>
            <div className="text-sm text-gray-500 mb-1">技能等级</div>
            <Select value={level} onChange={setLevel} style={{ width: 140 }} options={['五级', '四级', '三级', '二级', '一级'].map((l) => ({ value: l, label: l }))} />
          </div>
          <div>
            <div className="text-sm text-gray-500 mb-1">计划书类型</div>
            <Select value={planType} onChange={(v) => setPlanType(v)} style={{ width: 140 }} options={[{ value: 'theory', label: '理论组卷' }, { value: 'skill', label: '技能组卷' }]} />
          </div>
        </div>

        <div className="mb-4 text-sm text-gray-600">
          题型配置（当前参考题库：<b>{questionBanks[questionBanks.length - 1]?.name || '暂无'}</b>）
        </div>
        <Table
          rowKey="type"
          size="small"
          pagination={false}
          dataSource={typeRows.map((t) => ({ type: t }))}
          columns={[
            { title: '题型', dataIndex: 'type', key: 'type', render: (t: QuestionType) => typeLabels[t] },
            { title: '单题分值', dataIndex: 'score', key: 'score', render: (_: any, r: any) => <Tag color="blue">{scoreMap[r.type as QuestionType]}</Tag> },
            {
              title: '题量',
              dataIndex: 'count', key: 'count',
              render: (_: any, r: any) => <InputNumber min={0} max={100} value={counts[r.type as QuestionType]} onChange={(v) => updateCount(r.type as QuestionType, v)} style={{ width: 90 }} />,
            },
            { title: '小计', key: 'subtotal', render: (_: any, r: any) => (counts[r.type as QuestionType] ?? 0) * (scoreMap[r.type as QuestionType] || 0) + ' 分' },
          ]}
        />
        <div className="mt-3 text-right text-base">
          卷面总分：<b className="text-blue-600 text-lg">{totalScore} 分</b>
        </div>

        <div className="mt-4 flex gap-3">
          <Button type="primary" icon={<CalendarOutlined />} onClick={handleGenerate}>生成计划书</Button>
          <Button icon={<SaveOutlined />} onClick={handleSave} disabled={!generated}>保存到数据库</Button>
          <Button icon={<DownloadOutlined />} onClick={handleExport} disabled={!generated}>导出 Excel</Button>
        </div>
      </Card>

      {generated && (
        <Card title={`${generated.level}级${generated.type === 'theory' ? '理论' : '技能'}组卷计划书`}>
          <Paragraph type="secondary">生成时间：{generated.createdAt} · 卷面总分 {totalScore} 分</Paragraph>
          <Table
            rowKey="type"
            size="small"
            pagination={false}
            dataSource={Object.entries(generated.configs).filter(([, c]) => c > 0).map(([t]) => ({ type: t as QuestionType }))}
            columns={[
              { title: '题型', dataIndex: 'type', render: (t: QuestionType) => typeLabels[t] },
              { title: '题量', dataIndex: 'type', render: (t: QuestionType) => generated.configs[t] },
              { title: '分值', dataIndex: 'type', render: (t: QuestionType) => scoreMap[t] },
              { title: '小计', dataIndex: 'type', render: (t: QuestionType) => generated.configs[t] * scoreMap[t] },
            ]}
          />
        </Card>
      )}

      {examPlans.length > 0 && (
        <Card title="已保存的计划书">
          <Table
            rowKey="id"
            size="small"
            pagination={false}
            dataSource={examPlans}
            columns={[
              { title: '等级', dataIndex: 'level', width: 80 },
              { title: '类型', dataIndex: 'type', width: 100, render: (t: string) => <Tag color={t === 'theory' ? 'blue' : 'purple'}>{t === 'theory' ? '理论' : '技能'}</Tag> },
              { title: '题型数', dataIndex: 'configs', render: (c: Record<QuestionType, number>) => Object.values(c).filter((v) => v > 0).length + ' 种' },
              { title: '创建时间', dataIndex: 'createdAt', width: 180 },
            ]}
          />
        </Card>
      )}
    </div>
  );
}
