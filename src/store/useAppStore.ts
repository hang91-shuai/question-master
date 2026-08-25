import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppState, FileItem, OutlineItem, QuestionBank, ExamPlanItem, Question, StepKey, PersonalProfile, UserRole, UserAccount } from '../types';

const defaultProfile: PersonalProfile = {
  name: '管理员',
  org: '职业技能鉴定中心',
  role: '命题专家',
  email: 'admin@example.com',
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      currentStep: 'import',
      currentUser: 'guest',
      currentUserName: '',
      userAccounts: [],
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

      setCurrentUser: (role: UserRole, name: string) =>
        set({ currentUser: role, currentUserName: name }),

      registerAccount: (account) => {
        let ok = true;
        set((state) => {
          const exists = state.userAccounts.some(
            (u) => u.username.toLowerCase() === account.username.toLowerCase()
          );
          if (exists) {
            ok = false;
            return state;
          }
          const newAccount: UserAccount = {
            id: `acc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            username: account.username,
            password: account.password,
            name: account.name,
            role: account.role,
            createdAt: new Date().toLocaleString(),
          };
          return { userAccounts: [...state.userAccounts, newAccount] };
        });
        return ok;
      },

      logout: () => set({ currentUser: 'guest', currentUserName: '' }),

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

      mergeQuestionBanks: (banks: QuestionBank[]) =>
        set((state) => {
          const existingIds = new Set(state.questionBanks.map((b) => b.id));
          const newBanks = banks.filter((b) => !existingIds.has(b.id));
          if (newBanks.length === 0) return state;
          return {
            questionBanks: [...state.questionBanks, ...newBanks],
            selectedBankId: state.selectedBankId ?? newBanks[0]?.id,
          };
        }),

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

      batchUpdateQuestionStatus: (bankId: string, ids: string[], status: Question['status'], reason?: string) =>
        set((state) => ({
          questionBanks: state.questionBanks.map((bank) =>
            bank.id === bankId
              ? {
                  ...bank,
                  questions: bank.questions.map((q) =>
                    ids.includes(q.id)
                      ? { ...q, status, rejectReason: reason ?? q.rejectReason }
                      : q
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
    }),
    {
      name: 'question-master-storage',
      partialize: (state) => ({
        questionBanks: state.questionBanks,
        examPlans: state.examPlans,
        standardFiles: state.standardFiles,
        materialFiles: state.materialFiles,
        outlineItems: state.outlineItems,
        profile: state.profile,
        selectedBankId: state.selectedBankId,
        currentUser: state.currentUser,
        currentUserName: state.currentUserName,
        userAccounts: state.userAccounts,
      }),
    }
  )
);
