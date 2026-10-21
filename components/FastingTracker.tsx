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
  const strokeColor = phase.eating ? "stroke-[#79ad31]" : "stroke-[#5b87eb]";

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div className="flex items-start gap-3">
          <div
            aria-hidden
            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground"
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
                      ? "border-[#96641c]/30 bg-[#fff5d9] text-[#96641c] dark:border-[#96641c]/30 dark:bg-[#362e1c] dark:text-[#dba75f]"
                      : "border-[#5b87eb]/30 bg-accent text-[#3861c6] dark:border-[#5b87eb]/30 dark:bg-[#2a3552] dark:text-[#7fa3f0]"
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
              className="stroke-[#e2e2e2] dark:stroke-[#3b3b3b]"
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
              <Utensils className="h-5 w-5 text-[#54761e] dark:text-[#9cc35c]" />
            ) : (
              <Waves className="h-5 w-5 text-[#3861c6] dark:text-[#7fa3f0]" />
            )}
            <div
              className={cn(
                "mt-1 text-[11px] font-semibold tracking-wider",
                phase.eating ? "text-[#54761e] dark:text-[#9cc35c]" : "text-[#3861c6] dark:text-[#7fa3f0]"
              )}
            >
              {phase.eating ? "进食窗口" : "低胰岛素消脂维护期"}
            </div>
            <div className="text-[10px] text-muted-foreground">
              {phase.eating ? "距窗口关闭" : "距开窗进食"}
            </div>
            <div className="text-sm font-semibold tabular-nums tracking-tight text-foreground">
              {fmtCountdown(phase.remaining)}
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          今日进食窗口{" "}
          <span className="font-semibold tabular-nums text-foreground">{phase.windowLabel}</span>
          ，断食 {24 - windowHours} 小时有助胰岛素基线回落
        </p>

        {/* 模式与窗口时间设置 */}
        <div className="w-full space-y-2">
          {weeklySchedule?.enabled ? (
            <div className="rounded-[10px] border border-dashed border-border bg-secondary p-3 text-center text-xs text-muted-foreground">
              双模引擎已开启：工作日{" "}
              <span className="font-semibold text-foreground">{weeklySchedule.weekdayProtocol}</span>
              {" · "}周末{" "}
              <span className="font-semibold text-foreground">
                {weeklySchedule.weekendProtocol === "flexible" ? "弹性" : weeklySchedule.weekendProtocol}
              </span>
              ，当前自动切换为{" "}
              <span className="font-semibold text-[#3861c6] dark:text-[#7fa3f0]">{PROTOCOL_LABEL[protocol]}</span>
            </div>
          ) : (
            <div className="flex gap-1 rounded-[10px] border border-border bg-muted p-1 dark:border-border dark:bg-secondary">
              {PROTOCOL_OPTIONS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => updateGoal({ fastingProtocol: p })}
                  className={cn(
                    "min-h-10 flex-1 rounded-lg px-1 py-1.5 text-xs font-medium tabular-nums",
                    goal.fastingProtocol === p
                      ? "bg-card text-foreground shadow-sm dark:bg-secondary dark:text-white"
                      : "text-muted-foreground active:bg-[#f8f8f8] dark:active:bg-[#2a2a2a]"
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-1 rounded-[10px] border border-border bg-muted p-1 dark:border-border dark:bg-secondary">
            {START_HOUR_OPTIONS.map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => setStartHour(h)}
                className={cn(
                  "flex-1 rounded-lg px-1 py-1.5 text-xs font-medium tabular-nums",
                  startHour === h
                    ? "bg-card text-foreground shadow-sm dark:bg-secondary dark:text-white"
                    : "text-muted-foreground active:bg-[#f8f8f8] dark:active:bg-[#2a2a2a]"
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
