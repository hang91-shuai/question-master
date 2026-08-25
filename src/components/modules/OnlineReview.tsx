import { useState } from 'react';
import type { Key } from 'react';
import { Card, Select, Table, Tag, Button, Radio, Input, message, Modal, Typography, Badge, Space } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, EditOutlined, AuditOutlined, CheckOutlined } from '@ant-design/icons';
import { useAppStore } from '../../store/useAppStore';
import type { Question, QuestionBank } from '../../types';

const { TextArea } = Input;
const { Text, Paragraph } = Typography;

const typeLabels: Record<string, string> = {
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

const difficultyColors: Record<string, string> = {
  easy: 'green',
  medium: 'orange',
  hard: 'red',
};

export function OnlineReview() {
  const { questionBanks, updateQuestionStatus, batchUpdateQuestionStatus, setCurrentStep } = useAppStore();
  const [selectedBankId, setSelectedBankId] = useState<string | undefined>();
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [editModal, setEditModal] = useState<{ bankId: string; q: Question } | null>(null);
  const [editContent, setEditContent] = useState('');
  const [rejectModal, setRejectModal] = useState<{ bankId: string; q: Question } | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);

  const currentBank: QuestionBank | undefined = selectedBankId
    ? questionBanks.find((b) => b.id === selectedBankId)
    : questionBanks[questionBanks.length - 1];

  const questions = (currentBank?.questions || []).filter((q) =>
    filterStatus === 'all' ? true : q.status === filterStatus
  );

  const stats = (bank: QuestionBank | undefined) => {
    const qs = bank?.questions || [];
    return {
      total: qs.length,
      approved: qs.filter((q) => q.status === 'approved').length,
      pending: qs.filter((q) => q.status === 'pending').length,
      rejected: qs.filter((q) => q.status === 'rejected').length,
    };
  };
  const s = stats(currentBank);

  const handleApprove = (q: Question) => {
    if (!currentBank) return;
    updateQuestionStatus(currentBank.id, q.id, 'approved');
    message.success('已通过审核');
  };

  const handleBatchApprove = () => {
    if (!currentBank) return;
    if (selectedRowKeys.length === 0) {
      message.warning('请先勾选要批量通过的题目');
      return;
    }
    batchUpdateQuestionStatus(currentBank.id, selectedRowKeys as string[], 'approved');
    message.success(`已批量通过 ${selectedRowKeys.length} 道题`);
    setSelectedRowKeys([]);
  };

  const rowSelection = {
    selectedRowKeys,
    onChange: (keys: Key[]) => setSelectedRowKeys(keys),
  };

  const handleReject = () => {
    if (!rejectModal || !rejectReason.trim()) {
      message.warning('请填写驳回原因');
      return;
    }
    updateQuestionStatus(rejectModal.bankId, rejectModal.q.id, 'rejected', rejectReason);
    message.success('已驳回该题');
    setRejectModal(null);
    setRejectReason('');
  };

  const handleSaveEdit = () => {
    if (!editModal) return;
    // 本地编辑题目内容
    updateQuestionStatus(editModal.bankId, editModal.q.id, 'pending');
    message.success('题目已修改，保存成功');
    setEditModal(null);
  };

  const columns = [
    {
      title: '题型',
      dataIndex: 'type',
      width: 90,
      render: (t: string) => <Tag color="blue">{typeLabels[t] || t}</Tag>,
    },
    { title: '等级', dataIndex: 'level', width: 70, render: (l: string) => <Tag>{l}</Tag> },
    {
      title: '考评点',
      dataIndex: 'outlineName',
      width: 150,
      render: (n: string) => <Text ellipsis style={{ maxWidth: 140 }}>{n}</Text>,
    },
    {
      title: '题目内容',
      dataIndex: 'content',
      render: (c: string) => <Text ellipsis style={{ maxWidth: 400 }}>{c}</Text>,
    },
    {
      title: '难度',
      dataIndex: 'difficulty',
      width: 80,
      render: (d: string) => <Tag color={difficultyColors[d]}>{d === 'easy' ? '易' : d === 'medium' ? '中' : '难'}</Tag>,
    },
    {
      title: '来源',
      dataIndex: 'source',
      width: 130,
      render: (src: string) => <Tag color="purple">{src}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (st: string) =>
        st === 'approved' ? (
          <Tag color="success" icon={<CheckCircleOutlined />}>已通过</Tag>
        ) : st === 'rejected' ? (
          <Tag color="error" icon={<CloseCircleOutlined />}>已驳回</Tag>
        ) : (
          <Tag color="warning">待审核</Tag>
        ),
    },
    {
      title: '操作',
      width: 200,
      render: (_: any, q: Question) => (
        <div className="flex gap-1 flex-wrap">
          <Button size="small" type="primary" icon={<CheckCircleOutlined />} onClick={() => handleApprove(q)} disabled={q.status === 'approved'}>
            通过
          </Button>
          <Button size="small" danger icon={<CloseCircleOutlined />} onClick={() => setRejectModal({ bankId: currentBank!.id, q })} disabled={q.status === 'rejected'}>
            驳回
          </Button>
          <Button size="small" icon={<EditOutlined />} onClick={() => { setEditContent(q.content); setEditModal({ bankId: currentBank!.id, q }); }}>
            编辑
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex items-center gap-2 mb-1">
          <AuditOutlined className="text-blue-500 text-lg" />
          <h2 className="text-lg font-bold m-0">三、在线审核</h2>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <Select
              placeholder="选择题库"
              style={{ width: 260 }}
              value={selectedBankId || (questionBanks[questionBanks.length - 1]?.id)}
              onChange={setSelectedBankId}
              options={questionBanks.map((b) => ({ value: b.id, label: b.name }))}
            />
            <Radio.Group value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} size="small">
              <Radio.Button value="all">全部</Radio.Button>
              <Radio.Button value="pending">待审核</Radio.Button>
              <Radio.Button value="approved">已通过</Radio.Button>
              <Radio.Button value="rejected">已驳回</Radio.Button>
            </Radio.Group>
          </div>
          <Space>
            {selectedRowKeys.length > 0 && (
              <span className="text-gray-500 text-sm">{selectedRowKeys.length} 道题已选</span>
            )}
            <Button type="primary" icon={<CheckOutlined />} onClick={handleBatchApprove} disabled={selectedRowKeys.length === 0}>
              批量通过
            </Button>
            <Button onClick={() => setCurrentStep('manage')}>前往题库管理</Button>
          </Space>
        </div>

        {!currentBank ? (
          <div className="text-center text-gray-400 py-10">暂无题库，请先「生成题库」</div>
        ) : (
          <>
            <div className="grid grid-cols-4 gap-3 mb-4">
              <Badge.Ribbon text="总数" color="blue">
                <div className="border border-gray-200 rounded-lg p-3 bg-blue-50 text-center">
                  <div className="text-2xl font-bold text-blue-600">{s.total}</div>
                  <div className="text-gray-500 text-sm">题目总数</div>
                </div>
              </Badge.Ribbon>
              <div className="border border-green-200 rounded-lg p-3 bg-green-50 text-center">
                <div className="text-2xl font-bold text-green-600">{s.approved}</div>
                <div className="text-gray-500 text-sm">已通过</div>
              </div>
              <div className="border border-orange-200 rounded-lg p-3 bg-orange-50 text-center">
                <div className="text-2xl font-bold text-orange-500">{s.pending}</div>
                <div className="text-gray-500 text-sm">待审核</div>
              </div>
              <div className="border border-red-200 rounded-lg p-3 bg-red-50 text-center">
                <div className="text-2xl font-bold text-red-500">{s.rejected}</div>
                <div className="text-gray-500 text-sm">已驳回</div>
              </div>
            </div>
            <Table
              rowKey="id"
              size="small"
              columns={columns}
              dataSource={questions}
              pagination={{ pageSize: 12 }}
              scroll={{ x: 1200 }}
              rowSelection={rowSelection}
            />
          </>
        )}
      </Card>

      <Modal
        title="编辑题目"
        open={!!editModal}
        onCancel={() => setEditModal(null)}
        onOk={handleSaveEdit}
        okText="保存修改"
      >
        {editModal && (
          <div className="space-y-3">
            <div>
              <Text type="secondary">题型：{typeLabels[editModal.q.type]} · 等级：{editModal.q.level}</Text>
            </div>
            <TextArea rows={4} value={editContent} onChange={(e) => setEditContent(e.target.value)} placeholder="修改题目内容" />
            {editModal.q.options && (
              <div>
                <Text type="secondary">选项：</Text>
                {editModal.q.options.map((o, i) => (
                  <Paragraph key={i} className="mb-0">{String.fromCharCode(65 + i)}. {o}</Paragraph>
                ))}
              </div>
            )}
            <div>
              <Text type="secondary">答案：</Text>
              <Paragraph className="mb-0">{editModal.q.answer}</Paragraph>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        title="驳回原因"
        open={!!rejectModal}
        onCancel={() => setRejectModal(null)}
        onOk={handleReject}
        okText="确认驳回"
        okButtonProps={{ danger: true }}
      >
        {rejectModal && (
          <div className="space-y-3">
            <Paragraph type="secondary">{rejectModal.q.content}</Paragraph>
            <TextArea rows={3} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="请填写驳回原因，便于 AI 针对性修改" />
          </div>
        )}
      </Modal>
    </div>
  );
}
