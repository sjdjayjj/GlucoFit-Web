// --- 1. AI 配置与用户凭证 (BYOK) ---
export interface AISettings {
  baseUrl: string; // 例如: https://api.openai.com/v1 或兼容地址
  apiKey: string;
  model: string; // 例如: gpt-4o-mini, deepseek-chat, qwen-plus 等
  visionModel: string; // 支持视觉的多模态模型 (如 gpt-4o, qwen-vl-max 等)
}

// --- 2. 宏量营养与热量结构 ---
export interface NutritionSummary {
  calories: number; // 热量 (kcal)
  carbsG: number; // 碳水总量 (g)
  fiberG?: number; // 膳食纤维 (g)
  proteinG: number; // 蛋白质 (g)
  fatG: number; // 脂肪 (g)
}

// --- 3. 饮食与行为代谢记录 (v2 升级：图片 + 营养宏量) ---
export type MealType = "breakfast" | "lunch" | "dinner" | "snack";
export type EnergyReaction = "energetic" | "normal" | "food_coma"; // 饱满 / 正常 / 明显嗜睡昏沉
export type SatietyDuration = "under_2h" | "2_to_4h" | "over_4h"; // 抗饿时长

export interface MealLog {
  id: string;
  timestamp: string; // ISO 8601
  mealType: MealType;
  followedSequence: boolean; // 进食顺序：纤维/蔬菜 -> 蛋白/脂肪 -> 碳水主食
  avoidedRefinedCarb: boolean; // 避免精制碳水（无白米面、无游离糖/甜饮）
  postMealActivity: boolean; // 餐后30分钟内完成10-15分钟轻运动 (GLUT4 激活)
  energyReaction: EnergyReaction; // 餐后精力反应 (IR 核心自检项)
  satietyDuration?: SatietyDuration; // 饱腹维持时长
  score: number; // 稳糖表现分 (0-100)
  imageUrl?: string; // 菜品照片 (压缩后 Base64)
  foodSummary: string; // 食物描述
  nutrition?: NutritionSummary; // AI 估算/手动录入的热量宏量
}

// --- 4. 智能体脂秤体征打卡数据 (v2 升级：截图原图) ---
export interface BodyCompositionRecord {
  id: string;
  date: string; // YYYY-MM-DD
  imageUrl?: string; // 体脂秤报告截图
  weightKg: number; // 体重 (kg，如 79.1)
  bmi: number; // BMI (如 26.7)
  bodyFatRate: number; // 体脂率 (%，如 24.2)
  bodyScore?: number; // 身体得分 (如 81)
  waterWeightKg?: number; // 体水分量 (kg，如 43.4)
  fatMassKg: number; // 脂肪量 (kg，如 19.1)
  boneMassKg?: number; // 骨盐量 (kg，如 3.2)
  proteinWeightKg?: number; // 蛋白质量 (kg，如 12.7)
  notes?: string;
}

// --- 5. 全局目标与偏好 ---
export interface UserGoalConfig {
  targetWeightKg: number;
  targetBodyFatRate: number;
  fastingProtocol: "16:8" | "14:10" | "12:12";
}

// --- 6. AI 推荐餐谱结构 ---
export interface MealRecommendation {
  mealType: "breakfast" | "lunch" | "dinner";
  title: string;
  ingredients: string[];
  recommendedSequence: string; // 推荐食用顺序指导
  estimatedCalories: number;
  macros: { carbs: number; protein: number; fat: number };
}

// --- 7. 饮食打卡预填（AI 推荐方案采纳） ---
export interface MealLogPrefill {
  mealType?: MealType;
  foodSummary?: string;
  nutrition?: NutritionSummary;
  sourceNote?: string;
}

// --- 8. 用户初始体态档案与代谢基准 (v2.1) ---
export interface UserProfile {
  uid: string;
  email?: string;
  gender: "male" | "female" | "other";
  birthYear: number; // 出生年份
  heightCm: number; // 身高 (cm)
  initialWeightKg: number; // 初始空腹体重 (kg)
  initialBodyFatRate?: number; // 初始体脂率 (%，选填)
  initialFatMassKg?: number; // 初始脂肪量 (kg，选填)
  initialProteinKg?: number; // 初始骨骼肌/蛋白质量 (kg，选填)
  targetWeightKg: number; // 目标体重 (kg)
  targetBodyFatRate?: number; // 目标体脂率 (%，选填)
  activityLevel: 1.2 | 1.375 | 1.55 | 1.725; // 日常静息活动乘数
  updatedAt: string; // ISO 8601，用于多端合并
  createdAt: string;
}

// --- 9. 运动消耗与骨骼肌负荷记录 (v2.1) ---
export type ExerciseCategory =
  | "post_meal_walk" // 餐后肌肉泵：散步/提踵/慢速骑行 (GLUT4 激活)
  | "resistance" // 抗阻力量：扩大肌糖原池、长期提升胰岛素敏感度
  | "cardio" // 中高强度有氧
  | "other";

export interface ExerciseLog {
  id: string;
  userId?: string; // 云同步用户标识（本地记录可缺省）
  timestamp: string; // 运动开始时间 ISO 8601
  category: ExerciseCategory;
  durationMinutes: number;
  caloriesBurned: number;
  isPostMeal: boolean; // 是否紧邻餐后 30-45 分钟内
  muscleFeel?: string[]; // 肌肉刺激体感标签
  notes?: string;
}

// --- 10. 每日热量与代谢结算聚合 (v2.1) ---
export interface DailyEnergyBalance {
  date: string;
  intakeCalories: number; // 饮食总摄入
  bmr: number; // 基础代谢
  tdee: number; // 静态维持 TDEE = BMR × 活动系数
  activeBurnCalories: number; // 运动主动消耗
  netBalance: number; // 净热量 = 摄入 - (TDEE + 运动消耗)，负值为赤字
}

// --- 11. 云同步配置 (v2.1，BYOK Cloudflare D1) ---
export interface SyncSettings {
  accountId: string; // Cloudflare Account ID
  databaseId: string; // D1 Database ID
  apiToken: string; // Cloudflare API Token
  syncCode: string; // 同步码：多端一致的轻量用户标识
}

// --- 展示用标签映射 ---
export const MEAL_TYPE_LABEL: Record<MealType, string> = {
  breakfast: "早餐",
  lunch: "午餐",
  dinner: "晚餐",
  snack: "加餐",
};

export const ENERGY_REACTION_LABEL: Record<EnergyReaction, string> = {
  energetic: "精力充沛",
  normal: "正常平稳",
  food_coma: "餐后嗜睡脑雾",
};

export const SATIETY_DURATION_LABEL: Record<SatietyDuration, string> = {
  under_2h: "< 2 小时",
  "2_to_4h": "2 - 4 小时",
  over_4h: "> 4 小时",
};

export const EXERCISE_CATEGORY_LABEL: Record<ExerciseCategory, string> = {
  post_meal_walk: "餐后肌肉泵",
  resistance: "抗阻力量",
  cardio: "中高强度有氧",
  other: "其他",
};

export const EXERCISE_CATEGORY_DESC: Record<ExerciseCategory, string> = {
  post_meal_walk: "散步 / 提踵 / 慢速骑行 · GLUT4 非胰岛素依赖转位",
  resistance: "深蹲 / 核心 / 器械推拉 · 扩大肌糖原池",
  cardio: "跑步 / 游泳 / 跳绳 · 提升心肺与代谢灵活性",
  other: "瑜伽、徒步等日常活动",
};

/** 运动体感标签（多选） */
export const MUSCLE_FEEL_OPTIONS = ["下肢酸胀", "核心紧绷", "上肢酸胀", "无疲劳感"] as const;

export const GENDER_LABEL: Record<UserProfile["gender"], string> = {
  male: "男",
  female: "女",
  other: "其他",
};
