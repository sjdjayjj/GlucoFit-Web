import type {
  AISettings,
  MealRecommendation,
  UserGoalConfig,
} from "@/types";

// ---------- OpenAI 兼容协议客户端 ----------

export interface ContentPart {
  type: "text" | "image_url";
  text?: string;
  image_url?: { url: string };
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string | ContentPart[];
}

export interface ChatOptions {
  model?: string; // 默认使用 settings.model
  temperature?: number;
}

/** 文本模型已配置 */
export function isAIConfigured(s: AISettings | undefined): s is AISettings {
  return !!(s && s.baseUrl && s.apiKey && s.model);
}

/** 视觉模型已配置 */
export function isVisionConfigured(s: AISettings | undefined): boolean {
  return isAIConfigured(s) && !!s.visionModel;
}

/** 统一经本地 /api/ai 代理调用 OpenAI 兼容接口 */
async function chatCompletion(
  settings: AISettings,
  messages: ChatMessage[],
  opts?: ChatOptions
): Promise<string> {
  const res = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      baseUrl: settings.baseUrl,
      apiKey: settings.apiKey,
      model: opts?.model || settings.model,
      messages,
      temperature: opts?.temperature,
    }),
  });
  const data = (await res.json().catch(() => null)) as {
    content?: string;
    error?: string;
  } | null;
  if (!res.ok) {
    throw new Error(data?.error || `AI 请求失败 (${res.status})`);
  }
  return data?.content ?? "";
}

/** 从模型返回文本中稳健提取 JSON（容忍 Markdown 围栏与前后杂文） */
export function extractJson<T>(raw: string): T | null {
  if (!raw) return null;
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

/** 连通性测试：Ping 验证 API Key 与 Endpoint */
export async function testConnection(
  settings: AISettings
): Promise<{ ok: boolean; message: string; latencyMs: number }> {
  const started = Date.now();
  try {
    await chatCompletion(
      settings,
      [
        { role: "system", content: "你是连通性测试助手。" },
        { role: "user", content: "请只回复两个字：成功" },
      ],
      { temperature: 0 }
    );
    return {
      ok: true,
      message: "连接成功",
      latencyMs: Date.now() - started,
    };
  } catch (e) {
    return {
      ok: false,
      message: (e as Error).message || "连接失败",
      latencyMs: Date.now() - started,
    };
  }
}

// ---------- 4.1 体脂秤 OCR 识别 ----------

const BODY_OCR_PROMPT = `你是一个专业的人体成分分析识别助手。请从用户上传的体脂秤报告截图中，严格提取以下数字指标并以纯 JSON 返回，不得包含 Markdown 标记：
{"weightKg": number,"bmi": number,"bodyFatRate": number,"bodyScore": number | null,"waterWeightKg": number | null,"fatMassKg": number,"boneMassKg": number | null,"proteinWeightKg": number | null}`;

export interface BodyOcrResult {
  weightKg: number;
  bmi: number;
  bodyFatRate: number;
  fatMassKg: number;
  bodyScore: number | null;
  waterWeightKg: number | null;
  boneMassKg: number | null;
  proteinWeightKg: number | null;
}

export async function recognizeBodyReport(
  settings: AISettings,
  imageDataUrl: string
): Promise<BodyOcrResult> {
  const raw = await chatCompletion(
    settings,
    [
      { role: "system", content: BODY_OCR_PROMPT },
      {
        role: "user",
        content: [
          { type: "text", text: "请识别这张体脂秤报告截图中的各项指标。" },
          { type: "image_url", image_url: { url: imageDataUrl } },
        ],
      },
    ],
    { model: settings.visionModel, temperature: 0 }
  );
  const parsed = extractJson<Record<string, number | null>>(raw);
  if (!parsed || parsed.weightKg == null) {
    throw new Error("未能从图片中识别出有效数据，请尝试更清晰的截图或手动录入");
  }
  const num = (v: unknown): number => (typeof v === "number" ? v : Number(v) || 0);
  return {
    weightKg: num(parsed.weightKg),
    bmi: num(parsed.bmi),
    bodyFatRate: num(parsed.bodyFatRate),
    fatMassKg: num(parsed.fatMassKg),
    bodyScore: parsed.bodyScore == null ? null : num(parsed.bodyScore),
    waterWeightKg: parsed.waterWeightKg == null ? null : num(parsed.waterWeightKg),
    boneMassKg: parsed.boneMassKg == null ? null : num(parsed.boneMassKg),
    proteinWeightKg:
      parsed.proteinWeightKg == null ? null : num(parsed.proteinWeightKg),
  };
}

// ---------- 4.2 餐食图片估算 ----------

const MEAL_VISION_PROMPT = `你是一位兼具临床营养学与胰岛素抵抗干预背景的营养专家。
请根据食物图片评估：
1. 估算菜品清单、总热量(kcal)及三大营养素(g)。
2. 判断是否存在精制碳水/高升糖食物。
3. 给出基于控糖逻辑的最佳进食顺序指导。
以纯 JSON 输出，不得包含 Markdown 标记，字段包括：
{"foodSummary": string,"calories": number,"proteinG": number,"carbsG": number,"fatG": number,"fiberG": number,"hasRefinedCarb": boolean,"sequenceAdvice": string}`;

export interface MealAnalysisResult {
  foodSummary: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG?: number;
  hasRefinedCarb: boolean;
  sequenceAdvice: string;
}

export async function analyzeMealPhoto(
  settings: AISettings,
  imageDataUrl: string
): Promise<MealAnalysisResult> {
  const raw = await chatCompletion(
    settings,
    [
      { role: "system", content: MEAL_VISION_PROMPT },
      {
        role: "user",
        content: [
          { type: "text", text: "请分析这张餐食照片并按 JSON 规范返回。" },
          { type: "image_url", image_url: { url: imageDataUrl } },
        ],
      },
    ],
    { model: settings.visionModel, temperature: 0.2 }
  );
  const parsed = extractJson<Record<string, unknown>>(raw);
  if (!parsed || !parsed.foodSummary) {
    throw new Error("未能从照片中识别出食物，请尝试更清晰的照片或手动填写");
  }
  const num = (v: unknown): number => (typeof v === "number" ? v : Number(v) || 0);
  return {
    foodSummary: String(parsed.foodSummary),
    calories: num(parsed.calories),
    proteinG: num(parsed.proteinG),
    carbsG: num(parsed.carbsG),
    fatG: num(parsed.fatG),
    fiberG: parsed.fiberG == null ? undefined : num(parsed.fiberG),
    hasRefinedCarb: parsed.hasRefinedCarb === true,
    sequenceAdvice: String(parsed.sequenceAdvice || ""),
  };
}

// ---------- 模块 H：AI 三餐控糖推荐 ----------

const MEAL_PLAN_PROMPT = `你是一位专注胰岛素抵抗（IR）与代谢重塑的内分泌营养专家。请根据用户提供的控糖减脂数据，以纯 JSON 输出（不得包含 Markdown 标记）今日三餐控糖方案：
{"recommendations": [{"mealType": "breakfast" | "lunch" | "dinner", "title": string, "ingredients": string[], "recommendedSequence": string, "estimatedCalories": number, "macros": {"carbs": number, "protein": number, "fat": number}}]}
要求：
- recommendations 共 3 条，分别对应 breakfast / lunch / dinner，三餐总热量贴近用户剩余热量预算
- 控糖原则：高纤维蔬菜优先、每餐含 25-40g 优质蛋白、碳水选低 GI 复合来源（杂粮/根茎），规避精制糖与白米面
- ingredients 给出食材与参考克数；recommendedSequence 一句话说明进食顺序（蔬菜 -> 蛋白脂肪 -> 碳水）
- 避开用户忌口，优先使用用户提供的现有食材`;

export interface MealPlanInput {
  remainingCalories: number;
  targetIntake: number;
  consumedCalories: number;
  remainingNetCarbs: number;
  weightKg: number;
  fatMassKg: number;
  goalWeightKg: number;
  goalBodyFatRate: number;
  preferences?: string;
}

export async function generateMealPlan(
  settings: AISettings,
  input: MealPlanInput
): Promise<MealRecommendation[]> {
  const raw = await chatCompletion(
    settings,
    [
      { role: "system", content: MEAL_PLAN_PROMPT },
      {
        role: "user",
        content: `今日数据：剩余热量预算 ${input.remainingCalories} kcal（推荐摄入 ${input.targetIntake} kcal，已摄入 ${input.consumedCalories} kcal）；剩余净碳水预算 ${input.remainingNetCarbs} g。当前体重 ${input.weightKg} kg、脂肪量 ${input.fatMassKg} kg；目标体重 ${input.goalWeightKg} kg、目标体脂率 ${input.goalBodyFatRate}%。${input.preferences ? `忌口与现有食材：${input.preferences}` : ""}`,
      },
    ],
    { temperature: 0.8 }
  );
  const parsed = extractJson<{ recommendations?: MealRecommendation[] }>(raw);
  const recs = parsed?.recommendations;
  if (!Array.isArray(recs) || recs.length === 0) {
    throw new Error("AI 未返回有效的食谱方案，请重试");
  }
  return recs.slice(0, 3);
}

// ---------- AI 周度代谢诊断 ----------

export type PlateauStatus =
  | "improving"
  | "plateau"
  | "regressing"
  | "insufficient_data";

export interface WeeklyStats {
  weightStart: number;
  weightEnd: number;
  weightDelta: number;
  fatStart: number;
  fatEnd: number;
  fatDelta: number;
  proteinStart: number | null;
  proteinEnd: number | null;
  proteinDelta: number | null;
  ffmStart: number;
  ffmEnd: number;
  ffmDelta: number;
  muscleFatRatioStart: number;
  muscleFatRatioEnd: number;
  avgScore: number;
  logCount: number;
  foodComaCount: number;
  sequenceRate: number;
  activityRate: number;
}

const DIAGNOSIS_PROMPT = `你是一位针对胰岛素抵抗（IR）与代谢重塑的内分泌健康教练。请基于用户近 7 天的体成分与控糖行为统计数据，以纯 JSON 输出（不得包含 Markdown 标记）一份专业周度代谢诊断报告：
{"overall": string, "muscleStatus": string, "insulinStatus": string, "plateauStatus": "improving" | "plateau" | "regressing" | "insufficient_data", "actions": string[]}
字段要求：
- overall：总体评价，不超过 80 字
- muscleStatus：瘦体重/蛋白质量变化分析，是否掉肌及原因
- insulinStatus：结合稳糖得分与餐后嗜睡频次的胰岛素敏感度分析
- plateauStatus：结合"肌肉/脂肪比"变化与 7 天稳糖均分，判断代谢向好 / 平台期 / 退步 / 数据不足
- actions：3-5 条可执行的具体行动建议，每条不超过 40 字`;

export interface DiagnosisResult {
  overall: string;
  muscleStatus: string;
  insulinStatus: string;
  plateauStatus: PlateauStatus;
  actions: string[];
}

export async function generateWeeklyDiagnosis(
  settings: AISettings,
  stats: WeeklyStats,
  goal: UserGoalConfig
): Promise<DiagnosisResult> {
  const raw = await chatCompletion(
    settings,
    [
      { role: "system", content: DIAGNOSIS_PROMPT },
      {
        role: "user",
        content: `近 7 天统计数据（JSON）：${JSON.stringify(stats)}\n用户目标：体重 ${goal.targetWeightKg} kg、体脂率 ${goal.targetBodyFatRate}%。`,
      },
    ],
    { temperature: 0.4 }
  );
  const parsed = extractJson<{
    overall?: string;
    muscleStatus?: string;
    insulinStatus?: string;
    plateauStatus?: PlateauStatus;
    actions?: string[];
  }>(raw);
  if (!parsed?.overall) {
    throw new Error("AI 未返回有效的诊断报告，请重试");
  }
  return {
    overall: parsed.overall,
    muscleStatus: parsed.muscleStatus || "",
    insulinStatus: parsed.insulinStatus || "",
    plateauStatus: parsed.plateauStatus || "insufficient_data",
    actions: Array.isArray(parsed.actions) ? parsed.actions.slice(0, 5) : [],
  };
}
