import { Steps } from 'antd';
import { useAppStore } from '../store/useAppStore';
import type { StepKey } from '../types';
import {
  Upload,
  FileQuestion,
  CheckSquare,
  Database,
  Search,
  Calendar,
  FileOutput,
  User,
  FileBadge,
} from 'lucide-react';

const steps: { key: StepKey; title: string; icon: React.ReactNode }[] = [
  { key: 'import', title: '导入标准', icon: <Upload className="w-4 h-4" /> },
  { key: 'generate', title: '生成题库', icon: <FileQuestion className="w-4 h-4" /> },
  { key: 'review', title: '在线审核', icon: <CheckSquare className="w-4 h-4" /> },
  { key: 'manage', title: '题库管理', icon: <Database className="w-4 h-4" /> },
  { key: 'existing-review', title: '现有题库审核', icon: <Search className="w-4 h-4" /> },
  { key: 'plan', title: '组卷计划书', icon: <Calendar className="w-4 h-4" /> },
  { key: 'paper', title: '抽题组卷', icon: <FileOutput className="w-4 h-4" /> },
  { key: 'profile', title: '管理个人信息', icon: <User className="w-4 h-4" /> },
  { key: 'cert', title: '认定文件生成', icon: <FileBadge className="w-4 h-4" /> },
];

export function StepNav() {
  const { currentStep, setCurrentStep } = useAppStore();

  const activeIndex = steps.findIndex((s) => s.key === currentStep);

  return (
    <div className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-[1440px] mx-auto px-4 py-4">
        <Steps
          current={activeIndex}
          onChange={(index) => setCurrentStep(steps[index].key)}
          size="small"
          responsive={false}
          items={steps.map((s) => ({ title: s.title, icon: s.icon }))}
          className="step-nav"
        />
      </div>
    </div>
  );
}
