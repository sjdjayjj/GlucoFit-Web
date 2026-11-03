"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type {
  AISettings,
  BodyCompositionRecord,
  ExerciseLog,
  MealLog,
  UserProfile,
} from "@/types";
import {
  EMPTY_AI_SETTINGS,
  resetLocalStoreForScopeSwitch,
  useGlucoFitStore,
  useAISettingsStore,
} from "@/lib/storage";
import { useProfileStore } from "@/lib/profile";
import { useAuthStore } from "@/lib/auth-store";
import { mergeRecordList } from "@/lib/merge";
import {
  GUEST_SCOPE,
  getActiveScope,
  readScopedPersistJson,
  scopedStorage,
  setActiveScope,
  withStorageWritesSuppressed,
} from "@/lib/persist-scope";

/**
 * 云同步客户端 (v3.2)：
 * 会话经 HttpOnly Cookie 鉴权，无需任何用户配置。
 * 流程 = 拉取（云端 → 本地按 updatedAt 严格比较合并）→ 推送（仅上传本地 dirty / 首次全量）。
 * - 本地 dirty 记录绝不被云端覆盖；合并只采纳版本号严格更大的远端记录。
 * - 图片仅同步缩略图（image_url），原图保留在本机 IndexedDB。
 * - 本地持久化按 userId 命名空间隔离，游客数据独立保留。
 */

// ---------- 同步元信息（上次同步时间，按账号隔离） ----------

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
    {
      name: "glucofit-sync-meta",
      storage: createJSONStorage(() => scopedStorage),
    }
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

// ---------- 账号作用域 ----------

/**
 * 切换持久化作用域（userId / 游客）并重新水合各 store。
 * 返回是否发生了切换。
 */
export async function applyAuthScope(userId: string | null): Promise<boolean> {
  const target = userId ?? GUEST_SCOPE;
  if (getActiveScope() === target) return false;

  setActiveScope(target);
  // 抑制写入，避免默认值覆盖目标作用域已保存的数据
  withStorageWritesSuppressed(() => {
    resetLocalStoreForScopeSwitch();
    useProfileStore.setState({ profile: null, onboardingDismissed: false });
    useSyncMetaStore.setState({ lastSyncAt: null });
    useAISettingsStore.setState({ aiSettings: EMPTY_AI_SETTINGS });
  });
  await Promise.all([
    useGlucoFitStore.persist.rehydrate(),
    useProfileStore.persist.rehydrate(),
    useSyncMetaStore.persist.rehydrate(),
    useAISettingsStore.persist.rehydrate(),
  ]);
  return true;
}

interface PersistedMainState {
  state?: {
    bodyRecords?: BodyCompositionRecord[];
    mealLogs?: MealLog[];
    exerciseLogs?: ExerciseLog[];
  };
}

const isRealRecord = (record: { id?: string } | null | undefined): boolean =>
  typeof record?.id === "string" && !record.id.startsWith("demo-");

/** 游客作用域是否已有真实数据（用于登录时询问合并/仅云端） */
export function hasGuestData(): boolean {
  const persisted = readScopedPersistJson<PersistedMainState>(
    "glucofit-web-storage",
    GUEST_SCOPE
  );
  const state = persisted?.state;
  if (!state) return false;
  return (
    (state.bodyRecords ?? []).some(isRealRecord) ||
    (state.mealLogs ?? []).some(isRealRecord) ||
    (state.exerciseLogs ?? []).some(isRealRecord)
  );
}

/**
 * 把游客作用域的数据并入当前（已切换到用户）作用域，并标记为待上行。
 * 仅能在 applyAuthScope(userId) 之后调用。
 */
export function adoptGuestData(): void {
  const persisted = readScopedPersistJson<PersistedMainState>(
    "glucofit-web-storage",
    GUEST_SCOPE
  );
  const guest = persisted?.state;
  if (!guest) return;

  const guestBody = (guest.bodyRecords ?? []).filter(isRealRecord);
  const guestMeals = (guest.mealLogs ?? []).filter(isRealRecord);
  const guestExercises = (guest.exerciseLogs ?? []).filter(isRealRecord);
  const store = useGlucoFitStore.getState();

  const union = (current: string[] | undefined, extra: string[]): string[] => {
    const ids = new Set(current ?? []);
    for (const id of extra) ids.add(id);
    return Array.from(ids);
  };

  useGlucoFitStore.setState({
    bodyRecords: mergeRecordList(store.bodyRecords, guestBody, {
      dirtyIds: store.dirtyBodyIds,
    }).sort((a, b) => a.date.localeCompare(b.date)),
    mealLogs: mergeRecordList(store.mealLogs, guestMeals, {
      dirtyIds: store.dirtyMealIds,
      tombstoneIds: store.pendingDeletedMealIds,
    }).sort((a, b) => a.timestamp.localeCompare(b.timestamp)),
    exerciseLogs: mergeRecordList(store.exerciseLogs, guestExercises, {
      dirtyIds: store.dirtyExerciseIds,
      tombstoneIds: store.pendingDeletedExerciseIds,
    }).sort((a, b) => a.timestamp.localeCompare(b.timestamp)),
    dirtyBodyIds: union(store.dirtyBodyIds, guestBody.map((r) => r.id)),
    dirtyMealIds: union(store.dirtyMealIds, guestMeals.map((r) => r.id)),
    dirtyExerciseIds: union(
      store.dirtyExerciseIds,
      guestExercises.map((r) => r.id)
    ),
  });

  // 档案：当前账号为空时采纳游客档案
  const guestProfile = readScopedPersistJson<{ state?: { profile?: UserProfile | null } }>(
    "glucofit-profile",
    GUEST_SCOPE
  )?.state?.profile;
  if (guestProfile && !useProfileStore.getState().profile) {
    useProfileStore.getState().saveProfile(guestProfile);
  }
}

// ---------- 服务端请求 ----------

function extractError(data: unknown, fallback: string): string {
  return (data as { error?: string })?.error || fallback;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "未知错误";
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
  // 空列表不发请求（也避免服务端对空数组的历史 400 校验）
  if (records.length === 0) return;
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

/** 云端 image_url 只接收缩略图（避免把原图塞进 D1 行） */
const MAX_CLOUD_IMAGE_LENGTH = 60_000;

function withCloudImage<T extends { imageUrl?: string }>(record: T): T {
  const copy: T = { ...record };
  if (!copy.imageUrl || copy.imageUrl.length > MAX_CLOUD_IMAGE_LENGTH) {
    delete copy.imageUrl;
  }
  return copy;
}

type RecordKind = "body" | "meal" | "exercise";

/**
 * 完整双向同步：pull → merge → push（需已登录，Cookie 自动携带）。
 * 同时承担「本地离线数据一键合并至云端」的迁移职责。
 */
export async function syncAll(): Promise<void> {
  const user = useAuthStore.getState().user;
  if (!user) {
    throw new Error("请先登录后再同步数据");
  }
  // 确保作用域与当前账号一致，避免把游客/上一账号数据上行
  await applyAuthScope(user.id);

  const runtime = useSyncRuntimeStore.getState();
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

    // 3. 合并三类记录：updatedAt 严格比较、本地 dirty 不覆盖、相等本地优先
    useGlucoFitStore.getState().mergeCloudData({
      bodyRecords,
      mealLogs,
      exerciseLogs,
    });

    // 4. 推送：首次同步（无 lastSyncAt）全量；之后仅上行本机修改过的记录
    const state = useGlucoFitStore.getState();
    const latestProfile = useProfileStore.getState().profile;
    const fullPush = !useSyncMetaStore.getState().lastSyncAt;
    const pickDirty = <T extends { id: string }>(all: T[], dirty: string[]): T[] =>
      fullPush ? all : all.filter((r) => (dirty ?? []).includes(r.id));

    const tasks: Array<{
      kind: RecordKind | "profile";
      label: string;
      run: Promise<unknown>;
    }> = [];
    if (latestProfile) {
      tasks.push({ kind: "profile", label: "档案", run: pushProfile(latestProfile) });
    }
    tasks.push({
      kind: "body",
      label: "体成分记录",
      run: pushRecords(
        "body",
        pickDirty(state.bodyRecords, state.dirtyBodyIds ?? []).map(withCloudImage)
      ),
    });
    tasks.push({
      kind: "meal",
      label: "饮食记录",
      run: pushRecords(
        "meal",
        pickDirty(state.mealLogs, state.dirtyMealIds ?? []).map(withCloudImage)
      ),
    });
    tasks.push({
      kind: "exercise",
      label: "运动记录",
      run: pushRecords("exercise", pickDirty(state.exerciseLogs, state.dirtyExerciseIds ?? [])),
    });

    // 任一渠道失败都要上报；成功渠道单独清除 dirty，失败渠道保留待重试
    const failures: string[] = [];
    const succeededKinds: RecordKind[] = [];
    const settled = await Promise.allSettled(tasks.map((task) => task.run));
    settled.forEach((result, index) => {
      const task = tasks[index];
      if (result.status === "rejected") {
        failures.push(`${task.label}上传失败：${errorMessage(result.reason)}`);
      } else if (task.kind !== "profile") {
        succeededKinds.push(task.kind);
      }
    });
    if (succeededKinds.length) {
      useGlucoFitStore.getState().clearDirtyIds(succeededKinds);
    }

    // 4.5 本地 AI 配置较新时上行，并将云端 updatedAt 写回本地
    if (pushLocalAI) {
      try {
        const aiUpdatedAt = await pushAISettings(localAI);
        if (aiUpdatedAt) {
          useAISettingsStore
            .getState()
            .updateAISettings({ ...localAI, updatedAt: aiUpdatedAt });
        }
      } catch (error) {
        failures.push(`AI 设置上传失败：${errorMessage(error)}`);
      }
    }

    // 5. 云端删除本机已移除的记录（tombstone），成功后清空待删清单；
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

    if (failures.length) {
      throw new Error(`部分数据上传失败：${failures.join("；")}`);
    }

    useSyncMetaStore.getState().setLastSyncAt(new Date().toISOString());
    runtime.setSyncing(false);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "同步失败";
    runtime.setLastError(msg);
    runtime.setSyncing(false);
    throw e;
  }
}
