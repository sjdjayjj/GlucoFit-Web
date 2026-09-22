"use client";

import {
  CheckCircle2,
  Cookie,
  Moon,
  Sandwich,
  Sunrise,
  XCircle,
} from "lucide-react";
import {
  ENERGY_REACTION_LABEL,
  MEAL_TYPE_LABEL,
  SATIETY_DURATION_LABEL,
  type EnergyReaction,
  type MealLog,
  type MealType,
} from "@/types";
import { getScoreTone, SCORE_TONE_CLASS } from "@/lib/scoring";
import { cn, shortTime } from "@/lib/utils";

const MEAL_TYPE_ICON: Record<MealType, React.ComponentType<{ className?: string }>> = {
  breakfast: Sunrise,
  lunch: Sandwich,
  dinner: Moon,
  snack: Cookie,
};

const ENERGY_REACTION_CLASS: Record<EnergyReaction, string> = {
  energetic: "border-emerald-200 bg-emerald-50 text-emerald-700",
  normal: "border-slate-200 bg-slate-50 text-slate-600",
  food_coma: "border-red-200 bg-red-50 text-red-600",
};

function BehaviorBadge({ ok, okText, badText }: { ok: boolean; okText: string; badText: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        ok
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-slate-200 bg-slate-100 text-slate-500"
      )}
    >
      {ok ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
      {ok ? okText : badText}
    </span>
  );
}

export function MealLogCard({ log }: { log: MealLog }) {
  const MealIcon = MEAL_TYPE_ICON[log.mealType];
  const tone = getScoreTone(log.score);

  return (
    <div className="rounded-lg border bg-card p-3.5 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          {log.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={log.imageUrl}
              alt="餐食照片"
              className="h-8 w-8 rounded-md object-cover"
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
              <MealIcon className="h-4 w-4" />
            </div>
          )}
          <div>
            <div className="text-sm font-semibold">{MEAL_TYPE_LABEL[log.mealType]}</div>
            <div className="text-[11px] text-muted-foreground">{shortTime(log.timestamp)}</div>
          </div>
        </div>
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg border text-sm font-bold tabular-nums",
            SCORE_TONE_CLASS[tone]
          )}
        >
          {log.score}
          <span className="text-[9px] font-normal">稳糖分</span>
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        <BehaviorBadge
          ok={log.followedSequence}
          okText="顺序达标"
          badText="顺序未达标"
        />
        <BehaviorBadge
          ok={log.avoidedRefinedCarb}
          okText="控碳达标"
          badText="含精制碳水"
        />
        <BehaviorBadge
          ok={log.postMealActivity}
          okText="餐后轻动"
          badText="未活动"
        />
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
            ENERGY_REACTION_CLASS[log.energyReaction]
          )}
        >
          {ENERGY_REACTION_LABEL[log.energyReaction]}
        </span>
        {log.satietyDuration && (
          <span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700">
            抗饿 {SATIETY_DURATION_LABEL[log.satietyDuration]}
          </span>
        )}
      </div>

      {log.nutrition && (
        <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-muted-foreground">
          <span className="font-medium text-foreground">
            {Math.round(log.nutrition.calories)} kcal
          </span>
          <span>碳水 {Math.round(log.nutrition.carbsG)}g</span>
          <span>蛋白 {Math.round(log.nutrition.proteinG)}g</span>
          <span>脂肪 {Math.round(log.nutrition.fatG)}g</span>
        </div>
      )}

      {log.foodSummary && (
        <p className="mt-2 truncate text-xs text-muted-foreground">{log.foodSummary}</p>
      )}
    </div>
  );
}
