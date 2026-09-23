import { upstreamFetchJson } from "@/lib/upstream-fetch";
import type {
  AIDiagnosisRecord,
  BodyCompositionRecord,
  ExerciseLog,
  Gender,
  MealLog,
  UserProfile,
} from "@/types";

/**
 * 集中式 D1 数据访问 (v2.2，仅服务端使用)：
 * 开发者在部署环境注入全局凭证（不再由前端用户配置）：
 *   CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_D1_DATABASE_ID / CLOUDFLARE_API_TOKEN
 * 所有业务表强制关联系统下发的 user_id，实现多租户数据隔离。
 * 上游请求自动探测系统代理，见 lib/upstream-fetch.ts。
 */

const D1_API = (accountId: string, databaseId: string) =>
  `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;

interface CFResult {
  success?: boolean;
  errors?: Array<{ code?: number; message?: string }>;
  result?: Array<{ results?: unknown[] }>;
}

export function isDbConfigured(): boolean {
  return Boolean(
    process.env.CLOUDFLARE_ACCOUNT_ID &&
      process.env.CLOUDFLARE_D1_DATABASE_ID &&
      process.env.CLOUDFLARE_API_TOKEN
  );
}

export async function d1Query(
  sql: string,
  params: unknown[] = []
): Promise<CFResult["result"]> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !databaseId || !apiToken) {
    throw new Error("服务器未配置 D1 数据库凭证（CLOUDFLARE_ACCOUNT_ID 等）");
  }
  const res = await upstreamFetchJson(D1_API(accountId, databaseId), {
    method: "POST",
    headers: { Authorization: `Bearer ${apiToken}` },
    body: JSON.stringify({ sql, params }),
    timeoutMs: 30_000,
  });
  const data = res.data as CFResult | null;
  if (!res.ok || !data?.success) {
    const msg =
      data?.errors?.map((e) => e.message).join("; ") ||
      `Cloudflare D1 返回 ${res.status}`;
    throw new Error(msg);
  }
  return data.result;
}

// ---------- 表结构（幂等初始化，进程内仅执行一次） ----------

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    gender TEXT,
    birth_year INTEGER,
    height_cm REAL,
    initial_weight_kg REAL,
    initial_fat_rate REAL,
    initial_fat_mass_kg REAL,
    initial_protein_kg REAL,
    target_weight_kg REAL,
    target_fat_rate REAL,
    strategy TEXT,
    activity_level REAL DEFAULT 1.2,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME
  )`,
  // 旧库兼容：补充 v2.2 新增列
  `ALTER TABLE users ADD COLUMN password_hash TEXT`,
  `ALTER TABLE users ADD COLUMN strategy TEXT`,
  `CREATE TABLE IF NOT EXISTS body_composition (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    date TEXT NOT NULL,
    weight_kg REAL NOT NULL,
    bmi REAL NOT NULL,
    body_fat_rate REAL NOT NULL,
    fat_mass_kg REAL NOT NULL,
    water_weight_kg REAL,
    bone_mass_kg REAL,
    protein_weight_kg REAL,
    body_score REAL,
    image_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS meal_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    timestamp TEXT NOT NULL,
    meal_type TEXT NOT NULL,
    followed_sequence INTEGER NOT NULL,
    avoided_refined_carb INTEGER NOT NULL,
    post_meal_activity INTEGER NOT NULL,
    energy_reaction TEXT NOT NULL,
    satiety_duration TEXT,
    score INTEGER NOT NULL,
    calories INTEGER DEFAULT 0,
    carbs_g REAL DEFAULT 0,
    fiber_g REAL DEFAULT 0,
    protein_g REAL DEFAULT 0,
    fat_g REAL DEFAULT 0,
    food_summary TEXT,
    image_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS exercise_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    timestamp TEXT NOT NULL,
    category TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL,
    calories_burned REAL NOT NULL,
    is_post_meal INTEGER DEFAULT 0,
    muscle_feel TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS ai_diagnoses (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    content TEXT NOT NULL,
    generated_at TEXT NOT NULL,
    date_str TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_body_user_date ON body_composition(user_id, date)`,
  `CREATE INDEX IF NOT EXISTS idx_meal_user_ts ON meal_logs(user_id, timestamp)`,
  `CREATE INDEX IF NOT EXISTS idx_exercise_user_ts ON exercise_logs(user_id, timestamp)`,
  `CREATE INDEX IF NOT EXISTS idx_diag_user_time ON ai_diagnoses(user_id, generated_at)`,
];

let schemaReady: Promise<void> | null = null;

/** 幂等初始化表结构（ALTER 失败视为列已存在，忽略） */
export function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      for (const sql of SCHEMA_STATEMENTS) {
        try {
          await d1Query(sql);
        } catch (e) {
          const msg = (e as Error).message ?? "";
          if (!/duplicate column|already exists/i.test(msg)) throw e;
        }
      }
    })().catch((e) => {
      schemaReady = null; // 失败后允许重试
      throw e;
    });
  }
  return schemaReady;
}

// ---------- 行映射：D1 snake_case <-> 客户端 camelCase ----------

type Row = Record<string, unknown>;

const num = (v: unknown, fallback = 0): number =>
  typeof v === "number" ? v : typeof v === "string" && v !== "" ? Number(v) : fallback;
const str = (v: unknown): string | undefined =>
  typeof v === "string" && v !== "" ? v : undefined;
const bool = (v: unknown): boolean => v === 1 || v === true;

export function rowToProfile(r: Row): UserProfile {
  return {
    id: String(r.id ?? ""),
    email: str(r.email),
    gender: (r.gender === "female" ? "female" : "male") as Gender,
    birthYear: num(r.birth_year, new Date().getFullYear() - 30),
    heightCm: num(r.height_cm),
    initialWeightKg: num(r.initial_weight_kg),
    initialBodyFatRate: r.initial_fat_rate != null ? num(r.initial_fat_rate) : undefined,
    initialFatMassKg: r.initial_fat_mass_kg != null ? num(r.initial_fat_mass_kg) : undefined,
    initialProteinKg: r.initial_protein_kg != null ? num(r.initial_protein_kg) : undefined,
    targetWeightKg: num(r.target_weight_kg),
    targetBodyFatRate: r.target_fat_rate != null ? num(r.target_fat_rate) : undefined,
    strategy: str(r.strategy) as UserProfile["strategy"],
    activityLevel: (num(r.activity_level, 1.2) as UserProfile["activityLevel"]) ?? 1.2,
    updatedAt: String(r.updated_at ?? ""),
    createdAt: String(r.created_at ?? ""),
  };
}

/**
 * 注册后未建档的用户：身高/体重为空（旧库为 0 占位）时视为无档案，
 * 返回 null 以保证前端 Onboarding 正常触发。
 */
export function rowToOptionalProfile(r: Row): UserProfile | null {
  const heightCm = num(r.height_cm);
  const initialWeightKg = num(r.initial_weight_kg);
  if (heightCm <= 0 || initialWeightKg <= 0) return null;
  return rowToProfile(r);
}

export function rowToBodyRecord(r: Row): BodyCompositionRecord {
  return {
    id: String(r.id),
    date: String(r.date),
    weightKg: num(r.weight_kg),
    bmi: num(r.bmi),
    bodyFatRate: num(r.body_fat_rate),
    bodyScore: r.body_score != null ? num(r.body_score) : undefined,
    waterWeightKg: r.water_weight_kg != null ? num(r.water_weight_kg) : undefined,
    fatMassKg: num(r.fat_mass_kg),
    boneMassKg: r.bone_mass_kg != null ? num(r.bone_mass_kg) : undefined,
    proteinWeightKg: r.protein_weight_kg != null ? num(r.protein_weight_kg) : undefined,
    notes: str(r.notes),
  };
}

export function rowToMealLog(r: Row): MealLog {
  return {
    id: String(r.id),
    timestamp: String(r.timestamp),
    mealType: String(r.meal_type) as MealLog["mealType"],
    followedSequence: bool(r.followed_sequence),
    avoidedRefinedCarb: bool(r.avoided_refined_carb),
    postMealActivity: bool(r.post_meal_activity),
    energyReaction: String(r.energy_reaction) as MealLog["energyReaction"],
    satietyDuration: str(r.satiety_duration) as MealLog["satietyDuration"],
    score: num(r.score),
    foodSummary: str(r.food_summary) ?? "",
    nutrition: {
      calories: num(r.calories),
      carbsG: num(r.carbs_g),
      fiberG: num(r.fiber_g),
      proteinG: num(r.protein_g),
      fatG: num(r.fat_g),
    },
  };
}

export function rowToExerciseLog(r: Row): ExerciseLog {
  let muscleFeel: string[] | undefined;
  try {
    if (typeof r.muscle_feel === "string" && r.muscle_feel) {
      const parsed = JSON.parse(r.muscle_feel);
      if (Array.isArray(parsed)) muscleFeel = parsed;
    }
  } catch {
    /* 忽略非法 JSON */
  }
  return {
    id: String(r.id),
    userId: str(r.user_id),
    timestamp: String(r.timestamp),
    category: String(r.category) as ExerciseLog["category"],
    durationMinutes: num(r.duration_minutes),
    caloriesBurned: num(r.calories_burned),
    isPostMeal: bool(r.is_post_meal),
    muscleFeel,
    notes: str(r.notes),
  };
}

export function rowToDiagnosis(r: Row): AIDiagnosisRecord {
  return {
    id: String(r.id),
    userId: String(r.user_id),
    content: String(r.content ?? ""),
    generatedAt: String(r.generated_at ?? ""),
    dateStr: String(r.date_str ?? ""),
  };
}

// ---------- 写入辅助 ----------

export const boolInt = (v: boolean): number => (v ? 1 : 0);

/** D1 单查询绑定参数上限 100，按表分块多行 INSERT */
export function chunkInsert(
  table: string,
  columns: string[],
  rows: unknown[][]
): Array<{ sql: string; params: unknown[] }> {
  const CHUNK_PARAMS_LIMIT = 90;
  const perChunk = Math.max(1, Math.floor(CHUNK_PARAMS_LIMIT / columns.length));
  const statements: Array<{ sql: string; params: unknown[] }> = [];
  for (let i = 0; i < rows.length; i += perChunk) {
    const slice = rows.slice(i, i + perChunk);
    const placeholders = slice
      .map(() => `(${columns.map(() => "?").join(", ")})`)
      .join(", ");
    statements.push({
      sql: `INSERT OR REPLACE INTO ${table} (${columns.join(", ")}) VALUES ${placeholders}`,
      params: slice.flat(),
    });
  }
  return statements;
}

/** 依次执行写语句（D1 REST 单次仅一条 SQL） */
export async function execStatements(
  statements: Array<{ sql: string; params: unknown[] }>
): Promise<void> {
  for (const stmt of statements) {
    await d1Query(stmt.sql, stmt.params);
  }
}
