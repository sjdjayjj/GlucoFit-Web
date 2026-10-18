"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarRange, Timer, Utensils, Waves } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useGlucoFitStore } from "@/lib/storage";
import { cn } from "@/lib/utils";
import {
  effectiveFastingProtocol,
  PROTOCOL_LABEL,
  PROTOCOL_WINDOW_HOURS,
} from "@/lib/metabolic-sim";

const PROTOCOL_OPTIONS = ["16:8", "14:10", "12:12"] as const;
const START_HOUR_OPTIONS = [8, 9, 10, 11, 12];

const RING_RADIUS = 56;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function fmtCountdown(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h} 小时 ${String(m).padStart(2, "0")} 分`;
}

function fmtClock(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

export function FastingTracker() {
  const goal = useGlucoFitStore((s) => s.goal);
  const weeklySchedule = useGlucoFitStore((s) => s.weeklySchedule);
  const startHour = useGlucoFitStore((s) => s.eatingWindowStartHour);
  const updateGoal = useGlucoFitStore((s) => s.updateGoal);
  const setStartHour = useGlucoFitStore((s) => s.setEatingWindowStartHour);

  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  // v3.0 双模引擎：工作日严格 / 周末弹性自动切换（关闭时回退手动协议）
  const { protocol, isWeekendMode } = useMemo(
    () => effectiveFastingProtocol(weeklySchedule, now, goal.fastingProtocol),
    [weeklySchedule, now, goal.fastingProtocol]
  );
  const windowHours = PROTOCOL_WINDOW_HOURS[protocol];

  const phase = useMemo(() => {
    const todayStart = new Date(now);
    todayStart.setHours(startHour, 0, 0, 0);
    const todayEnd = new Date(todayStart.getTime() + windowHours * 3600_000);

    if (now >= todayStart && now < todayEnd) {
      // 进食窗口中
      return {
        eating: true,
        progress: (now.getTime() - todayStart.getTime()) / (windowHours * 3600_000),
        remaining: todayEnd.getTime() - now.getTime(),
        windowLabel: `${fmtClock(startHour)} — ${fmtClock((startHour + windowHours) % 24)}`,
      };
    }
    // 断食期（低胰岛素消脂维护期）
    const fastStart = now < todayStart ? new Date(todayEnd.getTime() - 24 * 3600_000) : todayEnd;
    const fastEnd = now < todayStart ? todayStart : new Date(todayStart.getTime() + 24 * 3600_000);
    return {
      eating: false,
      progress: (now.getTime() - fastStart.getTime()) / (fastEnd.getTime() - fastStart.getTime()),
      remaining: fastEnd.getTime() - now.getTime(),
      windowLabel: `${fmtClock(startHour)} — ${fmtClock((startHour + windowHours) % 24)}`,
    };
  }, [now, startHour, windowHours]);

  const progress = Math.min(1, Math.max(0, phase.progress));
  const strokeColor = phase.eating ? "stroke-emerald-500" : "stroke-sky-500";

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div className="flex items-start gap-3">
          <div
            aria-hidden
            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600 dark:bg-sky-400/10 dark:text-sky-400"
          >
            <Timer className="h-4 w-4" />
          </div>
          <div className="space-y-1.5">
            <CardTitle>断食进度</CardTitle>
            <CardDescription className="flex flex-wrap items-center gap-1.5">
              {PROTOCOL_LABEL[protocol]} 间歇断食
              {weeklySchedule?.enabled && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium",
                    isWeekendMode
                      ? "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-400"
                      : "border-blue-500/20 bg-blue-500/10 text-blue-600 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-400"
                  )}
                >
                  <CalendarRange className="h-3 w-3" />
                  {isWeekendMode ? "周末防御模式" : "工作日自动驾驶"}
                </span>
              )}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col items-center justify-center gap-4">
        {/* 进度环 */}
        <div className="relative">
          <svg width={150} height={150} viewBox="0 0 150 150" className="-rotate-90">
            <circle
              cx="75"
              cy="75"
              r={RING_RADIUS}
              fill="none"
              className="stroke-slate-200/80 dark:stroke-white/10"
              strokeWidth={10}
            />
            <circle
              cx="75"
              cy="75"
              r={RING_RADIUS}
              fill="none"
              className={strokeColor}
              strokeWidth={10}
              strokeLinecap="round"
              strokeDasharray={RING_CIRCUMFERENCE}
              strokeDashoffset={RING_CIRCUMFERENCE * (1 - progress)}
              style={{ transition: "stroke-dashoffset 0.6s ease" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {phase.eating ? (
              <Utensils className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <Waves className="h-5 w-5 text-sky-600 dark:text-sky-400" />
            )}
            <div
              className={cn(
                "mt-1 text-[11px] font-semibold tracking-wider",
                phase.eating ? "text-emerald-600 dark:text-emerald-400" : "text-sky-600 dark:text-sky-400"
              )}
            >
              {phase.eating ? "进食窗口" : "低胰岛素消脂维护期"}
            </div>
            <div className="text-[10px] text-slate-400 dark:text-slate-500">
              {phase.eating ? "距窗口关闭" : "距开窗进食"}
            </div>
            <div className="text-sm font-semibold tabular-nums tracking-tight text-slate-900 dark:text-white">
              {fmtCountdown(phase.remaining)}
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-slate-500 dark:text-slate-400">
          今日进食窗口{" "}
          <span className="font-semibold tabular-nums text-slate-900 dark:text-white">{phase.windowLabel}</span>
          ，断食 {24 - windowHours} 小时有助胰岛素基线回落
        </p>

        {/* 模式与窗口时间设置 */}
        <div className="w-full space-y-2">
          {weeklySchedule?.enabled ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-3 text-center text-xs text-slate-500 dark:border-white/10 dark:bg-slate-800/40 dark:text-slate-400">
              双模引擎已开启：工作日{" "}
              <span className="font-semibold text-slate-900 dark:text-white">{weeklySchedule.weekdayProtocol}</span>
              {" · "}周末{" "}
              <span className="font-semibold text-slate-900 dark:text-white">
                {weeklySchedule.weekendProtocol === "flexible" ? "弹性" : weeklySchedule.weekendProtocol}
              </span>
              ，当前自动切换为{" "}
              <span className="font-semibold text-blue-600 dark:text-blue-400">{PROTOCOL_LABEL[protocol]}</span>
            </div>
          ) : (
            <div className="flex gap-1 rounded-xl border border-slate-200/70 bg-slate-100/80 p-1 dark:border-white/10 dark:bg-slate-800/60">
              {PROTOCOL_OPTIONS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => updateGoal({ fastingProtocol: p })}
                  className={cn(
                    "min-h-10 flex-1 rounded-lg px-1 py-1.5 text-xs font-medium tabular-nums transition-all duration-200 ease-out",
                    goal.fastingProtocol === p
                      ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white"
                      : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-1 rounded-xl border border-slate-200/70 bg-slate-100/80 p-1 dark:border-white/10 dark:bg-slate-800/60">
            {START_HOUR_OPTIONS.map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => setStartHour(h)}
                className={cn(
                  "flex-1 rounded-lg px-1 py-1.5 text-xs font-medium tabular-nums transition-all duration-200 ease-out",
                  startHour === h
                    ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                )}
              >
                {fmtClock(h)}
              </button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
