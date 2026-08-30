import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppState, FileItem, OutlineItem, QuestionBank, ExamPlanItem, Question, StepKey, PersonalProfile, UserRole, WrongQuestion } from '../types';
import { cleanQuestion, cleanQuestionBank, cleanQuestionBanks } from '../utils/questionCleaner';
import { isCloudConfigured, overwriteWrongQuestionsCloud, overwritePracticeStatsCloud } from '../services/cloudService';

const defaultProfile: PersonalProfile = {
  name: '管理员',
  org: '职业技能鉴定中心',
  role: '命题专家',
  email: 'admin@example.com',
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      currentStep: 'import',
      currentUser: 'guest',
      currentUserName: '',
      currentUserId: '',
      practiceView: false,
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
      practiceStats: {},

      setCurrentStep: (step: StepKey) => set({ currentStep: step }),

      setCurrentUser: (role: UserRole, name: string, userId?: string) =>
        set({ currentUser: role, currentUserName: name, currentUserId: userId ?? '' }),

      setPracticeView: (v: boolean) => set({ practiceView: v }),

      logout: () =>
        set({ currentUser: 'guest', currentUserName: '', currentUserId: '', practiceView: false }),

      addStandardFile: (file: FileItem) =>
        set((state) => ({ standardFiles: [...state.standardFiles, file] })),

      addMaterialFile: (file: FileItem) =>
        set((state) => ({ materialFiles: [...state.materialFiles, file] })),

      removeStandardFile: (id: string) =>
        set((state) => ({ standardFiles: state.standardFiles.filter((f) => f.id !== id) })),

      removeMaterialFile: (id: string) =>
        set((state) => ({ materialFiles: state.materialFiles.filter((f) => f.id !== id) })),

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
          questionBanks: [...state.questionBanks, cleanQuestionBank(bank)],
          selectedBankId: bank.id,
        })),

      appendQuestionsToBank: (bankId: string, questions: Question[]) =>
        set((state) => ({
          questionBanks: state.questionBanks.map((bank) =>
            bank.id === bankId
              ? {
                  ...bank,
                  questions: [...bank.questions, ...questions.map(cleanQuestion)],
                  updatedAt: new Date().toISOString(),
                }
              : bank
          ),
          selectedBankId: bankId,
        })),

      mergeQuestionBanks: (banks: QuestionBank[]) =>
        set((state) => {
          if (banks.length === 0) return state;
          // 云端数据覆盖本地同 id 的题库，保证登录后以云端为准（跨设备同步最新题库）
          const cleaned = cleanQuestionBanks(banks);
          const cloudIds = new Set(cleaned.map((b) => b.id));
          const kept = state.questionBanks.filter((b) => !cloudIds.has(b.id));
          const merged = [...kept, ...cleaned];
          return {
            questionBanks: merged,
            selectedBankId: state.selectedBankId ?? cleaned[0]?.id,
          };
        }),

      setQuestionBanks: (banks: QuestionBank[]) =>
        set((state) => ({
          questionBanks: cleanQuestionBanks(banks),
          selectedBankId:
            state.selectedBankId && banks.some((b) => b.id === state.selectedBankId)
              ? state.selectedBankId
              : (banks[banks.length - 1]?.id ?? null),
        })),

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

      addWrongQuestion: (entry) => {
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
        });
        // 本地写入后异步覆盖式同步云端（失败不阻塞）
        const uid = entry.userId;
        if (isCloudConfigured() && uid) {
          const list = get().wrongQuestions.filter((w) => w.userId === uid);
          overwriteWrongQuestionsCloud(uid, list).catch(() => {});
        }
      },

      removeWrongQuestion: (id) => {
        const target = get().wrongQuestions.find((w) => w.id === id);
        set((state) => ({ wrongQuestions: state.wrongQuestions.filter((w) => w.id !== id) }));
        const uid = target?.userId;
        if (isCloudConfigured() && uid) {
          const list = get().wrongQuestions.filter((w) => w.userId === uid);
          overwriteWrongQuestionsCloud(uid, list).catch(() => {});
        }
      },

      bumpWrongStats: (id, correct) => {
        const target = get().wrongQuestions.find((w) => w.id === id);
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
        }));
        const uid = target?.userId;
        if (isCloudConfigured() && uid) {
          const list = get().wrongQuestions.filter((w) => w.userId === uid);
          overwriteWrongQuestionsCloud(uid, list).catch(() => {});
        }
      },

      // 记录一次判分练习（首页"我的进度"统计）
      recordPractice: (userId, bankId, questionId, correct) => {
        set((state) => {
          const key = `${bankId}:${questionId}`;
          const cur = state.practiceStats[userId] || { answeredCount: 0, correctCount: 0, practicedIds: [] };
          return {
            practiceStats: {
              ...state.practiceStats,
              [userId]: {
                answeredCount: cur.answeredCount + 1,
                correctCount: cur.correctCount + (correct ? 1 : 0),
                practicedIds: cur.practicedIds.includes(key) ? cur.practicedIds : [...cur.practicedIds, key],
              },
            },
          };
        });
        // 统计变化后异步同步云端
        if (isCloudConfigured() && userId) {
          const cur = get().practiceStats[userId];
          if (cur) overwritePracticeStatsCloud(userId, cur).catch(() => {});
        }
      },

      // 登录后从云端恢复该用户数据（云端为主，覆盖本地该用户部分）
      hydrateCloudUserData: (userId, wrongList, stats) =>
        set((state) => {
          const others = state.wrongQuestions.filter((w) => w.userId !== userId);
          return {
            wrongQuestions: [...others, ...wrongList],
            practiceStats: stats
              ? { ...state.practiceStats, [userId]: stats }
              : state.practiceStats,
          };
        }),
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
        currentUserId: state.currentUserId,
        practiceView: state.practiceView,
        wrongQuestions: state.wrongQuestions,
        practiceStats: state.practiceStats,
        }),
      // 每次从 localStorage 恢复时自动清洗旧数据中可能存在的 A./B./C./D. 选项前缀
      onRehydrateStorage: () => (state) => {
        if (state && Array.isArray(state.questionBanks)) {
          state.questionBanks = cleanQuestionBanks(state.questionBanks);
        }
      },
    }
  )
);
