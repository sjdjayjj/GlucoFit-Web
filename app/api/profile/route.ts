import { requireSession } from "@/lib/auth";
import { d1Query, ensureSchema, rowToProfile } from "@/lib/db";
import type { UserProfile } from "@/types";

/** 保存/更新用户代谢档案（身高、体重、三档推荐目标等） */
export async function PUT(req: Request) {
  const auth = await requireSession(req);
  if ("error" in auth) return auth.error;

  try {
    await ensureSchema();
    const body = (await req.json().catch(() => null)) as Partial<UserProfile> | null;
    if (!body) {
      return Response.json({ error: "请求体不能为空" }, { status: 400 });
    }

    const updatedAt = new Date().toISOString();
    await d1Query(
      `UPDATE users SET
        gender = ?, birth_year = ?, height_cm = ?, initial_weight_kg = ?,
        initial_fat_rate = ?, initial_fat_mass_kg = ?, initial_protein_kg = ?,
        target_weight_kg = ?, target_fat_rate = ?, strategy = ?,
        activity_level = ?, updated_at = ?
       WHERE id = ?`,
      [
        body.gender ?? null,
        body.birthYear ?? null,
        body.heightCm ?? null,
        body.initialWeightKg ?? null,
        body.initialBodyFatRate ?? null,
        body.initialFatMassKg ?? null,
        body.initialProteinKg ?? null,
        body.targetWeightKg ?? null,
        body.targetBodyFatRate ?? null,
        body.strategy ?? null,
        body.activityLevel ?? 1.2,
        updatedAt,
        auth.userId,
      ]
    );

    const res = await d1Query("SELECT * FROM users WHERE id = ?", [auth.userId]);
    const row = res?.[0]?.results?.[0] as Record<string, unknown> | undefined;
    return Response.json({ profile: row ? rowToProfile(row) : null });
  } catch (e) {
    return Response.json(
      { error: (e as Error).message || "保存档案失败" },
      { status: 500 }
    );
  }
}
