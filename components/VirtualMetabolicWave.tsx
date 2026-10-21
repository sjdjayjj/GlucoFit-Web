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
 *
 * v5 视觉：白卡底座（Argon）+ Oura 式白卡内嵌深色图表面板，
 * 图内配色（sky 血糖潮 / violet 胰岛素潮）保持深色面板语境不变。
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
      ? "bg-[#cf382e] dark:bg-[#c95046]"
      : currentLevel.glucoseLevel === "crash"
        ? "bg-[#96641c] dark:bg-[#dba75f]"
        : currentLevel.glucoseLevel === "moderate"
          ? "bg-[#5b87eb] dark:bg-[#7fa3f0]"
          : "bg-[#79ad31] dark:bg-[#9cc35c]";

  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-2 space-y-0 pb-2">
        <div className="flex items-start gap-3">
          <div
            aria-hidden
            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground"
          >
            <Waves className="h-4 w-4" />
          </div>
          <div className="space-y-1">
            <CardTitle>代谢数字孪生 · 血糖/胰岛素潮汐</CardTitle>
            <CardDescription>虚拟 CGM 实时推演 · 未来 3 小时预测（虚线）</CardDescription>
          </div>
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-border bg-secondary px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
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

      <CardContent className="space-y-3">
        {/* 反应性低血糖提前预警 */}
        {projectedCrash && (
          <div className="flex items-start gap-2 rounded-lg border border-[#96641c]/30 bg-[#fff5d9] p-2.5 text-xs text-[#96641c] dark:border-[#96641c]/30 dark:bg-[#362e1c] dark:text-[#dba75f]">
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
          <div className="flex flex-col gap-2 rounded-lg border border-[#cf382e]/30 bg-[#ffe7e5] p-2.5 dark:border-[#cf382e]/30 dark:bg-[#3a2422] sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2 text-xs text-[#c23430] dark:text-[#e5645a]">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-pulse" />
              <span>
                <span className="font-semibold">血糖冲高进行中</span>
                （{activeSpike.foodSummary || "本餐"}）：立即激活肌肉泵可快速消耗血糖、削峰约 35%。
              </span>
            </div>
            {rescued === activeSpike.id ? (
              <span className="flex shrink-0 items-center gap-1 rounded-full border border-[#79ad31]/30 bg-[#eef5e2] px-3 py-1.5 text-xs font-semibold text-[#54761e] dark:border-[#79ad31]/30 dark:bg-[#2a3320] dark:text-[#9cc35c]">
                <CheckCircle2 className="h-3.5 w-3.5" />
                已削峰 · 曲线压平中
              </span>
            ) : (
              <Button
                size="sm"
                onClick={handleRescue}
                className="shrink-0 animate-pulse s-grad-danger text-white border-[0.8px] border-[#d2463c]"
              >
                <Zap className="h-3.5 w-3.5" />
                开启 15 分钟提踵/快走 · 削峰 35%
              </Button>
            )}
          </div>
        )}

        {/* 双波浪潮汐图：白卡内嵌深色观测面板（Oura 式） */}
        <div className="rounded-[10px] border-[0.8px] border-border bg-secondary p-2 pt-3">
          <div className="h-[200px] sm:h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 4, right: 6, bottom: 0, left: -18 }}>
              <defs>
                <linearGradient id="glucoseFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#5b87eb" stopOpacity={0.18} />
                  <stop offset="100%" stopColor="#5b87eb" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="insulinFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#93b2f7" stopOpacity={0.18} />
                  <stop offset="100%" stopColor="#93b2f7" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#eeeeee" vertical={false} />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 10, fill: "#9d9d9d" }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
                minTickGap={36}
              />
              <YAxis
                yAxisId="glucose"
                domain={[60, 190]}
                tick={{ fontSize: 10, fill: "#9d9d9d" }}
                tickLine={false}
                axisLine={false}
                />
              <YAxis
                yAxisId="insulin"
                orientation="right"
                domain={[0, 100]}
                tick={{ fontSize: 10, fill: "#9d9d9d" }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
                minTickGap={36}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid #e2e2e2",
                  background: "#ffffff",
                  fontSize: 12,
                  color: "#333333",
                }}
                labelStyle={{ color: "#7f7f7f" }}
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
                wrapperStyle={{ fontSize: 11, color: "#7f7f7f" }}
              />
              {/* 冲高风暴区（红）与 crash 深谷（琥珀）参照线 */}
              <ReferenceLine
                yAxisId="glucose"
                y={SPIKE_THRESHOLD}
                stroke="#e5645a"
                strokeDasharray="4 4"
                strokeOpacity={0.6}
              />
              <ReferenceLine
                yAxisId="glucose"
                y={CRASH_THRESHOLD}
                stroke="#96641c"
                strokeDasharray="4 4"
                strokeOpacity={0.5}
              />
              <ReferenceLine
                yAxisId="glucose"
                y={GLUCOSE_BASELINE}
                stroke="#93b2f7"
                strokeOpacity={0.35}
              />
              {/* 当前时刻分界 */}
              <ReferenceLine
                yAxisId="glucose"
                x={nearestTick(nowMinutes)}
                stroke="#9d9d9d"
                strokeOpacity={0.5}
                label={{ value: "现在", fill: "#7f7f7f", fontSize: 10, position: "top" }}
              />
              {/* 预测区间底色 */}
              <ReferenceArea
                yAxisId="glucose"
                x1={nearestTick(nowMinutes)}
                x2="24:00"
                fill="#5b87eb"
                fillOpacity={0.05}
              />
              {/* 胰岛素水位（紫潮） */}
              <Area
                yAxisId="insulin"
                type="monotone"
                dataKey="insulinPast"
                name="胰岛素水位"
                stroke="#93b2f7"
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
                stroke="#93b2f7"
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
                stroke="#5b87eb"
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
                stroke="#5b87eb"
                strokeWidth={2}
                strokeDasharray="6 5"
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 px-2 pb-1 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-sm bg-[#5b87eb]" /> 血糖 (mg/dL) · 蓝潮
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-sm bg-[#93b2f7]" /> 胰岛素水位 · 紫潮
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-sm bg-[#e5645a]" /> 140 冲高线
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-sm bg-[#96641c]" /> 78 深谷线
            </span>
          </div>
        </div>

        {todayMeals.length === 0 && (
          <p className="text-center text-xs text-muted-foreground">
            今日尚无打卡，当前为空腹燃脂基线。打卡第一餐后，曲线将实时推演你的代谢潮汐。
          </p>
        )}

        {activeSpike && rescued === activeSpike.id && (
          <p className={cn("flex items-center justify-center gap-1 text-xs text-[#54761e] dark:text-[#9cc35c]")}>
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
