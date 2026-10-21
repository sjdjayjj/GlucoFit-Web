"use client";

import { useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Droplets } from "lucide-react";
import { useSortedBodyRecords } from "@/lib/storage";
import { analyzeHydration, VERDICT_STYLE } from "@/lib/bodyCompAnalyzer";
import type { BodyCompAnalysis } from "@/types/v3";
import { cn, daysAgoDateStr, shortDate } from "@/lib/utils";

type RangeDays = 7 | 30;

const RANGE_OPTIONS: Array<{ value: RangeDays; label: string }> = [
  { value: 7, label: "近 7 天" },
  { value: 30, label: "近 30 天" },
];

/** VERDICT_STYLE 为 lib 层浅色配色，dark 下叠加语义色修正 */
const VERDICT_DARK_CLASS: Record<BodyCompAnalysis["verdict"], string> = {
  fat_loss: "dark:border-[#79ad31]/30 dark:bg-[#2a3320] dark:text-[#9cc35c]",
  water_retention: "dark:border-[#5b87eb]/30 dark:bg-[#2a3552] dark:text-[#7fa3f0]",
  glycogen_refill: "dark:border-[#96641c]/30 dark:bg-[#362e1c] dark:text-[#dba75f]",
  fat_gain: "dark:border-[#cf382e]/30 dark:bg-[#3a2422] dark:text-[#e5645a]",
};

export function CompositionCharts() {
  const records = useSortedBodyRecords();
  const [range, setRange] = useState<RangeDays>(7);

  // v3.0 水合解耦：剥离水分噪音，解读最近一次体重波动
  const hydration = useMemo(() => analyzeHydration(records), [records]);

  const data = useMemo(() => {
    const cutoff = daysAgoDateStr(range - 1);
    return records
      .filter((r) => r.date >= cutoff)
      .map((r) => ({
        date: shortDate(r.date),
        weight: r.weightKg,
        bodyFatRate: r.bodyFatRate,
        fatMass: r.fatMassKg,
        protein: r.proteinWeightKg ?? null,
      }));
  }, [records, range]);

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-2 space-y-0">
        <div className="flex items-start gap-3">
          <div
            aria-hidden
            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground"
          >
            <LineChart className="h-4 w-4" />
          </div>
          <div className="space-y-1">
            <CardTitle>体成分多维趋势</CardTitle>
            <CardDescription>关注脂肪量下降与蛋白质量维持，判断减重是否掉肌</CardDescription>
          </div>
        </div>
        <div className="flex w-full gap-1 rounded-[10px] border border-border bg-muted p-1 sm:w-auto dark:border-border dark:bg-secondary">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setRange(opt.value)}
              className={cn(
                "min-h-10 flex-1 whitespace-nowrap rounded-lg px-2 py-1 text-xs font-medium sm:flex-none sm:px-2.5",
                range === opt.value
                  ? "bg-card text-foreground shadow-sm dark:bg-secondary dark:text-white"
                  : "text-muted-foreground active:bg-[#f8f8f8] dark:active:bg-[#2a2a2a]"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {data.length === 0 ? (
          <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
            该周期内暂无体成分记录
          </div>
        ) : (
          <>
            {/* v3.0 水合解耦诊断胶囊 */}
            {hydration && (
              <div
                className={cn(
                  "flex items-start gap-2.5 rounded-xl border p-3 text-xs leading-relaxed break-words",
                  VERDICT_STYLE[hydration.verdict].className,
                  VERDICT_DARK_CLASS[hydration.verdict]
                )}
              >
                <Droplets className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="space-y-0.5">
                  <div className="font-semibold">
                    {VERDICT_STYLE[hydration.verdict].icon}{" "}
                    {VERDICT_STYLE[hydration.verdict].label}
                    <span className="ml-2 font-normal opacity-80">
                      账面 {hydration.rawWeightDelta > 0 ? "+" : ""}
                      {hydration.rawWeightDelta.toFixed(1)} kg
                      {hydration.waterWeightDelta != null && (
                        <>
                          {" · "}水分 {hydration.waterWeightDelta > 0 ? "+" : ""}
                          {hydration.waterWeightDelta.toFixed(1)} kg
                        </>
                      )}
                      {" · "}真实脂肪 {hydration.trueFatDelta > 0 ? "+" : ""}
                      {hydration.trueFatDelta.toFixed(1)} kg
                    </span>
                  </div>
                  <div className="leading-relaxed opacity-90">{hydration.explanation}</div>
                </div>
              </div>
            )}

            {/* 图表 1：体重 + 体脂率 双轴 */}
            <div>
              <div className="mb-2 text-[11px] font-semibold tracking-wider text-muted-foreground">
                体重 (kg) 与 体脂率 (%) 走势
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eeeeee" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9d9d9d" }} tickLine={false} axisLine={false} />
                  <YAxis
                    yAxisId="weight"
                    domain={["dataMin - 0.5", "dataMax + 0.5"]}
                    tick={{ fontSize: 11, fill: "#9d9d9d" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    yAxisId="fatRate"
                    orientation="right"
                    domain={["dataMin - 0.5", "dataMax + 0.5"]}
                    tick={{ fontSize: 11, fill: "#9d9d9d" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid hsl(var(--border))",
                      backgroundColor: "hsl(var(--popover))",
                      color: "hsl(var(--foreground))",
                      fontSize: 12,
                    }}
                    formatter={(value: number | string, name: string) => [
                      typeof value === "number" ? value.toFixed(1) : value,
                      name === "weight" ? "体重 (kg)" : "体脂率 (%)",
                    ]}
                  />
                  <Legend
                    formatter={(value: string) => (value === "weight" ? "体重 (kg)" : "体脂率 (%)")}
                    wrapperStyle={{ fontSize: 12 }}
                  />
                  <Line
                    yAxisId="weight"
                    type="monotone"
                    dataKey="weight"
                    name="weight"
                    stroke="#5b87eb"
                    strokeWidth={2}
                    dot={{ r: 2.5, fill: "#5b87eb" }}
                  />
                  <Line
                    yAxisId="fatRate"
                    type="monotone"
                    dataKey="bodyFatRate"
                    name="bodyFatRate"
                    stroke="#79ad31"
                    strokeWidth={2}
                    dot={{ r: 2.5, fill: "#79ad31" }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* 图表 2：脂肪量 vs 蛋白质量 */}
            <div>
              <div className="mb-2 text-[11px] font-semibold tracking-wider text-muted-foreground">
                脂肪量 vs 蛋白质量 (kg) — 减重是否掉肌
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eeeeee" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9d9d9d" }} tickLine={false} axisLine={false} />
                  <YAxis
                    domain={["dataMin - 0.5", "dataMax + 0.5"]}
                    tick={{ fontSize: 11, fill: "#9d9d9d" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid hsl(var(--border))",
                      backgroundColor: "hsl(var(--popover))",
                      color: "hsl(var(--foreground))",
                      fontSize: 12,
                    }}
                    formatter={(value: number | string, name: string) => [
                      typeof value === "number" ? value.toFixed(1) : value,
                      name === "fatMass" ? "脂肪量 (kg)" : "蛋白质量 (kg)",
                    ]}
                  />
                  <Legend
                    formatter={(value: string) => (value === "fatMass" ? "脂肪量 (kg)" : "蛋白质量 (kg)")}
                    wrapperStyle={{ fontSize: 12 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="fatMass"
                    name="fatMass"
                    stroke="#79ad31"
                    strokeWidth={2}
                    fill="#79ad31"
                    fillOpacity={0.15}
                  />
                  <Line
                    type="monotone"
                    dataKey="protein"
                    name="protein"
                    stroke="#93b2f7"
                    strokeWidth={2}
                    dot={{ r: 2.5, fill: "#93b2f7" }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
