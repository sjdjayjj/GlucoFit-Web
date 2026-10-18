"use client";

import { useMemo } from "react";
import { Flame, Info, Trash2, Wallet } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useGlucoFitStore, useSortedBodyRecords } from "@/lib/storage";
import { useProfileStore, calcBaseline } from "@/lib/profile";
import { TARGET_DEFICIT, sumDayNutrition } from "@/lib/nutrition";
import { EXERCISE_CATEGORY_LABEL } from "@/types";
import { cn, fmtDate, shortTime } from "@/lib/utils";

const RING_RADIUS = 56;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

/** 运动消耗过大预警阈值：警惕反跳性碳水渴望 */
const OVERBURN_WARN_KCAL = 600;

export function EnergyBalanceCard() {
  const mealLogs = useGlucoFitStore((s) => s.mealLogs);
  const exerciseLogs = useGlucoFitStore((s) => s.exerciseLogs);
  const activityFactor = useGlucoFitStore((s) => s.activityFactor);
  const deleteExerciseLog = useGlucoFitStore((s) => s.deleteExerciseLog);
  const profile = useProfileStore((s) => s.profile);
  const records = useSortedBodyRecords();

  const today = fmtDate(new Date());

  const data = useMemo(() => {
    const todayMeals = mealLogs.filter(
      (l) => fmtDate(new Date(l.timestamp)) === today
    );
    const todayExercises = exerciseLogs
      .filter((l) => fmtDate(new Date(l.timestamp)) === today)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    const intake = Math.round(sumDayNutrition(todayMeals).calories);
    const activeBurn = Math.round(
      todayExercises.reduce((s, l) => s + (l.caloriesBurned || 0), 0)
    );
    const baseline = calcBaseline(profile, records[records.length - 1], activityFactor);
    const tdee = baseline ? Math.round(baseline.tdee) : null;
    const net = tdee != null ? intake - (tdee + activeBurn) : null;

    return { intake, activeBurn, tdee, net, baseline, todayExercises, loggedCount: todayMeals.length };
  }, [mealLogs, exerciseLogs, today, profile, records, activityFactor]);

  const { intake, activeBurn, tdee, net, baseline, todayExercises } = data;

  // 环形进度：赤字达成度（相对 400 kcal 目标）；盈余时展示摄入占消耗比
  const deficit = net != null ? -net : 0;
  const inDeficit = deficit >= 0;
  const ringProgress =
    net == null
      ? 0
      : inDeficit
        ? Math.min(1, deficit / TARGET_DEFICIT)
        : Math.min(1, intake / (tdee! + activeBurn || 1));
  const strokeColor =
    net == null
      ? "stroke-slate-200 dark:stroke-slate-700"
      : inDeficit
        ? "stroke-emerald-500"
        : "stroke-amber-500";

  const centerLabel =
    net == null
      ? "—"
      : inDeficit
        ? `赤字 ${deficit}`
        : `盈余 ${-deficit}`;

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div className="flex items-start gap-3">
          <div
            aria-hidden
            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:bg-blue-400/10 dark:text-blue-400"
          >
            <Wallet className="h-4 w-4" />
          </div>
          <div className="space-y-1">
            <CardTitle>今日热量收支</CardTitle>
            <CardDescription>净热量 = 摄入 − (静态 TDEE + 运动消耗)</CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-4">
        {baseline == null && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 p-2.5 text-[11px] leading-relaxed text-amber-700 break-words dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-400">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            暂无代谢基准：请完成初始档案建档或录入一次体脂秤数据，即可计算 BMR/TDEE 与净热量平衡。
          </div>
        )}

        <div className="flex items-center gap-4">
          {/* 收支环 */}
          <div className="relative shrink-0">
            <svg width={130} height={130} viewBox="0 0 130 130" className="-rotate-90">
              <circle
                cx="65"
                cy="65"
                r={RING_RADIUS}
                fill="none"
                className="stroke-slate-200/80 dark:stroke-white/10"
                strokeWidth={10}
              />
              <circle
                cx="65"
                cy="65"
                r={RING_RADIUS}
                fill="none"
                className={strokeColor}
                strokeWidth={10}
                strokeLinecap="round"
                strokeDasharray={RING_CIRCUMFERENCE}
                strokeDashoffset={RING_CIRCUMFERENCE * (1 - ringProgress)}
                style={{ transition: "stroke-dashoffset 0.6s ease" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div
                className={cn(
                  "text-lg font-semibold tabular-nums tracking-tight",
                  net == null
                    ? "text-slate-400 dark:text-slate-500"
                    : inDeficit
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-amber-600 dark:text-amber-400"
                )}
              >
                {centerLabel}
              </div>
              <div className="text-[10px] font-medium text-slate-400 dark:text-slate-500">
                {inDeficit ? `目标赤字 ${TARGET_DEFICIT}` : "kcal"}
              </div>
            </div>
          </div>

          {/* 三项结算 */}
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <StatRow label="饮食摄入" value={intake} unit="kcal" />
            <StatRow
              label={`静态 TDEE${baseline ? (baseline.formula === "katch_mcardle" ? " (Katch-McArdle)" : " (Mifflin)") : ""}`}
              value={tdee}
              unit="kcal"
            />
            <StatRow label="运动消耗" value={activeBurn} unit="kcal" accent />
          </div>
        </div>

        {activeBurn > OVERBURN_WARN_KCAL && (
          <p className="flex items-start gap-1.5 rounded-lg border border-amber-500/20 bg-amber-500/10 p-2.5 text-[11px] leading-relaxed text-amber-700 break-words dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-400">
            <Flame className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            今日运动消耗已超 {OVERBURN_WARN_KCAL} kcal，注意热量补给与睡眠，防范剧烈代偿性食欲（反跳性碳水渴望）。
          </p>
        )}

        {/* 当日运动记录 */}
        <div className="flex-1">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            当日运动 ({todayExercises.length})
          </div>
          {todayExercises.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 py-6 text-center dark:border-white/10">
              <Flame className="h-6 w-6 text-slate-300 dark:text-slate-600" />
              <p className="text-xs text-slate-400 dark:text-slate-500">
                还没有运动记录，餐后散步 15 分钟即可激活 GLUT4
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {todayExercises.map((l) => (
                <div
                  key={l.id}
                  className="flex items-center gap-2 rounded-xl border border-slate-200/70 bg-slate-50/60 px-2.5 py-2 transition-all duration-200 ease-out hover:border-slate-300/90 dark:border-white/[0.06] dark:bg-slate-800/40 dark:hover:border-white/[0.12]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-slate-900 dark:text-slate-100">
                      {EXERCISE_CATEGORY_LABEL[l.category]}
                      {l.isPostMeal && (
                        <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                          餐后
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 truncate text-[11px] text-slate-400 dark:text-slate-500">
                      {shortTime(l.timestamp)} · {l.durationMinutes} 分钟
                      {l.muscleFeel?.length ? ` · ${l.muscleFeel.join("/")}` : ""}
                    </div>
                  </div>
                  <span className="text-xs font-semibold tabular-nums text-sky-600 dark:text-sky-400">
                    {Math.round(l.caloriesBurned)} kcal
                  </span>
                  <button
                    type="button"
                    onClick={() => deleteExerciseLog(l.id)}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-slate-400 transition-all duration-200 ease-out hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400"
                    aria-label="删除运动记录"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function StatRow({
  label,
  value,
  unit,
  accent,
}: {
  label: string;
  value: number | null;
  unit: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="min-w-0 flex-1 truncate text-[11px] text-slate-400 dark:text-slate-500">{label}</span>
      <span
        className={cn(
          "shrink-0 whitespace-nowrap text-sm font-semibold tabular-nums tracking-tight",
          accent ? "text-sky-600 dark:text-sky-400" : "text-slate-900 dark:text-white"
        )}
      >
        {value == null ? "—" : value}
        <span className="ml-0.5 text-[10px] font-normal text-slate-400 dark:text-slate-500">{unit}</span>
      </span>
    </div>
  );
}
