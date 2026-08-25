import { useState } from 'react';
import { Card, Select, Button, Table, Tag, message, Modal, Typography } from 'antd';
import { PrinterOutlined, DownloadOutlined } from '@ant-design/icons';
import { useAppStore } from '../../store/useAppStore';
import { shuffleArray } from '../../utils/mockAI';
import { FileOutput } from 'lucide-react';
import type { Question, QuestionType } from '../../types';

const { Paragraph } = Typography;

const typeLabels: Record<QuestionType, string> = {
  single: '单选题', multiple: '多选题', judge: '判断题', short: '简答题', essay: '论述题',
  case: '案例分析题', calc: '计算题', blank: '填空题', ethics: '职业道德题',
};

const scoreMap: Record<QuestionType, number> = {
  single: 1, multiple: 2, judge: 1, short: 5, essay: 10, case: 10, calc: 5, blank: 2, ethics: 2,
};

export function PaperAssembly() {
  const { questionBanks, examPlans, setCurrentStep } = useAppStore();
  const [bankId, setBankId] = useState<string | undefined>();
  const [planId, setPlanId] = useState<string | undefined>();
  const [level, setLevel] = useState('五级');
  const [paper, setPaper] = useState<{ title: string; questions: Question[]; totalScore: number } | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const currentBank = bankId ? questionBanks.find((b) => b.id === bankId) : questionBanks[questionBanks.length - 1];
  const selectedPlan = examPlans.find((p) => p.id === planId);

  const handleAssemble = () => {
    if (!currentBank) {
      message.warning('请选择题库');
      return;
    }
    const approved = currentBank.questions.filter((q) => q.status === 'approved' && q.level === level);
    if (approved.length === 0) {
      message.warning(`当前题库中暂无「${level}」级已审核通过的题目，请先在线审核`);
      return;
    }

    const configs = selectedPlan?.configs;
    const picked: Question[] = [];
    if (configs) {
      (Object.entries(configs) as [QuestionType, number][]).forEach(([t, cnt]) => {
        const pool = approved.filter((q) => q.type === t);
        const chosen = shuffleArray(pool).slice(0, cnt);
        picked.push(...chosen);
      });
    } else {
      picked.push(...shuffleArray(approved).slice(0, 30));
    }

    if (picked.length === 0) {
      message.warning('没有满足组卷条件的题目，请调整计划书');
      return;
    }

    const totalScore = picked.reduce((acc, q) => acc + scoreMap[q.type], 0);
    setPaper({
      title: `${currentBank.name} · ${level}级模拟试卷`,
      questions: picked,
      totalScore,
    });
    setPreviewOpen(true);
    message.success(`抽题组卷完成，共 ${picked.length} 题`);
  };

  const handlePrint = () => {
    if (!paper) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<html><head><title>${paper.title}</title><style>body{font-family:SimSun,serif;padding:40px} h1,h2{text-align:center} .q{margin:16px 0} .op{margin-left:24px} .ans{page-break-inside:avoid;margin-top:30px;border-top:1px dashed #999;padding-top:10px}</style></head><body>`);
    win.document.write(`<h1>${paper.title}</h1><h3>总分 ${paper.totalScore} 分</h3><hr>`);
    paper.questions.forEach((q, i) => {
      const label = `【${typeLabels[q.type]}】`;
      win.document.write(`<div class="q"><b>${i + 1}.</b> ${label} ${q.content}</div>`);
      q.options?.forEach((o, oi) => {
        win.document.write(`<div class="op">${String.fromCharCode(65 + oi)}. ${o}</div>`);
      });
    });
    win.document.write(`<div class="ans"><h3>参考答案与解析</h3>`);
    paper.questions.forEach((q, i) => {
      win.document.write(`<div class="q"><b>${i + 1}.</b> 答案：${q.answer}　解析：${q.analysis || '无'}</div>`);
    });
    win.document.write(`</div></body></html>`);
    win.document.close();
    win.print();
  };

  const columns = [
    { title: '题型', dataIndex: 'type', width: 110, render: (t: QuestionType) => <Tag color="blue">{typeLabels[t]}</Tag> },
    { title: '等级', dataIndex: 'level', width: 70 },
    { title: '考评点', dataIndex: 'outlineName', width: 150, ellipsis: true },
    { title: '题目内容', dataIndex: 'content', ellipsis: true },
    { title: '答案', dataIndex: 'answer', width: 80, ellipsis: true },
    { title: '来源', dataIndex: 'source', width: 110, render: (s: string) => <Tag color="purple">{s}</Tag> },
  ];

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex items-center gap-2 mb-1">
          <FileOutput className="text-blue-500 text-lg" />
          <h2 className="text-lg font-bold m-0">七、抽题组卷</h2>
        </div>
        <div className="text-gray-500 text-sm mb-5">依据组卷计划书，从已审核通过的题库中按比例随机抽题，生成正式试卷。</div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap gap-4 items-start sm:items-center mb-4">
          <div className="w-full sm:w-auto">
            <div className="text-sm text-gray-500 mb-1">选择题库</div>
            <Select placeholder="选择题库" className="w-full sm:w-[240px]" value={bankId || currentBank?.id} onChange={setBankId} options={questionBanks.map((b) => ({ value: b.id, label: b.name }))} />
          </div>
          <div className="w-full sm:w-auto">
            <div className="text-sm text-gray-500 mb-1">组卷计划书</div>
            <Select placeholder="可选的组卷计划书" className="w-full sm:w-[240px]" value={planId} onChange={setPlanId} options={examPlans.map((p) => ({ value: p.id, label: `${p.level}级·${p.type === 'theory' ? '理论' : '技能'}` }))} allowClear />
          </div>
          <div className="w-full sm:w-auto">
            <div className="text-sm text-gray-500 mb-1">技能等级</div>
            <Select value={level} onChange={setLevel} className="w-full sm:w-[120px]" options={['五级', '四级', '三级', '二级', '一级'].map((l) => ({ value: l, label: l }))} />
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button type="primary" size="large" icon={<FileOutput />} onClick={handleAssemble}>抽题组卷</Button>
          <Button icon={<PrinterOutlined />} onClick={handlePrint} disabled={!paper}>打印试卷</Button>
          <Button onClick={() => setCurrentStep('review')}>题库不足？前往审核</Button>
        </div>
      </Card>

      {currentBank && (
        <Card title={`当前题库题量概览（${currentBank.name}）`}>
          <Paragraph type="secondary">仅统计「已通过审核」的题目，用于组卷。</Paragraph>
          <div className="flex flex-wrap gap-2">
            {['五级', '四级', '三级', '二级', '一级'].map((lv) => {
              const approved = currentBank.questions.filter((q) => q.status === 'approved' && q.level === lv).length;
              return (
                <div key={lv} className={`px-4 py-2 rounded-lg border ${lv === level ? 'border-blue-400 bg-blue-50' : 'border-gray-200'}`}>
                  <div className="text-xl font-bold">{approved}</div>
                  <div className="text-gray-500 text-sm">{lv}级可组卷</div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <Modal
        title={paper?.title || '试卷'}
        open={previewOpen}
        onCancel={() => setPreviewOpen(false)}
        width={typeof window !== 'undefined' && window.innerWidth < 768 ? '100%' : 1000}
        footer={
          <div className="flex justify-between w-full">
            <span className="text-gray-500">共 {paper?.questions.length} 题 · 总分 {paper?.totalScore} 分</span>
            <div>
              <Button icon={<DownloadOutlined />} onClick={() => setPreviewOpen(false)} className="mr-2">关闭</Button>
              <Button type="primary" icon={<PrinterOutlined />} onClick={handlePrint}>打印试卷</Button>
            </div>
          </div>
        }
      >
        {paper && (
          <div className="max-h-[70vh] overflow-auto pr-2">
            <Table rowKey="id" size="small" columns={columns} dataSource={paper.questions} pagination={false} scroll={{ x: 700 }} />
          </div>
        )}
      </Modal>
    </div>
  );
}
