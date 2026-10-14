// ================= v3.0 代谢数字孪生引擎 =================
// 基于生理学药代动力学的简化模型：以当日 MealLog 为输入，
// 推演全天 24h 血糖（mg/dL）与胰岛素水位（0-100）双波浪潮汐曲线。

import type { MealLog } from "@/types";
import type {
  EffectiveProtocol,
  GlucoseLevel,
  VirtualCurvePoint,
  WeeklyScheduleConfig,
} from "@/types/v3";

/** 基础空腹血糖基线 (mg/dL) */
export const GLUCOSE_BASELINE = 88;
/** 血糖冲高判定阈值 */
export const SPIKE_THRESHOLD = 140;
/** 反应性低血糖（crash）判定阈值 */
export const CRASH_THRESHOLD = 78;

export interface MetabolicSimPoint extends VirtualCurvePoint {
  minutes: number; // 距 00:00 的分钟数
  glucose: number; // mg/dL
}

interface MealResponseParams {
  /** 高斯波峰幅度 (mg/dL，相对基线) */
  amplitude: number;
  /** 峰值时刻 (分钟) */
  peakAt: number;
  /** 高斯宽度 σ (分钟) */
  sigma: number;
  /** 胰岛素波幅度系数（0-1，冲高时胰岛素过量分泌） */
  insulinFactor: number;
  /** 是否触发反应性低血糖深谷 */
  reactiveCrash: boolean;
}

/**
 * 依据单餐行为数据估算血糖响应参数：
 * - 精制碳水：更快更陡的红峰（达峰约 +30min）
 * - 先菜后饭：纤维缓冲，削峰 ~35% 且达峰延后
 * - 餐后运动：GLUT4 非胰岛素依赖摄糖，削峰 ~32%
 */
function mealResponseParams(meal: MealLog): MealResponseParams {
  const t0 = isoToMinutes(meal.timestamp);

  // 碳水负荷：优先用 AI 估算碳水克数，否则按餐次经验值
  const carbsG =
    meal.nutrition?.carbsG && meal.nutrition.carbsG > 0
      ? meal.nutrition.carbsG
      : meal.mealType === "snack"
        ? 25
        : meal.mealType === "breakfast"
          ? 50
          : 65;

  const refined = !meal.avoidedRefinedCarb;
  let amplitude = carbsG * (refined ? 0.85 : 0.5);
  if (meal.followedSequence) amplitude *= 0.65;
  if (meal.postMealActivity) amplitude *= 0.68;
  amplitude = Math.min(80, Math.max(8, amplitude));

  const peakDelay = (refined ? 30 : 55) + (meal.followedSequence ? 20 : 0);
  const sigma = refined ? 26 : 40;

  return {
    amplitude,
    peakAt: t0 + peakDelay,
    sigma,
    insulinFactor: refined ? 0.9 : 0.58,
    reactiveCrash: amplitude > 40 && !meal.postMealActivity,
  };
}

/** 高斯脉冲 */
function bump(minutes: number, center: number, amplitude: number, sigma: number): number {
  const d = minutes - center;
  return amplitude * Math.exp(-(d * d) / (2 * sigma * sigma));
}

function isoToMinutes(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

function fmtMinutes(minutes: number): string {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

function classify(glucose: number): GlucoseLevel {
  if (glucose < CRASH_THRESHOLD) return "crash";
  if (glucose > SPIKE_THRESHOLD) return "spike";
  if (glucose > GLUCOSE_BASELINE + 22) return "moderate";
  return "baseline";
}

/**
 * 推演全天双波浪潮汐曲线（15 分钟分辨率，49 个节点）。
 * @param mealLogs 当日（或近 24h）餐食记录
 * @param nowMinutes 当前时刻（分钟），此后节点标记为预测
 */
export function simulateMetabolicCurve(
  mealLogs: MealLog[],
  nowMinutes: number
): MetabolicSimPoint[] {
  const responses = mealLogs.map(mealResponseParams);

  const points: MetabolicSimPoint[] = [];
  for (let minutes = 0; minutes <= 1440; minutes += 15) {
    let glucose = GLUCOSE_BASELINE;
    let insulin = 0;

    for (const p of responses) {
      // 血糖波：单一高斯峰
      glucose += bump(minutes, p.peakAt, p.amplitude, p.sigma);
      // 反应性低血糖深谷：大幅冲高后胰岛素过量回落（约峰后 100min）
      if (p.reactiveCrash) {
        glucose -= bump(minutes, p.peakAt + 100, p.amplitude * 0.34, 32);
      }
      // 胰岛素潮：滞后 18min、宽度 1.4x；冲高时过量分泌
      insulin += bump(minutes, p.peakAt - 18 + p.sigma * 0.4, p.amplitude * p.insulinFactor * 1.5, p.sigma * 1.4);
    }

    const insulinLoad = Math.round(Math.min(100, insulin));
    points.push({
      minutes,
      time: fmtMinutes(minutes),
      glucose: Math.round(glucose * 10) / 10,
      insulinLoad,
      glucoseLevel: classify(glucose),
      isProjected: minutes > nowMinutes,
    });
  }
  return points;
}

/** 从曲线中找出已发生 / 正在发生的最高冲高餐（供削峰急救按钮定位） */
export function findActiveSpikeMeal(
  mealLogs: MealLog[],
  nowMinutes: number
): MealLog | null {
  let target: MealLog | null = null;
  let targetPeak = 0;
  for (const meal of mealLogs) {
    const t0 = isoToMinutes(meal.timestamp);
    const age = nowMinutes - t0;
    if (age < -15 || age > 210) continue; // 只针对近 3.5h 内的餐
    if (meal.postMealActivity) continue; // 已完成削峰
    const params = mealResponseParams(meal);
    // 当前处于冲高窗口（峰值前后 1.5σ）且幅度足够
    if (params.amplitude < 30) continue;
    const distance = Math.abs(nowMinutes - params.peakAt);
    if (distance > params.sigma * 2.2) continue;
    if (params.amplitude > targetPeak) {
      targetPeak = params.amplitude;
      target = meal;
    }
  }
  return target;
}

export interface ProjectedCrash {
  time: string; // 首个预计深谷时刻
  minutesUntil: number;
}

/** 在未来 3h 预测窗口内寻找反应性低血糖深谷 */
export function findProjectedCrash(
  curve: MetabolicSimPoint[],
  nowMinutes: number
): ProjectedCrash | null {
  const horizon = nowMinutes + 180;
  for (const p of curve) {
    if (!p.isProjected || p.minutes > horizon) continue;
    if (p.glucoseLevel === "crash" || (p.glucoseLevel === "baseline" && p.glucose < GLUCOSE_BASELINE - 6 && p.minutes > nowMinutes + 30)) {
      if (p.glucose < GLUCOSE_BASELINE - 6) {
        return { time: p.time, minutesUntil: p.minutes - nowMinutes };
      }
    }
  }
  return null;
}

// ---------- 工作日/周末双模引擎 ----------

/** 协议 → 进食窗口时长（小时） */
export const PROTOCOL_WINDOW_HOURS: Record<EffectiveProtocol, number> = {
  "18:6": 6,
  "16:8": 8,
  "14:10": 10,
  "12:12": 12,
  flexible: 12,
};

export const PROTOCOL_LABEL: Record<EffectiveProtocol, string> = {
  "18:6": "18:6 严苛",
  "16:8": "16:8 标准",
  "14:10": "14:10 温和",
  "12:12": "12:12 宽松",
  flexible: "弹性窗口",
};

/**
 * 计算某天的有效断食协议：
 * - 双模关闭：使用用户手动选择的协议
 * - 双模开启：周六/周日自动切换为周末防御与平衡协议，工作日走严格协议
 */
export function effectiveFastingProtocol(
  schedule: WeeklyScheduleConfig | null,
  date: Date,
  fallback: EffectiveProtocol = "16:8"
): { protocol: EffectiveProtocol; isWeekendMode: boolean } {
  if (!schedule?.enabled) {
    return { protocol: fallback, isWeekendMode: false };
  }
  const day = date.getDay();
  const isWeekend = day === 0 || day === 6;
  return {
    protocol: isWeekend ? schedule.weekendProtocol : schedule.weekdayProtocol,
    isWeekendMode: isWeekend,
  };
}
