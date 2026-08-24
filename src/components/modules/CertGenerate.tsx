import { useState } from 'react';
import { Card, Select, Button, Table, Tag, message, InputNumber } from 'antd';
import { FileTextOutlined, DownloadOutlined, SaveOutlined } from '@ant-design/icons';
import { useAppStore } from '../../store/useAppStore';

export function CertGenerate() {
  const { questionBanks } = useAppStore();
  const [bankId, setBankId] = useState<string | undefined>();
  const [certItems, setCertItems] = useState<{ id: string; type: string; name: string; createdAt: string }[]>([]);
  const [genCount, setGenCount] = useState<Record<string, number>>({});

  const currentBank = bankId ? questionBanks.find((b) => b.id === bankId) : questionBanks[questionBanks.length - 1];

  const handleGenerate = (type: string, label: string) => {
    if (!currentBank) {
      message.warning('请先选择题库');
      return;
    }
    const count = genCount[type] || 1;
    const items = Array.from({ length: count }, (_, i) => ({
      id: `cert_${type}_${Date.now()}_${i}`,
      type,
      name: `${label}·${currentBank.name}·第${i + 1}份`,
      createdAt: new Date().toLocaleString(),
    }));
    setCertItems((prev) => [...items, ...prev]);
    message.success(`已生成 ${count} 份${label}`);
  };

  const columns = [
    { title: '文件名称', dataIndex: 'name', key: 'name', ellipsis: true },
    {
      title: '类型', dataIndex: 'type', key: 'type', width: 140,
      render: (t: string) => {
        const map: Record<string, string> = {
          paper: '考试试卷',
          answer: '参考答案与评分标准',
          cert: '职业技能等级认定证书',
          table: '考核记录表',
        };
        return <Tag color="blue">{map[t] || t}</Tag>;
      },
    },
    { title: '生成时间', dataIndex: 'createdAt', key: 'createdAt', width: 180 },
  ];

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex items-center gap-2 mb-1">
          <FileTextOutlined className="text-blue-500 text-lg" />
          <h2 className="text-lg font-bold m-0">九、认定文件生成</h2>
        </div>
        <div className="text-gray-500 text-sm mb-5">基于已审核通过的题库与组卷计划，一键生成职业技能等级认定的全套文件。</div>

        <div className="flex flex-wrap gap-4 items-center mb-4">
          <div>
            <div className="text-sm text-gray-500 mb-1">选择题库</div>
            <Select placeholder="选择题库" style={{ width: 240 }} value={bankId || currentBank?.id} onChange={setBankId} options={questionBanks.map((b) => ({ value: b.id, label: b.name }))} />
          </div>
          <div>
            <div className="text-sm text-gray-500 mb-1">生成份数</div>
            <InputNumber min={1} max={10} value={genCount['_base'] || 1} onChange={(v) => setGenCount((p) => ({ ...p, _base: v || 1 }))} style={{ width: 100 }} addonAfter="份" />
          </div>
          <div className="text-sm text-gray-500">当前题库：<b className="text-gray-800">{currentBank?.name || '暂无'}</b> · 已审核 {currentBank?.questions.filter((q) => q.status === 'approved').length || 0} 题</div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="border border-gray-200 rounded-lg p-4 flex items-center justify-between">
            <div>
              <div className="font-medium">理论考试试卷（Word）</div>
              <div className="text-gray-500 text-sm">基于理论题库抽题并排版生成</div>
            </div>
            <Button type="primary" onClick={() => handleGenerate('paper', '理论考试试卷')}>生成</Button>
          </div>
          <div className="border border-gray-200 rounded-lg p-4 flex items-center justify-between">
            <div>
              <div className="font-medium">技能考核评分表</div>
              <div className="text-gray-500 text-sm">基于技能题库与考评点生成</div>
            </div>
            <Button type="primary" onClick={() => handleGenerate('table', '技能考核评分表')}>生成</Button>
          </div>
          <div className="border border-gray-200 rounded-lg p-4 flex items-center justify-between">
            <div>
              <div className="font-medium">参考答案与评分标准</div>
              <div className="text-gray-500 text-sm">导出答案解析与评分细则</div>
            </div>
            <Button type="primary" onClick={() => handleGenerate('answer', '参考答案与评分标准')}>生成</Button>
          </div>
          <div className="border border-gray-200 rounded-lg p-4 flex items-center justify-between">
            <div>
              <div className="font-medium">职业技能等级认定证书</div>
              <div className="text-gray-500 text-sm">生成认定证书（含个人与机构信息）</div>
            </div>
            <Button type="primary" onClick={() => handleGenerate('cert', '职业技能等级认定证书')}>生成</Button>
          </div>
        </div>
      </Card>

      {certItems.length > 0 && (
        <Card title="已生成的文件">
          <div className="mb-3 flex gap-3">
            <Button icon={<DownloadOutlined />} onClick={() => message.success('已打包下载全部文件（演示）')}>全部下载</Button>
            <Button icon={<SaveOutlined />} onClick={() => message.success('文件已保存到认定文件库')}>保存到数据库</Button>
          </div>
          <Table rowKey="id" size="small" columns={columns} dataSource={certItems} pagination={false} />
        </Card>
      )}
    </div>
  );
}
