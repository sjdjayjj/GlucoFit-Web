import { upstreamFetchJson } from "@/lib/upstream-fetch";

/**
 * AI 请求代理：由前端转发用户配置的 OpenAI 兼容接口，
 * 规避浏览器 CORS 限制，服务器不留存任何用户凭证。
 * 上游请求自动探测系统代理，见 lib/upstream-fetch.ts。
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const { baseUrl, apiKey, model, messages, temperature, maxTokens } =
      body ?? {};
    if (!baseUrl || !apiKey || !model || !Array.isArray(messages)) {
      return Response.json(
        { error: "缺少必要参数（baseUrl / apiKey / model / messages）" },
        { status: 400 }
      );
    }

    let url = String(baseUrl).replace(/\/+$/, "");
    if (!/\/chat\/completions$/.test(url)) url += "/chat/completions";

    const payload = JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    });

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
      const msg =
        data?.error?.message || data?.message || `上游服务返回 ${res.status}`;
      return Response.json({ error: msg }, { status: 502 });
    }

    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      return Response.json({ error: "上游响应格式异常" }, { status: 502 });
    }
    return Response.json({ content });
  } catch (e) {
    const err = e as { name?: string; message?: string; cause?: { code?: string } };
    let msg =
      err?.name === "TimeoutError"
        ? "AI 请求超时，请重试或更换模型"
        : err?.message || "AI 代理请求失败";
    if (err?.cause?.code) {
      msg += `（${err.cause.code}）`;
    }
    return Response.json({ error: msg }, { status: 500 });
  }
}
