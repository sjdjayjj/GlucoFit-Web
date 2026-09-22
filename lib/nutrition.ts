import type { BodyCompositionRecord, MealLog } from "@/types";

/** 活动系数选项（用于 TDEE 计算） */
export const ACTIVITY_LEVELS = [
  { value: 1.2, label: "久坐" },
  { value: 1.375, label: "轻度活动" },
  { value: 1.55, label: "中度活动" },
] as const;

/** 推荐热量赤字：300-500 kcal 区间中值，避免过大赤字造成 IR 恶化 */
export const TARGET_DEFICIT = 400;

/** 控糖减脂期净碳水日预算 (g) */
export const NET_CARB_BUDGET_G = 120;

export interface CalorieBudget {
  ffmKg: number; // 去脂体重 (FFM)
  bmr: number; // 基础代谢
  tdee: number; // 每日总消耗
  targetIntake: number; // 今日推荐摄入 = TDEE - 赤字
}

/**
 * 动态 TDEE：Katch-McArdle 公式（基于去脂体重，比 Mifflin-St Jeor 更契合减脂人群）
 * BMR = 370 + 21.6 × FFM(kg)
 */
export function calcCalorieBudget(
  latest: BodyCompositionRecord | undefined,
  activityFactor: number
): CalorieBudget | null {
  if (!latest) return null;
  const ffmKg = latest.weightKg * (1 - latest.bodyFatRate / 100);
  const bmr = 370 + 21.6 * ffmKg;
  const tdee = bmr * activityFactor;
  return {
    ffmKg,
    bmr,
    tdee,
    targetIntake: Math.round(tdee - TARGET_DEFICIT),
  };
}

export interface DailyNutritionSummary {
  calories: number;
  carbsG: number;
  fiberG: number;
  proteinG: number;
  fatG: number;
  netCarbsG: number; // 净碳水 = 总碳水 - 膳食纤维
  refinedExposureCount: number; // 今日精制碳水暴露次数
  loggedCount: number;
}

/** 汇总当日已记录餐食的营养与宏量 */
export function sumDayNutrition(logs: MealLog[]): DailyNutritionSummary {
  const s: DailyNutritionSummary = {
    calories: 0,
    carbsG: 0,
    fiberG: 0,
    proteinG: 0,
    fatG: 0,
    netCarbsG: 0,
    refinedExposureCount: 0,
    loggedCount: logs.length,
  };
  for (const l of logs) {
    if (!l.nutrition) continue;
    s.calories += l.nutrition.calories || 0;
    s.carbsG += l.nutrition.carbsG || 0;
    s.fiberG += l.nutrition.fiberG || 0;
    s.proteinG += l.nutrition.proteinG || 0;
    s.fatG += l.nutrition.fatG || 0;
    if (l.avoidedRefinedCarb === false) s.refinedExposureCount += 1;
  }
  s.netCarbsG = Math.max(0, Math.round(s.carbsG - s.fiberG));
  return s;
}
