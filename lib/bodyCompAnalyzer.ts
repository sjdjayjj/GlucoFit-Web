// ================= v3.0 水合解耦降噪算法 =================
// 基于体脂秤【体水分量】【脂肪量】【体重】三项数据，
// 将账面体重波动剥离为"水分波动"与"真实脂肪变化"，消除体重焦虑。

import type { BodyCompositionRecord } from "@/types";
import type { BodyCompAnalysis } from "@/types/v3";

/** 判定阈值 (kg) */
const WATER_SHIFT_EPSILON = 0.2; // 水分显著波动
const FAT_SHIFT_EPSILON = 0.05; // 脂肪显著变化
const WEIGHT_SHIFT_EPSILON = 0.15; // 账面体重显著变化

const sign = (n: number): string => (n > 0 ? `+${n.toFixed(1)}` : n.toFixed(1));

/**
 * 对比最近两次体成分记录，输出水合解耦诊断。
 * 任一记录缺失或不足两次时返回 null。
 */
export function analyzeHydration(
  records: BodyCompositionRecord[]
): BodyCompAnalysis | null {
  if (records.length < 2) return null;
  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));
  const prev = sorted[sorted.length - 2];
  const curr = sorted[sorted.length - 1];

  const rawWeightDelta = curr.weightKg - prev.weightKg;
  const trueFatDelta = curr.fatMassKg - prev.fatMassKg;

  const hasWater =
    curr.waterWeightKg != null && prev.waterWeightKg != null;
  const waterWeightDelta = hasWater
    ? (curr.waterWeightKg as number) - (prev.waterWeightKg as number)
    : null;

  // 无水分数据时退化为纯脂肪判定
  if (waterWeightDelta == null) {
    if (trueFatDelta <= -FAT_SHIFT_EPSILON) {
      return {
        rawWeightDelta,
        waterWeightDelta: null,
        trueFatDelta,
        verdict: "fat_loss",
        explanation: `账面体重 ${sign(rawWeightDelta)} kg，脂肪量 ${sign(trueFatDelta)} kg。趋势向好在减，继续保持热量赤字与蛋白质摄入。`,
      };
    }
    if (trueFatDelta >= FAT_SHIFT_EPSILON) {
      return {
        rawWeightDelta,
        waterWeightDelta: null,
        trueFatDelta,
        verdict: "fat_gain",
        explanation: `账面体重 ${sign(rawWeightDelta)} kg，脂肪量 ${sign(trueFatDelta)} kg。脂肪确实在增加，建议回顾近两日碳水与热量摄入。`,
      };
    }
    return {
      rawWeightDelta,
      waterWeightDelta: null,
      trueFatDelta,
      verdict: Math.abs(rawWeightDelta) < WEIGHT_SHIFT_EPSILON ? "fat_loss" : "fat_gain",
      explanation: `账面体重 ${sign(rawWeightDelta)} kg，脂肪量基本持平（${sign(trueFatDelta)} kg）。波动主要来自肠道内容物与糖原，无需焦虑。`,
    };
  }

  const waterUp = waterWeightDelta >= WATER_SHIFT_EPSILON;
  const waterDown = waterWeightDelta <= -WATER_SHIFT_EPSILON;
  const weightUp = rawWeightDelta >= WEIGHT_SHIFT_EPSILON;
  const weightDown = rawWeightDelta <= -WEIGHT_SHIFT_EPSILON;
  const fatStableOrDown = trueFatDelta < FAT_SHIFT_EPSILON;

  // 涨秤但涨的是水：储水 / 肌糖原充盈
  if (weightUp && waterUp && fatStableOrDown) {
    const isGlycogen = waterWeightDelta > 0.5 || trueFatDelta < -0.1;
    return {
      rawWeightDelta,
      waterWeightDelta,
      trueFatDelta,
      verdict: isGlycogen ? "glycogen_refill" : "water_retention",
      explanation: isGlycogen
        ? `别慌！体重 ${sign(rawWeightDelta)} kg 几乎全是肌糖原充盈与储水（水分 ${sign(waterWeightDelta)} kg），可能源于昨日碳水回馈或重训后肌肉超量恢复——你的真实脂肪其实${trueFatDelta <= 0 ? `微降了 ${Math.abs(trueFatDelta).toFixed(1)} kg` : "基本持平"}。`
        : `别慌！体重 ${sign(rawWeightDelta)} kg 主要是储水（水分 ${sign(waterWeightDelta)} kg），多与盐分摄入或肌肉微损伤水肿有关——真实脂肪${trueFatDelta <= 0 ? `微降了 ${Math.abs(trueFatDelta).toFixed(1)} kg` : "基本持平"}，无需焦虑。`,
    };
  }

  // 掉秤但掉的是水：脱水风险 / 生酮初期糖原排空
  if (weightDown && waterDown && trueFatDelta > -FAT_SHIFT_EPSILON) {
    return {
      rawWeightDelta,
      waterWeightDelta,
      trueFatDelta,
      verdict: "water_retention",
      explanation: `体重 ${sign(rawWeightDelta)} kg 主要是水分流失（水分 ${sign(waterWeightDelta)} kg），并非等量脂肪。请补水并保证电解质，警惕脱水被误读为减脂成功。`,
    };
  }

  // 真实脂肪下降（无论账面如何）
  if (trueFatDelta <= -FAT_SHIFT_EPSILON) {
    return {
      rawWeightDelta,
      waterWeightDelta,
      trueFatDelta,
      verdict: "fat_loss",
      explanation: `账面体重 ${sign(rawWeightDelta)} kg，但水分${waterUp ? "增加" : waterDown ? "减少" : "持平"} ${sign(waterWeightDelta)} kg，真实脂肪下降 ${Math.abs(trueFatDelta).toFixed(1)} kg——滤掉水分噪音后，燃脂仍在发生。`,
    };
  }

  // 真实脂肪上升
  if (trueFatDelta >= FAT_SHIFT_EPSILON) {
    return {
      rawWeightDelta,
      waterWeightDelta,
      trueFatDelta,
      verdict: "fat_gain",
      explanation: `滤除水分波动后，脂肪量上升 ${trueFatDelta.toFixed(1)} kg，这是一次真实的增脂信号。建议回顾近 48h 的精制碳水与总热量。`,
    };
  }

  // 脂肪与水分均不显著
  return {
    rawWeightDelta,
    waterWeightDelta,
    trueFatDelta,
    verdict: Math.abs(rawWeightDelta) < WEIGHT_SHIFT_EPSILON ? "fat_loss" : "water_retention",
    explanation: `体重 ${sign(rawWeightDelta)} kg，但水分与脂肪变化均在噪音区间内（脂肪 ${sign(trueFatDelta)} kg）。属于正常日间波动，坚持趋势而非单日数字。`,
  };
}

/** verdict → 展示样式 */
export const VERDICT_STYLE: Record<
  BodyCompAnalysis["verdict"],
  { label: string; icon: string; className: string }
> = {
  fat_loss: {
    label: "真实燃脂中",
    icon: "🔥",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  water_retention: {
    label: "水分波动",
    icon: "💧",
    className: "border-sky-200 bg-sky-50 text-sky-700",
  },
  glycogen_refill: {
    label: "糖原充盈",
    icon: "🔋",
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
  fat_gain: {
    label: "真实增脂",
    icon: "📈",
    className: "border-red-200 bg-red-50 text-red-600",
  },
};
