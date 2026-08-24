import { ConfigProvider, App as AntApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { Header } from './components/Header';
import { StepNav } from './components/StepNav';
import { useAppStore } from './store/useAppStore';
import { ImportStandard } from './components/modules/ImportStandard';
import { GenerateQuestions } from './components/modules/GenerateQuestions';
import { OnlineReview } from './components/modules/OnlineReview';
import { ManageBank } from './components/modules/ManageBank';
import { ExistingReview } from './components/modules/ExistingReview';
import { ExamPlan } from './components/modules/ExamPlan';
import { PaperAssembly } from './components/modules/PaperAssembly';
import { PersonalInfo } from './components/modules/PersonalInfo';
import { CertGenerate } from './components/modules/CertGenerate';

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
} as const;

function AppContent() {
  const currentStep = useAppStore((s) => s.currentStep);
  const Module = moduleMap[currentStep];

  return (
    <div className="min-h-screen bg-[#f6f8fb]">
      <Header />
      <StepNav />
      <main className="max-w-[1440px] mx-auto px-6 py-6">
        <Module />
      </main>
      <footer className="text-center text-gray-400 text-xs py-8">
        职业技能等级命题大师 · 本地优先 · 全等级可溯源题库平台
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
