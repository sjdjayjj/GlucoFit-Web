import { assertSafeUpstreamUrl, upstreamFetchJson } from "@/lib/upstream-fetch";

/**
 * AI 请求代理：由前端转发用户配置的 OpenAI 兼容接口，
 * 规避浏览器 CORS 限制，服务器不留存任何用户凭证。
 * 上游请求自动探测系统代理，见 lib/upstream-fetch.ts。
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const { baseUrl, apiKey, model, messages, temperature, maxTokens, deepThinking } =
      body ?? {};
    if (!baseUrl || !apiKey || !model || !Array.isArray(messages)) {
      return Response.json(
        { error: "缺少必要参数（baseUrl / apiKey / model / messages）" },
        { status: 400 }
      );
    }

    let url = String(baseUrl).replace(/\/+$/, "");
    if (!/\/chat\/completions$/.test(url)) url += "/chat/completions";
    try {
      assertSafeUpstreamUrl(url);
    } catch (e) {
      return Response.json({ error: (e as Error).message }, { status: 400 });
    }

    const payload = JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      // 仅在用户开启深度思考时附加，避免不支持的供应商拒绝未知参数
      ...(deepThinking === true ? { enable_thinking: true } : {}),
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
      const upstream = (data ?? {}) as {
        error?: { message?: string; status?: string; code?: number | string };
        message?: string;
      };
      // 兼容各家错误体形状（OpenAI / Google / 中转站），深度扫描兜底
      const raw = JSON.stringify(data ?? {});
      const upstreamMsg = upstream.error?.message || upstream.message || "";
      // 识别配额/限流：Google 风格 RESOURCE_EXHAUSTED、OpenAI 风格 429/quota
      const isQuota =
        res.status === 429 ||
        upstream.error?.status === "RESOURCE_EXHAUSTED" ||
        /RESOURCE_EXHAUSTED|insufficient_quota|quota\s?(exceeded|exhausted)|rate.?limit/i.test(
          raw
        );
      const msg = isQuota
        ? "今日配额用尽：当前模型/服务商的额度已耗尽，请更换模型或服务商，或明日再试"
        : upstreamMsg || `上游服务返回 ${res.status}`;
      return Response.json({ error: msg }, { status: isQuota ? 429 : 502 });
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
