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
import { AuthModal } from "@/components/AuthModal";
import { BodyMetricsCard } from "@/components/BodyMetricsCard";
import { BodyCompositionDialog } from "@/components/BodyCompositionDialog";
import { CompositionCharts } from "@/components/CompositionCharts";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useGlucoFitStore } from "@/lib/storage";
import { useProfileStore } from "@/lib/profile";
import { useAuthStore } from "@/lib/auth-store";
import { syncAll, useSyncRuntimeStore, useSyncMetaStore } from "@/lib/cloud";
import { fmtDate } from "@/lib/utils";
import type { MealLogPrefill, MealRecommendation } from "@/types";

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [bodyDialogOpen, setBodyDialogOpen] = useState(false);
  const [mealDialogOpen, setMealDialogOpen] = useState(false);
  const [mealPrefill, setMealPrefill] = useState<MealLogPrefill | null>(null);
  const [exerciseDialogOpen, setExerciseDialogOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; message: string } | null>(null);

  const mealLogs = useGlucoFitStore((s) => s.mealLogs);
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
    void refreshAuth();
  }, [refreshAuth]);

  // 首访 Onboarding：无档案且未跳过时自动弹出
  useEffect(() => {
    if (mounted && !profile && !onboardingDismissed) {
      setOnboardingOpen(true);
    }
  }, [mounted, profile, onboardingDismissed]);

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
      <div className="flex min-h-screen items-center justify-center">
        <Activity className="h-8 w-8 animate-pulse text-primary" />
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
    await signOut();
    showToast(true, "已退出登录，当前数据保留在本机");
  };

  return (
    <div className="min-h-screen">
      {/* 顶栏 */}
      <header className="sticky top-0 z-40 border-b bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 md:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-bold leading-tight">GlucoFit</h1>
              <p className="text-[11px] text-muted-foreground">控糖与代谢改善系统 · v2.2</p>
            </div>
          </div>

          <div className="hidden items-center gap-1.5 text-xs text-muted-foreground lg:flex">
            <CalendarDays className="h-4 w-4" />
            {todayLabel}
          </div>

          <div className="flex items-center gap-2">
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
            <Button
              variant="ghost"
              size="icon"
              title="设置"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings className="h-4 w-4" />
            </Button>

            {/* 账户状态 */}
            {user ? (
              <div className="flex items-center gap-1 rounded-full border bg-muted/40 py-1 pl-3 pr-1">
                <span className="max-w-[140px] truncate text-xs text-muted-foreground" title={user.email}>
                  {user.email}
                </span>
                <Button variant="ghost" size="icon" className="h-7 w-7" title="退出登录" onClick={handleSignOut}>
                  <LogOut className="h-3.5 w-3.5" />
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

      {/* 仪表盘：移动端单列，md+ 双列网格 */}
      <main className="mx-auto max-w-7xl p-4 md:p-6">
        {/* 减重里程碑条（建档后常驻顶部） */}
        {profile && (
          <div className="mb-5">
            <MilestoneBar />
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* 左列：代谢监控与即时状态 */}
          <div className="flex flex-col gap-6">
            <FastingTracker />
            <EnergyBalanceCard />

            {/* 今日饮食记录卡片流 */}
            <Card className="flex flex-col">
              <CardHeader className="flex-row items-start justify-between space-y-0">
                <div className="space-y-1.5">
                  <CardTitle className="flex items-center gap-2">
                    <UtensilsCrossed className="h-5 w-5 text-primary" />
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
                  <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-10 text-center">
                    <UtensilsCrossed className="h-8 w-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      点击右下角「记饮食」打卡，支持拍照识别与语音快记
                    </p>
                  </div>
                ) : (
                  todayMeals.map((log) => <MealLogCard key={log.id} log={log} />)
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
          <div className="flex flex-col gap-6">
            <BodyMetricsCard />
            <AIDiagnosisCard />
            <CompositionCharts />
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          控糖理念：进食顺序 蔬菜 → 蛋白脂肪 → 慢碳 · 餐后 30 分钟内激活肌肉泵（散步 / 提踵）· 热量赤字 300-500 kcal · 关注脂肪量下降与蛋白质量维持
        </p>
      </main>

      {/* 右下角常驻悬浮胶囊动作条 */}
      <FloatingActionCapsule
        onOpenMeal={() => openMealDialog()}
        onOpenExercise={() => setExerciseDialogOpen(true)}
        onOpenBody={() => setBodyDialogOpen(true)}
      />

      {/* 同步结果轻提示 */}
      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border px-4 py-2 text-sm shadow-lg ${
            toast.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-600"
          }`}
        >
          {toast.message}
          <button
            type="button"
            onClick={() => setToast(null)}
            aria-label="关闭提示"
            className="text-current/60 hover:text-current"
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
