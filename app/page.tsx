"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  CalendarDays,
  CloudUpload,
  Loader2,
  LogIn,
  LogOut,
  Settings,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { AIDiagnosisCard } from "@/components/AIDiagnosisCard";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AuthModal } from "@/components/AuthModal";
import { BodyMetricsCard } from "@/components/BodyMetricsCard";
import { BodyCompositionDialog } from "@/components/BodyCompositionDialog";
import { CompositionCharts } from "@/components/CompositionCharts";
import { CravingSosDialog } from "@/components/CravingSosDialog";
import { EnergyBalanceCard } from "@/components/EnergyBalanceCard";
import { ExerciseLogDialog } from "@/components/ExerciseLogDialog";
import { FastingTracker } from "@/components/FastingTracker";
import { FloatingActionCapsule } from "@/components/FloatingActionCapsule";
import { MealLogCard } from "@/components/MealLogCard";
import { MealLogDialog } from "@/components/MealLogDialog";
import { MealPlanner } from "@/components/MealPlanner";
import { MilestoneBar } from "@/components/MilestoneBar";
import { OnboardingModal } from "@/components/OnboardingModal";
import { SettingsDialog } from "@/components/SettingsDialog";
import { VirtualMetabolicWave } from "@/components/VirtualMetabolicWave";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useGlucoFitStore } from "@/lib/storage";
import { useProfileStore } from "@/lib/profile";
import { useAuthStore } from "@/lib/auth-store";
import { syncAll, useSyncRuntimeStore, useSyncMetaStore } from "@/lib/cloud";
import { fmtDate } from "@/lib/utils";
import type { MealLog, MealLogPrefill, MealRecommendation } from "@/types";

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [bodyDialogOpen, setBodyDialogOpen] = useState(false);
  const [mealDialogOpen, setMealDialogOpen] = useState(false);
  const [mealPrefill, setMealPrefill] = useState<MealLogPrefill | null>(null);
  const [exerciseDialogOpen, setExerciseDialogOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [sosOpen, setSosOpen] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; message: string } | null>(null);

  const mealLogs = useGlucoFitStore((s) => s.mealLogs);
  const deleteMealLog = useGlucoFitStore((s) => s.deleteMealLog);
  const profile = useProfileStore((s) => s.profile);
  const onboardingDismissed = useProfileStore((s) => s.onboardingDismissed);
  const user = useAuthStore((s) => s.user);
  const checking = useAuthStore((s) => s.checking);
  const refreshAuth = useAuthStore((s) => s.refresh);
  const signOut = useAuthStore((s) => s.signOut);
  const syncing = useSyncRuntimeStore((s) => s.syncing);
  const lastSyncAt = useSyncMetaStore((s) => s.lastSyncAt);

  useEffect(() => {
    setMounted(true);
    void (async () => {
      await refreshAuth();
      // 已有会话但本机无档案（如新设备曾登录但未完成同步）：静默拉取云端建档
      const { user: u } = useAuthStore.getState();
      if (u && !useProfileStore.getState().profile) {
        syncAll().catch(() => null);
      }
    })();
  }, [refreshAuth]);

  // 首访 Onboarding：无档案且未跳过时自动弹出（已登录用户档案应来自云端同步，不弹）。
  // 等会话探测完成（!checking）再判断，避免已登录用户在 /me 返回前闪现弹窗
  useEffect(() => {
    if (mounted && !checking && !user && !profile && !onboardingDismissed) {
      setOnboardingOpen(true);
    }
  }, [mounted, checking, user, profile, onboardingDismissed]);

  // 轻提示自动消失
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  const todayMeals = useMemo(() => {
    const today = fmtDate(new Date());
    return mealLogs
      .filter((l) => fmtDate(new Date(l.timestamp)) === today)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }, [mealLogs]);

  const avgScore = todayMeals.length
    ? Math.round(todayMeals.reduce((s, l) => s + l.score, 0) / todayMeals.length)
    : null;

  if (!mounted) {
    // 避免 Zustand persist 在 SSR 水合时产生不匹配
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="flex h-16 w-16 animate-pulse items-center justify-center rounded-2xl bg-brand-gradient shadow-sm shadow-blue-600/25">
          <Activity className="h-8 w-8 text-white" />
        </div>
      </div>
    );
  }

  const todayLabel = new Date().toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });

  const openMealDialog = (prefill: MealLogPrefill | null = null) => {
    setMealPrefill(prefill);
    setMealDialogOpen(true);
  };

  /** 编辑已有餐记录：整条回填打卡弹窗 */
  const handleEditMeal = (log: MealLog) => {
    openMealDialog({
      id: log.id,
      timestamp: log.timestamp,
      imageUrl: log.imageUrl,
      mealType: log.mealType,
      followedSequence: log.followedSequence,
      avoidedRefinedCarb: log.avoidedRefinedCarb,
      postMealActivity: log.postMealActivity,
      energyReaction: log.energyReaction,
      satietyDuration: log.satietyDuration ?? null,
      foodSummary: log.foodSummary,
      nutrition: log.nutrition,
    });
  };

  const handleDeleteMeal = (id: string) => {
    deleteMealLog(id);
    showToast(true, "已删除该餐记录，下次同步时将自云端移除");
  };

  const handleAdoptRecommendation = (rec: MealRecommendation) => {
    openMealDialog({
      mealType: rec.mealType,
      foodSummary: `${rec.title}（${
        Array.isArray(rec.ingredients) ? rec.ingredients.join("、") : rec.ingredients
      }）`,
      nutrition: {
        calories: Math.round(rec.estimatedCalories),
        carbsG: Math.round(rec.macros.carbs),
        proteinG: Math.round(rec.macros.protein),
        fatG: Math.round(rec.macros.fat),
      },
      sourceNote: rec.recommendedSequence,
    });
  };

  const showToast = (ok: boolean, message: string) => setToast({ ok, message });

  const handleSync = async () => {
    try {
      await syncAll();
      showToast(true, "云端同步完成");
    } catch (e) {
      showToast(false, e instanceof Error ? e.message : "同步失败");
    }
  };

  const handleSignOut = async () => {
    // 清空同步元信息：确保下次登录（可能切换账号）执行一次全量上行
    useSyncMetaStore.getState().resetLastSyncAt();
    await signOut();
    showToast(true, "已退出登录，当前数据保留在本机");
  };

  return (
    <div className="min-h-dvh">
      {/* 顶栏：毛玻璃导航 + 安全区适配 */}
      <header className="glass sticky top-0 z-40 border-b border-slate-200/60 dark:border-white/[0.06]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5 pt-[calc(0.625rem+env(safe-area-inset-top))] md:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-sm shadow-blue-600/25">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-bold leading-tight tracking-tight text-slate-900 dark:text-white">
                GlucoFit
              </h1>
              <p className="hidden text-[11px] font-medium text-slate-400 xs:block dark:text-slate-500">
                代谢自动驾驶 · Metabolic Autopilot v3.0
              </p>
            </div>
          </div>

          <div className="hidden items-center gap-1.5 text-xs font-medium text-slate-400 lg:flex dark:text-slate-500">
            <CalendarDays className="h-4 w-4" />
            {todayLabel}
          </div>

          <div className="flex items-center gap-1.5">
            {/* 云同步：仅登录后显示（游客数据仅存本机，无同步语义） */}
            {user && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSync}
                disabled={syncing}
                title={
                  lastSyncAt
                    ? `上次同步 ${new Date(lastSyncAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}`
                    : "同步数据至云端"
                }
              >
                {syncing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CloudUpload className="h-4 w-4" />
                )}
                <span className="hidden md:inline">同步</span>
              </Button>
            )}
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon"
              title="设置"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings className="h-[18px] w-[18px]" />
            </Button>

            {/* 账户状态 */}
            {user ? (
              <div className="flex min-w-0 items-center gap-1 rounded-full border border-slate-200/80 bg-slate-50 py-1 pl-3 pr-1 dark:border-white/10 dark:bg-slate-800/60">
                <span
                  className="min-w-0 max-w-[84px] xs:max-w-[140px] truncate text-xs font-medium text-slate-500 dark:text-slate-400"
                  title={user.email}
                >
                  {user.email}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  title="退出登录"
                  onClick={handleSignOut}
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button size="sm" onClick={() => setAuthOpen(true)} disabled={checking}>
                <LogIn className="h-4 w-4" />
                <span className="hidden sm:inline">登录 / 注册</span>
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* 仪表盘：Bento Grid —— 移动端单列，md+ 双列便当盒 */}
      <main className="mx-auto max-w-7xl px-4 pb-28 pt-5 md:px-6 md:pb-24 md:pt-6">
        {/* 减重里程碑条（建档后常驻顶部） */}
        {profile && (
          <div className="mb-4 animate-fade-up md:mb-5">
            <MilestoneBar />
          </div>
        )}

        {/* v3.0 核心：虚拟血糖/胰岛素潮汐引擎（代谢数字孪生） */}
        <div className="mb-4 animate-fade-up [animation-delay:60ms] md:mb-5">
          <VirtualMetabolicWave />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5">
          {/* 左列：代谢监控与即时状态 */}
          <div className="flex flex-col gap-4 md:gap-5">
            <FastingTracker />
            <EnergyBalanceCard />

            {/* 今日饮食记录卡片流 */}
            <Card className="flex flex-col">
              <CardHeader className="flex-row items-start justify-between space-y-0">
                <div className="space-y-1.5">
                  <CardTitle className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      <UtensilsCrossed className="h-4 w-4" />
                    </span>
                    今日餐食稳糖追踪
                  </CardTitle>
                  <CardDescription>
                    {todayMeals.length > 0
                      ? `${todayMeals.length} 次进食 · 平均稳糖分 ${avgScore} 分`
                      : "今日尚无打卡记录"}
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-3">
                {todayMeals.length === 0 ? (
                  <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-200 py-10 text-center dark:border-white/10">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-50 dark:bg-slate-800/60">
                      <UtensilsCrossed className="h-5 w-5 text-slate-400 dark:text-slate-500" />
                    </span>
                    <p className="max-w-[260px] text-[13px] leading-relaxed text-slate-400 dark:text-slate-500">
                      点击右下角「记饮食」打卡，支持拍照识别与语音快记
                    </p>
                  </div>
                ) : (
                  todayMeals.map((log) => (
                    <MealLogCard
                      key={log.id}
                      log={log}
                      onEdit={handleEditMeal}
                      onDelete={handleDeleteMeal}
                    />
                  ))
                )}
              </CardContent>
            </Card>

            {/* 热量预算 + AI 控糖三餐推荐（紧随餐食记录的使用动线） */}
            <MealPlanner
              onAdopt={handleAdoptRecommendation}
              onOpenSettings={() => setSettingsOpen(true)}
            />
          </div>

          {/* 右列：体征趋势与智能分析 */}
          <div className="flex flex-col gap-4 md:gap-5">
            <BodyMetricsCard />
            <AIDiagnosisCard />
            <CompositionCharts />
          </div>
        </div>

        <p className="mt-6 text-center text-[11px] leading-relaxed text-slate-400 sm:text-xs dark:text-slate-500">
          控糖理念：进食顺序 蔬菜 → 蛋白脂肪 → 慢碳 · 餐后 30 分钟内激活肌肉泵（散步 / 提踵）· 热量赤字 300-500 kcal · 关注脂肪量下降与蛋白质量维持
        </p>
      </main>

      {/* 右下角常驻悬浮胶囊动作条 */}
      <FloatingActionCapsule
        onOpenMeal={() => openMealDialog()}
        onOpenExercise={() => setExerciseDialogOpen(true)}
        onOpenBody={() => setBodyDialogOpen(true)}
        onOpenSos={() => setSosOpen(true)}
      />

      {/* 同步结果轻提示 */}
      {toast && (
        <div
          className={`fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] left-1/2 z-50 flex max-w-[92vw] -translate-x-1/2 animate-fade-up items-center gap-2 rounded-full border px-4 py-2.5 text-sm shadow-xl backdrop-blur-md sm:bottom-6 ${
            toast.ok
              ? "border-emerald-500/20 bg-emerald-50/90 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-400"
              : "border-rose-500/20 bg-rose-50/90 text-rose-700 dark:bg-rose-950/70 dark:text-rose-400"
          }`}
        >
          {toast.message}
          <button
            type="button"
            onClick={() => setToast(null)}
            aria-label="关闭提示"
            className="text-current/60 transition-colors hover:text-current"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* 全局弹窗 */}
      <BodyCompositionDialog open={bodyDialogOpen} onOpenChange={setBodyDialogOpen} />
      <MealLogDialog
        open={mealDialogOpen}
        onOpenChange={setMealDialogOpen}
        prefill={mealPrefill}
      />
      <ExerciseLogDialog open={exerciseDialogOpen} onOpenChange={setExerciseDialogOpen} />
      <CravingSosDialog open={sosOpen} onOpenChange={setSosOpen} />
      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        onOpenOnboarding={() => setOnboardingOpen(true)}
      />
      <AuthModal open={authOpen} onOpenChange={setAuthOpen} />
      <OnboardingModal open={onboardingOpen} onOpenChange={setOnboardingOpen} />
    </div>
  );
}
