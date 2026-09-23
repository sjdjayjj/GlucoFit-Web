"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  BodyCompositionRecord,
  ExerciseLog,
  MealLog,
  UserProfile,
} from "@/types";
import { useGlucoFitStore } from "@/lib/storage";
import { useProfileStore } from "@/lib/profile";
import { useAuthStore } from "@/lib/auth-store";

/**
 * 云同步客户端 (v2.2，中心化托管)：
 * 会话经 HttpOnly Cookie 鉴权，无需任何用户配置。
 * 流程 = 拉取（云端 → 本地按 id/时间新者胜合并）→ 推送（合并后全量上行）。
 * 图片字段不同步（D1 行限制），图片仍仅存本地。
 */

// ---------- 同步元信息（上次同步时间） ----------

interface SyncMetaState {
  lastSyncAt: string | null;
  setLastSyncAt: (iso: string) => void;
}

export const useSyncMetaStore = create<SyncMetaState>()(
  persist(
    (set) => ({
      lastSyncAt: null,
      setLastSyncAt: (lastSyncAt) => set({ lastSyncAt }),
    }),
    { name: "glucofit-sync-meta" }
  )
);

// ---------- 同步运行时状态（非持久化）：供按钮反馈 ----------

interface SyncRuntimeState {
  syncing: boolean;
  lastError: string | null;
  setSyncing: (v: boolean) => void;
  setLastError: (msg: string | null) => void;
}

export const useSyncRuntimeStore = create<SyncRuntimeState>()((set) => ({
  syncing: false,
  lastError: null,
  setSyncing: (syncing) => set({ syncing }),
  setLastError: (lastError) => set({ lastError }),
}));

// ---------- 服务端请求 ----------

function extractError(data: unknown, fallback: string): string {
  return (data as { error?: string })?.error || fallback;
}

async function listRecords<T>(
  kind: "body" | "meal" | "exercise"
): Promise<T[]> {
  const res = await fetch(`/api/records/${kind}`, { cache: "no-store" });
  const data = (await res.json().catch(() => null)) as
    | { records?: T[] }
    | { error: string }
    | null;
  if (!res.ok) throw new Error(extractError(data, `读取记录失败 (${res.status})`));
  return (data as { records?: T[] }).records ?? [];
}

async function pushRecords<T>(
  kind: "body" | "meal" | "exercise",
  records: T[]
): Promise<void> {
  const res = await fetch(`/api/records/${kind}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ records }),
  });
  const data = (await res.json().catch(() => null)) as
    | { ok?: boolean }
    | { error: string }
    | null;
  if (!res.ok) throw new Error(extractError(data, `上传记录失败 (${res.status})`));
}

async function pushProfile(profile: UserProfile): Promise<void> {
  const res = await fetch("/api/profile", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(profile),
  });
  const data = (await res.json().catch(() => null)) as
    | { ok?: boolean }
    | { error: string }
    | null;
  if (!res.ok) throw new Error(extractError(data, "上传档案失败"));
}

/**
 * 完整双向同步：pull → merge → push（需已登录，Cookie 自动携带）。
 * 同时承担「本地离线数据一键合并至云端」的迁移职责。
 */
export async function syncAll(): Promise<void> {
  const runtime = useSyncRuntimeStore.getState();
  if (!useAuthStore.getState().user) {
    throw new Error("请先登录后再同步数据");
  }

  runtime.setSyncing(true);
  runtime.setLastError(null);
  try {
    // 1. 拉取云端数据（档案随 /api/auth/me 返回）
    const [meRes, bodyRecords, mealLogs, exerciseLogs] = await Promise.all([
      fetch("/api/auth/me", { cache: "no-store" }),
      listRecords<BodyCompositionRecord>("body"),
      listRecords<MealLog>("meal"),
      listRecords<ExerciseLog>("exercise"),
    ]);
    if (!meRes.ok) throw new Error("会话已过期，请重新登录");
    const cloudProfile =
      ((await meRes.json().catch(() => null)) as { profile?: UserProfile | null })
        ?.profile ?? null;

    // 2. 合并档案：云端较新或本地缺失时采用云端
    const localProfile = useProfileStore.getState().profile;
    if (cloudProfile && (!localProfile || cloudProfile.updatedAt > localProfile.updatedAt)) {
      useProfileStore.getState().saveProfile(cloudProfile);
    }

    // 3. 合并三类记录（id 去重、时间新者胜）
    useGlucoFitStore.getState().mergeCloudData({
      bodyRecords,
      mealLogs,
      exerciseLogs,
    });

    // 4. 推送合并后的全量数据（剥离图片字段，云端 image_url 留空）
    const state = useGlucoFitStore.getState();
    const latestProfile = useProfileStore.getState().profile;
    await Promise.all([
      latestProfile ? pushProfile(latestProfile) : Promise.resolve(),
      pushRecords(
        "body",
        state.bodyRecords.map(({ imageUrl: _img, ...r }) => r)
      ),
      pushRecords(
        "meal",
        state.mealLogs.map(({ imageUrl: _img, ...l }) => l)
      ),
      pushRecords("exercise", state.exerciseLogs),
    ]);

    useSyncMetaStore.getState().setLastSyncAt(new Date().toISOString());
    runtime.setSyncing(false);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "同步失败";
    runtime.setLastError(msg);
    runtime.setSyncing(false);
    throw e;
  }
}
