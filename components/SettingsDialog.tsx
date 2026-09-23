"use client";

import { useEffect, useState } from "react";
import {
  BadgeCheck,
  CloudUpload,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LogIn,
  LogOut,
  Settings,
  UserRound,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAISettingsStore } from "@/lib/storage";
import { useProfileStore } from "@/lib/profile";
import { useAuthStore } from "@/lib/auth-store";
import { testConnection } from "@/lib/ai-client";
import { syncAll, useSyncMetaStore, useSyncRuntimeStore } from "@/lib/cloud";
import type { AISettings } from "@/types";
import { cn } from "@/lib/utils";

/** 常用 OpenAI 兼容服务商预设 */
const PROVIDER_PRESETS: Array<{
  label: string;
  baseUrl: string;
  model: string;
  visionModel: string;
}> = [
  { label: "OpenAI", baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini", visionModel: "gpt-4o-mini" },
  { label: "DeepSeek", baseUrl: "https://api.deepseek.com/v1", model: "deepseek-chat", visionModel: "" },
  { label: "通义千问 (百炼)", baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", model: "qwen-plus", visionModel: "qwen-vl-max" },
  { label: "月之暗面 Kimi", baseUrl: "https://api.moonshot.cn/v1", model: "moonshot-v1-8k", visionModel: "moonshot-v1-8k-vision" },
  { label: "硅基流动", baseUrl: "https://api.siliconflow.cn/v1", model: "deepseek-ai/DeepSeek-V3", visionModel: "Qwen/Qwen2.5-VL-72B-Instruct" },
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
  onOpenAuth,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenOnboarding?: () => void;
  onOpenAuth?: () => void;
}) {
  // ---------- AI 模型设置 ----------
  const saved = useAISettingsStore((s) => s.aiSettings);
  const updateAISettings = useAISettingsStore((s) => s.updateAISettings);

  // ---------- 代谢档案 ----------
  const profile = useProfileStore((s) => s.profile);

  // ---------- 账户与云同步 ----------
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const lastSyncAt = useSyncMetaStore((s) => s.lastSyncAt);
  const syncing = useSyncRuntimeStore((s) => s.syncing);

  const [form, setForm] = useState<AISettings>(saved);
  const [showKey, setShowKey] = useState(false);
  const [aiTest, setAiTest] = useState<AsyncState>(IDLE_ASYNC);
  const [syncState, setSyncState] = useState<AsyncState>(IDLE_ASYNC);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm(saved);
      setShowKey(false);
      setAiTest(IDLE_ASYNC);
      setSyncState(IDLE_ASYNC);
      setError(null);
    }
  }, [open, saved]);

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

  const handleSaveAI = () => {
    if (!form.baseUrl.trim() || !form.apiKey.trim() || !form.model.trim()) {
      setError("Base URL、API Key 与模型名为必填项");
      return;
    }
    setError(null);
    updateAISettings({
      baseUrl: form.baseUrl.trim(),
      apiKey: form.apiKey.trim(),
      model: form.model.trim(),
      visionModel: form.visionModel.trim(),
    });
    onOpenChange(false);
  };

  const handleSyncNow = async () => {
    setSyncState({ loading: true, ok: null, message: null });
    try {
      await syncAll();
      setSyncState({ loading: false, ok: true, message: "双向同步完成" });
    } catch (e) {
      setSyncState({ loading: false, ok: false, message: e instanceof Error ? e.message : "同步失败" });
    }
  };

  const handleSignOut = async () => {
    await signOut();
    setSyncState({ loading: false, ok: true, message: "已退出登录，数据保留在本机" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            设置
          </DialogTitle>
          <DialogDescription>
            AI 模型采用 BYOK 模式：凭证混淆加密后仅保存在本浏览器，请求经本地代理转发，服务器不留存任何凭证。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* ============ 账户与云同步 ============ */}
          <section className="space-y-3">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <UserRound className="h-4 w-4 text-sky-600" />
              账户与云同步
            </h3>

            {user ? (
              <>
                <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/40 p-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{user.email}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {lastSyncAt
                        ? `上次同步 ${new Date(lastSyncAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}`
                        : "尚未同步过"}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Button variant="outline" size="sm" onClick={handleSyncNow} disabled={syncing}>
                      {syncing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CloudUpload className="h-4 w-4" />
                      )}
                      立即同步
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handleSignOut}>
                      <LogOut className="h-3.5 w-3.5" />
                      退出
                    </Button>
                  </div>
                </div>
                <AsyncMessage state={syncState} />
              </>
            ) : (
              <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/40 p-3">
                <span className="text-xs text-muted-foreground">
                  当前为游客模式（数据仅存本机）。登录后可多端漫游与自动备份。
                </span>
                {onOpenAuth && (
                  <Button
                    size="sm"
                    className="shrink-0"
                    onClick={() => {
                      onOpenChange(false);
                      onOpenAuth();
                    }}
                  >
                    <LogIn className="h-4 w-4" />
                    登录 / 注册
                  </Button>
                )}
              </div>
            )}
          </section>

          <div className="border-t" />

          {/* ============ 代谢档案 ============ */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">代谢初始档案</h3>
            <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/40 p-3">
              <span className="text-xs text-muted-foreground">
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

          <div className="border-t" />

          {/* ============ AI 模型设置 ============ */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">AI 模型 (BYOK)</h3>

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
                      "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                      form.baseUrl === p.baseUrl
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-input bg-card text-muted-foreground hover:bg-muted"
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
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
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
                  value={form.model}
                  onChange={(e) => set({ model: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ai-vision-model">视觉模型</Label>
                <Input
                  id="ai-vision-model"
                  placeholder="gpt-4o / qwen-vl-max"
                  value={form.visionModel}
                  onChange={(e) => set({ visionModel: e.target.value })}
                />
              </div>
            </div>

            <div className="rounded-lg border bg-muted/40 p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-muted-foreground">一键 Ping 验证 API 可用性</span>
                <Button variant="outline" size="sm" onClick={handleTest} disabled={aiTest.loading}>
                  {aiTest.loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  测试连接
                </Button>
              </div>
              <AsyncMessage state={aiTest} />
            </div>
          </section>

          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSaveAI}>保存 AI 设置</Button>
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
        "mt-2 flex items-center gap-1 text-xs font-medium",
        state.ok ? "text-emerald-600" : "text-red-500"
      )}
    >
      {state.ok && <BadgeCheck className="h-3.5 w-3.5" />}
      {state.message}
    </p>
  );
}
