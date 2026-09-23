"use client";

import { useEffect, useState } from "react";
import {
  BadgeCheck,
  CloudUpload,
  Loader2,
  LogIn,
  UserPlus,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/lib/auth-store";
import { useGlucoFitStore } from "@/lib/storage";
import { syncAll } from "@/lib/cloud";
import { cn } from "@/lib/utils";

type Mode = "login" | "register";
type Step = "form" | "migrate";

/**
 * 登录 / 注册弹窗 (v2.2 中心化托管)：
 * 登录成功后若检测到本地离线数据，引导一键合并至云端。
 */
export function AuthModal({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 登录成功（含迁移决策完成）后的回调 */
  onSuccess?: () => void;
}) {
  const signIn = useAuthStore((s) => s.signIn);
  const signUp = useAuthStore((s) => s.signUp);

  const [mode, setMode] = useState<Mode>("login");
  const [step, setStep] = useState<Step>("form");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setStep("form");
      setError(null);
    }
  }, [open, mode]);

  const hasLocalData = () => {
    const s = useGlucoFitStore.getState();
    return s.bodyRecords.length > 0 || s.mealLogs.length > 0 || s.exerciseLogs.length > 0;
  };

  const finish = () => {
    onOpenChange(false);
    onSuccess?.();
  };

  const handleMigrate = async () => {
    setMigrating(true);
    setError(null);
    try {
      await syncAll();
      setMigrating(false);
      finish();
    } catch (e) {
      setMigrating(false);
      setError((e as Error).message || "合并失败，可稍后在设置中重试同步");
    }
  };

  const handleSubmit = async () => {
    if (!email.trim() || !password) {
      setError("请输入邮箱与密码");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      if (mode === "login") {
        await signIn(email.trim(), password);
      } else {
        await signUp(email.trim(), password);
      }
      setSubmitting(false);
      // 登录成功 → 引导离线数据迁移
      if (hasLocalData()) {
        setStep("migrate");
      } else {
        finish();
      }
    } catch (e) {
      setSubmitting(false);
      setError((e as Error).message || "操作失败");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        {step === "form" ? (
          <>
            <DialogHeader>
              <DialogTitle>
                {mode === "login" ? "登录 GlucoFit" : "注册 GlucoFit 账号"}
              </DialogTitle>
              <DialogDescription>
                登录后数据云端漫游，多设备同步；未登录也可继续以游客模式本地使用。
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="flex gap-1 rounded-lg border bg-muted/40 p-1">
                {(
                  [
                    { key: "login", label: "登录" },
                    { key: "register", label: "注册" },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setMode(t.key)}
                    className={cn(
                      "flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                      mode === t.key
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="auth-email">邮箱</Label>
                <Input
                  id="auth-email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="auth-password">密码</Label>
                <Input
                  id="auth-password"
                  type="password"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  placeholder={mode === "register" ? "至少 6 位" : "密码"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void handleSubmit();
                  }}
                />
              </div>

              {error && <p className="text-sm text-red-500">{error}</p>}

              <Button className="w-full" onClick={handleSubmit} disabled={submitting}>
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : mode === "login" ? (
                  <LogIn className="h-4 w-4" />
                ) : (
                  <UserPlus className="h-4 w-4" />
                )}
                {mode === "login" ? "登录" : "注册并登录"}
              </Button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <BadgeCheck className="h-5 w-5 text-emerald-500" />
                登录成功
              </DialogTitle>
              <DialogDescription>
                检测到本浏览器存有离线打卡数据，是否立即合并至云端？合并后可在其他设备登录同一账号继续使用。
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-lg border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
              合并规则：按记录 ID 去重、时间新者胜，本地与云端数据互不覆盖丢失。
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={finish} disabled={migrating}>
                稍后再说
              </Button>
              <Button className="flex-1" onClick={handleMigrate} disabled={migrating}>
                {migrating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CloudUpload className="h-4 w-4" />
                )}
                立即合并
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
