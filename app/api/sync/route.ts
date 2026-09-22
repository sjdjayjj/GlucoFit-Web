import { upstreamFetchJson } from "@/lib/upstream-fetch";
import type {
  BodyCompositionRecord,
  ExerciseLog,
  MealLog,
  SyncSettings,
  UserProfile,
} from "@/types";

/**
 * 云同步代理 (v2.1)：经 Cloudflare REST API 读写用户自己的 D1 数据库。
 * 凭证 (Account ID / Database ID / API Token) 由前端传入，服务器不留存。
 * 上游请求自动探测系统代理，见 lib/upstream-fetch.ts。
 *
 * D1 单条查询绑定参数上限 100，push 按表分块多行 INSERT。
 */

const D1_API = (accountId: string, databaseId: string) =>
  `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;

interface CFResult {
  success?: boolean;
  errors?: Array<{ code?: number; message?: string }>;
  result?: Array<{ results?: unknown[] }>;
}

async function d1Query(
  s: SyncSettings,
  sql: string,
  params: unknown[] = []
): Promise<CFResult["result"]> {
  const res = await upstreamFetchJson(D1_API(s.accountId, s.databaseId), {
    method: "POST",
    headers: { Authorization: `Bearer ${s.apiToken}` },
    body: JSON.stringify({ sql, params }),
    timeoutMs: 30_000,
  });
  const data = res.data as CFResult | null;
  if (!res.ok || !data?.success) {
    const msg =
      data?.errors?.map((e) => e.message).join("; ") ||
      data?.errors?.[0]?.message ||
      `Cloudflare D1 返回 ${res.status}`;
    throw new Error(msg);
  }
  return data.result;
}

/** 初始化表结构（与项目根 schema.sql 保持一致） */
const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    gender TEXT,
    birth_year INTEGER,
    height_cm REAL NOT NULL,
    initial_weight_kg REAL NOT NULL,
    initial_fat_rate REAL,
    initial_fat_mass_kg REAL,
    initial_protein_kg REAL,
    target_weight_kg REAL NOT NULL,
    target_fat_rate REAL,
    activity_level REAL DEFAULT 1.2,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME
  )`,
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
  `CREATE INDEX IF NOT EXISTS idx_body_user_date ON body_composition(user_id, date)`,
  `CREATE INDEX IF NOT EXISTS idx_meal_user_ts ON meal_logs(user_id, timestamp)`,
  `CREATE INDEX IF NOT EXISTS idx_exercise_user_ts ON exercise_logs(user_id, timestamp)`,
];

// ---------- 行映射：D1 snake_case <-> 客户端 camelCase 契约 ----------

type ProfileRow = Record<string, unknown>;
type BodyRow = Record<string, unknown>;
type MealRow = Record<string, unknown>;
type ExerciseRow = Record<string, unknown>;

const num = (v: unknown, fallback = 0): number =>
  typeof v === "number" ? v : typeof v === "string" && v !== "" ? Number(v) : fallback;
const str = (v: unknown): string | undefined =>
  typeof v === "string" && v !== "" ? v : undefined;
const bool = (v: unknown): boolean => v === 1 || v === true;

function rowToProfile(r: ProfileRow): UserProfile {
  return {
    uid: String(r.id ?? ""),
    email: str(r.email),
    gender: (r.gender === "male" || r.gender === "female" ? r.gender : "other") as UserProfile["gender"],
    birthYear: num(r.birth_year, new Date().getFullYear() - 30),
    heightCm: num(r.height_cm),
    initialWeightKg: num(r.initial_weight_kg),
    initialBodyFatRate: r.initial_fat_rate != null ? num(r.initial_fat_rate) : undefined,
    initialFatMassKg: r.initial_fat_mass_kg != null ? num(r.initial_fat_mass_kg) : undefined,
    initialProteinKg: r.initial_protein_kg != null ? num(r.initial_protein_kg) : undefined,
    targetWeightKg: num(r.target_weight_kg),
    targetBodyFatRate: r.target_fat_rate != null ? num(r.target_fat_rate) : undefined,
    activityLevel: (num(r.activity_level, 1.2) as UserProfile["activityLevel"]) ?? 1.2,
    updatedAt: String(r.updated_at ?? ""),
    createdAt: String(r.created_at ?? ""),
  };
}

function rowToBodyRecord(r: BodyRow): BodyCompositionRecord {
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

function rowToMealLog(r: MealRow): MealLog {
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

function rowToExerciseLog(r: ExerciseRow): ExerciseLog {
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

// ---------- push：分块多行 INSERT OR REPLACE ----------

const CHUNK_PARAMS_LIMIT = 90; // D1 单查询绑定参数上限 100，留余量

function chunkInsert(
  table: string,
  columns: string[],
  rows: unknown[][]
): Array<{ sql: string; params: unknown[] }> {
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

function boolInt(v: boolean): number {
  return v ? 1 : 0;
}

interface PushPayload {
  profile?: UserProfile;
  bodyRecords?: BodyCompositionRecord[];
  mealLogs?: MealLog[];
  exerciseLogs?: ExerciseLog[];
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const { action, settings, syncCode, payload } = (body ?? {}) as {
      action?: "ping" | "init" | "pull" | "push";
      settings?: SyncSettings;
      syncCode?: string;
      payload?: PushPayload;
    };

    if (
      !settings?.accountId ||
      !settings?.databaseId ||
      !settings?.apiToken
    ) {
      return Response.json(
        { error: "缺少 Cloudflare 凭证（Account ID / Database ID / API Token）" },
        { status: 400 }
      );
    }

    if (action === "ping") {
      await d1Query(settings, "SELECT 1");
      return Response.json({ ok: true });
    }

    if (action === "init") {
      for (const sql of SCHEMA_STATEMENTS) {
        await d1Query(settings, sql);
      }
      return Response.json({ ok: true });
    }

    if (!syncCode) {
      return Response.json({ error: "缺少同步码" }, { status: 400 });
    }

    if (action === "pull") {
      const [profileRes, bodyRes, mealRes, exRes] = await Promise.all([
        d1Query(settings, "SELECT * FROM users WHERE id = ?", [syncCode]),
        d1Query(
          settings,
          "SELECT * FROM body_composition WHERE user_id = ? ORDER BY date ASC",
          [syncCode]
        ),
        d1Query(
          settings,
          "SELECT * FROM meal_logs WHERE user_id = ? ORDER BY timestamp ASC",
          [syncCode]
        ),
        d1Query(
          settings,
          "SELECT * FROM exercise_logs WHERE user_id = ? ORDER BY timestamp ASC",
          [syncCode]
        ),
      ]);
      const profileRow = (profileRes?.[0]?.results as ProfileRow[] | undefined)?.[0];
      return Response.json({
        ok: true,
        data: {
          profile: profileRow ? rowToProfile(profileRow) : null,
          bodyRecords: (bodyRes?.[0]?.results as BodyRow[] | undefined)?.map(rowToBodyRecord) ?? [],
          mealLogs: (mealRes?.[0]?.results as MealRow[] | undefined)?.map(rowToMealLog) ?? [],
          exerciseLogs: (exRes?.[0]?.results as ExerciseRow[] | undefined)?.map(rowToExerciseLog) ?? [],
        },
      });
    }

    if (action === "push") {
      const p = payload ?? {};
      const statements: Array<{ sql: string; params: unknown[] }> = [];

      if (p.profile) {
        const u = p.profile;
        statements.push(
          ...chunkInsert(
            "users",
            [
              "id", "email", "gender", "birth_year", "height_cm",
              "initial_weight_kg", "initial_fat_rate", "initial_fat_mass_kg",
              "initial_protein_kg", "target_weight_kg", "target_fat_rate",
              "activity_level", "created_at", "updated_at",
            ],
            [[
              syncCode, u.email ?? null, u.gender, u.birthYear, u.heightCm,
              u.initialWeightKg, u.initialBodyFatRate ?? null,
              u.initialFatMassKg ?? null, u.initialProteinKg ?? null,
              u.targetWeightKg, u.targetBodyFatRate ?? null,
              u.activityLevel, u.createdAt, u.updatedAt,
            ]]
          )
        );
      }

      if (p.bodyRecords?.length) {
        statements.push(
          ...chunkInsert(
            "body_composition",
            [
              "id", "user_id", "date", "weight_kg", "bmi", "body_fat_rate",
              "fat_mass_kg", "water_weight_kg", "bone_mass_kg",
              "protein_weight_kg", "body_score", "image_url",
            ],
            p.bodyRecords.map((r) => [
              r.id, syncCode, r.date, r.weightKg, r.bmi, r.bodyFatRate,
              r.fatMassKg, r.waterWeightKg ?? null, r.boneMassKg ?? null,
              r.proteinWeightKg ?? null, r.bodyScore ?? null, null,
            ])
          )
        );
      }

      if (p.mealLogs?.length) {
        statements.push(
          ...chunkInsert(
            "meal_logs",
            [
              "id", "user_id", "timestamp", "meal_type", "followed_sequence",
              "avoided_refined_carb", "post_meal_activity", "energy_reaction",
              "satiety_duration", "score", "calories", "carbs_g", "fiber_g",
              "protein_g", "fat_g", "food_summary", "image_url",
            ],
            p.mealLogs.map((l) => [
              l.id, syncCode, l.timestamp, l.mealType,
              boolInt(l.followedSequence), boolInt(l.avoidedRefinedCarb),
              boolInt(l.postMealActivity), l.energyReaction,
              l.satietyDuration ?? null, l.score,
              l.nutrition?.calories ?? 0, l.nutrition?.carbsG ?? 0,
              l.nutrition?.fiberG ?? 0, l.nutrition?.proteinG ?? 0,
              l.nutrition?.fatG ?? 0, l.foodSummary || null, null,
            ])
          )
        );
      }

      if (p.exerciseLogs?.length) {
        statements.push(
          ...chunkInsert(
            "exercise_logs",
            [
              "id", "user_id", "timestamp", "category", "duration_minutes",
              "calories_burned", "is_post_meal", "muscle_feel", "notes",
            ],
            p.exerciseLogs.map((l) => [
              l.id, syncCode, l.timestamp, l.category,
              l.durationMinutes, l.caloriesBurned, boolInt(l.isPostMeal),
              l.muscleFeel?.length ? JSON.stringify(l.muscleFeel) : null,
              l.notes ?? null,
            ])
          )
        );
      }

      let executed = 0;
      for (const stmt of statements) {
        await d1Query(settings, stmt.sql, stmt.params);
        executed += 1;
      }
      return Response.json({ ok: true, data: { statements: executed } });
    }

    return Response.json({ error: "未知操作类型" }, { status: 400 });
  } catch (e) {
    const err = e as { name?: string; message?: string; cause?: { code?: string } };
    let msg =
      err?.name === "TimeoutError"
        ? "同步请求超时，请检查网络后重试"
        : err?.message || "云同步请求失败";
    if (err?.cause?.code) msg += `（${err.cause.code}）`;
    return Response.json({ error: msg }, { status: 500 });
  }
}
