import { execSync } from "child_process";

/**
 * AI 请求代理：由前端转发用户配置的 OpenAI 兼容接口，
 * 规避浏览器 CORS 限制，服务器不留存任何用户凭证。
 * 上游请求自动探测系统代理（环境变量或 Windows WinINET 设置），
 * 解决 Node fetch 不走系统代理导致的网络不通问题。
 */

let cachedProxy: string | null | undefined;

function detectUpstreamProxy(): string | null {
  if (cachedProxy !== undefined) return cachedProxy;
  cachedProxy =
    process.env.HTTPS_PROXY ||
    process.env.https_proxy ||
    process.env.HTTP_PROXY ||
    process.env.http_proxy ||
    null;

  // Windows 下读取 WinINET 系统代理设置
  // 注意：即使 ProxyEnable 当前为 0，若用户曾设置过 ProxyServer，
  // 仍然尝试使用（很多代理工具切换开关时不会清空 ProxyServer 值）
  if (!cachedProxy && process.platform === "win32") {
    try {
      const base =
        "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings";
      const serverOut = execSync(`reg query "${base}" /v ProxyServer`, {
        encoding: "utf8",
        timeout: 3000,
      });
      const m = serverOut.match(/ProxyServer\s+REG_SZ\s+(\S+)/);
      if (m) cachedProxy = m[1];
    } catch {
      cachedProxy = null;
    }
  }

  if (cachedProxy && !/^https?:\/\//.test(cachedProxy)) {
    cachedProxy = `http://${cachedProxy}`;
  }
  return cachedProxy;
}

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

    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    };
    const payload = JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    });
    const signal = AbortSignal.timeout(120_000);

    let res: { ok: boolean; status: number; json: () => Promise<unknown> };
    const proxy = detectUpstreamProxy();
    if (proxy) {
      const { fetch: undiciFetch, ProxyAgent } = await import("undici");
      const data = await undiciFetch(url, {
        method: "POST",
        headers,
        body: payload,
        signal,
        dispatcher: new ProxyAgent(proxy),
      });
      res = { ok: data.ok, status: data.status, json: () => data.json() };
    } else {
      const data = await fetch(url, {
        method: "POST",
        headers,
        body: payload,
        signal,
        cache: "no-store",
      });
      res = { ok: data.ok, status: data.status, json: () => data.json() };
    }

    const data = (await res.json().catch(() => null)) as {
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
