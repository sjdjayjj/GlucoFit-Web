import { requireSession } from "@/lib/auth";
import { d1Query, ensureSchema, rowToOptionalProfile } from "@/lib/db";

/** 获取当前用户信息及代谢档案 */
export async function GET(req: Request) {
  const auth = await requireSession(req);
  if ("error" in auth) return auth.error;

  try {
    await ensureSchema();
    const res = await d1Query("SELECT * FROM users WHERE id = ?", [auth.userId]);
    const row = res?.[0]?.results?.[0] as Record<string, unknown> | undefined;
    return Response.json({
      user: { id: auth.userId, email: auth.email },
      profile: row ? rowToOptionalProfile(row) : null,
    });
  } catch (e) {
    return Response.json(
      { error: (e as Error).message || "获取用户信息失败" },
      { status: 500 }
    );
  }
}
