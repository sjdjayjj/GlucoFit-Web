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
        setSubmitting(false);
        // 登录即双向同步：拉取云端档案与记录（新设备建档），并合并本地离线数据上行。
        // 同步失败时保留弹窗提示，可手动关闭后稍后通过顶栏同步按钮重试。
        try {
          await syncAll();
          finish();
        } catch {
          setError("登录成功，但云端同步失败：请检查网络后点击顶栏同步按钮重试");
        }
      } else {
        await signUp(email.trim(), password);
        setSubmitting(false);
        // 新注册账号云端为空，仅在有本地离线数据时引导合并上行
        if (hasLocalData()) {
          setStep("migrate");
        } else {
          finish();
        }
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
              <div className="flex gap-1 rounded-xl border border-slate-200/70 bg-slate-100/80 p-1 dark:border-white/10 dark:bg-slate-800/60">
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
                      "flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-all duration-200 ease-out",
                      mode === t.key
                        ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white"
                        : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
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

              {error && (
                <p className="break-words rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-600 dark:text-rose-400">
                  {error}
                </p>
              )}

              <Button className="h-11 w-full sm:w-auto" onClick={handleSubmit} disabled={submitting}>
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
                <BadgeCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                登录成功
              </DialogTitle>
              <DialogDescription>
                检测到本浏览器存有离线打卡数据，是否立即合并至云端？合并后可在其他设备登录同一账号继续使用。
              </DialogDescription>
            </DialogHeader>

            <div className="break-words rounded-xl border border-sky-500/20 bg-sky-500/10 p-3 text-xs leading-relaxed text-slate-700 dark:border-sky-400/20 dark:bg-sky-400/10 dark:text-slate-300">
              合并规则：按记录 ID 去重、时间新者胜，本地与云端数据互不覆盖丢失。
            </div>

            {error && (
              <p className="break-words rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-600 dark:text-rose-400">
                {error}
              </p>
            )}

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
