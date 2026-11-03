import { execSync } from "child_process";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

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

/** IPv4 点分十进制 → 32 位无符号整数；非法返回 null */
function ipv4ToLong(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const n = Number(part);
    if (n > 255) return null;
    value = value * 256 + n;
  }
  return value;
}

/** 私网 / 环回 / 链路本地 / 组播 / 保留网段（含 CGNAT、TEST-NET） */
const BLOCKED_V4_RANGES: Array<[min: number, max: number]> = [
  [0x00000000, 0x00ffffff], // 0.0.0.0/8
  [0x0a000000, 0x0affffff], // 10.0.0.0/8
  [0x64400000, 0x647fffff], // 100.64.0.0/10 CGNAT
  [0x7f000000, 0x7fffffff], // 127.0.0.0/8 环回
  [0xa9fe0000, 0xa9feffff], // 169.254.0.0/16 链路本地
  [0xac100000, 0xac1fffff], // 172.16.0.0/12
  [0xc0000000, 0xc00000ff], // 192.0.0.0/24
  [0xc0000200, 0xc00002ff], // 192.0.2.0/24 TEST-NET-1
  [0xc0a80000, 0xc0a8ffff], // 192.168.0.0/16
  [0xc6120000, 0xc613ffff], // 198.18.0.0/15 基准测试
  [0xc6336400, 0xc63364ff], // 198.51.100.0/24 TEST-NET-2
  [0xcb007100, 0xcb0071ff], // 203.0.113.0/24 TEST-NET-3
  [0xe0000000, 0xefffffff], // 224.0.0.0/4 组播
  [0xf0000000, 0xffffffff], // 240.0.0.0/4 保留
];

function isBlockedV4Long(value: number): boolean {
  return BLOCKED_V4_RANGES.some(([min, max]) => value >= min && value <= max);
}

function isBlockedV4(ip: string): boolean {
  const value = ipv4ToLong(ip);
  // 解析失败按不安全处理
  return value == null ? true : isBlockedV4Long(value);
}

/** IPv6 → 8 组 16 位整数；支持 :: 压缩与末尾点分 IPv4 */
function parseV6Hextets(raw: string): number[] | null {
  const s = raw.split("%")[0]; // 去掉 zone id
  const sections = s.split("::");
  if (sections.length > 2) return null;
  const parseGroups = (str: string | undefined): number[] | null => {
    if (!str) return [];
    const out: number[] = [];
    for (const g of str.split(":")) {
      if (g.includes(".")) {
        const v4 = ipv4ToLong(g);
        if (v4 == null) return null;
        out.push(Math.floor(v4 / 65536), v4 % 65536);
        continue;
      }
      if (!/^[0-9a-f]{1,4}$/.test(g)) return null;
      out.push(parseInt(g, 16));
    }
    return out;
  };
  const head = parseGroups(sections[0]);
  const tail = parseGroups(sections[1]);
  if (!head || !tail) return null;
  if (sections.length === 2) {
    const missing = 8 - head.length - tail.length;
    if (missing < 0) return null;
    return [...head, ...new Array<number>(missing).fill(0), ...tail];
  }
  return head.length === 8 ? head : null;
}

/** 拦截环回/未指定/ULA/链路本地/站点本地，以及 IPv4-mapped（::ffff:127.0.0.1）等内嵌 IPv4 形式 */
function isBlockedV6(ip: string): boolean {
  const g = parseV6Hextets(ip);
  if (!g) return true;
  const g0 = g[0];
  // :: 与 ::1
  if (g.every((v) => v === 0)) return true;
  if (g.slice(0, 7).every((v) => v === 0) && g[7] === 1) return true;
  // IPv4-mapped ::ffff:a.b.c.d 与 IPv4-compatible ::a.b.c.d（含十六进制写法）
  const v4Long = ((g[6] << 16) | g[7]) >>> 0;
  if (g.slice(0, 5).every((v) => v === 0) && g[5] === 0xffff) {
    return isBlockedV4Long(v4Long);
  }
  if (g.slice(0, 6).every((v) => v === 0)) return isBlockedV4Long(v4Long);
  // fc00::/7 ULA
  if (g0 >= 0xfc00 && g0 <= 0xfdff) return true;
  // fe80::/10 链路本地
  if (g0 >= 0xfe80 && g0 <= 0xfebf) return true;
  // fec0::/10 站点本地（已废弃但仍可能被路由）
  if (g0 >= 0xfec0 && g0 <= 0xfeff) return true;
  return false;
}

/**
 * SSRF 防护：仅允许公网 http(s) 地址。
 * - 拦截私网/环回/链路本地/组播，包含 IPv4-mapped IPv6（如 ::ffff:127.0.0.1）
 * - 域名先做 DNS 解析，再校验每一条解析结果，防 DNS rebinding 指向内网
 * - 残留风险：解析与真正发起请求之间仍有 TOCTOU 窗口；彻底修复需固定 IP 直连并处理代理/TLS SNI，
 *   当前经系统代理访问上游，无法在不破坏代理的前提下做到，故此处为尽力而为的边界校验
 */
export async function assertSafeUpstreamUrl(raw: string): Promise<void> {
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
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".home.arpa")
  ) {
    throw new Error("出于安全考虑，不允许访问内网或本机地址");
  }

  // 1) 字面量 IP：直接校验（覆盖 IPv4-mapped IPv6 等绕过写法）
  const literal = host.replace(/^\[|\]$/g, "");
  const family = isIP(literal);
  if (family === 4) {
    if (isBlockedV4(literal)) throw new Error("出于安全考虑，不允许访问内网或本机地址");
    return;
  }
  if (family === 6) {
    if (isBlockedV6(literal)) throw new Error("出于安全考虑，不允许访问内网或本机地址");
    return;
  }

  // 2) 域名：解析后逐条校验，拒绝任一解析到内网的结果
  let resolved: Array<{ address: string }>;
  try {
    resolved = await lookup(host, { all: true, verbatim: true });
  } catch {
    throw new Error("上游域名无法解析");
  }
  if (!resolved.length) throw new Error("上游域名无法解析");
  for (const { address } of resolved) {
    const fam = isIP(address);
    if (fam === 0 || (fam === 4 ? isBlockedV4(address) : isBlockedV6(address))) {
      throw new Error("出于安全考虑，不允许访问内网或本机地址");
    }
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
