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
import { LineChart } from "lucide-react";
import { useSortedBodyRecords } from "@/lib/storage";
import { cn, daysAgoDateStr, shortDate } from "@/lib/utils";

type RangeDays = 7 | 30;

const RANGE_OPTIONS: Array<{ value: RangeDays; label: string }> = [
  { value: 7, label: "近 7 天" },
  { value: 30, label: "近 30 天" },
];

export function CompositionCharts() {
  const records = useSortedBodyRecords();
  const [range, setRange] = useState<RangeDays>(7);

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
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div className="space-y-1.5">
          <CardTitle className="flex items-center gap-2">
            <LineChart className="h-5 w-5 text-primary" />
            体成分多维趋势
          </CardTitle>
          <CardDescription>关注脂肪量下降与蛋白质量维持，判断减重是否掉肌</CardDescription>
        </div>
        <div className="flex gap-1 rounded-lg border bg-muted/40 p-1">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setRange(opt.value)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                range === opt.value
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
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
            {/* 图表 1：体重 + 体脂率 双轴 */}
            <div>
              <div className="mb-2 text-sm font-medium">体重 (kg) 与 体脂率 (%) 走势</div>
              <ResponsiveContainer width="100%" height={240}>
                <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis
                    yAxisId="weight"
                    domain={["dataMin - 0.5", "dataMax + 0.5"]}
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    yAxisId="fatRate"
                    orientation="right"
                    domain={["dataMin - 0.5", "dataMax + 0.5"]}
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, borderColor: "#e2e8f0", fontSize: 12 }}
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
                    stroke="#475569"
                    strokeWidth={2}
                    dot={{ r: 2.5, fill: "#475569" }}
                  />
                  <Line
                    yAxisId="fatRate"
                    type="monotone"
                    dataKey="bodyFatRate"
                    name="bodyFatRate"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={{ r: 2.5, fill: "#10b981" }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* 图表 2：脂肪量 vs 蛋白质量 */}
            <div>
              <div className="mb-2 text-sm font-medium">脂肪量 vs 蛋白质量 (kg) — 减重是否掉肌</div>
              <ResponsiveContainer width="100%" height={240}>
                <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis
                    domain={["dataMin - 0.5", "dataMax + 0.5"]}
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, borderColor: "#e2e8f0", fontSize: 12 }}
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
                    stroke="#10b981"
                    strokeWidth={2}
                    fill="#10b981"
                    fillOpacity={0.15}
                  />
                  <Line
                    type="monotone"
                    dataKey="protein"
                    name="protein"
                    stroke="#0ea5e9"
                    strokeWidth={2}
                    dot={{ r: 2.5, fill: "#0ea5e9" }}
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
