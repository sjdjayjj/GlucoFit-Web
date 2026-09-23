"use client";

import { useEffect, useState } from "react";
import { ArrowUp, Dumbbell, Scale, UtensilsCrossed } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Smartisan 风格右下角常驻悬浮胶囊动作条 (v2.2)：
 * 全面胶囊圆角 + 毛玻璃质感浅灰白渐变底 + 优雅阴影。
 * 集成【记饮食】【记运动】【录体脂】主动作与【回到顶部】。
 */
export function FloatingActionCapsule({
  onOpenMeal,
  onOpenExercise,
  onOpenBody,
}: {
  onOpenMeal: () => void;
  onOpenExercise: () => void;
  onOpenBody: () => void;
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
        "fixed bottom-6 right-6 z-50 flex items-center gap-1 rounded-full border border-slate-200/80 bg-white/90 p-1.5 shadow-2xl backdrop-blur-md dark:border-slate-700/80 dark:bg-slate-900/90"
      )}
    >
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
      {/* 主按钮：录体脂，高亮加权 */}
      <button
        type="button"
        onClick={onOpenBody}
        title="录入体脂秤数据"
        className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground shadow-md transition-all hover:scale-[1.03] hover:bg-primary/90 active:scale-95"
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
          className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
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
      className="flex items-center gap-1.5 rounded-full px-3.5 py-2.5 text-xs font-medium text-slate-700 transition-all hover:bg-slate-100 active:scale-95 dark:text-slate-200 dark:hover:bg-slate-800"
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
