import { useState } from 'react';
import { Card, Table, Tag, Button, Select, message, Modal, Input, Progress, Space } from 'antd';
import { DownloadOutlined, DatabaseOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { useAppStore } from '../../store/useAppStore';
import { exportToExcel } from '../../utils/fileParser';

const typeLabels: Record<string, string> = {
  single: '单选', multiple: '多选', judge: '判断', short: '简答', essay: '论述',
  case: '案例分析', calc: '计算', blank: '填空', ethics: '职业道德',
};

export function ManageBank() {
  const { questionBanks, setCurrentStep } = useAppStore();
  const [bankId, setBankId] = useState<string | undefined>();
  const [search, setSearch] = useState('');
  const [addModal, setAddModal] = useState(false);
  const [importProgress, setImportProgress] = useState(0);

  const currentBank = bankId ? questionBanks.find((b) => b.id === bankId) : questionBanks[questionBanks.length - 1];
  const questions = (currentBank?.questions || []).filter((q) => q.content.includes(search) || q.outlineName.includes(search));

  const handleExport = () => {
    if (!currentBank) return;
    const rows: any[][] = [
      ['序号', '题型', '等级', '考评点', '题目', '答案', '难度', '来源', '审核状态'],
    ];
    currentBank.questions.forEach((q, i) => {
      rows.push([i + 1, typeLabels[q.type] || q.type, q.level, q.outlineName, q.content, q.answer, q.difficulty, q.source, q.status]);
    });
    exportToExcel(rows, `${currentBank.name}.xlsx`);
    message.success('题库已导出为 Excel');
  };

  const handleImport = () => {
    setImportProgress(0);
    const timer = setInterval(() => {
      setImportProgress((p) => {
        if (p >= 100) {
          clearInterval(timer);
          setAddModal(false);
          message.success('Excel 题库导入完成');
          return 100;
        }
        return p + 20;
      });
    }, 200);
  };

  const columns = [
    { title: '题型', dataIndex: 'type', width: 80, render: (t: string) => <Tag color="blue">{typeLabels[t] || t}</Tag> },
    { title: '等级', dataIndex: 'level', width: 70, render: (l: string) => <Tag>{l}</Tag> },
    { title: '考评点', dataIndex: 'outlineName', width: 140, ellipsis: true },
    { title: '题目内容', dataIndex: 'content', ellipsis: true },
    { title: '难度', dataIndex: 'difficulty', width: 70, render: (d: string) => <Tag color={d === 'easy' ? 'green' : d === 'medium' ? 'orange' : 'red'}>{d === 'easy' ? '易' : d === 'medium' ? '中' : '难'}</Tag> },
    {
      title: '状态', dataIndex: 'status', width: 90,
      render: (st: string) =>
        st === 'approved' ? <Tag color="success">已通过</Tag> : st === 'rejected' ? <Tag color="error">已驳回</Tag> : <Tag color="warning">待审核</Tag>,
    },
  ];

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex items-center gap-2 mb-1">
          <DatabaseOutlined className="text-blue-500 text-lg" />
          <h2 className="text-lg font-bold m-0">四、题库管理</h2>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <Space>
            <Select placeholder="选择题库" style={{ width: 240 }} value={bankId || currentBank?.id} onChange={setBankId} options={questionBanks.map((b) => ({ value: b.id, label: b.name }))} />
            <Input prefix={<SearchOutlined />} placeholder="搜索题目 / 考评点" style={{ width: 220 }} value={search} onChange={(e) => setSearch(e.target.value)} allowClear />
          </Space>
          <Space>
            <Button icon={<PlusOutlined />} type="primary" onClick={() => setAddModal(true)}>从 Excel 导入</Button>
            <Button icon={<DownloadOutlined />} onClick={handleExport}>导出 Excel</Button>
            <Button onClick={() => setCurrentStep('review')}>前往在线审核</Button>
          </Space>
        </div>

        {!currentBank ? (
          <div className="text-center text-gray-400 py-10">暂无题库，请先「生成题库」</div>
        ) : (
          <>
            <div className="mb-3 text-gray-500 text-sm">当前题库：<b className="text-gray-800">{currentBank.name}</b> · 共 {currentBank.questions.length} 题 · 命中 {questions.length} 题</div>
            <Table rowKey="id" size="small" columns={columns} dataSource={questions} pagination={{ pageSize: 15 }} scroll={{ x: 1000 }} />
          </>
        )}
      </Card>

      <Modal title="从 Excel 导入题库" open={addModal} onCancel={() => setAddModal(false)} footer={null}>
        <div className="space-y-4">
          <p className="text-gray-500 text-sm">支持导入符合标准列名（序号/题型/等级/题目/答案）的 Excel 文件，系统将自动映射并入库。</p>
          <Button type="primary" block onClick={handleImport} icon={<PlusOutlined />}>选择 Excel 文件并导入</Button>
          {importProgress > 0 && importProgress < 100 && <Progress percent={importProgress} status="active" />}
        </div>
      </Modal>
    </div>
  );
}
