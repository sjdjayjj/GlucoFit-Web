"use client";

import { useEffect, useState } from "react";
import {
  BadgeCheck,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Settings,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAISettingsStore, useGlucoFitStore } from "@/lib/storage";
import { useProfileStore } from "@/lib/profile";
import { useAuthStore } from "@/lib/auth-store";
import { testConnection } from "@/lib/ai-client";
import type { AISettings } from "@/types";
import type { WeeklyScheduleConfig } from "@/types/v3";
import { cn } from "@/lib/utils";

/** 常用 OpenAI 兼容服务商预设 */
const PROVIDER_PRESETS: Array<{
  label: string;
  baseUrl: string;
  model: string;
  visionModel: string;
  textModels?: string[]; // 可选的文本模型候选（渲染为 datalist 供下拉选择）
}> = [
  { label: "OpenAI", baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini", visionModel: "gpt-4o-mini" },
  { label: "DeepSeek", baseUrl: "https://api.deepseek.com/v1", model: "deepseek-chat", visionModel: "" },
  { label: "通义千问 (百炼)", baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", model: "qwen-plus", visionModel: "qwen-vl-max" },
  { label: "月之暗面 Kimi", baseUrl: "https://api.moonshot.cn/v1", model: "moonshot-v1-8k", visionModel: "moonshot-v1-8k-vision" },
  { label: "硅基流动", baseUrl: "https://api.siliconflow.cn/v1", model: "deepseek-ai/DeepSeek-V3", visionModel: "Qwen/Qwen2.5-VL-72B-Instruct" },
  {
    label: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    model: "gemini-3.8-flash",
    visionModel: "gemini-3.8-flash",
    textModels: [
      "gemini-3.8-flash",
      "gemini-3.7-flash",
      "gemini-3.6-flash",
      "gemini-3.5-flash",
    ],
  },
];

interface AsyncState {
  loading: boolean;
  ok: boolean | null;
  message: string | null;
}

const IDLE_ASYNC: AsyncState = { loading: false, ok: null, message: null };

export function SettingsDialog({
  open,
  onOpenChange,
  onOpenOnboarding,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenOnboarding?: () => void;
}) {
  // ---------- AI 模型设置 ----------
  const saved = useAISettingsStore((s) => s.aiSettings);
  const updateAISettings = useAISettingsStore((s) => s.updateAISettings);

  // ---------- 代谢档案 ----------
  const profile = useProfileStore((s) => s.profile);

  // ---------- v3.0 工作日/周末双模引擎 ----------
  const savedSchedule = useGlucoFitStore((s) => s.weeklySchedule);
  const setWeeklySchedule = useGlucoFitStore((s) => s.setWeeklySchedule);
  const [scheduleForm, setScheduleForm] = useState<WeeklyScheduleConfig>(
    savedSchedule ?? {
      enabled: false,
      weekdayProtocol: "16:8",
      weekendProtocol: "12:12",
      carbFistLimitPerMeal: 1,
    }
  );

  const [form, setForm] = useState<AISettings>(saved);
  const [showKey, setShowKey] = useState(false);
  const [aiTest, setAiTest] = useState<AsyncState>(IDLE_ASYNC);
  const [savingAI, setSavingAI] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm(saved);
      setScheduleForm(
        savedSchedule ?? {
          enabled: false,
          weekdayProtocol: "16:8",
          weekendProtocol: "12:12",
          carbFistLimitPerMeal: 1,
        }
      );
      setShowKey(false);
      setAiTest(IDLE_ASYNC);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = (partial: Partial<AISettings>) =>
    setForm((f) => ({ ...f, ...partial }));

  const handleTest = async () => {
    if (!form.baseUrl || !form.apiKey || !form.model) {
      setAiTest({ loading: false, ok: false, message: "请先填写 Base URL、API Key 与模型名" });
      return;
    }
    setAiTest({ loading: true, ok: null, message: null });
    const result = await testConnection(form);
    setAiTest({
      loading: false,
      ok: result.ok,
      message: result.ok ? `${result.message}（${result.latencyMs} ms）` : result.message,
    });
  };

  const handleSaveAI = async () => {
    if (!form.baseUrl.trim() || !form.apiKey.trim() || !form.model.trim()) {
      setError("Base URL、API Key 与模型名为必填项");
      return;
    }
    setError(null);
    const next: AISettings = {
      baseUrl: form.baseUrl.trim(),
      apiKey: form.apiKey.trim(),
      model: form.model.trim(),
      visionModel: form.visionModel.trim(),
      deepThinking: form.deepThinking === true,
      updatedAt: new Date().toISOString(),
    };
    // 先落本地（未登录也即时生效），云端保存失败时保留弹窗提示
    updateAISettings(next);
    // 已登录时同步上行至云端档案（按用户隔离，API Key 服务端加密落库）
    if (useAuthStore.getState().user) {
      setSavingAI(true);
      try {
        const res = await fetch("/api/ai-settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(next),
        });
        const data = (await res.json().catch(() => null)) as
          | { updatedAt?: string; error?: string }
          | null;
        if (!res.ok) {
          setError(data?.error || "AI 配置已保存到本机，但云端保存失败，可稍后点击顶栏同步重试");
          return;
        }
        // 以服务端返回的 updatedAt 收敛本地，避免下次同步误判新旧
        if (data?.updatedAt) {
          updateAISettings({ ...next, updatedAt: data.updatedAt });
        }
      } catch {
        setError("AI 配置已保存到本机，但云端保存失败，请检查网络后重试");
        return;
      } finally {
        setSavingAI(false);
      }
    }
    // v3.0：同步保存周期双模配置
    setWeeklySchedule(
      scheduleForm.enabled
        ? scheduleForm
        : null
    );
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5">
            <span
              aria-hidden
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-500/10 text-slate-600 dark:bg-slate-400/10 dark:text-slate-300"
            >
              <Settings className="h-4 w-4" />
            </span>
            设置
          </DialogTitle>
          <DialogDescription>
            AI 模型采用 BYOK 模式：已登录用户的配置随账号云端存储（API Key 服务端加密落库、仅本人可读），换设备登录自动同步；未登录时仅保存在本浏览器。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* ============ 代谢初始档案 ============ */}
          <section className="space-y-3 rounded-xl border border-slate-200/70 bg-slate-50/60 p-4 dark:border-white/[0.06] dark:bg-slate-800/40">
            <h3 className="text-[11px] font-semibold tracking-wider text-slate-400 dark:text-slate-500">
              代谢初始档案
            </h3>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/70 bg-white p-3 dark:border-white/[0.08] dark:bg-slate-900/60">
              <span className="min-w-0 flex-1 break-words text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                {profile
                  ? `${profile.gender === "male" ? "男" : "女"} · ${profile.heightCm} cm · 初始 ${profile.initialWeightKg} kg → 目标 ${profile.targetWeightKg} kg`
                  : "尚未建档：身高/初始体重/目标是 BMI、TDEE 与里程碑的计算基准"}
              </span>
              {onOpenOnboarding && (
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => {
                    onOpenChange(false);
                    onOpenOnboarding();
                  }}
                >
                  {profile ? "编辑档案" : "立即建档"}
                </Button>
              )}
            </div>
          </section>

          {/* ============ v3.0 工作日/周末双模引擎 ============ */}
          <section className="space-y-3 rounded-xl border border-slate-200/70 bg-slate-50/60 p-4 dark:border-white/[0.06] dark:bg-slate-800/40">
            <div className="flex min-h-10 items-center justify-between gap-3 py-2">
              <h3 className="text-[11px] font-semibold tracking-wider text-slate-400 dark:text-slate-500">
                周期双模引擎
              </h3>
              <Switch
                checked={scheduleForm.enabled}
                onCheckedChange={(v) => setScheduleForm((s) => ({ ...s, enabled: v }))}
              />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              开启后工作日（周一至五）执行严格断食自动驾驶，周末/社交日自动切换为防御与平衡模式。
            </p>
            {scheduleForm.enabled && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>工作日协议（严格）</Label>
                  <div className="flex gap-1 rounded-xl border border-slate-200/70 bg-white p-1 dark:border-white/[0.08] dark:bg-slate-900/60">
                    {(["16:8", "18:6"] as const).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setScheduleForm((s) => ({ ...s, weekdayProtocol: p }))}
                        className={cn(
                          "flex-1 rounded-lg px-2 py-1.5 text-xs font-medium tabular-nums transition-all duration-200 ease-out",
                          scheduleForm.weekdayProtocol === p
                            ? "bg-slate-100 text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white"
                            : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                        )}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>周末协议（弹性）</Label>
                  <div className="flex gap-1 rounded-xl border border-slate-200/70 bg-white p-1 dark:border-white/[0.08] dark:bg-slate-900/60">
                    {(["14:10", "12:12", "flexible"] as const).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setScheduleForm((s) => ({ ...s, weekendProtocol: p }))}
                        className={cn(
                          "flex-1 rounded-lg px-2 py-1.5 text-xs font-medium tabular-nums transition-all duration-200 ease-out",
                          scheduleForm.weekendProtocol === p
                            ? "bg-slate-100 text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white"
                            : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                        )}
                      >
                        {p === "flexible" ? "弹性" : p}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* ============ AI 模型设置 ============ */}
          <section className="space-y-4 rounded-xl border border-slate-200/70 bg-slate-50/60 p-4 dark:border-white/[0.06] dark:bg-slate-800/40">
            <h3 className="text-[11px] font-semibold tracking-wider text-slate-400 dark:text-slate-500">
              AI 模型 (BYOK)
            </h3>

            <div className="space-y-1.5">
              <Label>快速填充服务商预设</Label>
              <div className="flex flex-wrap gap-1.5">
                {PROVIDER_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() =>
                      set({ baseUrl: p.baseUrl, model: p.model, visionModel: p.visionModel })
                    }
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs font-medium transition-all duration-200 ease-out",
                      form.baseUrl === p.baseUrl
                        ? "border-blue-500/40 bg-blue-500/10 text-blue-600 dark:border-blue-400/40 dark:bg-blue-400/10 dark:text-blue-400"
                        : "border-slate-200/70 bg-white text-slate-500 hover:bg-slate-100 dark:border-white/10 dark:bg-slate-800/60 dark:text-slate-400 dark:hover:bg-slate-800"
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ai-base-url">Base URL *</Label>
              <Input
                id="ai-base-url"
                placeholder="https://api.openai.com/v1"
                value={form.baseUrl}
                onChange={(e) => set({ baseUrl: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ai-api-key" className="flex items-center gap-1">
                <KeyRound className="h-3.5 w-3.5" />
                API Key *
              </Label>
              <div className="relative">
                <Input
                  id="ai-api-key"
                  type={showKey ? "text" : "password"}
                  placeholder="sk-..."
                  value={form.apiKey}
                  onChange={(e) => set({ apiKey: e.target.value })}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-900 dark:hover:text-white"
                  aria-label={showKey ? "隐藏 Key" : "显示 Key"}
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="ai-model">文本模型 *</Label>
                <Input
                  id="ai-model"
                  placeholder="gpt-4o-mini / deepseek-chat"
                  list="ai-model-options"
                  value={form.model}
                  onChange={(e) => set({ model: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ai-vision-model">视觉模型</Label>
                <Input
                  id="ai-vision-model"
                  placeholder="gpt-4o / qwen-vl-max"
                  list="ai-model-options"
                  value={form.visionModel}
                  onChange={(e) => set({ visionModel: e.target.value })}
                />
              </div>
            </div>

            <datalist id="ai-model-options">
              {PROVIDER_PRESETS.find((p) => p.baseUrl === form.baseUrl)?.textModels?.map(
                (m) => (
                  <option key={m} value={m} />
                )
              )}
            </datalist>

            <div className="flex min-h-10 items-center justify-between gap-3 rounded-xl border border-slate-200/70 bg-white p-3 dark:border-white/[0.08] dark:bg-slate-900/60">
              <div className="space-y-0.5 break-words">
                <Label htmlFor="ai-deep-thinking">深度思考模式</Label>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  开启后请求携带 enable_thinking 参数（Qwen3 / SiliconFlow
                  等支持的推理模型生效），响应更慢但推理更深，默认关闭
                </p>
              </div>
              <Switch
                id="ai-deep-thinking"
                checked={form.deepThinking === true}
                onCheckedChange={(v) => set({ deepThinking: v })}
              />
            </div>

            <div className="rounded-xl border border-slate-200/70 bg-white p-3 dark:border-white/[0.08] dark:bg-slate-900/60">
              <div className="flex min-h-10 flex-wrap items-center justify-between gap-3">
                <span className="text-xs text-slate-500 dark:text-slate-400">一键 Ping 验证 API 可用性</span>
                <Button variant="outline" size="sm" onClick={handleTest} disabled={aiTest.loading}>
                  {aiTest.loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  测试连接
                </Button>
              </div>
              <AsyncMessage state={aiTest} />
            </div>
          </section>

          {error && (
            <p className="break-words rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-600 dark:text-rose-400">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSaveAI} disabled={savingAI}>
            {savingAI && <Loader2 className="h-4 w-4 animate-spin" />}
            保存设置
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** 异步操作结果消息行 */
function AsyncMessage({ state }: { state: AsyncState }) {
  if (!state.message) return null;
  return (
    <p
      className={cn(
        "mt-2 flex items-start gap-1 break-words text-xs font-medium",
        state.ok ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
      )}
    >
      {state.ok && <BadgeCheck className="h-3.5 w-3.5" />}
      {state.message}
    </p>
  );
}
