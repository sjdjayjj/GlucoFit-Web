import type { Gender, TargetStrategy } from "@/types";

/**
 * 初始档案智能三档目标推荐 (v2.2)
 * 基准：BMI 正常区间 18.5-23.9，理想中值 BMI = 21.5；
 * 体脂率健康基准：男 15% / 女 22%，年龄 > 35 岁时男 +1% / 女 +1.5%。
 */

export interface TargetOption {
  type: TargetStrategy;
  label: string;
  targetWeightKg: number;
  targetFatRate: number;
  description: string;
}

export function calculateTargetOptions(
  gender: Gender,
  birthYear: number,
  heightCm: number,
  currentWeightKg: number
): TargetOption[] {
  const currentYear = new Date().getFullYear();
  const age = currentYear - birthYear;
  const heightM = heightCm / 100;

  // 理想中位健康体重 (BMI = 21.5)
  const baseIdealWeight = 21.5 * heightM * heightM;

  // 体脂率基准（随年龄上浮）
  const ageAdjustment = age > 35 ? (gender === "male" ? 1 : 1.5) : 0;
  const baseFatRate = gender === "male" ? 15 + ageAdjustment : 22 + ageAdjustment;

  // 已达/低于理想体重时，减重目标不低于当前体重（避免"越减越重"的推荐）
  const clampWeight = (w: number) =>
    Number(Math.min(w, currentWeightKg).toFixed(1));

  return [
    {
      type: "conservative",
      label: "保守稳健型",
      targetWeightKg: clampWeight(
        currentWeightKg - (currentWeightKg - baseIdealWeight) * 0.35
      ),
      targetFatRate: Number((baseFatRate + 4).toFixed(1)),
      description: "轻度减重，侧重改善胰岛素抵抗与防止反弹，易于长期维持",
    },
    {
      type: "moderate",
      label: "中性推荐型",
      targetWeightKg: clampWeight(baseIdealWeight),
      targetFatRate: Number(baseFatRate.toFixed(1)),
      description: "回归标准黄金 BMI (21.5)，内脏脂肪显著减少，代谢全面修复",
    },
    {
      type: "aggressive",
      label: "激进塑形型",
      targetWeightKg: clampWeight(baseIdealWeight * 0.94),
      targetFatRate: Number((baseFatRate - 3.5).toFixed(1)),
      description: "高代谢灵活性与紧致肌肉线条，需配合规律力量训练",
    },
  ];
}
