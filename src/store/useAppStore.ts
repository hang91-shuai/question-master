import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppState, FileItem, OutlineItem, QuestionBank, ExamPlanItem, Question, StepKey, PersonalProfile, UserRole, UserAccount, WrongQuestion } from '../types';

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
      wrongQuestions: [],

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

      mergeOutlineItems: (items: OutlineItem[]) =>
        set((state) => {
          const existingCodes = new Set(state.outlineItems.map((o) => o.code));
          const newItems = items.filter((o) => !existingCodes.has(o.code));
          return { outlineItems: [...state.outlineItems, ...newItems] };
        }),

      setAiModel: (model: string) => set({ aiModel: model }),

      setSkillType: (type: string) => set({ skillType: type }),

      addQuestionBank: (bank: QuestionBank) =>
        set((state) => ({
          questionBanks: [...state.questionBanks, bank],
          selectedBankId: bank.id,
        })),

      appendQuestionsToBank: (bankId: string, questions: Question[]) =>
        set((state) => ({
          questionBanks: state.questionBanks.map((bank) =>
            bank.id === bankId
              ? {
                  ...bank,
                  questions: [...bank.questions, ...questions],
                  updatedAt: new Date().toISOString(),
                }
              : bank
          ),
          selectedBankId: bankId,
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

      removeQuestionBank: (bankId: string) =>
        set((state) => {
          const remaining = state.questionBanks.filter((b) => b.id !== bankId);
          const selected = state.selectedBankId === bankId ? (remaining[remaining.length - 1]?.id ?? null) : state.selectedBankId;
          return { questionBanks: remaining, selectedBankId: selected };
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

      addWrongQuestion: (entry) =>
        set((state) => {
          const exists = state.wrongQuestions.some(
            (w) => w.userId === entry.userId && w.bankId === entry.bankId && w.questionId === entry.questionId
          );
          if (exists) return state;
          const newEntry: WrongQuestion = {
            id: `wq_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            userId: entry.userId,
            bankId: entry.bankId,
            questionId: entry.questionId,
            addedAt: new Date().toLocaleString(),
            source: entry.source,
            correctCount: 0,
            wrongCount: 0,
          };
          return { wrongQuestions: [...state.wrongQuestions, newEntry] };
        }),

      removeWrongQuestion: (id) =>
        set((state) => ({ wrongQuestions: state.wrongQuestions.filter((w) => w.id !== id) })),

      bumpWrongStats: (id, correct) =>
        set((state) => ({
          wrongQuestions: state.wrongQuestions.map((w) =>
            w.id === id
              ? {
                  ...w,
                  correctCount: (w.correctCount || 0) + (correct ? 1 : 0),
                  wrongCount: (w.wrongCount || 0) + (correct ? 0 : 1),
                }
              : w
          ),
        })),
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
        wrongQuestions: state.wrongQuestions,
      }),
    }
  )
);
