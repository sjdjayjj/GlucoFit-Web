"use client";

import { useMemo, useState } from "react";
import {
  ChefHat,
  Flame,
  Loader2,
  RefreshCw,
  Settings2,
  Sparkles,
  TriangleAlert,
  Wheat,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MEAL_TYPE_LABEL, type MealRecommendation } from "@/types";
import { useAISettingsStore, useGlucoFitStore, useSortedBodyRecords } from "@/lib/storage";
import { generateMealPlan, isAIConfigured } from "@/lib/ai-client";
import {
  ACTIVITY_LEVELS,
  NET_CARB_BUDGET_G,
  TARGET_DEFICIT,
  calcCalorieBudget,
  sumDayNutrition,
} from "@/lib/nutrition";
import { fmtDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

function BudgetBar({
  label,
  icon: Icon,
  value,
  max,
  unit,
  overWarn,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  value: number;
  max: number;
  unit: string;
  overWarn?: boolean;
}) {
  const pct = Math.min(100, max > 0 ? (value / max) * 100 : 0);
  const over = value > max;
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
          <Icon
            className={cn(
              "h-3.5 w-3.5",
              over && overWarn ? "text-rose-500" : "text-blue-600 dark:text-blue-400"
            )}
          />
          {label}
        </span>
        <span
          className={cn(
            "tabular-nums",
            over && overWarn
              ? "font-semibold text-rose-600 dark:text-rose-400"
              : "text-slate-400 dark:text-slate-500"
          )}
        >
          {Math.round(value)} / {Math.round(max)} {unit}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-700",
            over && overWarn ? "bg-rose-500" : pct > 80 ? "bg-amber-500" : "bg-blue-600"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function MealPlanner({
  onAdopt,
  onOpenSettings,
}: {
  onAdopt: (rec: MealRecommendation) => void;
  onOpenSettings: () => void;
}) {
  const records = useSortedBodyRecords();
  const mealLogs = useGlucoFitStore((s) => s.mealLogs);
  const goal = useGlucoFitStore((s) => s.goal);
  const activityFactor = useGlucoFitStore((s) => s.activityFactor);
  const setActivityFactor = useGlucoFitStore((s) => s.setActivityFactor);
  const aiSettings = useAISettingsStore((s) => s.aiSettings);

  const [preferences, setPreferences] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<MealRecommendation[] | null>(null);

  const latest = records[records.length - 1];
  const budget = useMemo(
    () => calcCalorieBudget(latest, activityFactor),
    [latest, activityFactor]
  );

  const todaySummary = useMemo(() => {
    const today = fmtDate(new Date());
    const todayLogs = mealLogs.filter(
      (l) => fmtDate(new Date(l.timestamp)) === today
    );
    return sumDayNutrition(todayLogs);
  }, [mealLogs]);

  const configured = isAIConfigured(aiSettings);
  const remainingCalories = budget
    ? Math.max(250, Math.round(budget.targetIntake - todaySummary.calories))
    : 0;
  const remainingNetCarbs = Math.max(
    10,
    NET_CARB_BUDGET_G - todaySummary.netCarbsG
  );

  const handleGenerate = async () => {
    if (!latest || !budget) {
      setError("请先录入体脂秤数据以计算 TDEE 热量预算");
      return;
    }
    if (!configured) {
      setError("请先在「AI 模型设置」中配置 API Key");
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const recs = await generateMealPlan(aiSettings, {
        remainingCalories,
        targetIntake: budget.targetIntake,
        consumedCalories: Math.round(todaySummary.calories),
        remainingNetCarbs,
        weightKg: latest.weightKg,
        fatMassKg: latest.fatMassKg,
        goalWeightKg: goal.targetWeightKg,
        goalBodyFatRate: goal.targetBodyFatRate,
        preferences: preferences.trim() || undefined,
      });
      setRecommendations(recs);
    } catch (e) {
      setError((e as Error).message || "生成失败，请重试");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-2 space-y-0">
        <div className="flex items-start gap-3">
          <div
            aria-hidden
            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-400"
          >
            <ChefHat className="h-4 w-4" />
          </div>
          <div className="space-y-1">
            <CardTitle>今日热量预算 与 AI 控糖三餐推荐</CardTitle>
            <CardDescription>
              {budget
                ? `Katch-McArdle：去脂体重 ${budget.ffmKg.toFixed(1)}kg · BMR ${Math.round(budget.bmr)} · TDEE ${Math.round(budget.tdee)} kcal，赤字 ${TARGET_DEFICIT} kcal`
                : "录入体脂秤数据后自动计算动态 TDEE（Katch-McArdle 公式）"}
            </CardDescription>
          </div>
        </div>
        <div className="flex w-full gap-1 rounded-xl border border-slate-200/70 bg-slate-100/80 p-1 sm:w-auto dark:border-white/10 dark:bg-slate-800/60">
          {ACTIVITY_LEVELS.map((a) => (
            <button
              key={a.value}
              type="button"
              onClick={() => setActivityFactor(a.value)}
              className={cn(
                "min-h-10 flex-1 whitespace-nowrap rounded-lg px-2 py-1 text-xs font-medium transition-all duration-200 ease-out sm:flex-none sm:px-2.5",
                activityFactor === a.value
                  ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white"
                  : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              )}
            >
              {a.label}
            </button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* 热量与碳水双轨面板 */}
        {budget ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <BudgetBar
              label="今日热量预算（含赤字控制）"
              icon={Flame}
              value={todaySummary.calories}
              max={budget.targetIntake}
              unit="kcal"
            />
            <div>
              <BudgetBar
                label="净碳水警戒线（总碳水 - 纤维）"
                icon={Wheat}
                value={todaySummary.netCarbsG}
                max={NET_CARB_BUDGET_G}
                unit="g"
                overWarn
              />
              {todaySummary.refinedExposureCount > 0 && (
                <p className="mt-1.5 flex items-center gap-1 text-[11px] font-medium break-words text-amber-600 dark:text-amber-400">
                  <TriangleAlert className="h-3 w-3" />
                  今日已有 {todaySummary.refinedExposureCount} 次精制碳水暴露
                </p>
              )}
            </div>
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-slate-200 p-3 text-xs text-slate-400 dark:border-white/10 dark:text-slate-500">
            暂无体成分数据：录入体脂秤数据后，将基于去脂体重（FFM）计算基础代谢与今日热量预算。
          </p>
        )}

        {/* AI 生成区 */}
        <div className="space-y-2">
          <Textarea
            placeholder="忌口 / 现有食材 / 偏好（选填）：如 家里有鸡胸肉、西兰花、藜麦；不吃海鲜"
            value={preferences}
            onChange={(e) => setPreferences(e.target.value)}
            className="min-h-[52px]"
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={handleGenerate} disabled={generating}>
              {generating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : recommendations ? (
                <RefreshCw className="h-4 w-4" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {generating
                ? "AI 正在搭配三餐…"
                : recommendations
                  ? "重新生成今日食谱"
                  : "AI 生成今日控糖三餐"}
            </Button>
            {!configured && (
              <Button variant="ghost" onClick={onOpenSettings}>
                <Settings2 className="h-4 w-4" />
                前往配置 AI
              </Button>
            )}
            {error && (
              <span className="text-xs leading-relaxed break-words text-rose-600 dark:text-rose-400">
                {error}
              </span>
            )}
          </div>
        </div>

        {/* 推荐结果 */}
        {recommendations && (
          <div className="grid gap-3 md:grid-cols-3">
            {recommendations.map((rec, i) => (
              <div
                key={`${rec.mealType}-${i}`}
                className="flex flex-col rounded-xl border border-slate-200/70 bg-slate-50/60 p-3.5 transition-all duration-200 ease-out hover:border-slate-300/90 dark:border-white/[0.06] dark:bg-slate-800/40 dark:hover:border-white/[0.12]"
              >
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[11px] font-semibold text-blue-600 dark:bg-blue-400/10 dark:text-blue-400">
                    {MEAL_TYPE_LABEL[rec.mealType]}
                  </span>
                  <span className="text-xs font-semibold tabular-nums tracking-tight text-slate-900 dark:text-white">
                    {Math.round(rec.estimatedCalories)} kcal
                  </span>
                </div>
                <h4 className="mt-2 text-sm font-semibold leading-snug text-slate-900 dark:text-white">
                  {rec.title}
                </h4>
                <p className="mt-1 text-[11px] tabular-nums text-slate-400 dark:text-slate-500">
                  碳水 {Math.round(rec.macros.carbs)}g · 蛋白 {Math.round(rec.macros.protein)}g · 脂肪 {Math.round(rec.macros.fat)}g
                </p>
                <p className="mt-2 flex-1 text-xs leading-relaxed break-words text-slate-500 dark:text-slate-400">
                  <span className="font-medium text-slate-900 dark:text-white">食材：</span>
                  {Array.isArray(rec.ingredients) ? rec.ingredients.join("、") : rec.ingredients}
                </p>
                <p className="mt-2 rounded-lg border border-sky-500/20 bg-sky-500/10 p-2 text-[11px] leading-relaxed break-words text-slate-700 dark:border-sky-400/20 dark:bg-sky-400/10 dark:text-slate-300">
                  <span className="font-semibold text-sky-600 dark:text-sky-400">顺序：</span>
                  {rec.recommendedSequence}
                </p>
                <Button
                  variant="outline"
                  className="mt-2.5 w-full"
                  onClick={() => onAdopt(rec)}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  采纳并打卡
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
