import { FileText, Database, Zap } from 'lucide-react';

export function Header() {
  return (
    <header className="bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 text-white px-4 sm:px-6 py-4 sm:py-5 shadow-md">
      <div className="max-w-[1440px] mx-auto flex items-center gap-3 sm:gap-4">
        <div className="bg-white/20 p-2 sm:p-2.5 rounded-lg backdrop-blur-sm shrink-0">
          <FileText className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg sm:text-2xl font-bold tracking-tight mb-0.5 leading-tight">职业技能等级命题大师</h1>
          <p className="text-blue-50 text-xs sm:text-sm flex items-center gap-1 sm:gap-2 flex-wrap">
            <span className="flex items-center gap-1"><Zap className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" /> 上传工种标准 + 电子资料</span>
            <span className="hidden sm:flex items-center gap-2">
              <span className="hidden sm:inline">→</span>
              <span>浏览器内解析 / 全等级 / 不限题量 / 可溯源题库</span>
              <span className="hidden lg:inline">·</span>
              <span className="hidden lg:inline">在线审核编辑 · 批量导入导出 · Word/Excel/试卷</span>
            </span>
          </p>
        </div>
        <div className="hidden md:flex items-center gap-2 bg-white/15 px-4 py-2 rounded-full text-sm shrink-0">
          <Database className="w-4 h-4" />
          <span>本地优先 · 离线可用</span>
        </div>
      </div>
    </header>
  );
}
