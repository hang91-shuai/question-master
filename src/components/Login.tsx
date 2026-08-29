import { useState } from 'react';
import { useEffect } from 'react';
import { Input, Button, message, Tabs, Alert } from 'antd';
import { UserOutlined, LockOutlined, ArrowRightOutlined, SettingOutlined, IdcardOutlined, TeamOutlined } from '@ant-design/icons';
import { GraduationCap, BookOpen, Target, TrendingUp } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { fetchBanksFromCloud, isCloudConfigured } from '../services/cloudService';
import type { UserRole } from '../types';

const DEFAULT_STUDENT = { username: 'student', password: '123456', name: '考生' };
const DEFAULT_ADMIN = { username: 'admin', password: 'admin123', name: '管理员' };

export function Login() {
  const { setCurrentUser, userAccounts, registerAccount, mergeQuestionBanks } = useAppStore();
  const [adminMode, setAdminMode] = useState(false);
  const [tab, setTab] = useState<'login' | 'register'>('login');

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

  // 页面打开即自动拉取一次云端题库，保证游客/考生都能拿到最新题库（本地缓存若过期会被云端覆盖）
  useEffect(() => {
    loadCloudBanks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  const doLogin = (role: UserRole) => {
    const u = username.trim();
    const p = password.trim();
    if (!u || !p) { message.warning('请输入账号和密码'); return; }

    if (role === 'admin') {
      if (u === DEFAULT_ADMIN.username && p === DEFAULT_ADMIN.password) {
        setCurrentUser('admin', DEFAULT_ADMIN.name);
        loadCloudBanks();
      } else {
        const acc = userAccounts.find((a) => a.role === 'admin' && a.username === u && a.password === p);
        if (acc) { setCurrentUser('admin', acc.name); loadCloudBanks(); }
        else message.error('管理员账号或密码错误');
      }
      return;
    }

    // 考生登录
    if (u === DEFAULT_STUDENT.username && p === DEFAULT_STUDENT.password) {
      setCurrentUser('student', DEFAULT_STUDENT.name);
      loadCloudBanks();
      return;
    }
    const acc = userAccounts.find((a) => a.role === 'student' && a.username === u && a.password === p);
    if (acc) {
      setCurrentUser('student', acc.name);
      loadCloudBanks();
    } else {
      message.error('账号或密码错误');
    }
  };

  const doRegister = () => {
    const u = username.trim();
    const p = password.trim();
    const n = name.trim();
    if (!u || !p || !n) { message.warning('请完整填写姓名、账号、密码'); return; }
    if (p.length < 6) { message.warning('密码至少 6 位'); return; }
    if (u === DEFAULT_STUDENT.username || u === DEFAULT_ADMIN.username) {
      message.error('该账号已被系统占用'); return;
    }
    const ok = registerAccount({ username: u, password: p, name: n, role: 'student' });
    if (ok) {
      message.success('注册成功，请登录');
      setTab('login');
      setPassword('');
    } else {
      message.error('该账号已存在，请更换');
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
        {/* 右上角管理员入口 */}
        <button
          onClick={() => { setAdminMode(!adminMode); setTab('login'); setPassword(''); }}
          className="absolute top-5 right-6 text-gray-400 hover:text-gray-700 text-xs flex items-center gap-1 transition-colors"
        >
          <SettingOutlined /> {adminMode ? '返回考生登录' : '管理后台'}
        </button>

        <div className="max-w-md w-full mx-auto">
          {/* 表单头部：桌面显示，移动端隐藏（品牌头已包含标题） */}
          <div className="mb-8 hidden lg:block">
            <h2 className="text-3xl font-bold text-[#0b1120] mb-2">
              {adminMode ? '管理员登录' : '欢迎回来'}
            </h2>
            <p className="text-gray-500">
              {adminMode ? '进入命题与题库管理后台' : '登录后继续你的备考进度'}
            </p>
          </div>

          {adminMode ? (
            <div className="space-y-5">
              <Input
                size="large"
                placeholder="管理员账号"
                prefix={<UserOutlined className="text-gray-400" />}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="login-input"
              />
              <Input.Password
                size="large"
                placeholder="管理员密码"
                prefix={<LockOutlined className="text-gray-400" />}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onPressEnter={() => doLogin('admin')}
                className="login-input"
              />
              <Button
                type="primary"
                size="large"
                block
                onClick={() => doLogin('admin')}
                className="login-btn-primary"
              >
                进入管理后台
              </Button>
              <Alert type="info" showIcon message="默认管理员：admin / admin123" className="rounded-xl" />
            </div>
          ) : (
            <Tabs
              activeKey={tab}
              onChange={(k) => { setTab(k as 'login' | 'register'); setPassword(''); }}
              className="login-tabs"
              items={[
                {
                  key: 'login',
                  label: <span className="flex items-center gap-1.5"><TeamOutlined /> 登录</span>,
                  children: (
                    <div className="space-y-5 pt-2">
                      <Input
                        size="large"
                        placeholder="账号"
                        prefix={<UserOutlined className="text-gray-400" />}
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="login-input"
                      />
                      <Input.Password
                        size="large"
                        placeholder="密码"
                        prefix={<LockOutlined className="text-gray-400" />}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onPressEnter={() => doLogin('student')}
                        className="login-input"
                      />
                      <Button
                        type="primary"
                        size="large"
                        block
                        icon={<ArrowRightOutlined />}
                        onClick={() => doLogin('student')}
                        className="login-btn-primary"
                      >
                        进入刷题
                      </Button>
                      <Alert type="info" showIcon message="体验账号：student / 123456" className="rounded-xl" />
                    </div>
                  ),
                },
                {
                  key: 'register',
                  label: <span className="flex items-center gap-1.5"><IdcardOutlined /> 注册</span>,
                  children: (
                    <div className="space-y-5 pt-2">
                      <Input
                        size="large"
                        placeholder="姓名"
                        prefix={<IdcardOutlined className="text-gray-400" />}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="login-input"
                      />
                      <Input
                        size="large"
                        placeholder="设置账号"
                        prefix={<UserOutlined className="text-gray-400" />}
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="login-input"
                      />
                      <Input.Password
                        size="large"
                        placeholder="设置密码（至少6位）"
                        prefix={<LockOutlined className="text-gray-400" />}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onPressEnter={doRegister}
                        className="login-input"
                      />
                      <Button
                        size="large"
                        block
                        onClick={doRegister}
                        className="login-btn-secondary"
                      >
                        注册账号
                      </Button>
                    </div>
                  ),
                },
              ]}
            />
          )}
        </div>
      </div>
    </div>
  );
}
