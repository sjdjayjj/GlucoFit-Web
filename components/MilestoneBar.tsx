"use client";

import { Flag, TrendingDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useProfileStore } from "@/lib/profile";
import { useSortedBodyRecords } from "@/lib/storage";
import { calcMilestone } from "@/lib/profile";
import { cn } from "@/lib/utils";

/** 减重里程碑条：初始体重 → 当前 → 目标，全周期进度 (v2.1) */
export function MilestoneBar() {
  const profile = useProfileStore((s) => s.profile);
  const records = useSortedBodyRecords();
  if (!profile) return null;

  const latestWeight = records[records.length - 1]?.weightKg ?? profile.initialWeightKg;
  const m = calcMilestone(profile, latestWeight);
  const lost = m.lostKg >= 0;

  return (
    <Card>
      <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex items-center gap-2">
          <div
            aria-hidden
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#eef5e2] text-[#54761e] dark:bg-[#2a3320] dark:text-[#9cc35c]"
          >
            <Flag className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold text-foreground">
              {m.achieved ? "目标体重已达成 🎉" : "减重里程碑"}
            </div>
            <div className="text-[11px] tabular-nums text-muted-foreground">
              初始 {m.initialWeightKg.toFixed(1)} kg → 目标 {m.targetWeightKg.toFixed(1)} kg
            </div>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1 text-xs">
            <span
              className={cn(
                "flex items-center gap-1 font-semibold",
                lost ? "text-[#54761e] dark:text-[#9cc35c]" : "text-[#96641c] dark:text-[#dba75f]"
              )}
            >
              <TrendingDown className={cn("h-3.5 w-3.5", !lost && "rotate-180")} />
              {lost ? "已减" : "较初始"} {Math.abs(m.lostKg).toFixed(1)} kg
            </span>
            <span className="text-sm font-semibold tabular-nums tracking-tight text-foreground">
              当前 {m.currentWeightKg.toFixed(1)} kg
            </span>
            <span className="text-muted-foreground">
              {m.achieved ? "已达标" : `距目标还差 ${m.remainingKg.toFixed(1)} kg`}
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-muted dark:bg-secondary">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-700",
                  m.achieved
                    ? "bg-[#5b87eb]"
                    : "bg-[#79ad31]"
                )}
                style={{ width: `${Math.max(2, m.progressPct)}%` }}
              />
            </div>
            <span className="shrink-0 whitespace-nowrap text-[11px] font-medium tabular-nums text-muted-foreground">
              总进度 {m.progressPct.toFixed(0)}%
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
