import type { StateStorage } from "zustand/middleware";

/**
 * 持久化作用域（按账号隔离）：
 * localStorage key = `${base}::${scope}`，scope 为 userId 或 "guest"。
 * - 旧版未分域 key 读取时自动回退，迁移到新 key 成功后删除旧 key。
 * - 写入配额超限时触发监听回调（UI 可见提示），不再静默失败。
 */

export const GUEST_SCOPE = "guest";
export const SCOPE_MARKER_KEY = "glucofit-active-scope";

/** 需要按账号隔离的持久化 key（均不含 scope 后缀） */
const SCOPED_BASE_KEYS = [
  "glucofit-web-storage",
  "glucofit-profile",
  "glucofit-ai-settings",
  "glucofit-sync-meta",
  "glucofit-ai-diagnosis-cache",
  "glucofit-ai-diagnosis-attempt",
];

let activeScope: string | null = null;
let writeSuppressed = false;
let quotaListener: ((key: string) => void) | null = null;

export function getActiveScope(): string {
  if (typeof window === "undefined") return activeScope ?? GUEST_SCOPE;
  if (activeScope != null) return activeScope;
  try {
    activeScope = localStorage.getItem(SCOPE_MARKER_KEY) || GUEST_SCOPE;
  } catch {
    activeScope = GUEST_SCOPE;
  }
  return activeScope;
}

export function setActiveScope(scope: string): void {
  activeScope = scope;
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SCOPE_MARKER_KEY, scope);
  } catch {
    // 配额已满：作用域标记写不进去不影响本次会话（下次刷新可能回到旧作用域）
  }
}

/** 拼出某个作用域下的真实 key */
export function scopedKey(base: string, scope: string = getActiveScope()): string {
  return `${base}::${scope}`;
}

function isQuotaError(error: unknown): boolean {
  if (typeof DOMException !== "undefined" && error instanceof DOMException) {
    return (
      error.name === "QuotaExceededError" ||
      error.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
      error.code === 22
    );
  }
  return false;
}

/** 监听本地存储写入失败（配额超限） */
export function onStorageQuotaExceeded(
  listener: (key: string) => void
): () => void {
  quotaListener = listener;
  return () => {
    if (quotaListener === listener) quotaListener = null;
  };
}

export function safeGetRaw(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function safeSetRaw(key: string, value: string): boolean {
  if (typeof window === "undefined") return false;
  // 作用域切换期间抑制写入，避免默认值覆盖目标作用域已存数据
  if (writeSuppressed) return true;
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    if (isQuotaError(error)) quotaListener?.(key);
    return false;
  }
}

export function safeRemoveRaw(key: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

/** 切换作用域时抑制写入，避免用默认值覆盖目标作用域已存数据 */
export function withStorageWritesSuppressed<T>(fn: () => T): T {
  writeSuppressed = true;
  try {
    return fn();
  } finally {
    writeSuppressed = false;
  }
}

/** Zustand persist 使用的按作用域存储 */
export const scopedStorage: StateStorage = {
  getItem: (name) => {
    if (typeof window === "undefined") return null;
    const scoped = safeGetRaw(scopedKey(name));
    if (scoped != null) return scoped;
    // 兼容旧版未分域数据
    return safeGetRaw(name);
  },
  setItem: (name, value) => {
    if (typeof window === "undefined") return;
    safeSetRaw(scopedKey(name), value);
  },
  removeItem: (name) => {
    safeRemoveRaw(scopedKey(name));
    safeRemoveRaw(name);
  },
};

/**
 * 旧版未分域 key 迁移到指定作用域。
 * 复制成功后删除旧 key；配额不足则保留旧 key（读取时走回退逻辑）。
 */
export function migrateLegacyKeys(scope: string): void {
  if (typeof window === "undefined") return;
  for (const base of SCOPED_BASE_KEYS) {
    const legacy = safeGetRaw(base);
    if (legacy == null) continue;
    const target = scopedKey(base, scope);
    if (safeGetRaw(target) == null && !safeSetRaw(target, legacy)) continue;
    safeRemoveRaw(base);
  }
}

/** 读取指定作用域的 persist JSON（含旧 key 回退） */
export function readScopedPersistJson<T = unknown>(
  base: string,
  scope: string
): T | null {
  const raw =
    safeGetRaw(scopedKey(base, scope)) ??
    (scope === GUEST_SCOPE ? safeGetRaw(base) : null);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
