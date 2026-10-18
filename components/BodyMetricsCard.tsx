"use client";

import {
  Activity,
  Bone,
  Droplets,
  Dumbbell,
  Scale,
  Star,
  TrendingDown,
  TrendingUp,
  Weight,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useGlucoFitStore, useSortedBodyRecords } from "@/lib/storage";
import {
  analyzeComposition,
  analyzeInsulinSensitivity,
} from "@/lib/scoring";
import { cn, fmtNum } from "@/lib/utils";
import type { BodyCompositionRecord } from "@/types";

const EPSILON = 0.05;

interface PrimaryMetric {
  key: "weightKg" | "bmi" | "bodyFatRate" | "fatMassKg";
  label: string;
  unit: string;
  icon: React.ComponentType<{ className?: string }>;
  digits: number;
  lowerIsBetter: boolean;
}

const PRIMARY_METRICS: PrimaryMetric[] = [
  { key: "weightKg", label: "体重", unit: "kg", icon: Weight, digits: 1, lowerIsBetter: true },
  { key: "bmi", label: "BMI", unit: "", icon: Scale, digits: 1, lowerIsBetter: true },
  { key: "bodyFatRate", label: "体脂率", unit: "%", icon: Activity, digits: 1, lowerIsBetter: true },
  { key: "fatMassKg", label: "脂肪量", unit: "kg", icon: TrendingDown, digits: 1, lowerIsBetter: true },
];

interface SecondaryMetric {
  key: "waterWeightKg" | "proteinWeightKg" | "boneMassKg" | "bodyScore";
  label: string;
  unit: string;
  icon: React.ComponentType<{ className?: string }>;
  digits: number;
}

const SECONDARY_METRICS: SecondaryMetric[] = [
  { key: "waterWeightKg", label: "体水分量", unit: "kg", icon: Droplets, digits: 1 },
  { key: "proteinWeightKg", label: "蛋白质量", unit: "kg", icon: Dumbbell, digits: 1 },
  { key: "boneMassKg", label: "骨盐量", unit: "kg", icon: Bone, digits: 1 },
  { key: "bodyScore", label: "身体得分", unit: "分", icon: Star, digits: 0 },
];

function DeltaChip({
  current,
  previous,
  digits,
  unit,
  lowerIsBetter,
}: {
  current: number;
  previous?: number;
  digits: number;
  unit: string;
  lowerIsBetter?: boolean;
}) {
  if (previous == null) {
    return <span className="text-[11px] text-slate-400 dark:text-slate-500">首次记录</span>;
  }
  const delta = current - previous;
  if (Math.abs(delta) <= EPSILON) {
    return <span className="text-[11px] text-slate-400 dark:text-slate-500">较上次持平</span>;
  }
  const improved = lowerIsBetter ? delta < 0 : delta > 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-[11px] font-medium tabular-nums",
        improved
          ? "text-emerald-600 dark:text-emerald-400"
          : "text-rose-600 dark:text-rose-400"
      )}
    >
      {delta < 0 ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
      较上次 {delta > 0 ? "+" : ""}
      {fmtNum(delta, digits)}
      {unit}
    </span>
  );
}

export function BodyMetricsCard() {
  const records = useSortedBodyRecords();
  const mealLogs = useGlucoFitStore((s) => s.mealLogs);

  const latest = records[records.length - 1] as BodyCompositionRecord | undefined;
  const previous = records[records.length - 2] as BodyCompositionRecord | undefined;

  const compositionInsights = analyzeComposition(previous, latest);
  const insulinInsight = analyzeInsulinSensitivity(mealLogs);

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div className="flex items-start gap-3">
          <div
            aria-hidden
            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:bg-blue-400/10 dark:text-blue-400"
          >
            <Scale className="h-4 w-4" />
          </div>
          <div className="space-y-1">
            <CardTitle>体脂秤最新状态</CardTitle>
            <CardDescription>
              {latest
                ? `BIA 体成分报告 · ${latest.date}${latest.notes ? ` · ${latest.notes}` : ""}`
                : "暂无称重记录，点击右下角「录体脂」开始追踪"}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {latest ? (
          <>
            {/* 核心指标 */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {PRIMARY_METRICS.map((m) => {
                const Icon = m.icon;
                const value = latest[m.key];
                return (
                  <div
                    key={m.key}
                    className="rounded-xl border border-slate-200/70 bg-slate-50/60 p-3.5 dark:border-white/[0.06] dark:bg-slate-800/40"
                  >
                    <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400 dark:text-slate-500">
                      <Icon className="h-3.5 w-3.5" />
                      {m.label}
                    </div>
                    <div className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-slate-900 dark:text-white">
                      {fmtNum(value, m.digits)}
                      <span className="ml-0.5 text-xs font-medium text-slate-400 dark:text-slate-500">
                        {m.unit}
                      </span>
                    </div>
                    <div className="mt-1">
                      <DeltaChip
                        current={value}
                        previous={previous?.[m.key]}
                        digits={m.digits}
                        unit={m.unit}
                        lowerIsBetter={m.lowerIsBetter}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 次级体成分指标 */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {SECONDARY_METRICS.map((m) => {
                const Icon = m.icon;
                const value = latest[m.key];
                return (
                  <div
                    key={m.key}
                    className="flex items-center gap-2.5 rounded-xl border border-slate-200/70 p-2.5 dark:border-white/[0.06]"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600 dark:bg-sky-400/10 dark:text-sky-400">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[11px] text-slate-400 dark:text-slate-500">{m.label}</div>
                      <div className="text-sm font-semibold tabular-nums tracking-tight text-slate-900 dark:text-white">
                        {value != null ? `${fmtNum(value, m.digits)} ${m.unit}` : "—"}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 代谢导向提示 (4.2) */}
            {(compositionInsights.length > 0 || insulinInsight) && (
              <div className="space-y-2">
                {[...compositionInsights, ...(insulinInsight ? [insulinInsight] : [])].map((insight) => (
                  <div
                    key={insight.id}
                    className={cn(
                      "rounded-xl border p-3 text-xs leading-relaxed break-words",
                      insight.tone === "good" &&
                        "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-400",
                      insight.tone === "warn" &&
                        "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-400",
                      insight.tone === "info" &&
                        "border-sky-500/20 bg-sky-500/10 text-sky-600 dark:border-sky-400/20 dark:bg-sky-400/10 dark:text-sky-400"
                    )}
                  >
                    <span className="font-semibold">{insight.title}：</span>
                    {insight.description}
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-200 py-10 text-center dark:border-white/10">
            <Scale className="h-8 w-8 text-slate-300 dark:text-slate-600" />
            <p className="text-sm text-slate-400 dark:text-slate-500">
              录入体脂秤数据，开始追踪脂肪量与蛋白质量变化
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
