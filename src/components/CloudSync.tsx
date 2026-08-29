import { useState } from 'react';
import { Card, Button, message, Alert, Tooltip } from 'antd';
import {
  CloudUploadOutlined,
  CloudDownloadOutlined,
  CloudServerOutlined,
  ClearOutlined,
} from '@ant-design/icons';
import { useAppStore } from '../store/useAppStore';
import {
  isCloudConfigured,
  syncBanksToCloud,
  fetchBanksFromCloud,
  dedupeBanksByContent,
} from '../services/cloudService';

export function CloudSync() {
  const questionBanks = useAppStore((s) => s.questionBanks);
  const addQuestionBank = useAppStore((s) => s.addQuestionBank);
  const setQuestionBanks = useAppStore((s) => s.setQuestionBanks);
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(false);

  const configured = isCloudConfigured();

  const handlePush = async () => {
    if (questionBanks.length === 0) {
      message.warning('暂无题库可同步，请先生成题库');
      return;
    }
    setSyncing(true);
    try {
      await syncBanksToCloud(questionBanks);
      message.success(`已同步 ${questionBanks.length} 个题库到云端，访问者可立即刷题`);
    } catch (e: any) {
      message.error(e.message || '同步失败');
    } finally {
      setSyncing(false);
    }
  };

  const handlePull = async () => {
    setLoading(true);
    try {
      const banks = await fetchBanksFromCloud();
      if (banks.length === 0) {
        message.info('云端暂无可拉取的题库');
        return;
      }
      // 拉取后合并到本地（避免重复）
      banks.forEach((b) => addQuestionBank(b));
      message.success(`已从云端拉取 ${banks.length} 个题库`);
    } catch (e: any) {
      message.error(e.message || '拉取失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDedupe = () => {
    if (questionBanks.length === 0) {
      message.warning('暂无题库可去重，请先生成题库');
      return;
    }
    const before = questionBanks.reduce((s, b) => s + b.questions.length, 0);
    const deduped = dedupeBanksByContent(questionBanks);
    const after = deduped.reduce((s, b) => s + b.questions.length, 0);
    const removed = before - after;

    if (removed === 0) {
      message.success(`已检查 ${before} 题，未发现重复，无需去重`);
      return;
    }
    // 写入本地 store，后续「同步题库到云端」上传的即为去重后的数据
    setQuestionBanks(deduped);
    message.success(`去重完成：${before} 题 → ${after} 题，已清理 ${removed} 道重复题`);
  };

  return (
    <Card>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <CloudServerOutlined className="text-2xl text-cyan-500 mt-0.5" />
          <div>
            <div className="font-bold text-gray-800 flex items-center gap-2">
              云端题库共享
              {configured ? (
                <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded">已配置</span>
              ) : (
                <span className="text-xs text-orange-500 bg-orange-50 px-2 py-0.5 rounded">未配置</span>
              )}
            </div>
            <p className="text-gray-400 text-sm mt-1 mb-0">
              将题库同步到腾讯云 CloudBase，所有访问者即可刷到你审核通过的题。
            </p>
            {!configured && (
              <Alert
                className="mt-2"
                type="warning"
                showIcon
                message="未配置云端同步代理"
                description="请在项目根目录 .env.local 中设置 VITE_CLOUDBASE_PROXY_URL（HTTP 云函数代理地址）后重新构建部署，再使用云端共享功能。"
              />
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Tooltip title="对本地题库按题干一键去重（内容相同仅保留一题，优先保留答案/解析最完整的那题），去重后点击「同步题库到云端」上传即生效">
            <Button icon={<ClearOutlined />} onClick={handleDedupe} disabled={questionBanks.length === 0}>
              一键去重
            </Button>
          </Tooltip>
          <Tooltip title="把当前题库上传到云端，供所有访问者刷题">
            <Button
              type="primary"
              icon={<CloudUploadOutlined />}
              loading={syncing}
              onClick={handlePush}
              disabled={!configured}
            >
              同步题库到云端
            </Button>
          </Tooltip>
          <Tooltip title="从云端下载题库到本地">
            <Button
              icon={<CloudDownloadOutlined />}
              loading={loading}
              onClick={handlePull}
              disabled={!configured}
            >
              从云端拉取
            </Button>
          </Tooltip>
        </div>
      </div>
    </Card>
  );
}
