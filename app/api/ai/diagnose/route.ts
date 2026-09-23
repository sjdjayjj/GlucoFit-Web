import { requireSession } from "@/lib/auth";
import { d1Query, ensureSchema, rowToDiagnosis } from "@/lib/db";

/**
 * AI 代谢诊断缓存 (v2.2)：
 * - GET：读取云端最新诊断记录（前端优先读本地缓存，云端用于多端漫游）
 * - POST：持久化客户端经 BYOK 代理生成的新诊断（content 为报告 JSON 字符串）
 */

export async function GET(req: Request) {
  const auth = await requireSession(req);
  if ("error" in auth) return auth.error;
  try {
    await ensureSchema();
    const res = await d1Query(
      "SELECT * FROM ai_diagnoses WHERE user_id = ? ORDER BY generated_at DESC LIMIT 1",
      [auth.userId]
    );
    const row = res?.[0]?.results?.[0] as Record<string, unknown> | undefined;
    return Response.json({ record: row ? rowToDiagnosis(row) : null });
  } catch (e) {
    return Response.json(
      { error: (e as Error).message || "读取诊断缓存失败" },
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
      content?: string;
      generatedAt?: string;
      dateStr?: string;
    } | null;
    if (!body?.content || !body.generatedAt || !body.dateStr) {
      return Response.json(
        { error: "缺少 content / generatedAt / dateStr" },
        { status: 400 }
      );
    }
    // 每用户每天一条缓存，重复生成即覆盖
    const id = `${auth.userId}:${body.dateStr}`;
    await d1Query(
      `INSERT OR REPLACE INTO ai_diagnoses (id, user_id, content, generated_at, date_str)
       VALUES (?, ?, ?, ?, ?)`,
      [id, auth.userId, body.content, body.generatedAt, body.dateStr]
    );
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json(
      { error: (e as Error).message || "保存诊断缓存失败" },
      { status: 500 }
    );
  }
}
