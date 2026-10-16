"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlarmClock,
  CheckCircle2,
  Footprints,
  TriangleAlert,
  Waves,
  Zap,
} from "lucide-react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useGlucoFitStore } from "@/lib/storage";
import { cn } from "@/lib/utils";
import {
  CRASH_THRESHOLD,
  findActiveSpikeMeal,
  findProjectedCrash,
  GLUCOSE_BASELINE,
  simulateMetabolicCurve,
  SPIKE_THRESHOLD,
} from "@/lib/metabolic-sim";

/**
 * v3.0 核心组件：虚拟动态血糖/胰岛素潮汐引擎（代谢数字孪生）
 * 依据当日打卡推演 24h 血糖与胰岛素双波浪潮汐曲线，
 * 未来 3h 为预测虚线；冲高期提供一键「餐后运动削峰」急救。
 */
export function VirtualMetabolicWave() {
  const mealLogs = useGlucoFitStore((s) => s.mealLogs);
  const updateMealLog = useGlucoFitStore((s) => s.updateMealLog);
  const [now, setNow] = useState(() => new Date());
  const [rescued, setRescued] = useState<string | null>(null); // 已削峰的餐食 id

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const todayMeals = useMemo(() => {
    // 跨午夜补齐：昨晚 21:00 后的餐仍在代谢窗口内（餐后 2-3h 有反应尾部），
    // 否则凌晨时段曲线会突然失去昨晚深夜餐的贡献
    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setHours(cutoff.getHours() - 3);
    return mealLogs
      .filter((l) => new Date(l.timestamp) >= cutoff)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }, [mealLogs]);

  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const curve = useMemo(
    () => simulateMetabolicCurve(todayMeals, nowMinutes),
    [todayMeals, nowMinutes]
  );

  const data = useMemo(() => {
    // 拆分历史（实线）与预测（虚线）两条序列
    return curve.map((p) => ({
      time: p.time,
      minutes: p.minutes,
      glucosePast: p.isProjected ? null : p.glucose,
      glucoseFuture: p.isProjected ? p.glucose : null,
      insulinPast: p.isProjected ? null : p.insulinLoad,
      insulinFuture: p.isProjected ? p.insulinLoad : null,
      level: p.glucoseLevel,
      projected: p.isProjected,
    }));
  }, [curve]);

  const activeSpike = useMemo(
    () => findActiveSpikeMeal(todayMeals, nowMinutes),
    [todayMeals, nowMinutes]
  );

  const projectedCrash = useMemo(
    () => findProjectedCrash(curve, nowMinutes),
    [curve, nowMinutes]
  );

  const currentLevel = useMemo(() => {
    for (let i = curve.length - 1; i >= 0; i--) {
      if (curve[i].minutes <= nowMinutes) return curve[i];
    }
    return curve[0];
  }, [curve, nowMinutes]);

  const handleRescue = () => {
    if (!activeSpike) return;
    // 削峰急救：标记该餐已完成餐后肌肉泵，曲线自动压平约 32%
    updateMealLog(activeSpike.id, { postMealActivity: true });
    setRescued(activeSpike.id);
    window.setTimeout(() => setRescued(null), 6000);
  };

  const nowLabel = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  const levelDot =
    currentLevel.glucoseLevel === "spike"
      ? "bg-red-400"
      : currentLevel.glucoseLevel === "crash"
        ? "bg-amber-400"
        : currentLevel.glucoseLevel === "moderate"
          ? "bg-sky-300"
          : "bg-emerald-400";

  return (
    <Card className="relative overflow-hidden border-sky-900/40 bg-[linear-gradient(135deg,#081C33_0%,#0F3D6B_45%,#1B2A5E_75%,#2A1E52_100%)] text-white shadow-lg">
      {/* 装饰光晕：营造「驾驶舱」纵深感 */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-sky-500/20 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-28 -left-10 h-56 w-56 rounded-full bg-violet-500/15 blur-3xl"
      />
      <CardHeader className="relative flex-row flex-wrap items-start justify-between gap-2 space-y-0 pb-2">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-white">
            <Waves className="h-5 w-5 text-sky-300" />
            代谢数字孪生 · 血糖/胰岛素潮汐
          </CardTitle>
          <CardDescription className="text-sky-200/70">
            虚拟 CGM 实时推演 · 未来 3 小时预测（虚线）
          </CardDescription>
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-sky-300/30 bg-sky-400/10 px-2.5 py-1 text-[11px] font-medium text-sky-200">
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              levelDot,
              currentLevel.glucoseLevel === "spike" && "animate-pulse"
            )}
          />
          <Activity className="h-3 w-3" />
          当前 {nowLabel} · {levelLabel(currentLevel.glucoseLevel)}
        </div>
      </CardHeader>

      <CardContent className="relative space-y-3">
        {/* 反应性低血糖提前预警 */}
        {projectedCrash && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-300/40 bg-amber-400/15 p-2.5 text-xs text-amber-100">
            <AlarmClock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              <span className="font-semibold">提前预警：</span>
              预计 {projectedCrash.time}（约 {Math.round(projectedCrash.minutesUntil)} 分钟后）迎来反应性低血糖深谷，
              可能出现强烈嗜睡或甜食渴望。可先进行 15 分钟餐后运动或补充蛋白质垫底。
            </span>
          </div>
        )}

        {/* 餐后急救纠偏：冲高期动态脉冲按钮 */}
        {activeSpike && (
          <div className="flex flex-col gap-2 rounded-lg border border-red-400/40 bg-red-500/15 p-2.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2 text-xs text-red-100">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-pulse" />
              <span>
                <span className="font-semibold">血糖冲高进行中</span>
                （{activeSpike.foodSummary || "本餐"}）：立即激活肌肉泵可快速消耗血糖、削峰约 35%。
              </span>
            </div>
            {rescued === activeSpike.id ? (
              <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-400/20 px-3 py-1.5 text-xs font-semibold text-emerald-200">
                <CheckCircle2 className="h-3.5 w-3.5" />
                已削峰 · 曲线压平中
              </span>
            ) : (
              <Button
                size="sm"
                onClick={handleRescue}
                className="shrink-0 animate-pulse bg-amber-400 text-amber-950 hover:bg-amber-300 hover:text-amber-950"
              >
                <Zap className="h-3.5 w-3.5" />
                开启 15 分钟提踵/快走 · 削峰 35%
              </Button>
            )}
          </div>
        )}

        {/* 双波浪潮汐图 */}
        <div className="rounded-xl bg-[#0b1c30]/60 p-2 pt-3 ring-1 ring-inset ring-white/5">
          <div className="h-[200px] sm:h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 4, right: 6, bottom: 0, left: -18 }}>
              <defs>
                <linearGradient id="glucoseFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="#0F4C81" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="insulinFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#a78bfa" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" vertical={false} />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 10, fill: "#7dd3fc" }}
                tickLine={false}
                axisLine={false}
                interval={3}
              />
              <YAxis
                yAxisId="glucose"
                domain={[60, 190]}
                tick={{ fontSize: 10, fill: "#7dd3fc" }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                yAxisId="insulin"
                orientation="right"
                domain={[0, 100]}
                tick={{ fontSize: 10, fill: "#c4b5fd" }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid #164e63",
                  background: "#0b1c30",
                  fontSize: 12,
                  color: "#e0f2fe",
                }}
                labelStyle={{ color: "#7dd3fc" }}
                formatter={(
                  value: number | string,
                  name: string
                ): [string, string] => {
                  if (name.startsWith("血糖")) return [`${value} mg/dL`, name];
                  return [`${value} / 100`, name];
                }}
              />
              <Legend
                formatter={(value: string) => value}
                wrapperStyle={{ fontSize: 11, color: "#bae6fd" }}
              />
              {/* 冲高风暴区（红色）与 crash 深谷（琥珀）参照线 */}
              <ReferenceLine
                yAxisId="glucose"
                y={SPIKE_THRESHOLD}
                stroke="#f87171"
                strokeDasharray="4 4"
                strokeOpacity={0.6}
              />
              <ReferenceLine
                yAxisId="glucose"
                y={CRASH_THRESHOLD}
                stroke="#fbbf24"
                strokeDasharray="4 4"
                strokeOpacity={0.5}
              />
              <ReferenceLine
                yAxisId="glucose"
                y={GLUCOSE_BASELINE}
                stroke="#38bdf8"
                strokeOpacity={0.35}
              />
              {/* 当前时刻分界 */}
              <ReferenceLine
                yAxisId="glucose"
                x={nearestTick(nowMinutes)}
                stroke="#e0f2fe"
                strokeOpacity={0.5}
                label={{ value: "现在", fill: "#e0f2fe", fontSize: 10, position: "top" }}
              />
              {/* 预测区间底色 */}
              <ReferenceArea
                yAxisId="glucose"
                x1={nearestTick(nowMinutes)}
                x2="24:00"
                fill="#38bdf8"
                fillOpacity={0.05}
              />
              {/* 胰岛素水位（紫潮） */}
              <Area
                yAxisId="insulin"
                type="monotone"
                dataKey="insulinPast"
                name="胰岛素水位"
                stroke="#a78bfa"
                strokeWidth={1.5}
                fill="url(#insulinFill)"
                connectNulls={false}
                dot={false}
                isAnimationActive={false}
              />
              <Area
                yAxisId="insulin"
                type="monotone"
                dataKey="insulinFuture"
                name="胰岛素预测"
                stroke="#a78bfa"
                strokeWidth={1.5}
                strokeDasharray="5 4"
                fill="none"
                connectNulls={false}
                dot={false}
                isAnimationActive={false}
              />
              {/* 血糖曲线（蓝潮：历史实线 + 预测虚线） */}
              <Area
                yAxisId="glucose"
                type="monotone"
                dataKey="glucosePast"
                name="虚拟血糖"
                stroke="#7dd3fc"
                strokeWidth={2.5}
                fill="url(#glucoseFill)"
                connectNulls={false}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                yAxisId="glucose"
                type="monotone"
                dataKey="glucoseFuture"
                name="血糖预测"
                stroke="#7dd3fc"
                strokeWidth={2}
                strokeDasharray="6 5"
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 px-2 pb-1 text-[10px] text-sky-200/60">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-sm bg-sky-300" /> 血糖 (mg/dL) · 蓝潮
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-sm bg-violet-400" /> 胰岛素水位 · 紫潮
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-sm bg-red-400" /> 140 冲高线
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-sm bg-amber-400" /> 78 深谷线
            </span>
          </div>
        </div>

        {todayMeals.length === 0 && (
          <p className="text-center text-xs text-sky-200/60">
            今日尚无打卡，当前为空腹燃脂基线。打卡第一餐后，曲线将实时推演你的代谢潮汐。
          </p>
        )}

        {activeSpike && rescued === activeSpike.id && (
          <p className={cn("flex items-center justify-center gap-1 text-xs text-emerald-300")}>
            <Footprints className="h-3.5 w-3.5" />
            GLUT4 已激活，血糖正被肌肉非胰岛素依赖摄取，预计 30 分钟内回落至燃脂区。
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function levelLabel(level: string): string {
  switch (level) {
    case "spike":
      return "血糖冲高风暴区";
    case "moderate":
      return "平稳进食消化区";
    case "crash":
      return "反应性低血糖深谷";
    default:
      return "燃脂基线区";
  }
}

/** 找到曲线上最接近当前时刻的 X 轴刻度 */
function nearestTick(nowMinutes: number): string {
  const snapped = Math.round(nowMinutes / 15) * 15;
  const m = ((snapped % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}
