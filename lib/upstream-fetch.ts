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
