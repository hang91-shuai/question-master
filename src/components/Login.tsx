import { useState } from 'react';
import { useEffect } from 'react';
import { Input, Button, message, Alert } from 'antd';
import { UserOutlined, LockOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { GraduationCap, BookOpen, Target, TrendingUp } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { fetchBanksFromCloud, isCloudConfigured, loginCloud, fetchWrongQuestionsCloud, fetchPracticeStatsCloud } from '../services/cloudService';

export function Login() {
  const { setCurrentUser, setPracticeView, hydrateCloudUserData, mergeQuestionBanks } = useAppStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // 登录成功后异步加载云端题库，供考生刷题
  const loadCloudBanks = async () => {
    if (!isCloudConfigured()) return;
    try {
      const banks = await fetchBanksFromCloud();
      if (banks.length > 0) mergeQuestionBanks(banks);
    } catch (e) {
      // 云端加载失败不阻塞登录
    }
  };

  // 页面打开即自动拉取一次云端题库，保证登录后能立即拿到最新题库
  useEffect(() => {
    loadCloudBanks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 登录成功后从云端恢复该考生的错题本/练习统计（云端为主）
  const hydrateCloudData = async (userId: string) => {
    try {
      const [wrong, stats] = await Promise.all([
        fetchWrongQuestionsCloud(userId),
        fetchPracticeStatsCloud(userId),
      ]);
      hydrateCloudUserData(userId, wrong, stats);
    } catch {
      // 云端数据恢复失败不阻塞登录
    }
  };

  const doLogin = async () => {
    const u = username.trim();
    const p = password.trim();
    if (!u || !p) { message.warning('请输入账号和密码'); return; }
    if (!isCloudConfigured()) { message.error('云端未配置，暂无法登录'); return; }
    setLoading(true);
    try {
      const user = await loginCloud(u, p);
      if (!user) {
        message.error('账号或密码错误');
        return;
      }
      setCurrentUser(user.role, user.name, user.id);
      setPracticeView(false); // 管理员默认进后台，答题端需手动切换
      loadCloudBanks();
      hydrateCloudData(user.id);
      message.success(`欢迎，${user.name}`);
    } catch {
      message.error('登录失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#0b1120] flex flex-col lg:flex-row relative overflow-hidden font-sans">
      {/* 左侧品牌视觉区：桌面固定左侧占约 55%，移动端为顶部品牌头 */}
      <div className="w-full lg:w-[55%] xl:w-[58%] lg:h-screen relative flex flex-col justify-between p-8 sm:p-12 lg:p-12 xl:p-16 text-white overflow-hidden shrink-0">
        {/* 有机流动的背景 blob */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-[10%] -left-[10%] w-[70%] h-[70%] bg-indigo-600/40 rounded-blob blob-morph blur-[90px]" />
          <div className="absolute top-[20%] right-[-15%] w-[60%] h-[60%] bg-violet-500/30 rounded-blob blob-morph blur-[80px]" style={{ animationDelay: '-4s' }} />
          <div className="absolute bottom-[-10%] left-[15%] w-[55%] h-[55%] bg-cyan-500/25 rounded-blob blob-morph blur-[90px]" style={{ animationDelay: '-8s' }} />
          {/* 细密网格，增加知识/科技氛围 */}
          <div className="absolute inset-0 opacity-[0.035]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.4) 1px, transparent 1px)', backgroundSize: '48px 48px' }} />
        </div>

        {/* 顶部 Logo */}
        <div className="relative z-10 flex items-center gap-3 justify-center lg:justify-start">
          <div className="w-11 h-11 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 flex items-center justify-center">
            <GraduationCap className="w-6 h-6 text-white" />
          </div>
          <span className="text-lg font-semibold tracking-wide">QuestionMaster</span>
        </div>

        {/* 中部大标题 + 数据卡片 */}
        <div className="relative z-10 max-w-lg mx-auto lg:mx-0 text-center lg:text-left mt-8 mb-10 lg:mt-0 lg:mb-0">
          <p className="text-orange-400 font-medium tracking-widest text-sm mb-4 uppercase">Online Practice System</p>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-bold leading-[1.1] mb-4 lg:mb-6">
            把每一次练习<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-300 to-amber-200">都变成有效积累</span>
          </h1>
          <p className="text-white/60 text-base lg:text-lg leading-relaxed mb-6 lg:mb-10 max-w-md mx-auto lg:mx-0">
            章节练习、标准组卷、错题本反复训练，让备考像打游戏升级一样有迹可循。
          </p>

          <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row gap-3 lg:gap-4 justify-center lg:justify-start">
            <div className="float-slow flex items-center gap-3 px-4 lg:px-5 py-3 lg:py-4 rounded-2xl bg-white/8 backdrop-blur-md border border-white/10">
              <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-xl bg-orange-500/20 flex items-center justify-center shrink-0">
                <BookOpen className="w-4 h-4 lg:w-5 lg:h-5 text-orange-300" />
              </div>
              <div className="text-left">
                <div className="text-base lg:text-xl font-bold">章节练习</div>
                <div className="text-[11px] lg:text-xs text-white/50">按题库自由组卷</div>
              </div>
            </div>
            <div className="float-slow flex items-center gap-3 px-4 lg:px-5 py-3 lg:py-4 rounded-2xl bg-white/8 backdrop-blur-md border border-white/10" style={{ animationDelay: '-1.5s' }}>
              <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center shrink-0">
                <Target className="w-4 h-4 lg:w-5 lg:h-5 text-cyan-300" />
              </div>
              <div className="text-left">
                <div className="text-base lg:text-xl font-bold">标准考试</div>
                <div className="text-[11px] lg:text-xs text-white/50">40单选+10多选+10判断</div>
              </div>
            </div>
            <div className="float-slow flex items-center gap-3 px-4 lg:px-5 py-3 lg:py-4 rounded-2xl bg-white/8 backdrop-blur-md border border-white/10" style={{ animationDelay: '-3s' }}>
              <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-xl bg-violet-500/20 flex items-center justify-center shrink-0">
                <TrendingUp className="w-4 h-4 lg:w-5 lg:h-5 text-violet-300" />
              </div>
              <div className="text-left">
                <div className="text-base lg:text-xl font-bold">错题本</div>
                <div className="text-[11px] lg:text-xs text-white/50">自动收录 + 手动收藏</div>
              </div>
            </div>
          </div>
        </div>

        {/* 底部：仅桌面显示 */}
        <div className="hidden lg:block relative z-10 text-white/30 text-sm">
          题库刷题练习系统 · 适合职业资格/等级认定备考
        </div>
      </div>

      {/* 右侧表单区 */}
      <div className="w-full lg:w-[45%] xl:w-[42%] min-h-screen bg-[#faf9f7] flex flex-col justify-center p-6 sm:p-10 lg:p-16 relative">
        <div className="max-w-md w-full mx-auto">
          {/* 表单头部 */}
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-[#0b1120] mb-2">欢迎回来</h2>
            <p className="text-gray-500">登录后继续你的备考进度</p>
          </div>

          <div className="space-y-5">
            <Input
              size="large"
              placeholder="账号"
              prefix={<UserOutlined className="text-gray-400" />}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <Input.Password
              size="large"
              placeholder="密码"
              prefix={<LockOutlined className="text-gray-400" />}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onPressEnter={doLogin}
            />
            <Button
              type="primary"
              size="large"
              block
              loading={loading}
              icon={<ArrowRightOutlined />}
              onClick={doLogin}
              className="login-btn-primary"
            >
              登录
            </Button>
            <Alert
              type="info"
              showIcon
              message="账号由管理员统一发放，如忘记密码请联系管理员。"
              className="rounded-xl"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
