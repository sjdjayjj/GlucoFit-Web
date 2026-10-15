"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  AISettings,
  BodyCompositionRecord,
  ExerciseLog,
  MealLog,
  UserProfile,
} from "@/types";
import { useGlucoFitStore, useAISettingsStore } from "@/lib/storage";
import { useProfileStore } from "@/lib/profile";
import { useAuthStore } from "@/lib/auth-store";

/**
 * 云同步客户端 (v3.1，中心化托管)：
 * 会话经 HttpOnly Cookie 鉴权，无需任何用户配置。
 * 流程 = 拉取（云端 → 本地按 id/时间新者胜合并）→ 推送（合并后全量上行）。
 * 图片字段不同步（D1 行限制），图片仍仅存本地。
 * AI 模型配置（BYOK）按用户存云端：本地为空时采纳云端，否则按 updatedAt 新者胜。
 */

// ---------- 同步元信息（上次同步时间） ----------

interface SyncMetaState {
  lastSyncAt: string | null;
  setLastSyncAt: (iso: string) => void;
  /** 登出时清空，确保下次登录执行一次全量上行 */
  resetLastSyncAt: () => void;
}

export const useSyncMetaStore = create<SyncMetaState>()(
  persist(
    (set) => ({
      lastSyncAt: null,
      setLastSyncAt: (lastSyncAt) => set({ lastSyncAt }),
      resetLastSyncAt: () => set({ lastSyncAt: null }),
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

async function pushAISettings(settings: AISettings): Promise<string | null> {
  const res = await fetch("/api/ai-settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  });
  const data = (await res.json().catch(() => null)) as
    | { ok?: boolean; updatedAt?: string }
    | { error: string }
    | null;
  if (!res.ok) throw new Error(extractError(data, "上传 AI 设置失败"));
  return (data as { updatedAt?: string }).updatedAt ?? null;
}

/** 本地 AI 设置是否从未配置（无任何有效字段） */
function isAISettingsEmpty(s: AISettings): boolean {
  return !s.apiKey && !s.baseUrl && !s.model;
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
    const [meRes, aiRes, bodyRecords, mealLogs, exerciseLogs] = await Promise.all([
      fetch("/api/auth/me", { cache: "no-store" }),
      fetch("/api/ai-settings", { cache: "no-store" }),
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

    // 2.5 合并 AI 模型配置：本地为空采纳云端，否则 updatedAt 新者胜
    const cloudAI =
      ((await aiRes.json().catch(() => null)) as { settings?: AISettings | null })
        ?.settings ?? null;
    const cloudAIUsable =
      cloudAI && !isAISettingsEmpty(cloudAI) ? cloudAI : null;
    const localAI = useAISettingsStore.getState().aiSettings;
    let pushLocalAI = false;
    if (cloudAIUsable) {
      const cloudNewer =
        !isAISettingsEmpty(localAI) &&
        !!cloudAIUsable.updatedAt &&
        (!localAI.updatedAt || cloudAIUsable.updatedAt > localAI.updatedAt);
      if (isAISettingsEmpty(localAI) || cloudNewer) {
        useAISettingsStore.getState().updateAISettings(cloudAIUsable);
      } else if (
        localAI.updatedAt &&
        (!cloudAIUsable.updatedAt || localAI.updatedAt > cloudAIUsable.updatedAt)
      ) {
        pushLocalAI = true;
      }
    } else if (!isAISettingsEmpty(localAI)) {
      pushLocalAI = true;
    }

    // 3. 合并三类记录（id 去重、时间新者胜）
    useGlucoFitStore.getState().mergeCloudData({
      bodyRecords,
      mealLogs,
      exerciseLogs,
    });

    // 4. 推送合并后的数据（剥离图片字段，云端 image_url 留空）。
    //    首次同步（无 lastSyncAt）全量上行；之后仅增量上行本机修改过的记录，节省 D1 配额
    const state = useGlucoFitStore.getState();
    const latestProfile = useProfileStore.getState().profile;
    const fullPush = !useSyncMetaStore.getState().lastSyncAt;
    const pickDirty = <T extends { id: string }>(all: T[], dirty: string[]): T[] =>
      fullPush ? all : all.filter((r) => (dirty ?? []).includes(r.id));
    await Promise.all([
      latestProfile ? pushProfile(latestProfile) : Promise.resolve(),
      pushRecords(
        "body",
        pickDirty(state.bodyRecords, state.dirtyBodyIds ?? []).map(
          ({ imageUrl: _img, ...r }) => r
        )
      ),
      pushRecords(
        "meal",
        pickDirty(state.mealLogs, state.dirtyMealIds ?? []).map(
          ({ imageUrl: _img, ...l }) => l
        )
      ),
      pushRecords(
        "exercise",
        pickDirty(state.exerciseLogs, state.dirtyExerciseIds ?? [])
      ),
    ]);

    // 4.5 本地 AI 配置较新时上行，并将云端 updatedAt 写回本地
    if (pushLocalAI) {
      const aiUpdatedAt = await pushAISettings(localAI);
      if (aiUpdatedAt) {
        useAISettingsStore
          .getState()
          .updateAISettings({ ...localAI, updatedAt: aiUpdatedAt });
      }
    }

    // 5. 云端删除本机已移除的记录（tombstone，餐记录与运动记录），成功后清空待删清单；
    //    失败则保留清单，下次同步重试
    const { pendingDeletedMealIds, clearPendingDeletedMealIds } =
      useGlucoFitStore.getState();
    if (pendingDeletedMealIds?.length) {
      const delRes = await fetch("/api/records/meal", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: pendingDeletedMealIds }),
      });
      if (delRes.ok) clearPendingDeletedMealIds();
    }
    const { pendingDeletedExerciseIds, clearPendingDeletedExerciseIds } =
      useGlucoFitStore.getState();
    if (pendingDeletedExerciseIds?.length) {
      const delRes = await fetch("/api/records/exercise", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: pendingDeletedExerciseIds }),
      });
      if (delRes.ok) clearPendingDeletedExerciseIds();
    }

    // 6. 全部推送成功后清空增量标记
    useGlucoFitStore.getState().clearDirtyIds();
    useSyncMetaStore.getState().setLastSyncAt(new Date().toISOString());
    runtime.setSyncing(false);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "同步失败";
    runtime.setLastError(msg);
    runtime.setSyncing(false);
    throw e;
  }
}
