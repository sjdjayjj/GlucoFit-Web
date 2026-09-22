import type {
  BodyCompositionRecord,
  EnergyReaction,
  MealLog,
} from "@/types";
import { daysAgoDateStr, fmtDate } from "@/lib/utils";
import type { WeeklyStats } from "@/lib/ai-client";

// ---------- 单餐稳糖评分 (4.1) ----------

/** 评分权重：顺序 30 + 控碳 30 + 餐后活动 20 + 神经状态 20 = 100 */
export const MEAL_SCORE_WEIGHTS = {
  sequence: 30,
  carbQuality: 30,
  activity: 20,
  energy: 20,
} as const;

export interface MealScoreInput {
  followedSequence: boolean;
  avoidedRefinedCarb: boolean;
  postMealActivity: boolean;
  energyReaction: EnergyReaction;
}

/** 计算单餐稳糖得分 (0-100) */
export function computeMealScore(input: MealScoreInput): number {
  let score = 0;
  if (input.followedSequence) score += MEAL_SCORE_WEIGHTS.sequence;
  if (input.avoidedRefinedCarb) score += MEAL_SCORE_WEIGHTS.carbQuality;
  if (input.postMealActivity) score += MEAL_SCORE_WEIGHTS.activity;
  // 精力正常或充沛计 20 分；重度嗜睡 (Food Coma) 计 0 分
  if (input.energyReaction !== "food_coma") score += MEAL_SCORE_WEIGHTS.energy;
  return score;
}

export type ScoreTone = "good" | "warn" | "bad";

/** 得分分级：绿色 ≥80，黄色 60-79，红色 <60 */
export function getScoreTone(score: number): ScoreTone {
  if (score >= 80) return "good";
  if (score >= 60) return "warn";
  return "bad";
}

export const SCORE_TONE_CLASS: Record<ScoreTone, string> = {
  good: "bg-emerald-100 text-emerald-700 border-emerald-200",
  warn: "bg-amber-100 text-amber-700 border-amber-200",
  bad: "bg-red-100 text-red-700 border-red-200",
};

// ---------- 体成分对比与预警 (4.2) ----------

/** 体脂秤日间波动容差 (kg)，小于该值视为维持 */
const MAINTAIN_EPSILON = 0.05;

export type InsightTone = "good" | "warn" | "info";

export interface CompositionInsight {
  id: string;
  tone: InsightTone;
  title: string;
  description: string;
}

function isDown(curr?: number, prev?: number): boolean {
  if (curr == null || prev == null) return false;
  return curr < prev - MAINTAIN_EPSILON;
}

function isMaintainedOrUp(curr?: number, prev?: number): boolean {
  if (curr == null || prev == null) return true; // 数据缺失时不误判
  return curr >= prev - MAINTAIN_EPSILON;
}

/**
 * 体成分健康变化预警：
 * - 优质减脂：体重↓、脂肪量↓、蛋白质量维持
 * - 脱水/代谢受损风险：体重↓ 但蛋白质量↓ 或体水分量↓
 */
export function analyzeComposition(
  prev?: BodyCompositionRecord,
  curr?: BodyCompositionRecord
): CompositionInsight[] {
  if (!prev || !curr) return [];

  const weightDown = curr.weightKg < prev.weightKg - MAINTAIN_EPSILON;
  const fatDown = isDown(curr.fatMassKg, prev.fatMassKg);
  const proteinDown = isDown(curr.proteinWeightKg, prev.proteinWeightKg);
  const proteinMaintained = isMaintainedOrUp(
    curr.proteinWeightKg,
    prev.proteinWeightKg
  );
  const waterDown = isDown(curr.waterWeightKg, prev.waterWeightKg);

  const insights: CompositionInsight[] = [];

  if (weightDown && fatDown && proteinMaintained && !waterDown) {
    insights.push({
      id: "quality-fat-loss",
      tone: "good",
      title: "优质减脂",
      description: "体重与脂肪量同步下降，蛋白质/瘦体重维持稳定，代谢导向良好。",
    });
    return insights;
  }

  if (weightDown && (proteinDown || waterDown)) {
    insights.push({
      id: "dehydration-risk",
      tone: "warn",
      title: "脱水 / 代谢受损风险",
      description: "体重下降但伴随蛋白质量或体水分量流失，警惕过度节食损失瘦体重，请保证蛋白质摄入。",
    });
  }

  return insights;
}

/**
 * 胰岛素敏感性向好判定：
 * 连续 3 天无餐后嗜睡反应，且单餐稳糖得分均值 ≥ 80
 */
export function analyzeInsulinSensitivity(
  logs: MealLog[]
): CompositionInsight | null {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 2);
  cutoff.setHours(0, 0, 0, 0);

  const recent = logs.filter((l) => new Date(l.timestamp) >= cutoff);
  if (recent.length === 0) return null;

  const foodComaCount = recent.filter(
    (l) => l.energyReaction === "food_coma"
  ).length;
  const avgScore =
    recent.reduce((sum, l) => sum + l.score, 0) / recent.length;

  if (foodComaCount === 0 && avgScore >= 80) {
    return {
      id: "insulin-sensitivity-good",
      tone: "good",
      title: "胰岛素敏感性向好",
      description: `近 3 天无餐后嗜睡，稳糖得分均值 ${avgScore.toFixed(0)} 分，血糖曲线趋于平稳。`,
    };
  }

  return {
    id: "insulin-sensitivity-fluctuating",
    tone: "info",
    title: "餐后神经反应仍有波动",
    description: `近 3 天出现 ${foodComaCount} 次嗜睡反应，稳糖得分均值 ${avgScore.toFixed(0)} 分。坚持进食顺序与餐后肌肉泵可改善。`,
  };
}

// ---------- 周度代谢诊断统计 ----------

const ffmOf = (r: BodyCompositionRecord): number =>
  r.weightKg * (1 - r.bodyFatRate / 100);

/**
 * 聚合近 7 天体成分变化（是否掉肌）、肌肉/脂肪比、稳糖均分、嗜睡频次，
 * 供 AI 周度诊断与平台期判断使用。
 */
export function buildWeeklyStats(
  records: BodyCompositionRecord[],
  logs: MealLog[]
): WeeklyStats | null {
  const cutoff = daysAgoDateStr(6);
  const recentRecords = records
    .filter((r) => r.date >= cutoff)
    .sort((a, b) => a.date.localeCompare(b.date));
  const recentLogs = logs.filter(
    (l) => fmtDate(new Date(l.timestamp)) >= cutoff
  );

  if (recentRecords.length === 0 && recentLogs.length === 0) return null;

  const first = recentRecords[0];
  const last = recentRecords[recentRecords.length - 1];
  const logCount = recentLogs.length;
  const avgScore = logCount
    ? recentLogs.reduce((s, l) => s + l.score, 0) / logCount
    : 0;

  return {
    weightStart: first?.weightKg ?? 0,
    weightEnd: last?.weightKg ?? 0,
    weightDelta: first && last ? last.weightKg - first.weightKg : 0,
    fatStart: first?.fatMassKg ?? 0,
    fatEnd: last?.fatMassKg ?? 0,
    fatDelta: first && last ? last.fatMassKg - first.fatMassKg : 0,
    proteinStart: first?.proteinWeightKg ?? null,
    proteinEnd: last?.proteinWeightKg ?? null,
    proteinDelta:
      first?.proteinWeightKg != null && last?.proteinWeightKg != null
        ? last.proteinWeightKg - first.proteinWeightKg
        : null,
    ffmStart: first ? ffmOf(first) : 0,
    ffmEnd: last ? ffmOf(last) : 0,
    ffmDelta: first && last ? ffmOf(last) - ffmOf(first) : 0,
    muscleFatRatioStart: first ? ffmOf(first) / first.fatMassKg : 0,
    muscleFatRatioEnd: last ? ffmOf(last) / last.fatMassKg : 0,
    avgScore: Math.round(avgScore),
    logCount,
    foodComaCount: recentLogs.filter((l) => l.energyReaction === "food_coma")
      .length,
    sequenceRate: logCount
      ? recentLogs.filter((l) => l.followedSequence).length / logCount
      : 0,
    activityRate: logCount
      ? recentLogs.filter((l) => l.postMealActivity).length / logCount
      : 0,
  };
}
