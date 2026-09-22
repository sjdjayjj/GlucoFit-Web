"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BadgeCheck,
  Bot,
  Loader2,
  RefreshCw,
  TriangleAlert,
  Waves,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { buildWeeklyStats } from "@/lib/scoring";
import { useAISettingsStore, useGlucoFitStore, useSortedBodyRecords } from "@/lib/storage";
import {
  generateWeeklyDiagnosis,
  isAIConfigured,
  type DiagnosisResult,
  type PlateauStatus,
} from "@/lib/ai-client";
import { cn } from "@/lib/utils";

const PLATEAU_BADGE: Record<PlateauStatus, { label: string; className: string }> = {
  improving: { label: "代谢向好", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  plateau: { label: "代谢平台期", className: "border-amber-200 bg-amber-50 text-amber-700" },
  regressing: { label: "代谢退步预警", className: "border-red-200 bg-red-50 text-red-600" },
  insufficient_data: { label: "数据不足", className: "border-slate-200 bg-slate-100 text-slate-500" },
};

export function AIDiagnosisModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const records = useSortedBodyRecords();
  const mealLogs = useGlucoFitStore((s) => s.mealLogs);
  const goal = useGlucoFitStore((s) => s.goal);
  const aiSettings = useAISettingsStore((s) => s.aiSettings);

  const stats = useMemo(() => buildWeeklyStats(records, mealLogs), [records, mealLogs]);
  const configured = isAIConfigured(aiSettings);

  const [generating, setGenerating] = useState(false);
  const [report, setReport] = useState<DiagnosisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (!stats || !configured) return;
    setGenerating(true);
    setError(null);
    try {
      const result = await generateWeeklyDiagnosis(aiSettings, stats, goal);
      setReport(result);
    } catch (e) {
      setError((e as Error).message || "生成失败，请重试");
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    if (open) {
      setReport(null);
      setError(null);
      setGenerating(false);
      if (stats && configured) {
        void run();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const fmtDelta = (v: number | null, digits = 1, unit = "kg") =>
    v == null ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(digits)}${unit}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            AI 代谢分析（近 7 天）
          </DialogTitle>
          <DialogDescription>
            聚合体成分变化、稳糖得分与嗜睡频次，生成胰岛素敏感度周度诊断
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 数据概览 */}
          {stats ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-lg border bg-muted/40 p-2.5">
                <div className="text-[11px] text-muted-foreground">体重变化</div>
                <div className="text-sm font-semibold tabular-nums">
                  {fmtDelta(stats.weightDelta)}
                </div>
              </div>
              <div className="rounded-lg border bg-muted/40 p-2.5">
                <div className="text-[11px] text-muted-foreground">脂肪量变化</div>
                <div className="text-sm font-semibold tabular-nums">
                  {fmtDelta(stats.fatDelta)}
                </div>
              </div>
              <div className="rounded-lg border bg-muted/40 p-2.5">
                <div className="text-[11px] text-muted-foreground">肌肉/脂肪比</div>
                <div className="text-sm font-semibold tabular-nums">
                  {stats.muscleFatRatioStart.toFixed(2)} → {stats.muscleFatRatioEnd.toFixed(2)}
                </div>
              </div>
              <div className="rounded-lg border bg-muted/40 p-2.5">
                <div className="text-[11px] text-muted-foreground">7 天稳糖均分</div>
                <div className="text-sm font-semibold tabular-nums">
                  {stats.avgScore} 分 · 嗜睡 {stats.foodComaCount} 次
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              近 7 天暂无记录，请先录入体脂秤数据与饮食打卡
            </div>
          )}

          {!configured && stats && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              请先在右上角「AI 模型设置」中配置 API Key 后再生成诊断。
            </p>
          )}

          {/* 生成中 / 错误 / 重新生成 */}
          {generating && (
            <div className="flex items-center justify-center gap-2 rounded-lg border bg-muted/40 p-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              AI 正在分析近 7 天代谢数据…
            </div>
          )}
          {error && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-600">
              <span className="flex items-center gap-1.5">
                <TriangleAlert className="h-3.5 w-3.5" />
                {error}
              </span>
              <Button variant="outline" size="sm" onClick={run} disabled={generating}>
                重试
              </Button>
            </div>
          )}

          {/* 诊断报告 */}
          {report && (
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
                <Button variant="ghost" size="sm" onClick={run} disabled={generating}>
                  <RefreshCw className="h-3.5 w-3.5" />
                  重新生成
                </Button>
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
