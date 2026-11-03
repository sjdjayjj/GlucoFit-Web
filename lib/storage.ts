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
import type { WeeklyScheduleConfig } from "@/types/v3";
import { computeMealScore } from "@/lib/scoring";
import { daysAgoDateStr, uid } from "@/lib/utils";
import { backfillUpdatedAt, mergeRecordList } from "@/lib/merge";
import {
  safeGetRaw,
  safeRemoveRaw,
  safeSetRaw,
  scopedKey,
  scopedStorage,
} from "@/lib/persist-scope";

const STORAGE_KEY = "glucofit-web-storage";

export type DirtyKind = "body" | "meal" | "exercise";

/** 新作用域（新账号/游客）的初始数据：空记录，不带演示种子 */
const EMPTY_DATA_STATE = {
  bodyRecords: [] as BodyCompositionRecord[],
  mealLogs: [] as MealLog[],
  exerciseLogs: [] as ExerciseLog[],
  goal: { targetWeightKg: 70, targetBodyFatRate: 18, fastingProtocol: "16:8" } as UserGoalConfig,
  eatingWindowStartHour: 10,
  activityFactor: 1.375,
  weeklySchedule: null,
  pendingDeletedMealIds: [] as string[],
  pendingDeletedExerciseIds: [] as string[],
  dirtyBodyIds: [] as string[],
  dirtyMealIds: [] as string[],
  dirtyExerciseIds: [] as string[],
};

/** 作用域切换时把内存重置为当前作用域的初始数据（随后由 persist.rehydrate 覆盖） */
export function resetLocalStoreForScopeSwitch(): void {
  useGlucoFitStore.setState(EMPTY_DATA_STATE);
}

export const EMPTY_AI_SETTINGS: AISettings = {
  baseUrl: "",
  apiKey: "",
  model: "",
  visionModel: "",
  deepThinking: false,
};

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
    id: "demo-" + uid(),
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
      id: "demo-" + uid(),
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
      id: "demo-" + uid(),
      timestamp: at(0, 13, 10),
      category: "post_meal_walk",
      durationMinutes: 15,
      caloriesBurned: 62,
      isPostMeal: true,
      muscleFeel: ["无疲劳感"],
    },
    {
      id: "demo-" + uid(),
      timestamp: at(1, 19, 30),
      category: "resistance",
      durationMinutes: 30,
      caloriesBurned: 208,
      isPostMeal: false,
      muscleFeel: ["下肢酸胀", "核心紧绷"],
    },
  ];
}

// ---------- 演示种子数据识别与清理 ----------

/** 演示餐记录文案指纹（旧版本无 demo- 前缀，靠此识别存量脏数据） */
const DEMO_MEAL_SUMMARIES = new Set([
  "燕麦片 + 水煮蛋 + 蓝莓 + 无糖豆浆",
  "牛肉菠菜糙米饭",
  "外卖咖喱白米饭（精制碳水）",
  "三文鱼西兰花藜麦沙拉",
  "全麦贝果 + 煎蛋 + 牛油果",
]);

const isDemoMeal = (m: MealLog) =>
  m.id.startsWith("demo-") ||
  // 文案指纹仅命中无照片、无营养数据的裸记录；真实手输记录经 AI 估算会带 nutrition，不受影响
  (DEMO_MEAL_SUMMARIES.has(m.foodSummary) && !m.imageUrl && !m.nutrition);

/** 剔除全部演示数据；被剔除的餐记录标记进 tombstone 以便同步删除云端 */
function stripDemoState(s: {
  mealLogs: MealLog[];
  bodyRecords: BodyCompositionRecord[];
  exerciseLogs: ExerciseLog[];
  pendingDeletedMealIds?: string[];
}): Partial<GlucoFitState> {
  const demoMeals = s.mealLogs.filter(isDemoMeal);
  const out: Partial<GlucoFitState> = {
    mealLogs: s.mealLogs.filter((m) => !isDemoMeal(m)),
    bodyRecords: s.bodyRecords.filter((r) => !r.id.startsWith("demo-")),
    exerciseLogs: s.exerciseLogs.filter((l) => !l.id.startsWith("demo-")),
  };
  if (demoMeals.length) {
    out.pendingDeletedMealIds = Array.from(
      new Set([
        ...(s.pendingDeletedMealIds ?? []),
        ...demoMeals.map((m) => m.id),
      ])
    );
  }
  return out;
}

// ---------- Store ----------

/** 标记记录为待上行（去重） */
const markDirty = (ids: string[] | undefined, id: string): string[] =>
  (ids ?? []).includes(id) ? ids ?? [] : [...(ids ?? []), id];

/** 新增记录时写入版本号（毫秒）；已有版本（导入/迁移）则保留 */
const withUpdatedAt = <T extends { updatedAt?: number }>(record: T): T => ({
  ...record,
  updatedAt: record.updatedAt ?? Date.now(),
});

interface GlucoFitState {
  bodyRecords: BodyCompositionRecord[];
  mealLogs: MealLog[];
  exerciseLogs: ExerciseLog[];
  goal: UserGoalConfig;
  /** 进食窗口开始小时（如 16:8 模式下默认 10:00 开始，18:00 结束） */
  eatingWindowStartHour: number;
  /** TDEE 活动系数 */
  activityFactor: number;
  /** v3.0 工作日/周末双模引擎（null = 关闭，回退单一协议） */
  weeklySchedule: WeeklyScheduleConfig | null;
  addBodyRecord: (record: BodyCompositionRecord) => void;
  addMealLog: (log: MealLog) => void;
  updateMealLog: (id: string, partial: Partial<MealLog>) => void;
  deleteMealLog: (id: string) => void;
  /** 本机已删除、待云端同步删除的餐记录 id（tombstone，云端删除成功后清空） */
  pendingDeletedMealIds: string[];
  clearPendingDeletedMealIds: () => void;
  addExerciseLog: (log: ExerciseLog) => void;
  deleteExerciseLog: (id: string) => void;
  /** 本机已删除、待云端同步删除的运动记录 id（tombstone，云端删除成功后清空） */
  pendingDeletedExerciseIds: string[];
  clearPendingDeletedExerciseIds: () => void;
  /** 本机新增/修改、待增量上行的记录 id（云端合并采纳后清除） */
  dirtyBodyIds: string[];
  dirtyMealIds: string[];
  dirtyExerciseIds: string[];
  /** 清除已成功上行的增量标记；不传则清空全部 */
  clearDirtyIds: (kinds?: DirtyKind[]) => void;
  updateGoal: (partial: Partial<UserGoalConfig>) => void;
  setEatingWindowStartHour: (hour: number) => void;
  setActivityFactor: (factor: number) => void;
  setWeeklySchedule: (schedule: WeeklyScheduleConfig | null) => void;
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
      weeklySchedule: null,
      pendingDeletedMealIds: [],
      pendingDeletedExerciseIds: [],
      dirtyBodyIds: [],
      dirtyMealIds: [],
      dirtyExerciseIds: [],
      addBodyRecord: (record) =>
        set((s) => {
          const stripped = stripDemoState(s);
          const next = withUpdatedAt(record);
          return {
            ...stripped,
            bodyRecords: [...(stripped.bodyRecords ?? []), next].sort((a, b) =>
              a.date.localeCompare(b.date)
            ),
            dirtyBodyIds: markDirty(s.dirtyBodyIds, record.id),
          };
        }),
      addMealLog: (log) =>
        set((s) => {
          const stripped = stripDemoState(s);
          const next = withUpdatedAt(log);
          return {
            ...stripped,
            mealLogs: [...(stripped.mealLogs ?? []), next].sort((a, b) =>
              a.timestamp.localeCompare(b.timestamp)
            ),
            dirtyMealIds: markDirty(s.dirtyMealIds, log.id),
          };
        }),
      updateMealLog: (id, partial) =>
        set((s) => ({
          mealLogs: s.mealLogs
            .map((l) =>
              l.id === id
                ? { ...l, ...partial, id: l.id, updatedAt: Date.now() }
                : l
            )
            .sort((a, b) => a.timestamp.localeCompare(b.timestamp)),
          dirtyMealIds: markDirty(s.dirtyMealIds, id),
        })),
      deleteMealLog: (id) =>
        set((s) => ({
          mealLogs: s.mealLogs.filter((l) => l.id !== id),
          pendingDeletedMealIds: (s.pendingDeletedMealIds ?? []).includes(id)
            ? s.pendingDeletedMealIds
            : [...(s.pendingDeletedMealIds ?? []), id],
        })),
      clearPendingDeletedMealIds: () => set({ pendingDeletedMealIds: [] }),
      addExerciseLog: (log) =>
        set((s) => {
          const stripped = stripDemoState(s);
          const next = withUpdatedAt(log);
          return {
            ...stripped,
            exerciseLogs: [...(stripped.exerciseLogs ?? []), next].sort((a, b) =>
              a.timestamp.localeCompare(b.timestamp)
            ),
            dirtyExerciseIds: markDirty(s.dirtyExerciseIds, log.id),
          };
        }),
      deleteExerciseLog: (id) =>
        set((s) => ({
          exerciseLogs: s.exerciseLogs.filter((l) => l.id !== id),
          pendingDeletedExerciseIds: (s.pendingDeletedExerciseIds ?? []).includes(id)
            ? s.pendingDeletedExerciseIds
            : [...(s.pendingDeletedExerciseIds ?? []), id],
        })),
      clearPendingDeletedExerciseIds: () => set({ pendingDeletedExerciseIds: [] }),
      clearDirtyIds: (kinds) =>
        set((s) => {
          const all = !kinds || kinds.length === 0;
          return {
            dirtyBodyIds: all || kinds.includes("body") ? [] : s.dirtyBodyIds,
            dirtyMealIds: all || kinds.includes("meal") ? [] : s.dirtyMealIds,
            dirtyExerciseIds:
              all || kinds.includes("exercise") ? [] : s.dirtyExerciseIds,
          };
        }),
      updateGoal: (partial) =>
        set((s) => ({ goal: { ...s.goal, ...partial } })),
      setEatingWindowStartHour: (hour) =>
        set({ eatingWindowStartHour: hour }),
      setActivityFactor: (factor) => set({ activityFactor: factor }),
      setWeeklySchedule: (weeklySchedule) => set({ weeklySchedule }),
      mergeCloudData: ({ bodyRecords, mealLogs, exerciseLogs }) =>
        set((s) => {
          const next: Partial<GlucoFitState> = {};
          // 严格按 updatedAt 比较；本地 dirty / tombstone 记录绝不覆盖；相等时本地优先
          if (bodyRecords?.length) {
            next.bodyRecords = mergeRecordList(s.bodyRecords, bodyRecords, {
              dirtyIds: s.dirtyBodyIds,
            }).sort((a, b) => a.date.localeCompare(b.date));
          }
          if (mealLogs?.length) {
            next.mealLogs = mergeRecordList(s.mealLogs, mealLogs, {
              dirtyIds: s.dirtyMealIds,
              tombstoneIds: s.pendingDeletedMealIds,
            }).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
          }
          if (exerciseLogs?.length) {
            next.exerciseLogs = mergeRecordList(
              s.exerciseLogs,
              exerciseLogs,
              {
                dirtyIds: s.dirtyExerciseIds,
                tombstoneIds: s.pendingDeletedExerciseIds,
              }
            ).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
          }
          // 云端数据到达即剔除演示种子，避免与真实记录混合；餐记录进 tombstone 以清理云端
          return {
            ...next,
            ...stripDemoState({
              ...s,
              mealLogs: next.mealLogs ?? s.mealLogs,
              bodyRecords: next.bodyRecords ?? s.bodyRecords,
              exerciseLogs: next.exerciseLogs ?? s.exerciseLogs,
            }),
          };
        }),
    }),
    {
      name: STORAGE_KEY,
      version: 2,
      // v1：清理演示种子；v2：为历史记录补 updatedAt（用 timestamp/date 兜底）
      migrate: (persisted, version) => {
        const p = persisted as Partial<GlucoFitState> | null;
        if (!p || !Array.isArray(p.mealLogs)) return p as GlucoFitState;
        const base = {
          ...p,
          ...stripDemoState({
            mealLogs: p.mealLogs,
            bodyRecords: p.bodyRecords ?? [],
            exerciseLogs: p.exerciseLogs ?? [],
            pendingDeletedMealIds: p.pendingDeletedMealIds,
          }),
        } as GlucoFitState;
        if (version < 2) {
          base.bodyRecords = backfillUpdatedAt(base.bodyRecords ?? []);
          base.mealLogs = backfillUpdatedAt(base.mealLogs ?? []);
          base.exerciseLogs = backfillUpdatedAt(base.exerciseLogs ?? []);
        }
        return base;
      },
      storage: createJSONStorage(() => scopedStorage),
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

/** XOR + Base64 混淆存储（按账号作用域），避免 API Key 明文暴露在 localStorage */
const obfuscatedStorage: StateStorage = {
  getItem: (name) => {
    const raw = safeGetRaw(scopedKey(name)) ?? safeGetRaw(name);
    if (!raw) return null;
    try {
      return deobfuscate(raw);
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    safeSetRaw(scopedKey(name), obfuscate(value));
  },
  removeItem: (name) => {
    safeRemoveRaw(scopedKey(name));
    safeRemoveRaw(name);
  },
};

interface AISettingsState {
  aiSettings: AISettings;
  updateAISettings: (settings: AISettings) => void;
}

export const useAISettingsStore = create<AISettingsState>()(
  persist(
    (set) => ({
      aiSettings: EMPTY_AI_SETTINGS,
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
