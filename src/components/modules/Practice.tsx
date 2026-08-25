import { useMemo, useState } from 'react';
import {
  Button, Select, InputNumber, Checkbox, Radio, Tag, message,
  Progress, Empty, Alert, Space, Divider, Result, Modal, Input,
} from 'antd';
import {
  PlayCircleOutlined, CheckCircleOutlined, CloseCircleOutlined,
  ArrowLeftOutlined, ArrowRightOutlined, ReloadOutlined, TrophyOutlined,
  LogoutOutlined, SettingOutlined, UserOutlined,
} from '@ant-design/icons';
import { useAppStore } from '../../store/useAppStore';
import { shuffleArray } from '../../utils/mockAI';
import type { Question, QuestionType } from '../../types';

const ADMIN_PASSWORD = 'admin123';

const typeLabels: Record<QuestionType, string> = {
  single: '单选题', multiple: '多选题', judge: '判断题', short: '简答题',
  essay: '论述题', case: '案例分析题', calc: '计算题', blank: '填空题', ethics: '职业道德题',
};

const typeShort: Record<QuestionType, string> = {
  single: '单选', multiple: '多选', judge: '判断', short: '简答', essay: '论述',
  case: '案例', calc: '计算', blank: '填空', ethics: '职业道德',
};

// 仅允许刷题的客观题题型
const PRACTICE_TYPES: QuestionType[] = ['single', 'multiple', 'judge', 'blank'];

type View = 'config' | 'answer' | 'result';

interface PracticeAnswer {
  questionId: string;
  userAnswer: string;
  correct: boolean;
  actual: string;
}

export function Practice() {
  const { questionBanks, currentUserName, setCurrentUser, setCurrentStep } = useAppStore();

  const [adminOpen, setAdminOpen] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');

  const [view, setView] = useState<View>('config');
  const [bankId, setBankId] = useState<string | undefined>();
  const [count, setCount] = useState(50);
  const [selectedTypes, setSelectedTypes] = useState<QuestionType[]>(['single', 'multiple', 'judge', 'blank']);
  const [mode, setMode] = useState<'immediate' | 'batch'>('immediate');
  const [shuffleQ, setShuffleQ] = useState(true);

  const [questions, setQuestions] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [curAnswer, setCurAnswer] = useState('');
  const [answers, setAnswers] = useState<PracticeAnswer[]>([]);
  const [revealed, setRevealed] = useState(false);

  const bank = useMemo(
    () => (bankId ? questionBanks.find((b) => b.id === bankId) : undefined),
    [bankId, questionBanks]
  );

  const available = useMemo(() => {
    if (!bank) return [];
    return bank.questions.filter((q) => PRACTICE_TYPES.includes(q.type) && q.status === 'approved');
  }, [bank]);

  const availableCounts = useMemo(() => {
    const map = new Map<QuestionType, number>();
    for (const t of PRACTICE_TYPES) map.set(t, available.filter((q) => q.type === t).length);
    return map;
  }, [available]);

  const startPractice = () => {
    if (!bank) { message.warning('请先选择题库'); return; }
    if (available.length === 0) { message.warning('当前题库没有可刷的客观题（单选/多选/判断/填空）'); return; }
    if (selectedTypes.length === 0) { message.warning('请至少选择一种题型'); return; }

    let pool = available.filter((q) => selectedTypes.includes(q.type));
    if (shuffleQ) pool = shuffleArray(pool);
    const picked = pool.slice(0, count);

    setQuestions(picked);
    setIndex(0);
    setCurAnswer('');
    setAnswers([]);
    setRevealed(false);
    setView('answer');
  };

  const currentQuestion = questions[index];

  const checkCorrect = (q: Question, a: string): { correct: boolean; actual: string } => {
    const actual = q.answer?.trim() || '';
    const ua = a.trim();
    if (q.type === 'judge') {
      const norm = (s: string) => (s.includes('正确') || s.includes('对') ? 'T' : s.includes('错误') || s.includes('错') ? 'F' : s);
      return { correct: norm(actual) === norm(ua) && ua !== '', actual };
    }
    if (q.type === 'multiple') {
      const setA = new Set(actual.split(/[,，、\s]+/).filter(Boolean).map((s) => s.trim()).sort());
      const setU = new Set(ua.split(/[,，、\s]+/).filter(Boolean).map((s) => s.trim()).sort());
      const same = setA.size > 0 && setU.size > 0 && setA.size === setU.size && [...setA].every((v) => setU.has(v));
      return { correct: same, actual };
    }
    if (q.type === 'single') {
      return { correct: actual !== '' && actual === ua, actual };
    }
    return { correct: ua !== '' && actual.replace(/\s+/g, '') === ua.replace(/\s+/g, ''), actual };
  };

  const submitCurrent = () => {
    const q = currentQuestion;
    if (!q) return;
    if (curAnswer.trim() === '') { message.warning('请先作答本题'); return; }
    const { correct, actual } = checkCorrect(q, curAnswer);
    const newAnswers = [...answers];
    const idx = newAnswers.findIndex((x) => x.questionId === q.id);
    const entry: PracticeAnswer = { questionId: q.id, userAnswer: curAnswer, correct, actual };
    if (idx >= 0) newAnswers[idx] = entry; else newAnswers.push(entry);
    setAnswers(newAnswers);
    if (mode === 'immediate') setRevealed(true);
  };

  const nextQuestion = () => {
    if (index < questions.length - 1) {
      setIndex(index + 1);
      setCurAnswer('');
      setRevealed(false);
    } else {
      setView('result');
    }
  };

  const prevQuestion = () => {
    if (index > 0) {
      setIndex(index - 1);
      const prevAns = answers.find((a) => a.questionId === questions[index - 1].id);
      setCurAnswer(prevAns?.userAnswer || '');
      setRevealed(mode === 'immediate' ? !!prevAns : false);
    }
  };

  const restart = () => {
    setView('config');
    setQuestions([]);
    setAnswers([]);
  };

  const answeredCount = answers.length;
  const correctCount = answers.filter((a) => a.correct).length;
  const score = answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : 0;

  // ================== 全屏容器 ==================
  return (
    <div className="min-h-screen bg-[#f6f8fb]">
      <div className="max-w-[900px] mx-auto px-4 py-8">
        {/* 考生端顶栏：考生信息 + 后台入口（常驻） */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <TrophyOutlined style={{ color: '#1677ff', fontSize: 20 }} />
            <span className="text-lg font-bold">题库刷题练习</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-gray-500 text-sm">
              <UserOutlined /> {currentUserName || '考生'}
            </span>
            <button
              onClick={() => setAdminOpen(true)}
              className="text-gray-300 hover:text-gray-600 text-xs flex items-center gap-1 transition-colors"
              title="管理后台"
            >
              <SettingOutlined /> 后台
            </button>
            <Button
              type="text"
              size="small"
              icon={<LogoutOutlined />}
              onClick={() => { setCurrentUser('guest', ''); }}
            >
              退出
            </Button>
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

        {view === 'config' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 max-w-xl mx-auto">
            <div className="text-xl font-bold text-center mb-6">开始刷题</div>

            <div className="space-y-6">
              <div>
                <div className="text-sm font-medium text-gray-700 mb-2">选择题库</div>
                <Select
                  placeholder="请选择题库"
                  style={{ width: '100%' }}
                  value={bankId}
                  onChange={setBankId}
                  options={questionBanks.map((b) => ({ value: b.id, label: b.name }))}
                />
                {bank && (
                  <div className="mt-1 text-xs text-gray-400">
                    可刷 {available.length} 道客观题（{PRACTICE_TYPES.map((t) => `${typeShort[t]}${availableCounts.get(t) || 0}`).join(' / ')}）
                  </div>
                )}
              </div>

              <div>
                <div className="text-sm font-medium text-gray-700 mb-2">题型</div>
                <Checkbox.Group
                  value={selectedTypes}
                  onChange={(v) => setSelectedTypes(v as QuestionType[])}
                  options={PRACTICE_TYPES.map((t) => ({ label: typeLabels[t], value: t }))}
                />
              </div>

              <div>
                <div className="text-sm font-medium text-gray-700 mb-2">本次刷题数量</div>
                <InputNumber min={1} max={Math.max(1, selectedTypes.reduce((acc, t) => acc + (availableCounts.get(t) || 0), 0) || 500)} value={count} onChange={(v) => setCount(v || 1)} style={{ width: 180 }} addonAfter="道" />
              </div>

              <div>
                <div className="text-sm font-medium text-gray-700 mb-2">答案展示方式</div>
                <Radio.Group value={mode} onChange={(e) => setMode(e.target.value)} optionType="button" buttonStyle="solid">
                  <Radio.Button value="immediate">逐题即时对答案</Radio.Button>
                  <Radio.Button value="batch">刷完统一看答案</Radio.Button>
                </Radio.Group>
              </div>

              <div>
                <Checkbox checked={shuffleQ} onChange={(e) => setShuffleQ(e.target.checked)}>随机打乱题目顺序</Checkbox>
              </div>
            </div>

            <Button type="primary" size="large" block icon={<PlayCircleOutlined />} className="mt-8" onClick={startPractice} disabled={available.length === 0}>
              开始刷题
            </Button>
          </div>
        )}

        {view === 'answer' && currentQuestion && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
            {/* 顶部：进度 */}
            <div className="flex items-center justify-between mb-4">
              <Tag color="blue">{typeLabels[currentQuestion.type]}</Tag>
              <span className="text-gray-500 text-sm">第 {index + 1} / {questions.length} 题 · 已答 {answeredCount} 题</span>
            </div>
            <Progress percent={Math.round(((index + 1) / questions.length) * 100)} showInfo={false} strokeColor="#1677ff" />

            {/* 题目 */}
            <div className="mt-6 text-lg font-medium text-gray-800 leading-relaxed">
              {index + 1}. {currentQuestion.content}
            </div>

            {/* 作答区 */}
            <div className="mt-5">
              {currentQuestion.type === 'single' && (
                <Radio.Group value={curAnswer} onChange={(e) => setCurAnswer(e.target.value)} style={{ width: '100%' }}>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    {(currentQuestion.options || []).map((opt) => (
                      <Radio key={opt} value={opt} className="w-full py-2 px-3 rounded-lg border border-transparent hover:border-blue-200 hover:bg-blue-50">
                        {opt}
                      </Radio>
                    ))}
                  </Space>
                </Radio.Group>
              )}

              {currentQuestion.type === 'multiple' && (
                <Checkbox.Group value={curAnswer ? curAnswer.split(',') : []} onChange={(v) => setCurAnswer((v as string[]).join(','))} style={{ width: '100%' }}>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    {(currentQuestion.options || []).map((opt) => (
                      <Checkbox key={opt} value={opt} className="w-full py-2 px-3 rounded-lg border border-transparent hover:border-blue-200 hover:bg-blue-50">
                        {opt}
                      </Checkbox>
                    ))}
                  </Space>
                </Checkbox.Group>
              )}

              {currentQuestion.type === 'judge' && (
                <Radio.Group value={curAnswer} onChange={(e) => setCurAnswer(e.target.value)} style={{ width: '100%' }}>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Radio value="正确" className="w-full py-2 px-3 rounded-lg border border-transparent hover:border-green-200 hover:bg-green-50">
                      <CheckCircleOutlined style={{ color: '#52c41a' }} className="mr-1" />正确
                    </Radio>
                    <Radio value="错误" className="w-full py-2 px-3 rounded-lg border border-transparent hover:border-red-200 hover:bg-red-50">
                      <CloseCircleOutlined style={{ color: '#ff4d4f' }} className="mr-1" />错误
                    </Radio>
                  </Space>
                </Radio.Group>
              )}

              {currentQuestion.type === 'blank' && (
                <input
                  className="border border-gray-300 rounded-lg px-4 py-2 w-full max-w-md focus:outline-none focus:border-blue-500"
                  placeholder="请输入答案（多个空用 / 分隔）"
                  value={curAnswer}
                  onChange={(e) => setCurAnswer(e.target.value)}
                />
              )}
            </div>

            {/* 即时模式反馈 */}
            {mode === 'immediate' && !revealed && (
              <div className="mt-6">
                <Button type="primary" size="large" icon={<CheckCircleOutlined />} onClick={submitCurrent}>提交本题</Button>
              </div>
            )}

            {mode === 'immediate' && revealed && (
              <div className="mt-6">
                <Alert
                  type={answers.find((a) => a.questionId === currentQuestion.id)?.correct ? 'success' : 'error'}
                  showIcon
                  message={answers.find((a) => a.questionId === currentQuestion.id)?.correct ? '回答正确' : '回答错误'}
                  description={
                    <div>
                      <div><b>正确答案：</b>{currentQuestion.answer}</div>
                      {currentQuestion.analysis && currentQuestion.analysis !== '无' && currentQuestion.analysis !== '略' && (
                        <div className="mt-1"><b>解析：</b>{currentQuestion.analysis}</div>
                      )}
                    </div>
                  }
                />
              </div>
            )}

            {/* 批量模式 */}
            {mode === 'batch' && (
              <div className="mt-6">
                <Button type="primary" size="large" icon={<CheckCircleOutlined />} onClick={submitCurrent}>记录本题</Button>
              </div>
            )}

            <Divider />

            {/* 底部导航 */}
            <div className="flex items-center justify-between">
              <Button icon={<ArrowLeftOutlined />} onClick={prevQuestion} disabled={index === 0}>上一题</Button>
              <Space>
                {mode === 'batch' && (
                  <Button onClick={() => setView('result')}>提前交卷看答案</Button>
                )}
                <Button type="primary" size="large" onClick={nextQuestion}>
                  {index < questions.length - 1 ? (<><span className="mr-1">下一题</span><ArrowRightOutlined /></>) : ('完成并看结果')}
                </Button>
              </Space>
            </div>
          </div>
        )}

        {view === 'answer' && !currentQuestion && <Empty description="没有可显示的题目" />}

        {view === 'result' && (
          <div>
            <Result
              icon={<TrophyOutlined style={{ color: '#1677ff' }} />}
              title="本次练习完成"
              subTitle={`共 ${questions.length} 题，已答 ${answeredCount} 题，答对 ${correctCount} 题`}
            />
            <div className="grid grid-cols-3 gap-4 max-w-xl mx-auto mb-8">
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-center">
                <div className="text-gray-500 text-sm">正确率</div>
                <div className="text-3xl font-bold text-blue-600 mt-1">{score}%</div>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-center">
                <div className="text-gray-500 text-sm">答对</div>
                <div className="text-3xl font-bold text-green-600 mt-1">{correctCount}</div>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-center">
                <div className="text-gray-500 text-sm">答错</div>
                <div className="text-3xl font-bold text-red-500 mt-1">{answeredCount - correctCount}</div>
              </div>
            </div>

            {/* 答题明细 */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-semibold text-gray-800 mb-3">答题明细</h3>
              {answers.length === 0 ? (
                <Empty description="暂无作答记录" />
              ) : (
                <div className="space-y-3">
                  {questions.map((q, i) => {
                    const ans = answers.find((a) => a.questionId === q.id);
                    if (!ans) return null;
                    return (
                      <div key={q.id} className="border border-gray-200 rounded-lg p-3">
                        <div className="flex items-start gap-2">
                          {ans.correct
                            ? <CheckCircleOutlined style={{ color: '#52c41a', marginTop: 4 }} />
                            : <CloseCircleOutlined style={{ color: '#ff4d4f', marginTop: 4 }} />}
                          <div className="flex-1">
                            <div className="text-sm text-gray-800">
                              <Tag color="blue" className="mr-1">{typeShort[q.type]}</Tag>
                              {i + 1}. {q.content}
                            </div>
                            <div className="mt-1 text-xs">
                              <div className="text-gray-500">你的答案：<span className={ans.correct ? 'text-green-600' : 'text-red-500'}>{ans.userAnswer || '（未作答）'}</span></div>
                              {!ans.correct && <div className="text-green-600">正确答案：{q.answer}</div>}
                              {q.analysis && q.analysis !== '无' && q.analysis !== '略' && (
                                <div className="text-gray-500 mt-1">解析：{q.analysis}</div>
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

            <div className="flex justify-center gap-3 mt-6">
              <Button icon={<ReloadOutlined />} onClick={restart}>重新刷题</Button>
              <Button type="primary" onClick={() => setView('config')}>返回开始</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
