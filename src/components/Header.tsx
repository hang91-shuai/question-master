import { FileText, Database, Zap } from 'lucide-react';

export function Header() {
  return (
    <header className="bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 text-white px-6 py-5 shadow-md">
      <div className="max-w-[1440px] mx-auto flex items-center gap-4">
        <div className="bg-white/20 p-2.5 rounded-lg backdrop-blur-sm">
          <FileText className="w-7 h-7 text-white" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight mb-0.5">职业技能等级命题大师</h1>
          <p className="text-blue-50 text-sm flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-1"><Zap className="w-3.5 h-3.5" /> 上传任一工种《国家职业技能标准》+ 电子资料</span>
            <span className="hidden sm:inline">→</span>
            <span>浏览器内解析 / 全等级 / 不限题量 / 可溯源题库</span>
            <span className="hidden sm:inline">·</span>
            <span>在线审核编辑 · 批量导入导出 · Word/Excel/试卷</span>
          </p>
        </div>
        <div className="hidden md:flex items-center gap-2 bg-white/15 px-4 py-2 rounded-full text-sm">
          <Database className="w-4 h-4" />
          <span>本地优先 · 离线可用</span>
        </div>
      </div>
    </header>
  );
}
