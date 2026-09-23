/**
 * 认证工具 (v2.2，仅服务端使用)：
 * - 密码：PBKDF2-SHA256 (Web Crypto，Node 与 Edge 运行时通用)
 * - 会话：HS256 JWT，写入 HttpOnly Cookie
 * - JWT_SECRET 必须由部署环境注入
 */

export const SESSION_COOKIE = "gf_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 天

const PBKDF2_ITERATIONS = 120_000;

// ---------- Base64URL ----------

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(s: string): Uint8Array<ArrayBuffer> {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function textToBytes(text: string): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(text) as Uint8Array<ArrayBuffer>;
}

// ---------- 密码哈希 ----------

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey(
    "raw",
    textToBytes(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    key,
    256
  );
  return `pbkdf2$${PBKDF2_ITERATIONS}$${bytesToBase64Url(salt)}$${bytesToBase64Url(new Uint8Array(bits))}`;
}

export async function verifyPassword(
  password: string,
  stored: string
): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iterations = Number(parts[1]);
  const salt = base64UrlToBytes(parts[2]);
  const expected = base64UrlToBytes(parts[3]);
  const key = await crypto.subtle.importKey(
    "raw",
    textToBytes(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    key,
    expected.length * 8
  );
  const actual = new Uint8Array(bits);
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
  return diff === 0;
}

// ---------- JWT (HS256) ----------

export interface SessionPayload {
  sub: string; // user id
  email: string;
  exp: number;
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("服务器未配置 JWT_SECRET 环境变量，无法签发会话");
  }
  return secret;
}

async function hmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    textToBytes(getJwtSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export async function signSession(payload: {
  sub: string;
  email: string;
}): Promise<string> {
  const header = bytesToBase64Url(textToBytes(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const body = bytesToBase64Url(
    textToBytes(JSON.stringify({ sub: payload.sub, email: payload.email, exp }))
  );
  const data = `${header}.${body}`;
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(), textToBytes(data));
  return `${data}.${bytesToBase64Url(new Uint8Array(sig))}`;
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const key = await hmacKey();
  const ok = await crypto.subtle.verify(
    "HMAC",
    key,
    base64UrlToBytes(parts[2]),
    textToBytes(`${parts[0]}.${parts[1]}`)
  );
  if (!ok) return null;
  try {
    const payload = JSON.parse(
      new TextDecoder().decode(base64UrlToBytes(parts[1]))
    ) as SessionPayload;
    if (!payload.sub || payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

// ---------- Cookie ----------

export function sessionCookieHeader(token: string): string {
  const secure = process.env.NODE_ENV === "production" ? " Secure;" : "";
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax;${secure} Max-Age=${SESSION_TTL_SECONDS}`;
}

export function clearSessionCookieHeader(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

/** 从请求中解析并校验会话，未登录返回 null */
export async function getSessionPayload(req: Request): Promise<SessionPayload | null> {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const match = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${SESSION_COOKIE}=`));
  if (!match) return null;
  return verifySession(match.slice(SESSION_COOKIE.length + 1));
}

/** 业务路由统一鉴权守卫，未登录返回 401 响应 */
export async function requireSession(
  req: Request
): Promise<{ userId: string; email: string } | { error: Response }> {
  const payload = await getSessionPayload(req);
  if (!payload) {
    return {
      error: Response.json({ error: "未登录或会话已过期" }, { status: 401 }),
    };
  }
  return { userId: payload.sub, email: payload.email };
}
