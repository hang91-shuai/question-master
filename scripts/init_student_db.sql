-- ============================================================
-- 考生账号 & 考生数据表初始化（在 CloudBase 控制台 SQL 编辑器执行一次）
-- 说明：
--   1. student_accounts     : 考生/管理员账号（密码存 SHA-256 哈希，不存明文）
--   2. wrong_questions      : 错题本（按 user_id 隔离）
--   3. practice_progress    : 未完成练习进度（整包 JSON，按 user_id 一行）
--   4. practice_stats       : 练习统计（已练题数/正确率，按 user_id 一行）
-- 权限：anon 全权读写（与 question_banks 保持一致，供前端经云函数代理访问）
-- ============================================================

-- 1. 账号表
CREATE TABLE IF NOT EXISTS public.student_accounts (
  id            text PRIMARY KEY,
  username      text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  name          text,
  role          text NOT NULL DEFAULT 'student',
  status        text NOT NULL DEFAULT 'active',
  created_at    text
);

-- 2. 错题表
CREATE TABLE IF NOT EXISTS public.wrong_questions (
  id            text PRIMARY KEY,
  user_id       text NOT NULL,
  bank_id       text NOT NULL,
  question_id   text NOT NULL,
  added_at      text,
  source        text NOT NULL DEFAULT 'auto',
  correct_count integer NOT NULL DEFAULT 0,
  wrong_count   integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_wrong_questions_user ON public.wrong_questions(user_id);

-- 3. 练习进度
CREATE TABLE IF NOT EXISTS public.practice_progress (
  user_id    text PRIMARY KEY,
  data       jsonb NOT NULL,
  updated_at text
);

-- 4. 练习统计
CREATE TABLE IF NOT EXISTS public.practice_stats (
  user_id    text PRIMARY KEY,
  data       jsonb NOT NULL,
  updated_at text
);

-- 授权 anon 角色读写（前端通过云函数代理使用 anon key 访问）
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_accounts   TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wrong_questions   TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.practice_progress TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.practice_stats    TO anon;

-- 启用行级安全并放行 anon（与现网题库表行为保持一致）
ALTER TABLE public.student_accounts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wrong_questions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practice_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practice_stats    ENABLE ROW LEVEL SECURITY;

CREATE POLICY student_accounts_anon_all   ON public.student_accounts   FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY wrong_questions_anon_all    ON public.wrong_questions   FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY practice_progress_anon_all  ON public.practice_progress FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY practice_stats_anon_all     ON public.practice_stats    FOR ALL TO anon USING (true) WITH CHECK (true);
