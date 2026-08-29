import { useEffect, useMemo, useState } from 'react';
import {
  Button, Select, InputNumber, Checkbox, Radio, Tag, message,
  Progress, Empty, Alert, Space, Divider, Result, Modal, Input, Badge, Segmented,
} from 'antd';
import {
  PlayCircleOutlined, CheckCircleOutlined, CloseCircleOutlined,
  ArrowLeftOutlined, ArrowRightOutlined, ReloadOutlined, TrophyOutlined,
  LogoutOutlined, SettingOutlined, UserOutlined, FileTextOutlined,
  BookOutlined, FormOutlined, DeleteOutlined, PlusOutlined,
} from '@ant-design/icons';
import { useAppStore } from '../../store/useAppStore';
import { shuffleArray } from '../../utils/mockAI';
import type { Question, QuestionType } from '../../types';

const ADMIN_PASSWORD = 'admin123';

// 老师规定：考生刷题只保留 单选 / 多选 / 判断 三种客观题
const PRACTICE_TYPES: QuestionType[] = ['single', 'multiple', 'judge'];

// 标准考试固定配比：单选40 + 多选10 + 判断10 = 60道
const STANDARD_QUOTA: Partial<Record<QuestionType, number>> = { single: 40, multiple: 10, judge: 10 };

const typeLabels: Record<QuestionType, string> = {
  single: '单选题', multiple: '多选题', judge: '判断题', short: '简答题',
  essay: '论述题', case: '案例分析题', calc: '计算题', blank: '填空题', ethics: '职业道德题',
};

const typeShort: Record<QuestionType, string> = {
  single: '单选', multiple: '多选', judge: '判断', short: '简答', essay: '论述',
  case: '案例', calc: '计算', blank: '填空', ethics: '职业道德',
};

// 题型配色
const typeColor: Record<QuestionType, string> = {
  single: 'blue', multiple: 'purple', judge: 'green', short: 'orange', essay: 'red',
  case: 'gold', calc: 'cyan', blank: 'geekblue', ethics: 'magenta',
};

type View = 'home' | 'config' | 'answer' | 'result' | 'wrong';

interface PracticeAnswer {
  questionId: string;
  userAnswer: string;
  correct: boolean;
  actual: string;
  unscored?: boolean; // 本题无标准答案（answer 为占位符），不参与判分
}

const getOptionLetter = (idx: number) => String.fromCharCode(65 + idx);

// 解析标准答案 → 选项字母集合（支持 "A" / "A,B" / "A,B,C" 或选项文本）
const parseAnswerToLetters = (answer: string, options: string[]): Set<string> | null => {
  const trimmed = answer.trim();
  if (!trimmed || trimmed === '略' || trimmed === '无' || trimmed === 'NONE') return null;

  const letters = new Set<string>();

  // 1) 先尝试整体匹配单个选项文本（避免文本内部含逗号/顿号被错误拆分）
  const exactIdx = options.findIndex((o) => o.replace(/\s+/g, '') === trimmed.replace(/\s+/g, ''));
  if (exactIdx >= 0) {
    letters.add(getOptionLetter(exactIdx));
    return letters;
  }

  // 2) 按分隔符拆分（标准答案通常用字母或 "A,B" 格式）
  const parts = trimmed.split(/[,，、;；\s]+/).filter(Boolean);
  for (const part of parts) {
    const m = part.match(/^\s*([A-Za-z])(?:[.．、\s]|$)/);
    if (m) {
      letters.add(m[1].toUpperCase());
      continue;
    }
    // 尝试匹配选项文本
    const idx = options.findIndex((o) => o.replace(/\s+/g, '') === part.replace(/\s+/g, ''));
    if (idx >= 0) letters.add(getOptionLetter(idx));
  }

  if (letters.size === 0) return null;
  return letters;
};

// 答题模式：immediate=逐题即时对答案，batch=统一看答案
type AnswerMode = 'immediate' | 'batch';

export function Practice() {
  const {
    questionBanks, currentUserName, setCurrentUser, setCurrentStep,
    wrongQuestions, addWrongQuestion, removeWrongQuestion, bumpWrongStats,
  } = useAppStore();

  const [adminOpen, setAdminOpen] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');

  // 页面视图
  const [view, setView] = useState<View>('home');
  // 当前做题的错题ID（来自错题本练习）
  const [practiceWrongIds, setPracticeWrongIds] = useState<string[]>([]);
  // 每题所属题库映射，用于错题收集时正确归属
  const [questionBankIds, setQuestionBankIds] = useState<Record<string, string>>({});
  // 错题练习时：questionId -> wrong entry id，用于更新答对/答错统计
  const [questionWrongMap, setQuestionWrongMap] = useState<Record<string, string>>({});

  // 组卷配置
  const [bankId, setBankId] = useState<string | undefined>();
  const [count, setCount] = useState(50);
  const [selectedTypes, setSelectedTypes] = useState<QuestionType[]>(['single', 'multiple', 'judge']);
  const [mode, setMode] = useState<AnswerMode>('immediate');
  const [shuffleQ, setShuffleQ] = useState(true);

  // 答题状态
  const [questions, setQuestions] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [curAnswer, setCurAnswer] = useState('');
  const [answers, setAnswers] = useState<PracticeAnswer[]>([]);
  const [revealed, setRevealed] = useState(false);

  // 错题本筛选
  const [wrongBankFilter, setWrongBankFilter] = useState<string | undefined>();
  // 是否有未完成的练习进度（首页显示"继续上次答题"）
  const [hasSavedPractice, setHasSavedPractice] = useState(false);

  const bank = useMemo(
    () => (bankId ? questionBanks.find((b) => b.id === bankId) : undefined),
    [bankId, questionBanks]
  );

  // 当前用户标识
  const userId = currentUserName || 'guest';

  // 可选客观题（已审核通过，按 id + 内容双重去重，避免重复题目撞车）
  const available = useMemo(() => {
    if (!bank) return [];
    const seenIds = new Set<string>();
    const seenContent = new Set<string>();
    return bank.questions.filter((q) => {
      if (!PRACTICE_TYPES.includes(q.type) || q.status !== 'approved') return false;
      if (seenIds.has(q.id)) return false;
      const contentKey = (q.content || '').trim();
      if (seenContent.has(contentKey)) return false;
      seenIds.add(q.id);
      seenContent.add(contentKey);
      return true;
    });
  }, [bank]);

  const availableCounts = useMemo(() => {
    const map = new Map<QuestionType, number>();
    for (const t of PRACTICE_TYPES) map.set(t, available.filter((q) => q.type === t).length);
    return map;
  }, [available]);

  // 当前用户的错题本（关联出完整题目）
  const myWrong = useMemo(() => {
    return wrongQuestions.filter((w) => w.userId === userId);
  }, [wrongQuestions, userId]);

  const myWrongByBank = useMemo(() => {
    const byBank = new Map<string, number>();
    for (const w of myWrong) byBank.set(w.bankId, (byBank.get(w.bankId) || 0) + 1);
    return byBank;
  }, [myWrong]);

  const wrongQuestionsDetail = useMemo(() => {
    const list: { wrong: (typeof myWrong)[number]; question: Question }[] = [];
    for (const w of myWrong) {
      if (wrongBankFilter && w.bankId !== wrongBankFilter) continue;
      const bk = questionBanks.find((b) => b.id === w.bankId);
      const q = bk?.questions.find((qq) => qq.id === w.questionId);
      if (q) list.push({ wrong: w, question: q });
    }
    return list;
  }, [myWrong, questionBanks, wrongBankFilter]);

  const wrongBanks = useMemo(() => {
    return questionBanks.filter((b) => myWrongByBank.has(b.id));
  }, [questionBanks, myWrongByBank]);

  // ---------- 组卷 ----------
  const pickQuestions = (type: QuestionType, need: number): Question[] => {
    const pool = available.filter((q) => q.type === type);
    return shuffleArray(pool).slice(0, need);
  };

  const startStandardPaper = () => {
    if (!bank) { message.warning('请先选择题库'); return; }
    const missing: string[] = [];
    for (const t of PRACTICE_TYPES) {
      const need = STANDARD_QUOTA[t] || 0;
      if ((availableCounts.get(t) || 0) < need) missing.push(`${typeShort[t]}${availableCounts.get(t) || 0}题`);
    }
    if (missing.length) {
      message.warning(`标准卷需要 单选40+多选10+判断10。当前题库 ${missing.join('、')}，不足请先补充题目或改自由刷题`);
      return;
    }
    const picked: Question[] = [];
    for (const t of PRACTICE_TYPES) {
      picked.push(...pickQuestions(t, STANDARD_QUOTA[t] || 0));
    }
    beginPractice(picked);
  };

  const startFreePractice = () => {
    if (!bank) { message.warning('请先选择题库'); return; }
    if (available.length === 0) { message.warning('当前题库没有可刷的客观题'); return; }
    if (selectedTypes.length === 0) { message.warning('请至少选择一种题型'); return; }
    let pool = available.filter((q) => selectedTypes.includes(q.type));
    if (shuffleQ) pool = shuffleArray(pool);
    const picked = pool.slice(0, count);
    beginPractice(picked);
  };

  const beginPractice = (picked: Question[]) => {
    if (picked.length === 0) { message.warning('没有可组卷的题目'); return; }
    clearSavedPractice();
    setQuestions(picked);
    // 记录每题所属题库（标准卷/自由刷题来自当前选中题库）
    const map: Record<string, string> = {};
    for (const q of picked) map[q.id] = bankId || '';
    setQuestionBankIds(map);
    setIndex(0);
    setCurAnswer('');
    setAnswers([]);
    setRevealed(false);
    setPracticeWrongIds([]);
    setView('answer');
  };

  // 从错题本开始练习
  const startWrongPractice = () => {
    const pairs = wrongQuestionsDetail.map((d) => ({ wrong: d.wrong, question: d.question }));
    if (pairs.length === 0) return;
    clearSavedPractice();
    const shuffled = shuffleQ ? shuffleArray(pairs) : pairs;
    setPracticeWrongIds(shuffled.map((p) => p.wrong.id));
    // 记录每题所属题库（来自错题本记录的 bankId）
    const map: Record<string, string> = {};
    const wmap: Record<string, string> = {};
    for (const p of shuffled) {
      map[p.question.id] = p.wrong.bankId;
      wmap[p.question.id] = p.wrong.id;
    }
    setQuestionBankIds(map);
    setQuestionWrongMap(wmap);
    setQuestions(shuffled.map((p) => p.question));
    setIndex(0);
    setCurAnswer('');
    setAnswers([]);
    setRevealed(false);
    setView('answer');
  };

  const currentQuestion = questions[index];

  const checkCorrect = (q: Question, a: string): { correct: boolean; actual: string; unscored?: boolean } => {
    const actual = q.answer?.trim() || '';
    const ua = a.trim();
    const options = q.options || [];

    // 判断题
    if (q.type === 'judge') {
      if (!actual || actual === '略' || actual === '无') return { correct: false, actual, unscored: true };
      const norm = (s: string) => (s.includes('正确') || s.includes('对') ? 'T' : s.includes('错误') || s.includes('错') ? 'F' : s);
      return { correct: norm(actual) === norm(ua) && ua !== '', actual };
    }

    // 单选题 / 多选题：将标准答案与用户答案都归一化为"选项字母集合"再比对
    const stdLetters = parseAnswerToLetters(actual, options);
    if (!stdLetters) return { correct: false, actual, unscored: true };
    // curAnswer 现在保存的是字母（单选 "A"，多选 "A,B"）
    const userLetters = new Set(ua.split(/[,，、;；\s]+/).filter(Boolean).map((c) => c.toUpperCase()));
    const same =
      stdLetters.size > 0 &&
      userLetters.size > 0 &&
      stdLetters.size === userLetters.size &&
      [...stdLetters].every((v) => userLetters.has(v));
    return { correct: same, actual };
  };

  // 保存/更新某题的作答记录（用于提交本题、切题自动保存、交卷）
  const saveAnswerForQuestion = (q: Question, answer: string, silent = false) => {
    if (!q || answer.trim() === '') return;
    const { correct, actual, unscored } = checkCorrect(q, answer);
    let changed = false;
    const newAnswers = answers.map((x) => {
      if (x.questionId === q.id) {
        changed = changed || x.userAnswer !== answer;
        return { questionId: q.id, userAnswer: answer, correct, actual, unscored };
      }
      return x;
    });
    if (!newAnswers.some((x) => x.questionId === q.id)) {
      newAnswers.push({ questionId: q.id, userAnswer: answer, correct, actual, unscored });
      changed = true;
    }
    setAnswers(newAnswers);

    // 答错 → 自动收进错题本（用该题所属题库）；无标准答案的题不判错，不进错题本
    if (!correct && !unscored) {
      addWrongQuestion({ userId, bankId: questionBankIds[q.id] || '', questionId: q.id, source: 'auto' });
    }

    // 错题练习：更新该错题的答对/答错统计
    const wrongId = questionWrongMap[q.id];
    if (wrongId) {
      bumpWrongStats(wrongId, correct);
    }

    if (!silent) {
      if (changed) message.success(correct ? '答对了！' : '已记录本题');
      if (!correct && !unscored && changed) message.info('答错了，已自动加入错题本');
    }
  };

  const submitCurrent = () => {
    const q = currentQuestion;
    if (!q) return;
    if (curAnswer.trim() === '') { message.warning('请先作答本题'); return; }
    saveAnswerForQuestion(q, curAnswer, true);
    if (mode === 'immediate') setRevealed(true);
  };

  const manualAddWrong = (q: Question) => {
    addWrongQuestion({ userId, bankId: questionBankIds[q.id] || '', questionId: q.id, source: 'manual' });
    message.success('已加入错题本');
  };

  const removeWrong = (id: string) => {
    removeWrongQuestion(id);
    message.success('已从错题本移除');
  };

  const nextQuestion = () => {
    const q = currentQuestion;
    // 当前题已作答但未记录时，切题前自动保存，避免答案丢失
    if (q && curAnswer.trim() !== '') saveAnswerForQuestion(q, curAnswer, true);
    if (index < questions.length - 1) {
      const nextIdx = index + 1;
      const nextQ = questions[nextIdx];
      const nextAns = answers.find((a) => a.questionId === nextQ.id);
      setIndex(nextIdx);
      setCurAnswer(nextAns?.userAnswer || '');
      setRevealed(mode === 'immediate' ? !!nextAns : false);
    } else {
      // 完成全部题目，清除保存的练习进度
      clearSavedPractice();
      setView('result');
    }
  };

  const prevQuestion = () => {
    const q = currentQuestion;
    // 切回上一题前也保存当前题作答
    if (q && curAnswer.trim() !== '') saveAnswerForQuestion(q, curAnswer, true);
    if (index > 0) {
      setIndex(index - 1);
      const prevAns = answers.find((a) => a.questionId === questions[index - 1].id);
      setCurAnswer(prevAns?.userAnswer || '');
      setRevealed(mode === 'immediate' ? !!prevAns : false);
    }
  };

  // ---------- 练习进度持久化（下次可继续上次答题） ----------
  const SAVE_KEY = () => `qm_practice_${userId}`;

  const loadSavedPractice = (): {
    questions: Question[]; index: number; answers: PracticeAnswer[];
    questionBankIds: Record<string, string>; questionWrongMap: Record<string, string>;
    practiceWrongIds: string[]; mode: AnswerMode;
  } | null => {
    try {
      const raw = localStorage.getItem(SAVE_KEY());
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!Array.isArray(data.questions) || data.questions.length === 0) return null;
      return data;
    } catch {
      return null;
    }
  };

  const clearSavedPractice = () => {
    try { localStorage.removeItem(SAVE_KEY()); } catch { /* ignore */ }
    setHasSavedPractice(false);
  };

  // 保存当前进度，返回首页，下次可继续
  const leavePractice = () => {
    const q = currentQuestion;
    // 保存未提交的当前题
    if (q && curAnswer.trim() !== '') saveAnswerForQuestion(q, curAnswer, true);
    try {
      localStorage.setItem(SAVE_KEY(), JSON.stringify({
        questions, index, answers,
        questionBankIds, questionWrongMap, practiceWrongIds, mode,
      }));
      setHasSavedPractice(true);
    } catch { /* ignore */ }
    setView('home');
  };

  // 继续上次未完成的练习
  const resumePractice = () => {
    const saved = loadSavedPractice();
    if (!saved) { message.info('没有上次未完成的答题'); return; }
    setQuestions(saved.questions);
    setQuestionBankIds(saved.questionBankIds);
    setQuestionWrongMap(saved.questionWrongMap);
    setPracticeWrongIds(saved.practiceWrongIds);
    setAnswers(saved.answers);
    const restoredMode: AnswerMode = saved.mode || 'immediate';
    setMode(restoredMode);
    setIndex(Math.min(saved.index, saved.questions.length - 1));
    const restoredQ = saved.questions[Math.min(saved.index, saved.questions.length - 1)];
    const restoredAns = saved.answers.find((a) => a.questionId === restoredQ?.id);
    setCurAnswer(restoredAns?.userAnswer || '');
    setRevealed(restoredMode === 'immediate' ? !!restoredAns : false);
    setView('answer');
  };

  // 挂载时如果有未完成练习，提示是否继续
  useEffect(() => {
    const saved = loadSavedPractice();
    setHasSavedPractice(!!saved);
  }, [userId]); // 仅登录/挂载时检测一次

  const restart = () => {
    clearSavedPractice();
    setView('home');
    setQuestions([]);
    setAnswers([]);
    setPracticeWrongIds([]);
    setQuestionWrongMap({});
  };

  const answeredCount = answers.length;
  const correctCount = answers.filter((a) => a.correct).length;
  const score = answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : 0;

  // ================== 渲染 ==================
  return (
    <div className="min-h-screen bg-[#eef2f7]">
      {/* 顶部渐变横幅 */}
      <div className="bg-gradient-to-r from-[#0f4c81] via-[#1e6fb5] to-[#2a9d8f] text-white">
        <div className="max-w-[980px] mx-auto px-4 py-5 sm:py-6">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <TrophyOutlined style={{ fontSize: 22 }} />
              <span className="text-lg sm:text-xl font-bold tracking-wide">题库刷题 · 错题本</span>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <span className="flex items-center gap-1 text-white/90 text-sm">
                <UserOutlined /> {currentUserName || '考生'}
              </span>
              <button
                onClick={() => setAdminOpen(true)}
                className="text-white/60 hover:text-white text-xs flex items-center gap-1 transition-colors"
                title="管理后台"
              >
                <SettingOutlined /> 后台
              </button>
              <Button
                type="text"
                size="small"
                icon={<LogoutOutlined />}
                className="!text-white/80 hover:!text-white"
                onClick={() => { setCurrentUser('guest', ''); }}
              >
                退出
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* 管理员入口弹窗 */}
      <Modal
        title="管理员登录"
        open={adminOpen}
        onCancel={() => { setAdminOpen(false); setAdminPassword(''); }}
        footer={null}
        width={360}
      >
        <div className="space-y-4 pt-2">
          <Input.Password
            placeholder="请输入管理员密码"
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
            onPressEnter={() => {
              if (adminPassword === ADMIN_PASSWORD) {
                setAdminOpen(false);
                setAdminPassword('');
                setCurrentUser('admin', '管理员');
                setCurrentStep('import');
              } else {
                message.error('管理员密码错误');
              }
            }}
          />
          <Button
            type="primary"
            block
            onClick={() => {
              if (adminPassword === ADMIN_PASSWORD) {
                setAdminOpen(false);
                setAdminPassword('');
                setCurrentUser('admin', '管理员');
                setCurrentStep('import');
              } else {
                message.error('管理员密码错误');
              }
            }}
          >
            进入管理后台
          </Button>
        </div>
      </Modal>

      <div className="max-w-[980px] mx-auto px-3 sm:px-4 py-4 sm:py-6">

        {/* ========== 首页：选择章节 + 三大入口 ========== */}
        {view === 'home' && (
          <div>
            {/* 选择题库（章节） */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6">
              <div className="flex items-center gap-2 mb-3">
                <BookOutlined className="text-[#1e6fb5]" />
                <span className="font-semibold text-gray-800">选择章节（题库）</span>
              </div>
              <Select
                placeholder="请选择题库"
                size="large"
                style={{ width: '100%' }}
                value={bankId}
                onChange={setBankId}
                options={questionBanks.map((b) => ({ value: b.id, label: b.name }))}
              />
              {bank && (
                <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                  {PRACTICE_TYPES.map((t) => (
                    <Tag key={t} color={typeColor[t]}>{typeShort[t]} {availableCounts.get(t) || 0}题</Tag>
                  ))}
                  <Tag>共 {available.length} 题可刷</Tag>
                </div>
              )}
            </div>

            {/* 三大入口 */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mt-4">
              {/* 标准卷组卷 */}
              <button
                onClick={startStandardPaper}
                disabled={!bank || available.length === 0}
                className={`group relative text-left rounded-2xl p-4 sm:p-5 transition-all overflow-hidden border ${
                  bank && available.length > 0
                    ? 'bg-white shadow-sm hover:shadow-md hover:-translate-y-0.5 border-gray-100'
                    : 'bg-gray-50 border-gray-100 opacity-60 cursor-not-allowed'
                }`}
              >
                <div className="absolute right-0 top-0 w-20 h-20 bg-gradient-to-br from-[#1e6fb5]/10 to-transparent rounded-bl-full" />
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1e6fb5] to-[#2a9d8f] text-white flex items-center justify-center mb-3">
                  <FileTextOutlined style={{ fontSize: 18 }} />
                </div>
                <div className="font-bold text-gray-800 text-base">标准考试卷</div>
                <div className="text-xs text-gray-500 mt-1">按正规考试配比自动组卷</div>
                <div className="mt-2 text-[11px] text-[#1e6fb5] font-medium">单选40 + 多选10 + 判断10</div>
              </button>

              {/* 自由刷题 */}
              <button
                onClick={() => { if (!bank) { message.warning('请先选择题库'); return; } setView('config'); }}
                disabled={!bank}
                className={`group relative text-left rounded-2xl p-4 sm:p-5 transition-all overflow-hidden border ${
                  bank
                    ? 'bg-white shadow-sm hover:shadow-md hover:-translate-y-0.5 border-gray-100'
                    : 'bg-gray-50 border-gray-100 opacity-60 cursor-not-allowed'
                }`}
              >
                <div className="absolute right-0 top-0 w-20 h-20 bg-gradient-to-br from-[#f2994a]/10 to-transparent rounded-bl-full" />
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#f2994a] to-[#eb5757] text-white flex items-center justify-center mb-3">
                  <FormOutlined style={{ fontSize: 18 }} />
                </div>
                <div className="font-bold text-gray-800 text-base">自由刷题</div>
                <div className="text-xs text-gray-500 mt-1">自选题型、数量，想刷多少刷多少</div>
                <div className="mt-2 text-[11px] text-[#f2994a] font-medium">按需组卷，灵活练习</div>
              </button>

              {/* 错题本 */}
              <button
                onClick={() => { if (myWrong.length === 0) { message.info('错题本还是空的，先去刷题吧'); return; } setView('wrong'); }}
                className="group relative text-left rounded-2xl p-4 sm:p-5 transition-all overflow-hidden border bg-white shadow-sm hover:shadow-md hover:-translate-y-0.5 border-gray-100"
              >
                <div className="absolute right-0 top-0 w-20 h-20 bg-gradient-to-br from-[#eb5757]/10 to-transparent rounded-bl-full" />
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#eb5757] to-[#f2994a] text-white flex items-center justify-center mb-3">
                  <Badge count={myWrong.length} size="small" offset={[2, 0]}>
                    <BookOutlined style={{ fontSize: 18 }} />
                  </Badge>
                </div>
                <div className="font-bold text-gray-800 text-base">错题本</div>
                <div className="text-xs text-gray-500 mt-1">答错自动收录，可手动收藏</div>
                <div className="mt-2 text-[11px] text-[#eb5757] font-medium">已收录 {myWrong.length} 题</div>
              </button>
            </div>

            {/* 继续上次未完成的答题 */}
            {hasSavedPractice && (
              <div className="mt-4">
                <Button
                  block
                  size="large"
                  icon={<PlayCircleOutlined />}
                  className="!border-[#1e6fb5] !text-[#1e6fb5] hover:!bg-blue-50"
                  onClick={resumePractice}
                >
                  继续上次答题
                </Button>
                <div className="text-center text-[11px] text-gray-400 mt-1">若上次答题中途退出，可从这里接着刷</div>
              </div>
            )}

            <div className="text-center text-xs text-gray-400 mt-4">
              提示：答题答错的题目会自动收进错题本；答对的题如果觉得没掌握，也可以手动加入错题本反复练习。
            </div>
          </div>
        )}

        {/* ========== 自由刷题配置 ========== */}
        {view === 'config' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-8 max-w-xl mx-auto">
            <div className="flex items-center gap-2 mb-5">
              <Button type="text" size="small" icon={<ArrowLeftOutlined />} onClick={() => setView('home')}>返回</Button>
              <span className="text-lg font-bold text-gray-800">自由刷题设置</span>
            </div>

            <div className="space-y-6">
              <div>
                <div className="text-sm font-medium text-gray-700 mb-2">当前章节</div>
                <div className="text-sm text-[#1e6fb5] font-medium">{bank?.name || '未选择'}</div>
              </div>

              <div>
                <div className="text-sm font-medium text-gray-700 mb-2">题型（可多选）</div>
                <Checkbox.Group
                  value={selectedTypes}
                  onChange={(v) => setSelectedTypes(v as QuestionType[])}
                  options={PRACTICE_TYPES.map((t) => ({ label: `${typeLabels[t]}（${availableCounts.get(t) || 0}）`, value: t }))}
                />
              </div>

              <div>
                <div className="text-sm font-medium text-gray-700 mb-2">本次刷题数量</div>
                <InputNumber
                  min={1}
                  max={Math.max(1, selectedTypes.reduce((acc, t) => acc + (availableCounts.get(t) || 0), 0) || 500)}
                  value={count}
                  onChange={(v) => setCount(v || 1)}
                  style={{ width: '100%' }}
                  addonAfter="道"
                  size="large"
                />
              </div>

              <div>
                <div className="text-sm font-medium text-gray-700 mb-2">答案展示方式</div>
                <Segmented
                  block
                  value={mode}
                  onChange={(v) => setMode(v as AnswerMode)}
                  options={[
                    { label: '逐题即时对答案', value: 'immediate' },
                    { label: '刷完统一看答案', value: 'batch' },
                  ]}
                />
              </div>

              <div>
                <Checkbox checked={shuffleQ} onChange={(e) => setShuffleQ(e.target.checked)}>随机打乱题目顺序</Checkbox>
              </div>
            </div>

            <Button
              type="primary"
              size="large"
              block
              icon={<PlayCircleOutlined />}
              className="mt-8 !bg-[#1e6fb5] !h-12 !rounded-xl"
              onClick={startFreePractice}
              disabled={available.length === 0}
            >
              开始刷题
            </Button>
          </div>
        )}

        {/* ========== 答题中 ========== */}
        {view === 'answer' && currentQuestion && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-8">
            {/* 顶部：进度 */}
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Button
                  type="text"
                  size="small"
                  icon={<ArrowLeftOutlined />}
                  className="!text-gray-500 hover:!text-[#1e6fb5]"
                  onClick={leavePractice}
                >
                  退出
                </Button>
                <Tag color={typeColor[currentQuestion.type]}>{typeLabels[currentQuestion.type]}</Tag>
                {practiceWrongIds.length > 0 && <Tag color="red">错题练习</Tag>}
              </div>
              <span className="text-gray-500 text-xs sm:text-sm">第 {index + 1} / {questions.length} 题 · 已答 {answeredCount} 题</span>
            </div>
            <Progress percent={Math.round(((index + 1) / questions.length) * 100)} showInfo={false} strokeColor="#1e6fb5" />

            {/* 题目 */}
            <div className="mt-5 sm:mt-6 text-base sm:text-lg font-medium text-gray-800 leading-relaxed">
              {index + 1}. {currentQuestion.content}
            </div>

            {/* 作答区 */}
            <div className="mt-5">
              {currentQuestion.type === 'single' && (
                <Radio.Group value={curAnswer} onChange={(e) => setCurAnswer(e.target.value)} style={{ width: '100%' }}>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    {(currentQuestion.options || []).map((opt, idx) => {
                      const letter = getOptionLetter(idx);
                      return (
                        <Radio key={letter} value={letter} className="w-full py-2.5 px-3 rounded-xl border border-gray-100 hover:border-blue-300 hover:bg-blue-50/60 transition-colors">
                          {letter}. {opt}
                        </Radio>
                      );
                    })}
                  </Space>
                </Radio.Group>
              )}

              {currentQuestion.type === 'multiple' && (
                <Checkbox.Group value={curAnswer ? curAnswer.split(/[,，、;；\s]+/) : []} onChange={(v) => setCurAnswer((v as string[]).join(','))} style={{ width: '100%' }}>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    {(currentQuestion.options || []).map((opt, idx) => {
                      const letter = getOptionLetter(idx);
                      return (
                        <Checkbox key={letter} value={letter} className="w-full py-2.5 px-3 rounded-xl border border-gray-100 hover:border-blue-300 hover:bg-blue-50/60 transition-colors">
                          {letter}. {opt}
                        </Checkbox>
                      );
                    })}
                  </Space>
                </Checkbox.Group>
              )}

              {currentQuestion.type === 'judge' && (
                <Radio.Group value={curAnswer} onChange={(e) => setCurAnswer(e.target.value)} style={{ width: '100%' }}>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Radio value="正确" className="w-full py-3 px-3 rounded-xl border border-gray-100 hover:border-green-300 hover:bg-green-50/60 transition-colors">
                      <CheckCircleOutlined style={{ color: '#52c41a' }} className="mr-1" />正确
                    </Radio>
                    <Radio value="错误" className="w-full py-3 px-3 rounded-xl border border-gray-100 hover:border-red-300 hover:bg-red-50/60 transition-colors">
                      <CloseCircleOutlined style={{ color: '#ff4d4f' }} className="mr-1" />错误
                    </Radio>
                  </Space>
                </Radio.Group>
              )}
            </div>

            {/* 即时模式反馈 */}
            {mode === 'immediate' && !revealed && (
              <div className="mt-6">
                <Button type="primary" size="large" icon={<CheckCircleOutlined />} className="!bg-[#1e6fb5]" onClick={submitCurrent}>提交本题</Button>
              </div>
            )}

            {mode === 'immediate' && revealed && (() => {
              const curAns = answers.find((a) => a.questionId === currentQuestion.id);
              return (
              <div className="mt-6">
                {curAns?.unscored ? (
                  <Alert
                    type="warning"
                    showIcon
                    message="本题暂无标准答案"
                    description={
                      <div>
                        <div>该题未录入标准答案，无法自动判分，请自行对照解析或资料核对。</div>
                        {currentQuestion.analysis && currentQuestion.analysis !== '无' && currentQuestion.analysis !== '略' && (
                          <div className="mt-1"><b>解析：</b>{currentQuestion.analysis}</div>
                        )}
                      </div>
                    }
                  />
                ) : (
                <Alert
                  type={curAns?.correct ? 'success' : 'error'}
                  showIcon
                  message={curAns?.correct ? '回答正确' : '回答错误'}
                  description={
                    <div>
                      <div><b>正确答案：</b>{currentQuestion.answer}</div>
                      {currentQuestion.analysis && currentQuestion.analysis !== '无' && currentQuestion.analysis !== '略' && (
                        <div className="mt-1"><b>解析：</b>{currentQuestion.analysis}</div>
                      )}
                    </div>
                  }
                />
                )}
                {/* 答对但觉得没掌握 → 手动收藏 */}
                {answers.find((a) => a.questionId === currentQuestion.id)?.correct && (
                  <div className="mt-3 flex justify-end">
                    <Button size="small" icon={<PlusOutlined />} onClick={() => manualAddWrong(currentQuestion)}>觉得没掌握，加入错题本</Button>
                  </div>
                )}
              </div>
              );
            })()}

            {/* 批量模式 */}
            {mode === 'batch' && (
              <div className="mt-6">
                <Button type="primary" size="large" icon={<CheckCircleOutlined />} className="!bg-[#1e6fb5]" onClick={submitCurrent}>记录本题</Button>
              </div>
            )}

            <Divider />

            {/* 底部导航 */}
            <div className="flex items-center justify-between gap-2 mt-2 flex-wrap">
              <Button icon={<ArrowLeftOutlined />} onClick={prevQuestion} disabled={index === 0}>上一题</Button>
              <div className="flex items-center gap-2 flex-wrap justify-end">
                {index < questions.length - 1 && (
                  <Button onClick={() => setView('result')}>交卷看结果</Button>
                )}
                <Button type="primary" size="large" className="!bg-[#1e6fb5]" onClick={nextQuestion}>
                  {index < questions.length - 1 ? (<><span className="mr-1">下一题</span><ArrowRightOutlined /></>) : ('完成看结果')}
                </Button>
              </div>
            </div>
          </div>
        )}

        {view === 'answer' && !currentQuestion && <Empty description="没有可显示的题目" />}

        {/* ========== 结果页 ========== */}
        {view === 'result' && (
          <div>
            <Result
              icon={<TrophyOutlined style={{ color: '#1e6fb5' }} />}
              title="本次练习完成"
              subTitle={`共 ${questions.length} 题，已答 ${answeredCount} 题，答对 ${correctCount} 题`}
            />
            <div className="grid grid-cols-3 gap-2 sm:gap-4 max-w-xl mx-auto mb-6 sm:mb-8 px-1">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3 sm:p-4 text-center">
                <div className="text-gray-500 text-xs sm:text-sm">正确率</div>
                <div className="text-xl sm:text-3xl font-bold text-[#1e6fb5] mt-1">{score}%</div>
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3 sm:p-4 text-center">
                <div className="text-gray-500 text-xs sm:text-sm">答对</div>
                <div className="text-xl sm:text-3xl font-bold text-green-600 mt-1">{correctCount}</div>
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3 sm:p-4 text-center">
                <div className="text-gray-500 text-xs sm:text-sm">答错（已入错题本）</div>
                <div className="text-xl sm:text-3xl font-bold text-red-500 mt-1">{answeredCount - correctCount}</div>
              </div>
            </div>

            {/* 答题明细 */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6">
              <h3 className="font-semibold text-gray-800 mb-3">答题明细</h3>
              {answers.length === 0 ? (
                <Empty description="暂无作答记录" />
              ) : (
                <div className="space-y-3">
                  {questions.map((q, i) => {
                    const ans = answers.find((a) => a.questionId === q.id);
                    if (!ans) return null;
                    const inWrong = myWrong.some((w) => w.questionId === q.id && w.bankId === (questionBankIds[q.id] || ''));
                    return (
                      <div key={q.id} className="border border-gray-200 rounded-xl p-3">
                        <div className="flex items-start gap-2">
                          {ans.correct
                            ? <CheckCircleOutlined style={{ color: '#52c41a', marginTop: 4 }} />
                            : <CloseCircleOutlined style={{ color: '#ff4d4f', marginTop: 4 }} />}
                          <div className="flex-1">
                            <div className="text-sm text-gray-800">
                              <Tag color={typeColor[q.type]} className="mr-1">{typeShort[q.type]}</Tag>
                              {i + 1}. {q.content}
                            </div>
                            <div className="mt-1 text-xs">
                              <div className="text-gray-500">你的答案：<span className={ans.correct ? 'text-green-600' : ans.unscored ? 'text-gray-500' : 'text-red-500'}>{ans.userAnswer || '（未作答）'}</span></div>
                              {ans.unscored
                                ? <div className="text-gray-400">本题无标准答案，未判分</div>
                                : (!ans.correct && <div className="text-green-600">正确答案：{q.answer}</div>)}
                              {q.analysis && q.analysis !== '无' && q.analysis !== '略' && (
                                <div className="text-gray-500 mt-1">解析：{q.analysis}</div>
                              )}
                            </div>
                            {/* 结果页操作：答对可收藏，已收藏可取消 */}
                            <div className="mt-2">
                              {ans.correct ? (
                                inWrong
                                  ? <Button size="small" icon={<CheckCircleOutlined />} className="text-[#52c41a]" disabled>已在错题本</Button>
                                  : <Button size="small" icon={<PlusOutlined />} onClick={() => manualAddWrong(q)}>加入错题本</Button>
                              ) : (
                                <Tag color="red" icon={<BookOutlined />}>已自动收入错题本</Tag>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex justify-center gap-3 mt-6 flex-wrap">
              <Button icon={<ReloadOutlined />} onClick={restart}>返回首页</Button>
              <Button type="primary" className="!bg-[#1e6fb5]" icon={<BookOutlined />} onClick={() => { if (myWrong.length) setView('wrong'); else { message.info('错题本还是空的'); setView('home'); } }}>
                去错题本
              </Button>
            </div>
          </div>
        )}

        {/* ========== 错题本 ========== */}
        {view === 'wrong' && (
          <div>
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <Button type="text" size="small" icon={<ArrowLeftOutlined />} onClick={() => setView('home')}>返回</Button>
              <span className="text-lg font-bold text-gray-800">我的错题本</span>
              <Tag color="red">{myWrong.length} 题</Tag>
            </div>

            {/* 按章节筛选 */}
            {wrongBanks.length > 1 && (
              <div className="mb-4">
                <Select
                  placeholder="按章节筛选"
                  allowClear
                  style={{ width: '100%', maxWidth: 280 }}
                  value={wrongBankFilter}
                  onChange={setWrongBankFilter}
                  options={wrongBanks.map((b) => ({ value: b.id, label: `${b.name}（${myWrongByBank.get(b.id) || 0}）` }))}
                />
              </div>
            )}

            {wrongQuestionsDetail.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10">
                <Empty description="该章节暂无错题，去刷题积累错题本吧">
                  <Button type="primary" className="!bg-[#1e6fb5]" onClick={() => setView('home')}>去刷题</Button>
                </Empty>
              </div>
            ) : (
              <>
                <div className="flex gap-3 mb-4 flex-wrap">
                  <Button type="primary" icon={<ReloadOutlined />} className="!bg-[#1e6fb5]" onClick={startWrongPractice}>开始错题练习</Button>
                  <Button onClick={() => setView('home')}>返回刷题</Button>
                </div>

                <div className="space-y-3">
                  {wrongQuestionsDetail.map(({ wrong, question }, i) => {
                    const bk = questionBanks.find((b) => b.id === wrong.bankId);
                    return (
                      <div key={wrong.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                        <div className="flex items-start gap-2">
                          <Tag color={typeColor[question.type]}>{typeShort[question.type]}</Tag>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-gray-800 leading-relaxed">{i + 1}. {question.content}</div>
                            <div className="mt-2 text-xs text-gray-400 flex flex-wrap gap-1">
                              <Tag>{bk?.name || '未知题库'}</Tag>
                              {wrong.source === 'manual' && <Tag color="gold">手动收藏</Tag>}
                              {wrong.source === 'auto' && <Tag color="red">答错自动收录</Tag>}
                              <span>答对 {wrong.correctCount || 0} 次 / 答错 {wrong.wrongCount || 0} 次</span>
                            </div>
                            <div className="mt-2">
                              <Button size="small" danger icon={<DeleteOutlined />} onClick={() => removeWrong(wrong.id)}>移出错题本</Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
