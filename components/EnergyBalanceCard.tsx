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
  const strokeColor = net == null ? "#cbd5e1" : inDeficit ? "#10b981" : "#f59e0b";

  const centerLabel =
    net == null
      ? "—"
      : inDeficit
        ? `赤字 ${deficit}`
        : `盈余 ${-deficit}`;

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div className="space-y-1.5">
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            今日热量收支
          </CardTitle>
          <CardDescription>
            净热量 = 摄入 − (静态 TDEE + 运动消耗)
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-4">
        {baseline == null && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[11px] leading-relaxed text-amber-700">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            暂无代谢基准：请完成初始档案建档或录入一次体脂秤数据，即可计算 BMR/TDEE 与净热量平衡。
          </div>
        )}

        <div className="flex items-center gap-4">
          {/* 收支环 */}
          <div className="relative shrink-0">
            <svg width={130} height={130} viewBox="0 0 130 130" className="-rotate-90">
              <circle cx="65" cy="65" r={RING_RADIUS} fill="none" stroke="#e2e8f0" strokeWidth={10} />
              <circle
                cx="65"
                cy="65"
                r={RING_RADIUS}
                fill="none"
                stroke={strokeColor}
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
                  "text-base font-bold tabular-nums",
                  net == null
                    ? "text-muted-foreground"
                    : inDeficit
                      ? "text-emerald-600"
                      : "text-amber-600"
                )}
              >
                {centerLabel}
              </div>
              <div className="text-[10px] text-muted-foreground">
                {inDeficit ? `目标赤字 ${TARGET_DEFICIT}` : "kcal"}
              </div>
            </div>
          </div>

          {/* 三项结算 */}
          <div className="flex flex-1 flex-col gap-2">
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
          <p className="flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[11px] leading-relaxed text-amber-700">
            <Flame className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            今日运动消耗已超 {OVERBURN_WARN_KCAL} kcal，注意热量补给与睡眠，防范剧烈代偿性食欲（反跳性碳水渴望）。
          </p>
        )}

        {/* 当日运动记录 */}
        <div className="flex-1">
          <div className="mb-2 text-xs font-medium text-muted-foreground">
            当日运动 ({todayExercises.length})
          </div>
          {todayExercises.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-6 text-center">
              <Flame className="h-6 w-6 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">
                还没有运动记录，餐后散步 15 分钟即可激活 GLUT4
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {todayExercises.map((l) => (
                <div
                  key={l.id}
                  className="flex items-center gap-2 rounded-lg border bg-muted/30 px-2.5 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-xs font-medium">
                      {EXERCISE_CATEGORY_LABEL[l.category]}
                      {l.isPostMeal && (
                        <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                          餐后
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                      {shortTime(l.timestamp)} · {l.durationMinutes} 分钟
                      {l.muscleFeel?.length ? ` · ${l.muscleFeel.join("/")}` : ""}
                    </div>
                  </div>
                  <span className="text-xs font-semibold tabular-nums text-sky-600">
                    {Math.round(l.caloriesBurned)} kcal
                  </span>
                  <button
                    type="button"
                    onClick={() => deleteExerciseLog(l.id)}
                    className="text-muted-foreground transition-colors hover:text-red-500"
                    aria-label="删除运动记录"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
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
      <span className="truncate text-[11px] text-muted-foreground">{label}</span>
      <span
        className={cn(
          "text-sm font-semibold tabular-nums",
          accent ? "text-sky-600" : "text-foreground"
        )}
      >
        {value == null ? "—" : value}
        <span className="ml-0.5 text-[10px] font-normal text-muted-foreground">{unit}</span>
      </span>
    </div>
  );
}
