"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  BadgeCheck,
  Bot,
  Clock,
  Loader2,
  RefreshCw,
  TriangleAlert,
  Waves,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { buildWeeklyStats } from "@/lib/scoring";
import { useAISettingsStore, useGlucoFitStore, useSortedBodyRecords } from "@/lib/storage";
import { useAuthStore } from "@/lib/auth-store";
import {
  generateWeeklyDiagnosis,
  isAIConfigured,
  type DiagnosisResult,
  type PlateauStatus,
} from "@/lib/ai-client";
import type { CachedAIDiagnosis } from "@/types";
import { fmtDate, shortTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

const PLATEAU_BADGE: Record<PlateauStatus, { label: string; className: string }> = {
  improving: { label: "代谢向好", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  plateau: { label: "代谢平台期", className: "border-amber-200 bg-amber-50 text-amber-700" },
  regressing: { label: "代谢退步预警", className: "border-red-200 bg-red-50 text-red-600" },
  insufficient_data: { label: "数据不足", className: "border-slate-200 bg-slate-100 text-slate-500" },
};

const CACHE_KEY = "glucofit-ai-diagnosis-cache";
const ATTEMPT_KEY = "glucofit-ai-diagnosis-attempt";

function readCache(): CachedAIDiagnosis | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as CachedAIDiagnosis) : null;
  } catch {
    return null;
  }
}

function writeCache(cache: CachedAIDiagnosis) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    /* 存储不可用时忽略 */
  }
}

function parseContent(content: string): DiagnosisResult | null {
  try {
    return JSON.parse(content) as DiagnosisResult;
  } catch {
    return null;
  }
}

/**
 * AI 代谢诊断面板 (v2.2 缓存节流版)：
 * - 绝不自动随页面刷新调用 AI：优先展示上次缓存结果与生成时间
 * - 每日首次访问且今日尚未生成时，后台静默补生成一次
 * - 「重新评估」按钮支持手动强制刷新
 * - 登录后缓存双写云端（多端漫游）
 */
export function AIDiagnosisCard() {
  const records = useSortedBodyRecords();
  const mealLogs = useGlucoFitStore((s) => s.mealLogs);
  const goal = useGlucoFitStore((s) => s.goal);
  const aiSettings = useAISettingsStore((s) => s.aiSettings);
  const authUser = useAuthStore((s) => s.user);

  const stats = useMemo(() => buildWeeklyStats(records, mealLogs), [records, mealLogs]);
  const configured = isAIConfigured(aiSettings);

  const [cache, setCache] = useState<CachedAIDiagnosis | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justAutoRun, setJustAutoRun] = useState(false);
  /** 防止每日自动任务重复触发 */
  const autoRunStarted = useRef(false);

  const todayStr = fmtDate(new Date());
  const report = cache ? parseContent(cache.content) : null;

  const generate = useCallback(async () => {
    if (!stats || !configured) return;
    setGenerating(true);
    setError(null);
    try {
      const result = await generateWeeklyDiagnosis(aiSettings, stats, goal);
      const next: CachedAIDiagnosis = {
        content: JSON.stringify(result),
        generatedAt: new Date().toISOString(),
        dateStr: fmtDate(new Date()),
      };
      writeCache(next);
      setCache(next);
      return true;
    } catch (e) {
      setError((e as Error).message || "生成失败，请重试");
      return false;
    } finally {
      setGenerating(false);
    }
  }, [stats, configured, aiSettings, goal]);

  // 挂载：读本地缓存；登录态再拉云端缓存（时间新者胜）
  useEffect(() => {
    const local = readCache();
    setCache(local);
    if (!authUser) return;
    (async () => {
      try {
        const res = await fetch("/api/ai/diagnose", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json().catch(() => null)) as {
          record?: { content: string; generatedAt: string; dateStr: string } | null;
        } | null;
        const cloud = data?.record;
        if (cloud?.content && (!local || cloud.generatedAt > local.generatedAt)) {
          const next: CachedAIDiagnosis = {
            content: cloud.content,
            generatedAt: cloud.generatedAt,
            dateStr: cloud.dateStr,
          };
          writeCache(next);
          setCache(next);
        }
      } catch {
        /* 云端缓存拉取失败不影响本地展示 */
      }
    })();
  }, [authUser]);

  // 每日首次访问自动补生成（静默后台，不重复尝试）
  useEffect(() => {
    if (autoRunStarted.current) return;
    if (!stats || !configured) return;
    const current = readCache();
    if (current?.dateStr === todayStr) return;
    let attempted = false;
    try {
      attempted = localStorage.getItem(ATTEMPT_KEY) === todayStr;
    } catch {
      /* 忽略 */
    }
    if (attempted) return;
    autoRunStarted.current = true;
    try {
      localStorage.setItem(ATTEMPT_KEY, todayStr);
    } catch {
      /* 忽略 */
    }
    (async () => {
      const ok = await generate();
      if (ok) {
        setJustAutoRun(true);
        // 登录态下双写云端
        const latest = readCache();
        if (authUser && latest) {
          void fetch("/api/ai/diagnose", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(latest),
          }).catch(() => null);
        }
      }
    })();
  }, [stats, configured, todayStr, generate, authUser]);

  const handleManualRefresh = async () => {
    const ok = await generate();
    if (ok && authUser) {
      const latest = readCache();
      if (latest) {
        void fetch("/api/ai/diagnose", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(latest),
        }).catch(() => null);
      }
    }
  };

  const generatedLabel = cache
    ? `分析生成于：${cache.dateStr === todayStr ? "今天" : cache.dateStr} ${shortTime(cache.generatedAt)}`
    : null;

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div className="space-y-1.5">
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            AI 代谢诊断
          </CardTitle>
          <CardDescription className="flex items-center gap-1.5">
            <Clock className="h-3 w-3" />
            {generating
              ? "AI 正在分析近 7 天代谢数据…"
              : generatedLabel ?? "暂无历史分析，可立即生成一次"}
          </CardDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleManualRefresh}
          disabled={generating || !stats || !configured}
          title={!configured ? "请先在设置中配置 AI 模型" : "重新评估当前代谢状态"}
        >
          {generating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          重新评估
        </Button>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-3">
        {justAutoRun && !generating && (
          <p className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-[11px] text-emerald-700">
            <BadgeCheck className="h-3.5 w-3.5" />
            今日代谢简报已就绪（每日仅自动生成一次）
          </p>
        )}

        {stats ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <MiniStat label="体重变化" value={fmtDelta(stats.weightDelta)} />
            <MiniStat label="脂肪量变化" value={fmtDelta(stats.fatDelta)} />
            <MiniStat
              label="肌肉/脂肪比"
              value={`${stats.muscleFatRatioStart.toFixed(2)} → ${stats.muscleFatRatioEnd.toFixed(2)}`}
            />
            <MiniStat label="7 天稳糖均分" value={`${stats.avgScore} 分 · 嗜睡 ${stats.foodComaCount} 次`} />
          </div>
        ) : (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            近 7 天暂无记录，请先录入体脂秤数据与饮食打卡
          </div>
        )}

        {!configured && stats && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            请先在「设置 → AI 模型」中配置 API Key 后再生成诊断。
          </p>
        )}

        {error && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-600">
            <span className="flex items-center gap-1.5">
              <TriangleAlert className="h-3.5 w-3.5" />
              {error}
            </span>
            <Button variant="outline" size="sm" onClick={handleManualRefresh} disabled={generating}>
              重试
            </Button>
          </div>
        )}

        {/* 缓存的诊断报告 */}
        {report && !generating && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                  PLATEAU_BADGE[report.plateauStatus].className
                )}
              >
                {report.plateauStatus === "improving" ? (
                  <BadgeCheck className="h-3.5 w-3.5" />
                ) : (
                  <Activity className="h-3.5 w-3.5" />
                )}
                平台期诊断：{PLATEAU_BADGE[report.plateauStatus].label}
              </span>
            </div>

            <p className="rounded-lg border bg-muted/40 p-3 text-sm leading-relaxed">
              {report.overall}
            </p>

            {report.muscleStatus && (
              <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-xs leading-relaxed text-amber-900">
                <span className="font-semibold">瘦体重 / 掉肌分析：</span>
                {report.muscleStatus}
              </div>
            )}
            {report.insulinStatus && (
              <div className="rounded-lg border border-sky-200 bg-sky-50/60 p-3 text-xs leading-relaxed text-sky-900">
                <span className="font-semibold">胰岛素敏感度：</span>
                {report.insulinStatus}
              </div>
            )}

            {report.actions.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold">
                  <Waves className="h-3.5 w-3.5 text-primary" />
                  本周行动建议
                </div>
                {report.actions.map((action, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 rounded-lg border p-2.5 text-xs"
                  >
                    <BadgeCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                    {action}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!report && !generating && !error && stats && configured && (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-8 text-center">
            <Bot className="h-7 w-7 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              点击「重新评估」生成你的第一份周度代谢诊断
            </p>
          </div>
        )}

        <p className="mt-auto text-[10px] text-muted-foreground">
          诊断基于近 7 天体成分与稳糖行为数据；每日首次访问自动更新，其余时间仅读取缓存。
        </p>
      </CardContent>
    </Card>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/40 p-2.5">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function fmtDelta(v: number | null, digits = 1, unit = "kg") {
  return v == null ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(digits)}${unit}`;
}
