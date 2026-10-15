import { execSync } from "child_process";

/**
 * 服务端上游请求工具：自动探测系统代理（环境变量或 Windows WinINET 设置），
 * 解决 Node fetch 不走系统代理导致的网络不通问题。
 * 供 /api/ai（OpenAI 兼容接口）与 /api/sync（Cloudflare D1 REST API）共用。
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

export interface UpstreamJsonResult {
  ok: boolean;
  status: number;
  data: unknown;
}

/** SSRF 防护：仅允许公网 http(s) 地址，拦截内网/环回/链路本地目标 */
export function assertSafeUpstreamUrl(raw: string): void {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error("上游地址格式无效");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error("上游地址仅支持 http(s) 协议");
  }
  // WHATWG URL 对 IPv6 字面量保留方括号
  const host = u.hostname.toLowerCase();
  const isV6 = host.includes(":");
  const v6 = host.replace(/^\[|\]$/g, "");
  const blocked =
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    (isV6 &&
      (v6 === "::1" ||
        v6 === "::" ||
        /^f[cd]/.test(v6) || // IPv6 ULA
        /^fe[89ab]/.test(v6))) || // IPv6 链路本地
    (!isV6 &&
      (/^127\./.test(host) ||
        /^10\./.test(host) ||
        /^192\.168\./.test(host) ||
        /^169\.254\./.test(host) ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
        host.startsWith("0.")));
  if (blocked) {
    throw new Error("出于安全考虑，不允许访问内网或本机地址");
  }
}

/** 发起上游 JSON 请求（自动经系统代理），返回解析后的 JSON */
export async function upstreamFetchJson(
  url: string,
  init: { method?: string; headers?: Record<string, string>; body?: string; timeoutMs?: number }
): Promise<UpstreamJsonResult> {
  const headers = {
    "Content-Type": "application/json",
    ...(init.headers ?? {}),
  };
  const signal = AbortSignal.timeout(init.timeoutMs ?? 120_000);

  const proxy = detectUpstreamProxy();
  let res: { ok: boolean; status: number; json: () => Promise<unknown> };
  if (proxy) {
    const { fetch: undiciFetch, ProxyAgent } = await import("undici");
    const data = await undiciFetch(url, {
      method: init.method ?? "GET",
      headers,
      body: init.body,
      signal,
      dispatcher: new ProxyAgent(proxy),
    });
    res = { ok: data.ok, status: data.status, json: () => data.json() };
  } else {
    const data = await fetch(url, {
      method: init.method ?? "GET",
      headers,
      body: init.body,
      signal,
      cache: "no-store",
    });
    res = { ok: data.ok, status: data.status, json: () => data.json() };
  }

  const data = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, data };
}
