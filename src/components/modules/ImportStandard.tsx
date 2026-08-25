import { useState } from 'react';
import { Card, Button, Upload, Select, message, Table, Tag, Progress, Typography, Empty } from 'antd';
import { FilePdfOutlined, BookOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { useAppStore } from '../../store/useAppStore';
import { parseFile } from '../../utils/fileParser';
import { generateOutlineFromText } from '../../utils/mockAI';
import type { FileItem } from '../../types';
import { CheckCircle, AlertCircle } from 'lucide-react';

const { Dragger } = Upload;
const { Title, Paragraph } = Typography;

const aiModels = [
  { value: 'deepseek', label: 'DeepSeek（快）' },
  { value: 'qwen', label: '通义千问' },
  { value: 'gpt4', label: 'GPT-4' },
];

const skillTypes = [
  { value: 'manual', label: '工件加工等手动设备操作类' },
  { value: 'digital', label: '数字技术应用类' },
  { value: 'service', label: '服务流程操作类' },
];

const typeMap: Record<string, string> = {
  pdf: 'PDF',
  docx: 'DOCX',
  doc: 'DOC',
  txt: 'TXT',
  md: 'MD',
};

function getExt(name: string) {
  return name.split('.').pop()?.toLowerCase() || '';
}

export function ImportStandard() {
  const {
    standardFiles,
    materialFiles,
    outlineItems,
    aiModel,
    skillType,
    setAiModel,
    setSkillType,
    addStandardFile,
    addMaterialFile,
    updateFileStatus,
    setOutlineItems,
    setCurrentStep,
  } = useAppStore();

  const [parsing, setParsing] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleStandardUpload = async (file: File) => {
    const ext = getExt(file.name);
    if (!['pdf', 'docx', 'doc'].includes(ext)) {
      message.warning('国家标准请上传 PDF / DOCX 文件');
      return false;
    }
    const item: FileItem = {
      id: `std_${Date.now()}`,
      name: file.name,
      size: file.size,
      type: ext,
      status: 'pending',
    };
    addStandardFile(item);
    updateFileStatus(item.id, 'parsing');
    try {
      const content = await parseFile(file);
      updateFileStatus(item.id, 'done', content);
      message.success(`《${file.name}》解析完成`);
      return false;
    } catch (e) {
      updateFileStatus(item.id, 'error');
      message.error('解析失败');
      return false;
    }
  };

  const handleMaterialUpload = async (file: File) => {
    const ext = getExt(file.name);
    if (!['pdf', 'docx', 'doc', 'txt', 'md'].includes(ext)) {
      message.warning('教材请上传 PDF / DOCX / TXT / MD 文件');
      return false;
    }
    const item: FileItem = {
      id: `mat_${Date.now()}`,
      name: file.name,
      size: file.size,
      type: ext,
      status: 'pending',
    };
    addMaterialFile(item);
    updateFileStatus(item.id, 'parsing');
    try {
      const content = await parseFile(file);
      updateFileStatus(item.id, 'done', content);
      message.success(`《${file.name}》解析完成`);
      return false;
    } catch (e) {
      updateFileStatus(item.id, 'error');
      message.error('解析失败');
      return false;
    }
  };

  const handleAnalyze = () => {
    if (standardFiles.filter((f) => f.status === 'done').length === 0) {
      message.warning('请先上传并解析《国家职业技能标准》');
      return;
    }
    setParsing(true);
    setProgress(0);
    const timer = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(timer);
          const text = standardFiles
            .filter((f) => f.status === 'done')
            .map((f) => f.content || '')
            .join('\n');
          const items = generateOutlineFromText(text);
          setOutlineItems(items);
          setParsing(false);
          message.success('职业功能解析完成，已生成考评点大纲');
          return 100;
        }
        return p + 10;
      });
    }, 150);
  };

  const fileColumns = [
    { title: '文件', dataIndex: 'name', key: 'name', ellipsis: true },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 90,
      render: (t: string) => <Tag color="blue">{typeMap[t] || t}</Tag>,
    },
    {
      title: '大小',
      dataIndex: 'size',
      key: 'size',
      width: 100,
      render: (s: number) => (s / 1024).toFixed(1) + ' KB',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (s: FileItem['status']) =>
        s === 'done' ? (
          <Tag color="success" icon={<CheckCircle className="w-3.5 h-3.5" />}>已解析</Tag>
        ) : s === 'parsing' ? (
          <Tag color="processing">解析中…</Tag>
        ) : s === 'error' ? (
          <Tag color="error" icon={<AlertCircle className="w-3.5 h-3.5" />}>失败</Tag>
        ) : (
          <Tag>待解析</Tag>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <Title level={4} className="mb-1">一、导入《国家职业技能标准》</Title>
        <Paragraph type="secondary" className="mb-4">
          上传并解析任一工种的国家职业技能标准文件，系统将自动提取等级结构、职业功能与考评要点。
        </Paragraph>
        <Dragger
          accept=".pdf,.docx,.doc"
          showUploadList={false}
          beforeUpload={handleStandardUpload}
          style={{ background: '#f0f7ff', borderColor: '#91caff', borderRadius: 8 }}
        >
          <p className="ant-upload-drag-icon">
            <FilePdfOutlined style={{ fontSize: 40, color: '#1677ff' }} />
          </p>
          <p className="ant-upload-text">点击或拖拽《国家职业技能标准》文件到此区域</p>
          <p className="ant-upload-hint">支持 PDF / DOCX 格式，可上传多个文件</p>
        </Dragger>
        {standardFiles.length > 0 && (
          <Table
            rowKey="id"
            size="small"
            columns={fileColumns}
            dataSource={standardFiles}
            pagination={false}
            className="mt-4"
            scroll={{ x: 480 }}
          />
        )}
      </Card>

      <Card>
        <Title level={4} className="mb-1">二、导入电子教材 / 培训资料</Title>
        <Paragraph type="secondary" className="mb-4">
          上传与职业技能相关的教材、讲义或培训资料，作为出题的参考数据源，提升题目专业度。
        </Paragraph>
        <Dragger
          accept=".pdf,.docx,.doc,.txt,.md"
          showUploadList={false}
          beforeUpload={handleMaterialUpload}
          style={{ background: '#fafafa', borderRadius: 8 }}
        >
          <p className="ant-upload-drag-icon">
            <BookOutlined style={{ fontSize: 40, color: '#8c8c8c' }} />
          </p>
          <p className="ant-upload-text">点击或拖拽教材资料文件到此区域</p>
          <p className="ant-upload-hint">支持 PDF / DOCX / TXT / MD 格式</p>
        </Dragger>
        {materialFiles.length > 0 && (
          <Table
            rowKey="id"
            size="small"
            columns={fileColumns}
            dataSource={materialFiles}
            pagination={false}
            className="mt-4"
            scroll={{ x: 480 }}
          />
        )}
      </Card>

      <Card>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <Title level={4} className="mb-1">三、AI 解析配置</Title>
            <Paragraph type="secondary" className="mb-0">
              选择用于解析与出题的大模型，并确定职业技能的所属类型，然后一键解析职业功能。
            </Paragraph>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-start sm:items-center w-full sm:w-auto">
            <div className="w-full sm:w-auto">
              <div className="text-sm text-gray-500 mb-1">AI 模型</div>
              <Select
                value={aiModel}
                onChange={setAiModel}
                options={aiModels}
                className="w-full sm:w-[180px]"
              />
            </div>
            <div className="w-full sm:w-auto">
              <div className="text-sm text-gray-500 mb-1">技能类型</div>
              <Select
                value={skillType}
                onChange={setSkillType}
                options={skillTypes}
                className="w-full sm:w-[220px]"
              />
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button
            type="primary"
            icon={<ThunderboltOutlined />}
            size="large"
            loading={parsing}
            onClick={handleAnalyze}
          >
            {parsing ? '正在解析职业功能…' : '开始解析职业功能'}
          </Button>
          {parsing && <Progress percent={progress} style={{ width: '100%', maxWidth: 260 }} />}
        </div>
      </Card>

      <Card title="职业功能 / 考评点大纲">
        {outlineItems.length === 0 ? (
          <Empty description="解析后将在下方展示职业功能与考评点大纲" />
        ) : (
          <>
            <div className="mb-3 flex items-center gap-2">
              <Tag color="green">共 {outlineItems.length} 项职业功能</Tag>
              <Tag color="blue">已生成考评点大纲</Tag>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {outlineItems.map((item) => (
                <div
                  key={item.id}
                  className="border border-gray-200 rounded-lg p-4 hover:border-blue-400 hover:shadow-sm transition"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Tag color="blue">{item.code}</Tag>
                    <span className="font-medium text-gray-800">{item.name}</span>
                  </div>
                  <div className="text-sm text-gray-500 mb-1">等级：{item.level} · 权重 {item.weight}%</div>
                  <ul className="text-sm text-gray-600 space-y-1">
                    {item.points.map((p, i) => (
                      <li key={i} className="flex gap-1">
                        <span className="text-blue-400">·</span>
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="mt-4 flex gap-3">
              <Button type="primary" onClick={() => setCurrentStep('generate')}>
                下一步：生成题库
              </Button>
              <Button onClick={() => setCurrentStep('manage')}>跳转到题库管理</Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
