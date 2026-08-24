import { create } from 'zustand';
import type { AppState, FileItem, OutlineItem, QuestionBank, ExamPlanItem, Question, StepKey, PersonalProfile } from '../types';

const defaultProfile: PersonalProfile = {
  name: '管理员',
  org: '职业技能鉴定中心',
  role: '命题专家',
  email: 'admin@example.com',
};

export const useAppStore = create<AppState>((set) => ({
  currentStep: 'import',
  standardFiles: [],
  materialFiles: [],
  outlineItems: [],
  aiModel: 'deepseek',
  skillType: 'manual',
  questionBanks: [],
  examPlans: [],
  selectedBankId: null,
  profile: defaultProfile,

  setCurrentStep: (step: StepKey) => set({ currentStep: step }),

  addStandardFile: (file: FileItem) =>
    set((state) => ({ standardFiles: [...state.standardFiles, file] })),

  addMaterialFile: (file: FileItem) =>
    set((state) => ({ materialFiles: [...state.materialFiles, file] })),

  updateFileStatus: (id: string, status: FileItem['status'], content?: string) =>
    set((state) => ({
      standardFiles: state.standardFiles.map((f) =>
        f.id === id ? { ...f, status, content: content ?? f.content } : f
      ),
      materialFiles: state.materialFiles.map((f) =>
        f.id === id ? { ...f, status, content: content ?? f.content } : f
      ),
    })),

  setOutlineItems: (items: OutlineItem[]) => set({ outlineItems: items }),

  setAiModel: (model: string) => set({ aiModel: model }),

  setSkillType: (type: string) => set({ skillType: type }),

  addQuestionBank: (bank: QuestionBank) =>
    set((state) => ({
      questionBanks: [...state.questionBanks, bank],
      selectedBankId: bank.id,
    })),

  updateQuestionStatus: (bankId: string, qId: string, status: Question['status'], reason?: string) =>
    set((state) => ({
      questionBanks: state.questionBanks.map((bank) =>
        bank.id === bankId
          ? {
              ...bank,
              questions: bank.questions.map((q) =>
                q.id === qId ? { ...q, status, rejectReason: reason ?? q.rejectReason } : q
              ),
            }
          : bank
      ),
    })),

  addExamPlan: (plan: ExamPlanItem) =>
    set((state) => ({ examPlans: [...state.examPlans, plan] })),

  setSelectedBankId: (id: string | null) => set({ selectedBankId: id }),

  updateProfile: (profile: Partial<PersonalProfile>) =>
    set((state) => ({ profile: { ...state.profile, ...profile } })),
}));
