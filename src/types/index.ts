export interface FileItem {
  id: string;
  name: string;
  size: number;
  type: string;
  content?: string;
  status: 'pending' | 'parsing' | 'done' | 'error';
}

export interface OutlineItem {
  id: string;
  code: string;
  name: string;
  level: string;
  weight: number;
  points: string[];
}

export type QuestionType = 'single' | 'multiple' | 'judge' | 'short' | 'essay' | 'case' | 'calc' | 'blank' | 'ethics';

export interface TypeConfig {
  type: QuestionType;
  count: number;
  score: number;
  difficulty: number;
  ratio: number;
}

export interface Question {
  id: string;
  type: QuestionType;
  level: string;
  outlineCode: string;
  outlineName: string;
  content: string;
  options?: string[];
  answer?: string;
  analysis?: string;
  difficulty: 'easy' | 'medium' | 'hard';
  source: string;
  status: 'pending' | 'approved' | 'rejected';
  rejectReason?: string;
}

export interface QuestionBank {
  id: string;
  name: string;
  type: 'theory' | 'skill';
  createdAt: string;
  questionCount: number;
  questions: Question[];
}

export interface ExamPlanItem {
  id: string;
  level: string;
  type: 'theory' | 'skill';
  createdAt: string;
  configs: Record<QuestionType, number>;
}

export interface PersonalProfile {
  name: string;
  org: string;
  role: string;
  email: string;
}

export type StepKey =
  | 'import'
  | 'generate'
  | 'review'
  | 'manage'
  | 'existing-review'
  | 'plan'
  | 'paper'
  | 'profile'
  | 'cert'
  | 'practice';

export interface WrongQuestion {
  id: string;
  userId: string; // 考生标识（guest/用户名）
  bankId: string;
  questionId: string;
  addedAt: string;
  source: 'auto' | 'manual'; // auto=答错自动收，manual=手动收藏
  correctCount?: number; // 错题练习累计答对次数
  wrongCount?: number; // 累计答错次数
}

export type UserRole = 'guest' | 'student' | 'admin';

export interface UserAccount {
  id: string;
  username: string;
  password: string;
  name: string;
  role: 'student' | 'admin';
  createdAt: string;
}

export interface AppState {
  currentStep: StepKey;
  currentUser: UserRole;
  currentUserName: string;
  userAccounts: UserAccount[];
  standardFiles: FileItem[];
  materialFiles: FileItem[];
  outlineItems: OutlineItem[];
  aiModel: string;
  skillType: string;
  questionBanks: QuestionBank[];
  examPlans: ExamPlanItem[];
  selectedBankId: string | null;
  profile: PersonalProfile;
  wrongQuestions: WrongQuestion[];
  setCurrentStep: (step: StepKey) => void;
  setCurrentUser: (role: UserRole, name: string) => void;
  registerAccount: (account: Omit<UserAccount, 'id' | 'createdAt'>) => boolean;
  logout: () => void;
  addStandardFile: (file: FileItem) => void;
  addMaterialFile: (file: FileItem) => void;
  updateFileStatus: (id: string, status: FileItem['status'], content?: string) => void;
  setOutlineItems: (items: OutlineItem[]) => void;
  setAiModel: (model: string) => void;
  setSkillType: (type: string) => void;
  addQuestionBank: (bank: QuestionBank) => void;
  mergeQuestionBanks: (banks: QuestionBank[]) => void;
  removeQuestionBank: (bankId: string) => void;
  updateQuestionStatus: (bankId: string, qId: string, status: Question['status'], reason?: string) => void;
  batchUpdateQuestionStatus: (bankId: string, ids: string[], status: Question['status'], reason?: string) => void;
  addExamPlan: (plan: ExamPlanItem) => void;
  setSelectedBankId: (id: string | null) => void;
  updateProfile: (profile: Partial<PersonalProfile>) => void;
  addWrongQuestion: (entry: { userId: string; bankId: string; questionId: string; source: 'auto' | 'manual' }) => void;
  removeWrongQuestion: (id: string) => void;
  bumpWrongStats: (id: string, correct: boolean) => void;
}
