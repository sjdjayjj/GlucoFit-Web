import { requireSession } from "@/lib/auth";
import {
  chunkInsert,
  d1Query,
  ensureSchema,
  execStatements,
  rowToBodyRecord,
} from "@/lib/db";
import type { BodyCompositionRecord } from "@/types";

/** 体脂秤记录：GET 读取列表 / POST 新增（支持数组批量上行） */
export async function GET(req: Request) {
  const auth = await requireSession(req);
  if ("error" in auth) return auth.error;
  try {
    await ensureSchema();
    const res = await d1Query(
      "SELECT * FROM body_composition WHERE user_id = ? ORDER BY date ASC",
      [auth.userId]
    );
    const rows = (res?.[0]?.results ?? []) as Record<string, unknown>[];
    return Response.json({ records: rows.map(rowToBodyRecord) });
  } catch (e) {
    return Response.json(
      { error: (e as Error).message || "读取体脂秤记录失败" },
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
      record?: BodyCompositionRecord;
      records?: BodyCompositionRecord[];
    } | null;
    const list = body?.records ?? (body?.record ? [body.record] : []);
    if (!list.length) {
      return Response.json({ error: "缺少记录数据" }, { status: 400 });
    }

    const statements = chunkInsert(
      "body_composition",
      [
        "id", "user_id", "date", "weight_kg", "bmi", "body_fat_rate",
        "fat_mass_kg", "water_weight_kg", "bone_mass_kg",
        "protein_weight_kg", "body_score", "image_url",
      ],
      list.map((r) => [
        r.id, auth.userId, r.date, r.weightKg, r.bmi, r.bodyFatRate,
        r.fatMassKg, r.waterWeightKg ?? null, r.boneMassKg ?? null,
        r.proteinWeightKg ?? null, r.bodyScore ?? null, null, // 图片暂不同步
      ])
    );
    await execStatements(statements);
    return Response.json({ ok: true, count: list.length });
  } catch (e) {
    return Response.json(
      { error: (e as Error).message || "保存体脂秤记录失败" },
      { status: 500 }
    );
  }
}
