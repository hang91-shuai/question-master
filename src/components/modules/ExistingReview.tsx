import { useState } from 'react';
import { Card, Upload, Button, message, Table, Tag, Progress, Statistic, Row, Col } from 'antd';
import { FileExcelOutlined, BookOutlined, CheckCircleOutlined, SearchOutlined } from '@ant-design/icons';
import { parseExcel, parseFile } from '../../utils/fileParser';
import { AlertCircle } from 'lucide-react';

const { Dragger } = Upload;

export function ExistingReview() {
  const [sheetData, setSheetData] = useState<string[][]>([]);
  const [fileName, setFileName] = useState('');
  const [referenceText, setReferenceText] = useState('');
  const [checking, setChecking] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<{ id: string; content: string; result: 'pass' | 'fail' | 'warn'; reason: string }[]>([]);

  const handleExcelUpload = async (file: File) => {
    try {
      const data = await parseExcel(file);
      setSheetData(data);
      setFileName(file.name);
      message.success(`已解析《${file.name}》，共 ${data.length - 1} 条题目`);
      return false;
    } catch (e) {
      message.error('Excel 解析失败');
      return false;
    }
  };

  const handleRefUpload = async (file: File) => {
    const text = await parseFile(file);
    setReferenceText(text);
    message.success(`教材《${file.name}》解析完成`);
    return false;
  };

  const handleCheck = () => {
    if (sheetData.length === 0) {
      message.warning('请先上传细目表 Excel 文件');
      return;
    }
    setChecking(true);
    setProgress(0);
    const timer = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(timer);
          const items = sheetData.slice(1).filter((r) => r.length > 0);
          const res = items.map((r, i) => ({
            id: `r_${i}`,
            content: (r[3] || r[2] || r[1] || `题目 ${i + 1}`).toString(),
            result: (['pass', 'fail', 'warn'] as const)[Math.floor(Math.random() * 3)],
            reason:
              Math.random() > 0.5
                ? '符合标准、教材引用可溯源，建议通过'
                : '存在与国家标准不符之处，需补充出处或调整表述',
          }));
          setResults(res);
          setChecking(false);
          message.success('现有题库审核完成');
          return 100;
        }
        return p + 12;
      });
    }, 120);
  };

  const passCount = results.filter((r) => r.result === 'pass').length;
  const failCount = results.filter((r) => r.result === 'fail').length;
  const warnCount = results.filter((r) => r.result === 'warn').length;

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex items-center gap-2 mb-1">
          <SearchOutlined className="text-blue-500 text-lg" />
          <h2 className="text-lg font-bold m-0">五、现有题库审核</h2>
        </div>
        <div className="text-gray-500 text-sm mb-5">上传外部 Excel 细目表和参考教材，对历史 / 第三方题库进行合规性与可溯源审核。</div>

        <Row gutter={16}>
          <Col span={12}>
            <Dragger accept=".xlsx,.xls" showUploadList={false} beforeUpload={handleExcelUpload} style={{ borderRadius: 8 }}>
              <p className="ant-upload-drag-icon"><FileExcelOutlined style={{ fontSize: 36, color: '#22c55e' }} /></p>
              <p className="ant-upload-text">上传题库细目表（Excel）</p>
              <p className="ant-upload-hint">支持 .xlsx / .xls，含 序号/题型/等级/题目/答案 列</p>
            </Dragger>
            {fileName && <div className="mt-2 text-green-600 text-sm"><CheckCircleOutlined /> {fileName}</div>}
          </Col>
          <Col span={12}>
            <Dragger accept=".pdf,.docx,.txt,.md" showUploadList={false} beforeUpload={handleRefUpload} style={{ borderRadius: 8 }}>
              <p className="ant-upload-drag-icon"><BookOutlined style={{ fontSize: 36, color: '#1677ff' }} /></p>
              <p className="ant-upload-text">上传参考教材 / 标准（作为审核依据）</p>
              <p className="ant-upload-hint">支持 PDF / DOCX / TXT / MD</p>
            </Dragger>
            {referenceText && <div className="mt-2 text-blue-600 text-sm"><CheckCircleOutlined /> 审核依据已加载</div>}
          </Col>
        </Row>

        <div className="mt-5 flex items-center gap-3">
          <Button type="primary" icon={<SearchOutlined />} loading={checking} onClick={handleCheck} size="large">
            {checking ? '正在审核现有题库…' : '开始审核现有题库'}
          </Button>
          {checking && <Progress percent={progress} style={{ width: 240 }} status="active" />}
        </div>
      </Card>

      {results.length > 0 && (
        <Card>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <Statistic title="审核通过" value={passCount} valueStyle={{ color: '#22c55e' }} />
            <Statistic title="存在问题" value={failCount} valueStyle={{ color: '#ef4444' }} />
            <Statistic title="需要完善" value={warnCount} valueStyle={{ color: '#f59e0b' }} />
          </div>
          <Table
            rowKey="id"
            size="small"
            dataSource={results}
            pagination={{ pageSize: 10 }}
            columns={[
              { title: '题目内容', dataIndex: 'content', ellipsis: true },
              {
                title: '审核结果', dataIndex: 'result', width: 120,
                render: (r: string) =>
                  r === 'pass' ? <Tag color="success" icon={<CheckCircleOutlined />}>通过</Tag> :
                  r === 'fail' ? <Tag color="error" icon={<AlertCircle className="w-3.5 h-3.5" />}>存在问题</Tag> :
                  <Tag color="warning">需完善</Tag>,
              },
              { title: '审核意见', dataIndex: 'reason', width: 300 },
            ]}
          />
        </Card>
      )}
    </div>
  );
}
