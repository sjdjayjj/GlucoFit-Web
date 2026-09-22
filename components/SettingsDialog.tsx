"use client";

import { useEffect, useState } from "react";
import { BadgeCheck, Eye, EyeOff, KeyRound, Loader2, Settings } from "lucide-react";
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
import { testConnection } from "@/lib/ai-client";
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

export function SettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const saved = useAISettingsStore((s) => s.aiSettings);
  const updateAISettings = useAISettingsStore((s) => s.updateAISettings);

  const [form, setForm] = useState<AISettings>(saved);
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm(saved);
      setShowKey(false);
      setTestResult(null);
      setError(null);
    }
  }, [open, saved]);

  const set = (partial: Partial<AISettings>) =>
    setForm((f) => ({ ...f, ...partial }));

  const handleTest = async () => {
    if (!form.baseUrl || !form.apiKey || !form.model) {
      setTestResult({ ok: false, message: "请先填写 Base URL、API Key 与模型名" });
      return;
    }
    setTesting(true);
    setTestResult(null);
    const result = await testConnection(form);
    setTestResult({ ok: result.ok, message: result.ok ? `${result.message}（${result.latencyMs} ms）` : result.message });
    setTesting(false);
  };

  const handleSave = () => {
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            AI 模型设置 (BYOK)
          </DialogTitle>
          <DialogDescription>
            接入任意 OpenAI 兼容接口。API Key 混淆加密后仅保存在本浏览器，请求经本地代理转发，服务器不留存。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 服务商预设 */}
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

          {/* 连通性测试 */}
          <div className="rounded-lg border bg-muted/40 p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">一键 Ping 验证 API 可用性</span>
              <Button variant="outline" size="sm" onClick={handleTest} disabled={testing}>
                {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                测试连接
              </Button>
            </div>
            {testResult && (
              <p
                className={cn(
                  "mt-2 flex items-center gap-1 text-xs font-medium",
                  testResult.ok ? "text-emerald-600" : "text-red-500"
                )}
              >
                {testResult.ok && <BadgeCheck className="h-3.5 w-3.5" />}
                {testResult.message}
              </p>
            )}
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSave}>保存设置</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
