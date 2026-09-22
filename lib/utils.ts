import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** 格式化为 YYYY-MM-DD（本地时区） */
export function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** n 天前的日期字符串 YYYY-MM-DD */
export function daysAgoDateStr(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return fmtDate(d);
}

export function todayDateStr(): string {
  return fmtDate(new Date());
}

/** YYYY-MM-DD -> MM-DD */
export function shortDate(dateStr: string): string {
  return dateStr.slice(5);
}

/** ISO timestamp -> HH:MM */
export function shortTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes()
  ).padStart(2, "0")}`;
}

/** 数值显示：不足一位小数时保留 1 位 */
export function fmtNum(n: number, digits = 1): string {
  return n.toFixed(digits);
}
