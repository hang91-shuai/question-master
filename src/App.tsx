import { ConfigProvider, App as AntApp, Button } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { LogoutOutlined } from '@ant-design/icons';
import { Header } from './components/Header';
import { StepNav } from './components/StepNav';
import { useAppStore } from './store/useAppStore';
import { Login } from './components/Login';
import { CloudSync } from './components/CloudSync';
import { ImportStandard } from './components/modules/ImportStandard';
import { GenerateQuestions } from './components/modules/GenerateQuestions';
import { OnlineReview } from './components/modules/OnlineReview';
import { ManageBank } from './components/modules/ManageBank';
import { ExistingReview } from './components/modules/ExistingReview';
import { ExamPlan } from './components/modules/ExamPlan';
import { PaperAssembly } from './components/modules/PaperAssembly';
import { PersonalInfo } from './components/modules/PersonalInfo';
import { CertGenerate } from './components/modules/CertGenerate';
import { Practice } from './components/modules/Practice';

const moduleMap = {
  import: ImportStandard,
  generate: GenerateQuestions,
  review: OnlineReview,
  manage: ManageBank,
  'existing-review': ExistingReview,
  plan: ExamPlan,
  paper: PaperAssembly,
  profile: PersonalInfo,
  cert: CertGenerate,
  practice: Practice,
} as const;

function AppContent() {
  const currentStep = useAppStore((s) => s.currentStep);
  const currentUser = useAppStore((s) => s.currentUser);
  const logout = useAppStore((s) => s.logout);

  // 未登录 -> 登录门面
  if (currentUser === 'guest') {
    return <Login />;
  }

  // 考生 -> 纯净刷题端（看不到任何命题功能）
  if (currentUser === 'student') {
    return <Practice />;
  }

  // 管理员 -> 命题后台
  const Module = moduleMap[currentStep];

  return (
    <div className="min-h-screen bg-[#f6f8fb]">
      <Header />
      <StepNav />
      <main className="max-w-[1440px] mx-auto px-3 sm:px-6 py-4 sm:py-6 overflow-x-hidden">
        {['generate', 'review', 'manage'].includes(currentStep) && (
          <div className="mb-4 sm:mb-5">
            <CloudSync />
          </div>
        )}
        <Module />
      </main>
      <footer className="text-center text-gray-400 text-xs py-6 sm:py-8 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 px-4">
        职业技能等级命题大师 · 本地优先 · 全等级可溯源题库平台
        <Button
          type="link"
          size="small"
          icon={<LogoutOutlined />}
          onClick={() => logout()}
        >
          退出管理后台
        </Button>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: '#1677ff',
          borderRadius: 6,
          colorBgLayout: '#f6f8fb',
        },
      }}
    >
      <AntApp>
        <AppContent />
      </AntApp>
    </ConfigProvider>
  );
}
