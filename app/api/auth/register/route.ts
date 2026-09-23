import {
  hashPassword,
  sessionCookieHeader,
  signSession,
} from "@/lib/auth";
import { d1Query, ensureSchema } from "@/lib/db";

/** 用户注册：邮箱 + 密码，成功后签发 HttpOnly 会话 Cookie */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as {
      email?: string;
      password?: string;
    } | null;
    const email = body?.email?.trim().toLowerCase() ?? "";
    const password = body?.password ?? "";

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ error: "请输入有效的邮箱地址" }, { status: 400 });
    }
    if (password.length < 6) {
      return Response.json({ error: "密码长度至少 6 位" }, { status: 400 });
    }

    await ensureSchema();

    const existing = await d1Query("SELECT id FROM users WHERE email = ?", [email]);
    if (existing?.[0]?.results?.length) {
      return Response.json({ error: "该邮箱已注册，请直接登录" }, { status: 409 });
    }

    const userId = crypto.randomUUID();
    const passwordHash = await hashPassword(password);
    // 0 占位兼容 v2.1 旧表结构（height_cm / initial_weight_kg / target_weight_kg 曾为 NOT NULL）
    await d1Query(
      "INSERT INTO users (id, email, password_hash, height_cm, initial_weight_kg, target_weight_kg, created_at) VALUES (?, ?, ?, 0, 0, 0, ?)",
      [userId, email, passwordHash, new Date().toISOString()]
    );

    const token = await signSession({ sub: userId, email });
    return Response.json(
      { user: { id: userId, email } },
      { headers: { "Set-Cookie": sessionCookieHeader(token) } }
    );
  } catch (e) {
    return Response.json(
      { error: (e as Error).message || "注册失败" },
      { status: 500 }
    );
  }
}
