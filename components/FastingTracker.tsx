"use client";

import { useEffect, useMemo, useState } from "react";
import { Timer, Utensils, Waves } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useGlucoFitStore } from "@/lib/storage";
import { cn } from "@/lib/utils";
import type { UserGoalConfig } from "@/types";

const PROTOCOL_OPTIONS: UserGoalConfig["fastingProtocol"][] = ["16:8", "14:10", "12:12"];
const START_HOUR_OPTIONS = [8, 9, 10, 11, 12];

/** 各断食模式对应的进食窗口时长（小时） */
const WINDOW_HOURS: Record<UserGoalConfig["fastingProtocol"], number> = {
  "16:8": 8,
  "14:10": 10,
  "12:12": 12,
};

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
  const startHour = useGlucoFitStore((s) => s.eatingWindowStartHour);
  const updateGoal = useGlucoFitStore((s) => s.updateGoal);
  const setStartHour = useGlucoFitStore((s) => s.setEatingWindowStartHour);

  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const phase = useMemo(() => {
    const windowHours = WINDOW_HOURS[goal.fastingProtocol];
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
        windowHours,
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
      windowHours,
    };
  }, [now, startHour, goal.fastingProtocol]);

  const progress = Math.min(1, Math.max(0, phase.progress));
  const strokeColor = phase.eating ? "#10b981" : "#0ea5e9";

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div className="space-y-1.5">
          <CardTitle className="flex items-center gap-2">
            <Timer className="h-5 w-5 text-primary" />
            断食进度
          </CardTitle>
          <CardDescription>{goal.fastingProtocol} 间歇断食</CardDescription>
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col items-center justify-center gap-4">
        {/* 进度环 */}
        <div className="relative">
          <svg width={150} height={150} viewBox="0 0 150 150" className="-rotate-90">
            <circle cx="75" cy="75" r={RING_RADIUS} fill="none" stroke="#e2e8f0" strokeWidth={10} />
            <circle
              cx="75"
              cy="75"
              r={RING_RADIUS}
              fill="none"
              stroke={strokeColor}
              strokeWidth={10}
              strokeLinecap="round"
              strokeDasharray={RING_CIRCUMFERENCE}
              strokeDashoffset={RING_CIRCUMFERENCE * (1 - progress)}
              style={{ transition: "stroke-dashoffset 0.6s ease" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {phase.eating ? (
              <Utensils className="h-5 w-5 text-emerald-500" />
            ) : (
              <Waves className="h-5 w-5 text-sky-500" />
            )}
            <div
              className={cn(
                "mt-1 text-sm font-semibold",
                phase.eating ? "text-emerald-600" : "text-sky-600"
              )}
            >
              {phase.eating ? "进食窗口" : "低胰岛素消脂维护期"}
            </div>
            <div className="text-xs text-muted-foreground">
              {phase.eating ? "距窗口关闭" : "距开窗进食"}
            </div>
            <div className="text-xs font-semibold tabular-nums text-foreground">
              {fmtCountdown(phase.remaining)}
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          今日进食窗口 <span className="font-medium text-foreground">{phase.windowLabel}</span>
          ，断食 {24 - phase.windowHours} 小时有助胰岛素基线回落
        </p>

        {/* 模式与窗口时间设置 */}
        <div className="w-full space-y-2">
          <div className="flex gap-1 rounded-lg border bg-muted/40 p-1">
            {PROTOCOL_OPTIONS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => updateGoal({ fastingProtocol: p })}
                className={cn(
                  "flex-1 rounded-md px-1 py-1.5 text-xs font-medium transition-colors",
                  goal.fastingProtocol === p
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {p}
              </button>
            ))}
          </div>
          <div className="flex gap-1 rounded-lg border bg-muted/40 p-1">
            {START_HOUR_OPTIONS.map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => setStartHour(h)}
                className={cn(
                  "flex-1 rounded-md px-1 py-1.5 text-xs font-medium transition-colors",
                  startHour === h
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
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
