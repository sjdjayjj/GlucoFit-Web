"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { BodyCompositionRecord, ExerciseCategory, UserProfile } from "@/types";

/**
 * 用户初始体态档案与代谢基准 (v2.1)
 * - 首访 Onboarding 建档，未建档时相关计算自动降级
 * - BMR 优先 Katch-McArdle（去脂体重，需体脂秤数据），缺失时回退 Mifflin-St Jeor
 */

interface ProfileState {
  profile: UserProfile | null;
  /** 用户跳过 Onboarding（不再自动弹出，可在设置中重新打开） */
  onboardingDismissed: boolean;
  saveProfile: (profile: UserProfile) => void;
  dismissOnboarding: () => void;
  reopenOnboarding: () => void;
}

export const useProfileStore = create<ProfileState>()(
  persist(
    (set) => ({
      profile: null,
      onboardingDismissed: false,
      saveProfile: (profile) => set({ profile }),
      dismissOnboarding: () => set({ onboardingDismissed: true }),
      reopenOnboarding: () => set({ onboardingDismissed: false }),
    }),
    { name: "glucofit-profile" }
  )
);

// ---------- 代谢基准计算 ----------

export const ACTIVITY_LEVEL_OPTIONS: Array<{
  value: UserProfile["activityLevel"];
  label: string;
}> = [
  { value: 1.2, label: "久坐" },
  { value: 1.375, label: "轻度活动" },
  { value: 1.55, label: "中度活动" },
  { value: 1.725, label: "重度活动" },
];

/** Mifflin-St Jeor 公式（档案有身高/性别/年龄时的 BMR 回退方案） */
export function calcBmrMifflin(profile: UserProfile, weightKg: number): number {
  const age = new Date().getFullYear() - profile.birthYear;
  const base = 10 * weightKg + 6.25 * profile.heightCm - 5 * age;
  if (profile.gender === "male") return base + 5;
  if (profile.gender === "female") return base - 161;
  return base - 78;
}

export interface MetabolicBaseline {
  bmr: number;
  tdee: number;
  formula: "katch_mcardle" | "mifflin_st_jeor";
  ffmKg?: number;
}

/**
 * 基线 BMR/TDEE：
 * 有体成分数据时用 Katch-McArdle（BMR = 370 + 21.6 × FFM），
 * 否则回退 Mifflin-St Jeor（依赖档案身高/性别/出生年份）。
 */
export function calcBaseline(
  profile: UserProfile | null,
  latest: BodyCompositionRecord | undefined,
  activityLevel?: number
): MetabolicBaseline | null {
  const factor = activityLevel ?? profile?.activityLevel;
  if (!factor) return null;
  if (latest) {
    const ffmKg = latest.weightKg * (1 - latest.bodyFatRate / 100);
    const bmr = 370 + 21.6 * ffmKg;
    return { bmr, tdee: bmr * factor, formula: "katch_mcardle", ffmKg };
  }
  if (profile) {
    const bmr = calcBmrMifflin(profile, profile.initialWeightKg);
    return { bmr, tdee: bmr * factor, formula: "mifflin_st_jeor" };
  }
  return null;
}

// ---------- 减重里程碑 ----------

export interface Milestone {
  initialWeightKg: number;
  currentWeightKg: number;
  targetWeightKg: number;
  lostKg: number; // 已减重量（负值为反弹）
  remainingKg: number; // 距目标剩余
  totalKg: number; // 全程目标量
  progressPct: number; // 0-100
  achieved: boolean;
}

export function calcMilestone(
  profile: UserProfile,
  currentWeightKg: number
): Milestone {
  const totalKg = profile.initialWeightKg - profile.targetWeightKg;
  const lostKg = profile.initialWeightKg - currentWeightKg;
  const remainingKg = Math.max(0, currentWeightKg - profile.targetWeightKg);
  const achieved = currentWeightKg <= profile.targetWeightKg;
  const progressPct =
    totalKg <= 0 ? 100 : Math.min(100, Math.max(0, (lostKg / totalKg) * 100));
  return {
    initialWeightKg: profile.initialWeightKg,
    currentWeightKg,
    targetWeightKg: profile.targetWeightKg,
    lostKg,
    remainingKg,
    totalKg,
    progressPct,
    achieved,
  };
}

// ---------- 运动 MET 估算 ----------

/** 各运动类别 MET 指数（Compendium of Physical Activities 取中位近似值） */
export const EXERCISE_METS: Record<ExerciseCategory, number> = {
  post_meal_walk: 3.0, // 散步/提踵/慢速骑行
  resistance: 5.0, // 一般力量训练
  cardio: 8.0, // 中高强度有氧（跑步/游泳/跳绳）
  other: 4.0,
};

/** METs 估算法：kcal ≈ MET × 体重(kg) × 时长(h) × 1.05 */
export function estimateExerciseCalories(
  category: ExerciseCategory,
  weightKg: number,
  durationMinutes: number
): number {
  const hours = durationMinutes / 60;
  return Math.round(EXERCISE_METS[category] * weightKg * hours * 1.05);
}
