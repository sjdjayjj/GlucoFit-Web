"use client";

import { useEffect, useState } from "react";
import { ArrowUp, Dumbbell, Scale, UtensilsCrossed, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * 右下角常驻悬浮胶囊动作条：
 * 毛玻璃质感 + Argon 语义色 + 安全区适配 + ≥40px 触控目标。
 * 集成【记饮食】【记运动】【录体脂】【嘴馋急救 SOS】与【回到顶部】。
 */
export function FloatingActionCapsule({
  onOpenMeal,
  onOpenExercise,
  onOpenBody,
  onOpenSos,
}: {
  onOpenMeal: () => void;
  onOpenExercise: () => void;
  onOpenBody: () => void;
  onOpenSos: () => void;
}) {
  const [showTop, setShowTop] = useState(false);

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 400);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div
      className={cn(
        "fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-4 z-50 flex items-center gap-1 rounded-full border border-slate-200/70 bg-white/85 p-1.5 shadow-[0_10px_30px_-8px_rgba(15,23,42,0.25)] backdrop-blur-xl sm:right-6 sm:bottom-6 dark:border-white/[0.08] dark:bg-slate-900/85 dark:shadow-[0_10px_30px_-8px_rgba(0,0,0,0.6)]"
      )}
    >
      {/* 嘴馋急救 SOS：深夜/下午突发暴食冲动的多巴胺阻断入口 */}
      <button
        type="button"
        onClick={onOpenSos}
        title="嘴馋急救 SOS"
        aria-label="嘴馋急救 SOS"
        className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-b from-amber-400 to-orange-400 text-amber-950 shadow-sm shadow-amber-500/25 transition-all duration-200 ease-out hover:scale-105 hover:from-amber-300 hover:to-orange-300 active:scale-95"
      >
        <Zap className="h-4 w-4 fill-current" />
      </button>

      <CapsuleButton
        label="记饮食"
        onClick={onOpenMeal}
        icon={<UtensilsCrossed className="h-4 w-4" />}
      />
      <CapsuleButton
        label="记运动"
        onClick={onOpenExercise}
        icon={<Dumbbell className="h-4 w-4" />}
      />
      {/* 主按钮：录体脂，品牌渐变高亮加权 */}
      <button
        type="button"
        onClick={onOpenBody}
        title="录入体脂秤数据"
        className="flex h-10 items-center gap-1.5 rounded-full bg-gradient-to-b from-blue-600 to-indigo-600 px-4 text-xs font-semibold text-white shadow-sm shadow-blue-600/30 transition-all duration-200 ease-out hover:scale-[1.03] hover:from-blue-500 hover:to-indigo-500 hover:shadow-card-hover active:scale-95"
      >
        <Scale className="h-4 w-4" />
        <span>录体脂</span>
      </button>

      {/* 回到顶部（滚动后出现） */}
      {showTop && (
        <button
          type="button"
          onClick={scrollToTop}
          title="回到顶部"
          aria-label="回到顶部"
          className="flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition-all duration-200 ease-out hover:bg-slate-500/10 hover:text-slate-900 active:scale-95 dark:text-slate-400 dark:hover:text-white"
        >
          <ArrowUp className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function CapsuleButton({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="flex h-10 items-center gap-1.5 rounded-full px-3.5 text-xs font-medium text-slate-700 transition-all duration-200 ease-out hover:bg-slate-500/10 hover:text-slate-900 active:scale-95 dark:text-slate-300 dark:hover:text-white"
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
