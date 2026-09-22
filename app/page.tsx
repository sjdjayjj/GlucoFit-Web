"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Bot,
  CalendarDays,
  CloudUpload,
  Dumbbell,
  Loader2,
  Plus,
  Scale,
  Settings,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { BodyMetricsCard } from "@/components/BodyMetricsCard";
import { BodyCompositionDialog } from "@/components/BodyCompositionDialog";
import { CompositionCharts } from "@/components/CompositionCharts";
import { EnergyBalanceCard } from "@/components/EnergyBalanceCard";
import { ExerciseLogDialog } from "@/components/ExerciseLogDialog";
import { FastingTracker } from "@/components/FastingTracker";
import { MealLogCard } from "@/components/MealLogCard";
import { MealLogDialog } from "@/components/MealLogDialog";
import { MealPlanner } from "@/components/MealPlanner";
import { MilestoneBar } from "@/components/MilestoneBar";
import { OnboardingModal } from "@/components/OnboardingModal";
import { AIDiagnosisModal } from "@/components/AIDiagnosisModal";
import { SettingsDialog } from "@/components/SettingsDialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useGlucoFitStore, useSyncSettingsStore } from "@/lib/storage";
import { useProfileStore } from "@/lib/profile";
import { isSyncConfigured, syncAll, useSyncRuntimeStore } from "@/lib/cloud";
import { fmtDate } from "@/lib/utils";
import type { MealLogPrefill, MealRecommendation } from "@/types";

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [bodyDialogOpen, setBodyDialogOpen] = useState(false);
  const [mealDialogOpen, setMealDialogOpen] = useState(false);
  const [mealPrefill, setMealPrefill] = useState<MealLogPrefill | null>(null);
  const [exerciseDialogOpen, setExerciseDialogOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [diagnosisOpen, setDiagnosisOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; message: string } | null>(null);

  const mealLogs = useGlucoFitStore((s) => s.mealLogs);
  const profile = useProfileStore((s) => s.profile);
  const onboardingDismissed = useProfileStore((s) => s.onboardingDismissed);
  const syncSettings = useSyncSettingsStore((s) => s.syncSettings);
  const syncing = useSyncRuntimeStore((s) => s.syncing);

  useEffect(() => {
    setMounted(true);
  }, []);

  // 首访 Onboarding：无档案且未跳过时自动弹出
  useEffect(() => {
    if (mounted && !profile && !onboardingDismissed) {
      setOnboardingOpen(true);
    }
  }, [mounted, profile, onboardingDismissed]);

  // 同步结果轻提示
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

  const handleSync = async () => {
    if (!isSyncConfigured(syncSettings)) {
      setSettingsOpen(true);
      setToast({ ok: false, message: "请先在设置中配置云端同步" });
      return;
    }
    try {
      await syncAll();
      setToast({ ok: true, message: "云端同步完成" });
    } catch (e) {
      setToast({
        ok: false,
        message: e instanceof Error ? e.message : "同步失败",
      });
    }
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
              <p className="text-[11px] text-muted-foreground">控糖与代谢改善系统 · v2.1</p>
            </div>
          </div>

          <div className="hidden items-center gap-1.5 text-xs text-muted-foreground lg:flex">
            <CalendarDays className="h-4 w-4" />
            {todayLabel}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setDiagnosisOpen(true)}>
              <Bot className="h-4 w-4" />
              <span className="hidden md:inline">AI 代谢分析</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => setBodyDialogOpen(true)}>
              <Scale className="h-4 w-4" />
              <span className="hidden sm:inline">体脂秤录入</span>
            </Button>
            <Button size="sm" onClick={() => openMealDialog()}>
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">记录饮食</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => setExerciseDialogOpen(true)}>
              <Dumbbell className="h-4 w-4" />
              <span className="hidden sm:inline">记运动</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              title="云端同步"
              onClick={handleSync}
              disabled={syncing}
            >
              {syncing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CloudUpload className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              title="设置"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* 仪表盘 */}
      <main className="mx-auto max-w-7xl p-4 md:p-6">
        <div className="grid gap-5 xl:grid-cols-3">
          {/* 减重里程碑条（建档后常驻顶部） */}
          {profile && (
            <div className="xl:col-span-3">
              <MilestoneBar />
            </div>
          )}

          <div className="xl:col-span-2">
            <BodyMetricsCard onOpenRecord={() => setBodyDialogOpen(true)} />
          </div>

          <FastingTracker />

          <div className="xl:col-span-2">
            <CompositionCharts />
          </div>

          {/* 今日餐食稳糖追踪流 */}
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
              <Button size="sm" onClick={() => openMealDialog()}>
                <Plus className="h-4 w-4" />
                打卡
              </Button>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-3">
              {todayMeals.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-10 text-center">
                  <UtensilsCrossed className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    拍照记录第一餐，AI 自动估算热量与宏量
                  </p>
                </div>
              ) : (
                todayMeals.map((log) => <MealLogCard key={log.id} log={log} />)
              )}
            </CardContent>
          </Card>

          {/* 今日热量收支环 + 当日运动记录 */}
          <EnergyBalanceCard />

          {/* 热量预算 + AI 控糖三餐推荐 */}
          <div className="xl:col-span-2">
            <MealPlanner
              onAdopt={handleAdoptRecommendation}
              onOpenSettings={() => setSettingsOpen(true)}
            />
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          控糖理念：进食顺序 蔬菜 → 蛋白脂肪 → 慢碳 · 餐后 30 分钟内激活肌肉泵（散步 / 提踵）· 热量赤字 300-500 kcal · 关注脂肪量下降与蛋白质量维持
        </p>
      </main>

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
      <AIDiagnosisModal open={diagnosisOpen} onOpenChange={setDiagnosisOpen} />
      <OnboardingModal open={onboardingOpen} onOpenChange={setOnboardingOpen} />
    </div>
  );
}
