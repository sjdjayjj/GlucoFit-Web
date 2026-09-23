import { requireSession } from "@/lib/auth";
import {
  boolInt,
  chunkInsert,
  d1Query,
  ensureSchema,
  execStatements,
  rowToExerciseLog,
} from "@/lib/db";
import type { ExerciseLog } from "@/types";

/** 运动消耗记录：GET 读取列表 / POST 新增（支持数组批量上行） */
export async function GET(req: Request) {
  const auth = await requireSession(req);
  if ("error" in auth) return auth.error;
  try {
    await ensureSchema();
    const res = await d1Query(
      "SELECT * FROM exercise_logs WHERE user_id = ? ORDER BY timestamp ASC",
      [auth.userId]
    );
    const rows = (res?.[0]?.results ?? []) as Record<string, unknown>[];
    return Response.json({ records: rows.map(rowToExerciseLog) });
  } catch (e) {
    return Response.json(
      { error: (e as Error).message || "读取运动记录失败" },
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
      record?: ExerciseLog;
      records?: ExerciseLog[];
    } | null;
    const list = body?.records ?? (body?.record ? [body.record] : []);
    if (!list.length) {
      return Response.json({ error: "缺少记录数据" }, { status: 400 });
    }

    const statements = chunkInsert(
      "exercise_logs",
      [
        "id", "user_id", "timestamp", "category", "duration_minutes",
        "calories_burned", "is_post_meal", "muscle_feel", "notes",
      ],
      list.map((l) => [
        l.id, auth.userId, l.timestamp, l.category,
        l.durationMinutes, l.caloriesBurned, boolInt(l.isPostMeal),
        l.muscleFeel?.length ? JSON.stringify(l.muscleFeel) : null,
        l.notes ?? null,
      ])
    );
    await execStatements(statements);
    return Response.json({ ok: true, count: list.length });
  } catch (e) {
    return Response.json(
      { error: (e as Error).message || "保存运动记录失败" },
      { status: 500 }
    );
  }
}
