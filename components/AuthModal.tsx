"use client";

import { useEffect, useRef, useState } from "react";
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
import { adoptGuestData, applyAuthScope, hasGuestData, syncAll } from "@/lib/cloud";
import { cn } from "@/lib/utils";

type Mode = "login" | "register";
type Step = "form" | "migrate";

/**
 * 登录 / 注册弹窗 (v2.2 中心化托管)：
 * 登录成功后按账号切换本地存储作用域；若存在游客离线数据，由用户选择合并或仅用云端数据。
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
  /** 已登录但尚未切换作用域的账号 id */
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const settlingRef = useRef(false);

  useEffect(() => {
    if (open) {
      setStep("form");
      setError(null);
    }
  }, [open, mode]);

  const finish = () => {
    onOpenChange(false);
    onSuccess?.();
  };

  /** 切换到目标账号作用域，按需合并游客数据，再执行双向同步 */
  const activateScope = async (userId: string, mergeGuest: boolean) => {
    settlingRef.current = true;
    setMigrating(true);
    setError(null);
    try {
      await applyAuthScope(userId);
      if (mergeGuest) adoptGuestData();
      await syncAll();
      finish();
    } catch (e) {
      setError(
        `已登录，但同步失败：${
          (e as Error).message || "网络异常"
        }。可关闭弹窗后点击顶栏「同步」重试`
      );
    } finally {
      settlingRef.current = false;
      setMigrating(false);
    }
  };

  const handleMigrate = () => {
    if (pendingUserId) void activateScope(pendingUserId, true);
  };

  const handleCloudOnly = () => {
    if (pendingUserId) void activateScope(pendingUserId, false);
  };

  /** 直接关闭「是否合并」弹窗时，默认不合并但切换作用域，避免停留在游客数据上 */
  const handleOpenChange = (next: boolean) => {
    if (!next && pendingUserId && step === "migrate" && !settlingRef.current) {
      void activateScope(pendingUserId, false);
      return;
    }
    onOpenChange(next);
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
      const userId = useAuthStore.getState().user?.id;
      if (!userId) {
        setError("登录状态获取失败，请重试");
        return;
      }
      // 游客离线数据先询问归属，避免不声不响覆盖/上行
      if (hasGuestData()) {
        setPendingUserId(userId);
        setStep("migrate");
        return;
      }
      await activateScope(userId, false);
    } catch (e) {
      setSubmitting(false);
      setError((e as Error).message || "操作失败");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
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
              <div className="flex gap-1 rounded-[8px] border border-border bg-muted/80 p-1">
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
                      "flex-1 rounded-lg px-2 py-1.5 text-xs font-medium",
                      mode === t.key
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground active:bg-muted"
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
                <p className="break-words rounded-lg bg-[#ffe7e5] px-3 py-2 text-sm text-[#c23430] dark:bg-[#3a2422] dark:text-[#e5645a]">
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
                <BadgeCheck className="h-5 w-5 text-[#54761e] dark:text-[#9cc35c]" />
                登录成功
              </DialogTitle>
              <DialogDescription>
                检测到本浏览器存有游客模式的离线打卡数据。是否把这些数据合并进当前账号？不合并时游客数据仍保留在本机，退出登录后可继续使用。
              </DialogDescription>
            </DialogHeader>

            <div className="break-words rounded-[8px] border border-[#c9d8f7] bg-accent p-3 text-xs leading-relaxed text-foreground dark:border-[#3d5480]">
              合并规则：按记录 ID 去重，严格按记录更新时间（updatedAt）比较新旧，本地未上行的修改优先保留。
            </div>

            {error && (
              <p className="break-words rounded-lg bg-[#ffe7e5] px-3 py-2 text-sm text-[#c23430] dark:bg-[#3a2422] dark:text-[#e5645a]">
                {error}
              </p>
            )}

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={handleCloudOnly} disabled={migrating}>
                仅使用云端数据
              </Button>
              <Button className="flex-1" onClick={handleMigrate} disabled={migrating}>
                {migrating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CloudUpload className="h-4 w-4" />
                )}
                合并本地数据
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
