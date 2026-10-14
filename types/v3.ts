// ================= GlucoFit v3.0 · Metabolic Autopilot 代谢自动驾驶 =================
// 从"被动记账"到"预测未来、实时干预"：数字孪生曲线、水合解耦、周期双模

// --- V1. 虚拟胰岛素/血糖曲线预测节点 ---
export type GlucoseLevel = "baseline" | "moderate" | "spike" | "crash";

export interface VirtualCurvePoint {
  time: string; // HH:mm (如 "12:30")
  glucoseLevel: GlucoseLevel;
  insulinLoad: number; // 0 - 100 模拟胰岛素水位
  isProjected: boolean; // true 为未来预测值，false 为已发生历史值
}

// --- V2. 水合解耦分析结果 ---
export type BodyCompVerdict = "fat_loss" | "water_retention" | "glycogen_refill" | "fat_gain";

export interface BodyCompAnalysis {
  rawWeightDelta: number; // 账面体重变化 (如 +0.5kg)
  waterWeightDelta: number | null; // 水分波动贡献 (如 +0.6kg，缺数据时为 null)
  trueFatDelta: number; // 估算真实脂肪变化 (如 -0.1kg)
  verdict: BodyCompVerdict;
  explanation: string; // AI/算法生成的解读文案
}

// --- V3. 周期模式配置（工作日严格 / 周末弹性）---
export type WeekdayProtocol = "16:8" | "18:6";
export type WeekendProtocol = "14:10" | "12:12" | "flexible";

export interface WeeklyScheduleConfig {
  enabled: boolean;
  weekdayProtocol: WeekdayProtocol; // 工作日（周一至五）严格自动驾驶
  weekendProtocol: WeekendProtocol; // 周末/社交日防御与平衡模式
  carbFistLimitPerMeal: number; // 每餐主食上限（拳头数，默认 1）
}

// --- V4. 有效断食协议（含 18:6 与弹性窗口）---
export type EffectiveProtocol = "18:6" | "16:8" | "14:10" | "12:12" | "flexible";

// --- V5. 吃前排雷分析结果 ---
export interface PreMealPlanResult {
  safeFoods: string[]; // 稳糖安全区：优质蛋白、十字花科蔬菜
  hiddenThreats: string[]; // 隐藏刺客：勾芡、糖醋、隐形糖酱汁
  insulinBombs: string[]; // 胰岛素炸弹：精制碳水、含糖饮料
  script: string[]; // 10 秒进食战术剧本（2-3 步）
  stapleFist: number; // 主食建议拳头数 (0.5 - 1.5)
  stapleGrams: number; // 主食建议克重
}
