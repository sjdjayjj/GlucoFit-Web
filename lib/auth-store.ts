"use client";

import { create } from "zustand";
import type { AuthUser, UserProfile } from "@/types";

/**
 * 登录状态 (v2.2，中心化托管)：
 * 会话由 HttpOnly Cookie 承载，前端仅维护用户展示态。
 * 未登录 = 游客模式（纯 LocalStorage 运行）。
 */

interface AuthState {
  user: AuthUser | null;
  /** 启动时会话探测中 */
  checking: boolean;
  refresh: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** 登录后拉取云端档案（供档案合并） */
  fetchCloudProfile: () => Promise<UserProfile | null>;
}

async function authRequest(
  path: "login" | "register",
  email: string,
  password: string
): Promise<AuthUser> {
  const res = await fetch(`/api/auth/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = (await res.json().catch(() => null)) as
    | { user?: AuthUser; error?: string }
    | null;
  if (!res.ok || !data?.user) {
    throw new Error(data?.error || "请求失败");
  }
  return data.user;
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  checking: true,

  refresh: async () => {
    set({ checking: true });
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const data = (await res.json().catch(() => null)) as {
        user?: AuthUser;
      } | null;
      set({ user: res.ok && data?.user ? data.user : null });
    } catch {
      set({ user: null });
    } finally {
      set({ checking: false });
    }
  },

  signIn: async (email, password) => {
    const user = await authRequest("login", email, password);
    set({ user });
  },

  signUp: async (email, password) => {
    const user = await authRequest("register", email, password);
    set({ user });
  },

  signOut: async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    set({ user: null });
  },

  fetchCloudProfile: async () => {
    const res = await fetch("/api/auth/me", { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json().catch(() => null)) as {
      profile?: UserProfile | null;
    } | null;
    return data?.profile ?? null;
  },
}));
