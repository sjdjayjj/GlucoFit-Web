"use client";

import { useState } from "react";
import {
  CheckCircle2,
  Cookie,
  Moon,
  Pencil,
  Sandwich,
  Sunrise,
  Trash2,
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
import { getScoreTone, type ScoreTone } from "@/lib/scoring";
import { cn, shortTime } from "@/lib/utils";

/** 稳糖分徽章配色：语义化原子类，双主题可读 */
const SCORE_BADGE_CLASS: Record<ScoreTone, string> = {
  good: "border-[#d5e5bb] bg-[#eef5e2] text-[#54761e] dark:border-[#3a4a26] dark:bg-[#2a3320] dark:text-[#9cc35c]",
  warn: "border-[#f0dfb4] bg-[#fff5d9] text-[#96641c] dark:border-[#4d4229] dark:bg-[#362e1c] dark:text-[#dba75f]",
  bad: "border-[#f3c7c4] bg-[#ffe7e5] text-[#c23430] dark:border-[#4a2c29] dark:bg-[#3a2422] dark:text-[#e5645a]",
};

const MEAL_TYPE_ICON: Record<MealType, React.ComponentType<{ className?: string }>> = {
  breakfast: Sunrise,
  lunch: Sandwich,
  dinner: Moon,
  snack: Cookie,
};

const ENERGY_REACTION_CLASS: Record<EnergyReaction, string> = {
  energetic: "border-[#d5e5bb] bg-[#eef5e2] text-[#54761e] dark:border-[#3a4a26] dark:bg-[#2a3320] dark:text-[#9cc35c]",
  normal: "border-border bg-secondary text-muted-foreground",
  food_coma: "border-[#f3c7c4] bg-[#ffe7e5] text-[#c23430] dark:border-[#4a2c29] dark:bg-[#3a2422] dark:text-[#e5645a]",
};

function BehaviorBadge({ ok, okText, badText }: { ok: boolean; okText: string; badText: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        ok
          ? "border-[#d5e5bb] bg-[#eef5e2] text-[#54761e] dark:border-[#3a4a26] dark:bg-[#2a3320] dark:text-[#9cc35c]"
          : "border-border bg-secondary text-muted-foreground"
      )}
    >
      {ok ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
      {ok ? okText : badText}
    </span>
  );
}

export function MealLogCard({
  log,
  onEdit,
  onDelete,
}: {
  log: MealLog;
  onEdit?: (log: MealLog) => void;
  onDelete?: (id: string) => void;
}) {
  const MealIcon = MEAL_TYPE_ICON[log.mealType];
  const tone = getScoreTone(log.score);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const handleDeleteClick = () => {
    if (confirmingDelete) {
      onDelete?.(log.id);
      return;
    }
    setConfirmingDelete(true);
    setTimeout(() => setConfirmingDelete(false), 3000);
  };

  return (
    <div className="rounded-[8px] border border-border bg-secondary/60 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          {log.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={log.imageUrl}
              alt="餐食照片"
              className="h-8 w-8 rounded-lg object-cover"
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#eef5e2] text-[#54761e] dark:bg-[#2a3320] dark:text-[#9cc35c]">
              <MealIcon className="h-4 w-4" />
            </div>
          )}
          <div>
            <div className="text-sm font-semibold text-foreground">
              {MEAL_TYPE_LABEL[log.mealType]}
            </div>
            <div className="text-[11px] tabular-nums text-muted-foreground">
              {shortTime(log.timestamp)}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-start gap-1">
          {(onEdit || onDelete) && (
            <div className="flex items-center gap-0.5">
              {onEdit && (
                <button
                  type="button"
                  onClick={() => onEdit(log)}
                  title="编辑"
                  aria-label="编辑该餐记录"
                  className="flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground active:bg-muted"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              )}
              {onDelete &&
                (confirmingDelete ? (
                  <button
                    type="button"
                    onClick={handleDeleteClick}
                    className="flex h-10 items-center rounded-md border border-[#f3c7c4] bg-[#ffe7e5] px-3 text-xs font-medium text-[#c23430] dark:border-[#4a2c29] dark:bg-[#3a2422] dark:text-[#e5645a]"
                  >
                    确认删除
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleDeleteClick}
                    title="删除"
                    aria-label="删除该餐记录"
                    className="flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground active:bg-[#ffe7e5] active:text-[#c23430] dark:active:bg-[#3a2422] dark:active:text-[#e5645a]"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                ))}
            </div>
          )}
          <div
            className={cn(
              "flex h-10 w-10 flex-col items-center justify-center rounded-lg border text-sm font-bold tabular-nums tracking-tight",
              SCORE_BADGE_CLASS[tone]
            )}
          >
            {log.score}
            <span className="text-[9px] font-normal">稳糖分</span>
          </div>
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
          <span className="inline-flex items-center rounded-full border border-[#c9d8f7] bg-accent px-2 py-0.5 text-[11px] font-medium text-[#3861c6] dark:border-[#3d5480] dark:text-[#7fa3f0]">
            抗饿 {SATIETY_DURATION_LABEL[log.satietyDuration]}
          </span>
        )}
      </div>

      {log.nutrition && (
        <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] tabular-nums text-muted-foreground">
          <span className="font-semibold text-foreground">
            {Math.round(log.nutrition.calories)} kcal
          </span>
          <span>碳水 {Math.round(log.nutrition.carbsG)}g</span>
          <span>蛋白 {Math.round(log.nutrition.proteinG)}g</span>
          <span>脂肪 {Math.round(log.nutrition.fatG)}g</span>
        </div>
      )}

      {log.foodSummary && (
        <p className="mt-2 text-xs leading-relaxed break-words text-muted-foreground">
          {log.foodSummary}
        </p>
      )}
    </div>
  );
}
