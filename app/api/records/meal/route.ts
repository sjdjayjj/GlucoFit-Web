import { requireSession } from "@/lib/auth";
import {
  boolInt,
  chunkInsert,
  d1Query,
  ensureSchema,
  execStatements,
  rowToMealLog,
} from "@/lib/db";
import type { MealLog } from "@/types";

/** 饮食打卡记录：GET 读取列表 / POST 新增（支持数组批量上行） */
export async function GET(req: Request) {
  const auth = await requireSession(req);
  if ("error" in auth) return auth.error;
  try {
    await ensureSchema();
    const res = await d1Query(
      "SELECT * FROM meal_logs WHERE user_id = ? ORDER BY timestamp ASC",
      [auth.userId]
    );
    const rows = (res?.[0]?.results ?? []) as Record<string, unknown>[];
    return Response.json({ records: rows.map(rowToMealLog) });
  } catch (e) {
    return Response.json(
      { error: (e as Error).message || "读取饮食记录失败" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const auth = await requireSession(req);
  if ("error" in auth) return auth.error;
  try {
    await ensureSchema();
    const body = (await req.json().catch(() => null)) as {
      record?: MealLog;
      records?: MealLog[];
    } | null;
    const list = body?.records ?? (body?.record ? [body.record] : []);
    if (!list.length) {
      return Response.json({ error: "缺少记录数据" }, { status: 400 });
    }

    const statements = chunkInsert(
      "meal_logs",
      [
        "id", "user_id", "timestamp", "meal_type", "followed_sequence",
        "avoided_refined_carb", "post_meal_activity", "energy_reaction",
        "satiety_duration", "score", "calories", "carbs_g", "fiber_g",
        "protein_g", "fat_g", "food_summary", "image_url",
      ],
      list.map((l) => [
        l.id, auth.userId, l.timestamp, l.mealType,
        boolInt(l.followedSequence), boolInt(l.avoidedRefinedCarb),
        boolInt(l.postMealActivity), l.energyReaction,
        l.satietyDuration ?? null, l.score,
        l.nutrition?.calories ?? 0, l.nutrition?.carbsG ?? 0,
        l.nutrition?.fiberG ?? 0, l.nutrition?.proteinG ?? 0,
        l.nutrition?.fatG ?? 0, l.foodSummary || null, null, // 图片暂不同步
      ])
    );
    await execStatements(statements);
    return Response.json({ ok: true, count: list.length });
  } catch (e) {
    return Response.json(
      { error: (e as Error).message || "保存饮食记录失败" },
      { status: 500 }
    );
  }
}
