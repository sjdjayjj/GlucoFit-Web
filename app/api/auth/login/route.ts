import {
  sessionCookieHeader,
  signSession,
  verifyPassword,
} from "@/lib/auth";
import { d1Query, ensureSchema } from "@/lib/db";

/** 用户登录：校验邮箱密码，签发 HttpOnly 会话 Cookie */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as {
      email?: string;
      password?: string;
    } | null;
    const email = body?.email?.trim().toLowerCase() ?? "";
    const password = body?.password ?? "";
    if (!email || !password) {
      return Response.json({ error: "请输入邮箱与密码" }, { status: 400 });
    }

    await ensureSchema();

    const res = await d1Query(
      "SELECT id, email, password_hash FROM users WHERE email = ?",
      [email]
    );
    const row = res?.[0]?.results?.[0] as
      | { id: string; email: string; password_hash: string }
      | undefined;
    if (!row?.password_hash) {
      return Response.json({ error: "邮箱或密码不正确" }, { status: 401 });
    }

    const ok = await verifyPassword(password, row.password_hash);
    if (!ok) {
      return Response.json({ error: "邮箱或密码不正确" }, { status: 401 });
    }

    const token = await signSession({ sub: row.id, email: row.email });
    return Response.json(
      { user: { id: row.id, email: row.email } },
      { headers: { "Set-Cookie": sessionCookieHeader(token) } }
    );
  } catch (e) {
    return Response.json(
      { error: (e as Error).message || "登录失败" },
      { status: 500 }
    );
  }
}
