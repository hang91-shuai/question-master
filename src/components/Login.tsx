import { useState } from 'react';
import { Card, Input, Button, message, Tabs, Alert } from 'antd';
import { UserOutlined, LockOutlined, ArrowRightOutlined, SettingOutlined, IdcardOutlined, TeamOutlined } from '@ant-design/icons';
import { GraduationCap } from 'lucide-react';
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
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-500 to-cyan-400 flex items-center justify-center p-6 relative">
      {/* 右上角极小的管理员入口 */}
      <button
        onClick={() => { setAdminMode(!adminMode); setTab('login'); setPassword(''); }}
        className="absolute top-4 right-5 text-white/40 hover:text-white text-xs flex items-center gap-1 transition-colors"
      >
        <SettingOutlined /> {adminMode ? '返回考生登录' : '管理后台'}
      </button>

      <Card className="w-full max-w-md shadow-xl rounded-2xl" styles={{ body: { padding: '2.2rem' } }}>
        <div className="flex flex-col items-center mb-6">
          <div className="bg-blue-600 text-white p-4 rounded-2xl mb-3">
            <GraduationCap className="w-9 h-9" />
          </div>
          <h1 className="text-xl font-bold text-gray-800 text-center">
            {adminMode ? '管理员登录' : '题库刷题练习'}
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            {adminMode ? '进入命题管理后台' : '登录后开始刷题'}
          </p>
        </div>

        {adminMode ? (
          <div className="space-y-4">
            <Input
              size="large"
              placeholder="管理员账号"
              prefix={<UserOutlined className="text-gray-300" />}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <Input.Password
              size="large"
              placeholder="管理员密码"
              prefix={<LockOutlined className="text-gray-300" />}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onPressEnter={() => doLogin('admin')}
            />
            <Button type="primary" size="large" block onClick={() => doLogin('admin')}>
              进入管理后台
            </Button>
            <Alert type="info" showIcon message="默认管理员：admin / admin123" />
          </div>
        ) : (
          <div className="space-y-4">
            <Tabs
              activeKey={tab}
              onChange={(k) => { setTab(k as 'login' | 'register'); setPassword(''); }}
              items={[
                {
                  key: 'login',
                  label: <span><TeamOutlined /> 登录</span>,
                  children: (
                    <div className="space-y-4 pt-2">
                      <Input
                        size="large"
                        placeholder="账号"
                        prefix={<UserOutlined className="text-gray-300" />}
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                      />
                      <Input.Password
                        size="large"
                        placeholder="密码"
                        prefix={<LockOutlined className="text-gray-300" />}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onPressEnter={() => doLogin('student')}
                      />
                      <Button
                        type="primary"
                        size="large"
                        block
                        icon={<ArrowRightOutlined />}
                        onClick={() => doLogin('student')}
                      >
                        进入刷题
                      </Button>
                      <Alert type="info" showIcon message="体验账号：student / 123456" />
                    </div>
                  ),
                },
                {
                  key: 'register',
                  label: <span><IdcardOutlined /> 注册</span>,
                  children: (
                    <div className="space-y-4 pt-2">
                      <Input
                        size="large"
                        placeholder="姓名"
                        prefix={<IdcardOutlined className="text-gray-300" />}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                      <Input
                        size="large"
                        placeholder="设置账号"
                        prefix={<UserOutlined className="text-gray-300" />}
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                      />
                      <Input.Password
                        size="large"
                        placeholder="设置密码（至少6位）"
                        prefix={<LockOutlined className="text-gray-300" />}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onPressEnter={doRegister}
                      />
                      <Button size="large" block onClick={doRegister}>
                        注册账号
                      </Button>
                    </div>
                  ),
                },
              ]}
            />
          </div>
        )}
      </Card>
    </div>
  );
}
