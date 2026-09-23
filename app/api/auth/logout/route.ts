import { clearSessionCookieHeader } from "@/lib/auth";

/** 退出登录：清除会话 Cookie */
export async function POST() {
  return Response.json(
    { ok: true },
    { headers: { "Set-Cookie": clearSessionCookieHeader() } }
  );
}
