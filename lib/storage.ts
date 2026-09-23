import { create } from "zustand";
import {
  createJSONStorage,
  persist,
  type StateStorage,
} from "zustand/middleware";
import type {
  AISettings,
  BodyCompositionRecord,
  MealLog,
  UserGoalConfig,
  ExerciseLog,
  UserProfile,
} from "@/types";
import { computeMealScore } from "@/lib/scoring";
import { daysAgoDateStr, uid } from "@/lib/utils";

const STORAGE_KEY = "glucofit-web-storage";

// ---------- Mock 数据（基于体脂秤截图 + 最近 7 天趋势，日期相对当天生成） ----------

function mockBodyRecords(): BodyCompositionRecord[] {
  // 以截图数据 (79.1kg / BMI 26.7 / 体脂 24.2% / 得分 81 / 水 43.4 / 脂肪 19.1 / 骨盐 3.2 / 蛋白 12.7) 为最新一天
  const rows: Array<
    Pick<BodyCompositionRecord, "weightKg" | "bmi" | "bodyFatRate" | "bodyScore" | "waterWeightKg" | "fatMassKg" | "boneMassKg" | "proteinWeightKg">
  > = [
    { weightKg: 79.8, bmi: 26.9, bodyFatRate: 24.8, bodyScore: 79, waterWeightKg: 43.0, fatMassKg: 19.8, boneMassKg: 3.15, proteinWeightKg: 12.5 },
    { weightKg: 79.7, bmi: 26.9, bodyFatRate: 24.7, bodyScore: 80, waterWeightKg: 43.1, fatMassKg: 19.7, boneMassKg: 3.15, proteinWeightKg: 12.5 },
    { weightKg: 79.6, bmi: 26.8, bodyFatRate: 24.6, bodyScore: 80, waterWeightKg: 43.1, fatMassKg: 19.6, boneMassKg: 3.2, proteinWeightKg: 12.6 },
    { weightKg: 79.5, bmi: 26.8, bodyFatRate: 24.5, bodyScore: 82, waterWeightKg: 43.2, fatMassKg: 19.5, boneMassKg: 3.2, proteinWeightKg: 12.6 },
    { weightKg: 79.4, bmi: 26.7, bodyFatRate: 24.4, bodyScore: 83, waterWeightKg: 43.3, fatMassKg: 19.4, boneMassKg: 3.2, proteinWeightKg: 12.6 },
    { weightKg: 79.2, bmi: 26.7, bodyFatRate: 24.3, bodyScore: 81, waterWeightKg: 43.3, fatMassKg: 19.2, boneMassKg: 3.2, proteinWeightKg: 12.7 },
    { weightKg: 79.1, bmi: 26.7, bodyFatRate: 24.2, bodyScore: 81, waterWeightKg: 43.4, fatMassKg: 19.1, boneMassKg: 3.2, proteinWeightKg: 12.7 },
  ];
  return rows.map((row, i) => ({
    id: uid(),
    date: daysAgoDateStr(rows.length - 1 - i),
    notes: undefined,
    ...row,
  }));
}

function mockMealLogs(): MealLog[] {
  const at = (daysAgo: number, hour: number, minute: number) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    d.setHours(hour, minute, 0, 0);
    return d.toISOString();
  };

  const base = (
    daysAgo: number,
    hour: number,
    minute: number,
    mealType: MealLog["mealType"],
    partial: Partial<MealLog>
  ): MealLog => {
    const input = {
      followedSequence: partial.followedSequence ?? true,
      avoidedRefinedCarb: partial.avoidedRefinedCarb ?? true,
      postMealActivity: partial.postMealActivity ?? true,
      energyReaction: partial.energyReaction ?? ("normal" as const),
    };
    return {
      id: uid(),
      timestamp: at(daysAgo, hour, minute),
      mealType,
      satietyDuration: "2_to_4h",
      foodSummary: "",
      score: computeMealScore(input),
      ...input,
      ...partial,
    };
  };

  return [
    base(0, 8, 10, "breakfast", {
      energyReaction: "energetic",
      satietyDuration: "over_4h",
      foodSummary: "燕麦片 + 水煮蛋 + 蓝莓 + 无糖豆浆",
    }),
    base(0, 12, 30, "lunch", {
      energyReaction: "normal",
      foodSummary: "牛肉菠菜糙米饭",
    }),
    base(1, 12, 0, "lunch", {
      followedSequence: false,
      avoidedRefinedCarb: false,
      postMealActivity: false,
      energyReaction: "food_coma",
      satietyDuration: "under_2h",
      score: 30,
      foodSummary: "外卖咖喱白米饭（精制碳水）",
    }),
    base(1, 18, 30, "dinner", {
      energyReaction: "normal",
      foodSummary: "三文鱼西兰花藜麦沙拉",
    }),
    base(2, 8, 0, "breakfast", {
      energyReaction: "energetic",
      satietyDuration: "over_4h",
      foodSummary: "全麦贝果 + 煎蛋 + 牛油果",
    }),
  ];
}

function mockExerciseLogs(): ExerciseLog[] {
  const at = (daysAgo: number, hour: number, minute: number) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    d.setHours(hour, minute, 0, 0);
    return d.toISOString();
  };
  return [
    {
      id: uid(),
      timestamp: at(0, 13, 10),
      category: "post_meal_walk",
      durationMinutes: 15,
      caloriesBurned: 62,
      isPostMeal: true,
      muscleFeel: ["无疲劳感"],
    },
    {
      id: uid(),
      timestamp: at(1, 19, 30),
      category: "resistance",
      durationMinutes: 30,
      caloriesBurned: 208,
      isPostMeal: false,
      muscleFeel: ["下肢酸胀", "核心紧绷"],
    },
  ];
}

// ---------- Store ----------

interface GlucoFitState {
  bodyRecords: BodyCompositionRecord[];
  mealLogs: MealLog[];
  exerciseLogs: ExerciseLog[];
  goal: UserGoalConfig;
  /** 进食窗口开始小时（如 16:8 模式下默认 10:00 开始，18:00 结束） */
  eatingWindowStartHour: number;
  /** TDEE 活动系数 */
  activityFactor: number;
  addBodyRecord: (record: BodyCompositionRecord) => void;
  addMealLog: (log: MealLog) => void;
  addExerciseLog: (log: ExerciseLog) => void;
  deleteExerciseLog: (id: string) => void;
  updateGoal: (partial: Partial<UserGoalConfig>) => void;
  setEatingWindowStartHour: (hour: number) => void;
  setActivityFactor: (factor: number) => void;
  /** 云同步合并：按 id 去重、时间新者胜，返回合并数量 */
  mergeCloudData: (cloud: {
    bodyRecords?: BodyCompositionRecord[];
    mealLogs?: MealLog[];
    exerciseLogs?: ExerciseLog[];
  }) => void;
}

export const useGlucoFitStore = create<GlucoFitState>()(
  persist(
    (set) => ({
      bodyRecords: mockBodyRecords(),
      mealLogs: mockMealLogs(),
      exerciseLogs: mockExerciseLogs(),
      goal: { targetWeightKg: 70, targetBodyFatRate: 18, fastingProtocol: "16:8" },
      eatingWindowStartHour: 10,
      activityFactor: 1.375,
      addBodyRecord: (record) =>
        set((s) => ({
          bodyRecords: [...s.bodyRecords, record].sort((a, b) =>
            a.date.localeCompare(b.date)
          ),
        })),
      addMealLog: (log) =>
        set((s) => ({
          mealLogs: [...s.mealLogs, log].sort((a, b) =>
            a.timestamp.localeCompare(b.timestamp)
          ),
        })),
      addExerciseLog: (log) =>
        set((s) => ({
          exerciseLogs: [...s.exerciseLogs, log].sort((a, b) =>
            a.timestamp.localeCompare(b.timestamp)
          ),
        })),
      deleteExerciseLog: (id) =>
        set((s) => ({ exerciseLogs: s.exerciseLogs.filter((l) => l.id !== id) })),
      updateGoal: (partial) =>
        set((s) => ({ goal: { ...s.goal, ...partial } })),
      setEatingWindowStartHour: (hour) =>
        set({ eatingWindowStartHour: hour }),
      setActivityFactor: (factor) => set({ activityFactor: factor }),
      mergeCloudData: ({ bodyRecords, mealLogs, exerciseLogs }) =>
        set((s) => {
          const next: Partial<GlucoFitState> = {};
          if (bodyRecords?.length) {
            const byId = new Map(s.bodyRecords.map((r) => [r.id, r]));
            for (const r of bodyRecords) {
              const local = byId.get(r.id);
              if (!local || r.date >= local.date) byId.set(r.id, r);
            }
            next.bodyRecords = Array.from(byId.values()).sort((a, b) =>
              a.date.localeCompare(b.date)
            );
          }
          if (mealLogs?.length) {
            const byId = new Map(s.mealLogs.map((r) => [r.id, r]));
            for (const r of mealLogs) {
              const local = byId.get(r.id);
              if (!local || r.timestamp >= local.timestamp) byId.set(r.id, r);
            }
            next.mealLogs = Array.from(byId.values()).sort((a, b) =>
              a.timestamp.localeCompare(b.timestamp)
            );
          }
          if (exerciseLogs?.length) {
            const byId = new Map(s.exerciseLogs.map((r) => [r.id, r]));
            for (const r of exerciseLogs) {
              const local = byId.get(r.id);
              if (!local || r.timestamp >= local.timestamp) byId.set(r.id, r);
            }
            next.exerciseLogs = Array.from(byId.values()).sort((a, b) =>
              a.timestamp.localeCompare(b.timestamp)
            );
          }
          return next;
        }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
    }
  )
);

// ---------- AI 设置（BYOK，混淆加密后仅存于本浏览器） ----------

const OBFUSCATE_KEY = "GlucoFit::Byok::v1";

function obfuscate(text: string): string {
  const bytes = new TextEncoder().encode(text);
  const key = new TextEncoder().encode(OBFUSCATE_KEY);
  const out = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    out[i] = bytes[i] ^ key[i % key.length];
  }
  let bin = "";
  for (let i = 0; i < out.length; i++) bin += String.fromCharCode(out[i]);
  return btoa(bin);
}

function deobfuscate(text: string): string {
  const bin = atob(text);
  const key = new TextEncoder().encode(OBFUSCATE_KEY);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i) ^ key[i % key.length];
  }
  return new TextDecoder().decode(bytes);
}

/** XOR + Base64 混淆存储，避免 API Key 明文暴露在 localStorage */
const obfuscatedStorage: StateStorage = {
  getItem: (name) => {
    if (typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(name);
    if (!raw) return null;
    try {
      return deobfuscate(raw);
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(name, obfuscate(value));
  },
  removeItem: (name) => {
    if (typeof localStorage === "undefined") return;
    localStorage.removeItem(name);
  },
};

interface AISettingsState {
  aiSettings: AISettings;
  updateAISettings: (settings: AISettings) => void;
}

export const useAISettingsStore = create<AISettingsState>()(
  persist(
    (set) => ({
      aiSettings: { baseUrl: "", apiKey: "", model: "", visionModel: "" },
      updateAISettings: (aiSettings) => set({ aiSettings }),
    }),
    {
      name: "glucofit-ai-settings",
      storage: createJSONStorage(() => obfuscatedStorage),
    }
  )
);

/** 按日期升序的体成分记录 */
export function useSortedBodyRecords(): BodyCompositionRecord[] {
  return useGlucoFitStore((s) =>
    [...s.bodyRecords].sort((a, b) => a.date.localeCompare(b.date))
  );
}
