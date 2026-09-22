"use client";

import { create } from "zustand";
import type {
  BodyCompositionRecord,
  ExerciseLog,
  MealLog,
  SyncSettings,
  UserProfile,
} from "@/types";
import {
  useGlucoFitStore,
  useSyncSettingsStore,
} from "@/lib/storage";
import { useProfileStore } from "@/lib/profile";

/**
 * 云同步客户端 (v2.1)：
 * 流程 = 拉取（云端 → 本地按 id/时间新者胜合并）→ 推送（合并后全量上行）。
 * 图片字段不同步（D1 行限制），图片仍仅存本地。
 */

interface PullResult {
  profile: UserProfile | null;
  bodyRecords: BodyCompositionRecord[];
  mealLogs: MealLog[];
  exerciseLogs: ExerciseLog[];
}

/** 同步运行时状态（非持久化）：供顶栏按钮与设置面板反馈 */
interface SyncRuntimeState {
  syncing: boolean;
  lastError: string | null;
  lastSuccessAt: string | null;
  setSyncing: (v: boolean) => void;
  setLastError: (msg: string | null) => void;
}

export const useSyncRuntimeStore = create<SyncRuntimeState>()((set) => ({
  syncing: false,
  lastError: null,
  lastSuccessAt: null,
  setSyncing: (syncing) => set({ syncing }),
  setLastError: (lastError) => set({ lastError }),
}));

export function isSyncConfigured(s: SyncSettings): boolean {
  return Boolean(s.accountId && s.databaseId && s.apiToken && s.syncCode);
}

async function callSync<T = unknown>(
  action: "ping" | "init" | "pull" | "push",
  settings: SyncSettings,
  extra?: { syncCode?: string; payload?: unknown }
): Promise<T> {
  const res = await fetch("/api/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, settings, ...extra }),
  });
  const data = (await res.json().catch(() => null)) as
    | { ok: true; data?: T }
    | { ok: false; error: string }
    | null;
  if (!res.ok || !data?.ok) {
    throw new Error(
      (data as { error?: string })?.error || `同步服务返回 ${res.status}`
    );
  }
  return (data as { data?: T }).data as T;
}

/** 凭据连通性测试 */
export async function testSyncConnection(settings: SyncSettings): Promise<string> {
  await callSync("ping", settings);
  return "连接成功";
}

/** 初始化云端表结构（CREATE TABLE IF NOT EXISTS，可重复执行） */
export async function initCloudSchema(settings: SyncSettings): Promise<void> {
  await callSync("init", settings);
}

/** 完整双向同步：pull → merge → push */
export async function syncAll(): Promise<void> {
  const runtime = useSyncRuntimeStore.getState();
  const { syncSettings } = useSyncSettingsStore.getState();
  if (!isSyncConfigured(syncSettings)) {
    throw new Error("请先在设置中完成云端同步配置（含同步码）");
  }

  runtime.setSyncing(true);
  runtime.setLastError(null);
  try {
    // 1. 拉取云端数据
    const cloud = await callSync<PullResult>("pull", syncSettings, {
      syncCode: syncSettings.syncCode,
    });

    // 2. 合并档案：云端较新或本地缺失时采用云端
    const localProfile = useProfileStore.getState().profile;
    if (cloud.profile && (!localProfile || cloud.profile.updatedAt > localProfile.updatedAt)) {
      useProfileStore.getState().saveProfile(cloud.profile);
    }

    // 3. 合并三类记录（id 去重、时间新者胜）
    useGlucoFitStore.getState().mergeCloudData({
      bodyRecords: cloud.bodyRecords,
      mealLogs: cloud.mealLogs,
      exerciseLogs: cloud.exerciseLogs,
    });

    // 4. 推送合并后的全量数据（剥离图片字段，云端 image_url 留空）
    const state = useGlucoFitStore.getState();
    const latestProfile = useProfileStore.getState().profile;
    await callSync("push", syncSettings, {
      syncCode: syncSettings.syncCode,
      payload: {
        profile: latestProfile
          ? { ...latestProfile, uid: syncSettings.syncCode }
          : undefined,
        bodyRecords: state.bodyRecords.map(({ imageUrl: _img, ...r }) => r),
        mealLogs: state.mealLogs.map(({ imageUrl: _img, ...l }) => l),
        exerciseLogs: state.exerciseLogs.map((l) => ({
          ...l,
          userId: syncSettings.syncCode,
        })),
      },
    });

    const now = new Date().toISOString();
    useSyncSettingsStore.getState().setLastSyncAt(now);
    runtime.setSyncing(false);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "同步失败";
    runtime.setLastError(msg);
    runtime.setSyncing(false);
    throw e;
  }
}
