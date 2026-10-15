import { requireSession } from "@/lib/auth";
import { ensureSchema, loadAISettings, saveAISettings } from "@/lib/db";
import type { AISettings } from "@/types";

/** 读取当前用户的 AI 模型配置（apiKey 解密后返回，仅限本人会话） */
export async function GET(req: Request) {
  const auth = await requireSession(req);
  if ("error" in auth) return auth.error;

  try {
    await ensureSchema();
    const settings = await loadAISettings(auth.userId);
    return Response.json({ settings });
  } catch (e) {
    return Response.json(
      { error: (e as Error).message || "读取 AI 设置失败" },
      { status: 500 }
    );
  }
}

/** 保存当前用户的 AI 模型配置（apiKey 加密落库） */
export async function PUT(req: Request) {
  const auth = await requireSession(req);
  if ("error" in auth) return auth.error;

  try {
    await ensureSchema();
    const body = (await req.json().catch(() => null)) as Partial<AISettings> | null;
    if (!body || typeof body !== "object") {
      return Response.json({ error: "请求体不能为空" }, { status: 400 });
    }
    if (body.baseUrl && typeof body.baseUrl !== "string") {
      return Response.json({ error: "参数格式错误" }, { status: 400 });
    }

    const updatedAt = await saveAISettings(auth.userId, {
      baseUrl: typeof body.baseUrl === "string" ? body.baseUrl : "",
      apiKey: typeof body.apiKey === "string" ? body.apiKey : "",
      model: typeof body.model === "string" ? body.model : "",
      visionModel: typeof body.visionModel === "string" ? body.visionModel : "",
      deepThinking: body.deepThinking === true,
    });
    return Response.json({ ok: true, updatedAt });
  } catch (e) {
    return Response.json(
      { error: (e as Error).message || "保存 AI 设置失败" },
      { status: 500 }
    );
  }
}
