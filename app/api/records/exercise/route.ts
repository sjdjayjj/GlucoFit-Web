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

/** DELETE 批量删除（同步端 tombstone）：body = { ids: string[] }，按 90 个一组分块规避 D1 参数上限 */
export async function DELETE(req: Request) {
  const auth = await requireSession(req);
  if ("error" in auth) return auth.error;
  try {
    await ensureSchema();
    const body = (await req.json().catch(() => null)) as { ids?: unknown } | null;
    const ids = Array.isArray(body?.ids)
      ? body.ids.filter((x): x is string => typeof x === "string" && x.length > 0)
      : [];
    if (!ids.length) {
      return Response.json({ error: "缺少 ids" }, { status: 400 });
    }
    const CHUNK = 90; // D1 单语句绑定参数上限 100
    const statements = [];
    for (let i = 0; i < ids.length; i += CHUNK) {
      const slice = ids.slice(i, i + CHUNK);
      statements.push({
        sql: `DELETE FROM exercise_logs WHERE user_id = ? AND id IN (${slice
          .map(() => "?")
          .join(", ")})`,
        params: [auth.userId, ...slice],
      });
    }
    await execStatements(statements);
    return Response.json({ ok: true, count: ids.length });
  } catch (e) {
    return Response.json(
      { error: (e as Error).message || "删除运动记录失败" },
      { status: 500 }
    );
  }
}
