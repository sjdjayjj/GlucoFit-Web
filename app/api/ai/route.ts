import { requireSession } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { assertSafeUpstreamUrl, upstreamFetchJson } from "@/lib/upstream-fetch";

/**
 * AI 请求代理：由前端转发用户配置的 OpenAI 兼容接口，
 * 规避浏览器 CORS 限制，服务器不留存任何用户凭证。
 *
 * 安全边界（P2-10）：
 * - 必须登录（HttpOnly 会话 Cookie），未登录 401
 * - 请求体上限 8MB，超限 413
 * - 按用户内存限流（单实例有效；多实例部署需换 Redis / D1 等共享计数）
 * - SSRF：拦截私网/环回/链路本地，含 IPv4-mapped IPv6 与域名解析结果
 * - 不打印 apiKey，不向前端回传上游错误详情
 */

export const runtime = "nodejs";

const MAX_BODY_BYTES = 8 * 1024 * 1024;
const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;

interface AiRequestBody {
  baseUrl?: unknown;
  apiKey?: unknown;
  model?: unknown;
  messages?: unknown;
  temperature?: unknown;
  maxTokens?: unknown;
  deepThinking?: unknown;
}

export async function POST(req: Request) {
  const auth = await requireSession(req);
  if ("error" in auth) return auth.error;

  if (!rateLimit(`ai:${auth.userId}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS)) {
    return Response.json(
      { error: "请求过于频繁，请稍后再试" },
      {
        status: 429,
        headers: { "Retry-After": String(RATE_LIMIT_WINDOW_MS / 1000) },
      }
    );
  }

  // 先看声明长度，避免把超大请求体读进内存
  const declared = Number(req.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return Response.json({ error: "请求体过大（上限 8MB）" }, { status: 413 });
  }

  let buf: ArrayBuffer;
  try {
    buf = await req.arrayBuffer();
  } catch {
    return Response.json({ error: "请求体读取失败" }, { status: 400 });
  }
  // 部分客户端不带 Content-Length，按实际字节数二次校验
  if (buf.byteLength > MAX_BODY_BYTES) {
    return Response.json({ error: "请求体过大（上限 8MB）" }, { status: 413 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(buf));
  } catch {
    return Response.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }
  const body: AiRequestBody =
    parsed && typeof parsed === "object" ? (parsed as AiRequestBody) : {};

  const baseUrl = typeof body.baseUrl === "string" ? body.baseUrl : "";
  const apiKey = typeof body.apiKey === "string" ? body.apiKey : "";
  const model = typeof body.model === "string" ? body.model : "";
  const messages = Array.isArray(body.messages) ? body.messages : null;
  if (!baseUrl || !apiKey || !model || !messages) {
    return Response.json(
      { error: "缺少必要参数（baseUrl / apiKey / model / messages）" },
      { status: 400 }
    );
  }

  let url = baseUrl.replace(/\/+$/, "");
  if (!/\/chat\/completions$/.test(url)) url += "/chat/completions";
  try {
    await assertSafeUpstreamUrl(url);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 403 });
  }

  const payload = JSON.stringify({
    model,
    messages,
    temperature: body.temperature,
    max_tokens: body.maxTokens,
    // 仅在用户开启深度思考时附加，避免不支持的供应商拒绝未知参数
    ...(body.deepThinking === true ? { enable_thinking: true } : {}),
  });

  try {
    const res = await upstreamFetchJson(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: payload,
      timeoutMs: 120_000,
    });

    const data = res.data as {
      choices?: Array<{ message?: { content?: unknown } }>;
      error?: { message?: string };
      message?: string;
    } | null;

    if (!res.ok) {
      // 仅用于本地判定配额，不回传给前端，避免泄露上游响应细节
      const raw = JSON.stringify(data ?? {});
      const isQuota =
        res.status === 429 ||
        /RESOURCE_EXHAUSTED|insufficient_quota|quota\s?(exceeded|exhausted)|rate.?limit/i.test(
          raw
        );
      return Response.json(
        {
          error: isQuota
            ? "今日配额用尽：当前模型/服务商的额度已耗尽，请更换模型或服务商，或明日再试"
            : "AI 服务暂时不可用，请稍后重试或更换模型",
        },
        { status: isQuota ? 429 : 502 }
      );
    }

    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      return Response.json({ error: "上游响应格式异常" }, { status: 502 });
    }
    return Response.json({ content });
  } catch (e) {
    const err = e as { name?: string };
    return Response.json(
      {
        error:
          err?.name === "TimeoutError"
            ? "AI 请求超时，请重试或更换模型"
            : "AI 代理请求失败，请稍后重试",
      },
      { status: 500 }
    );
  }
}
