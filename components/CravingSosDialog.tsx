"use client";

import { useEffect, useState } from "react";
import {
  Apple,
  Brain,
  CheckCircle2,
  CupSoda,
  Drumstick,
  Hourglass,
  Lightbulb,
  Wind,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useGlucoFitStore } from "@/lib/storage";
import { cn } from "@/lib/utils";

type SosStep = "triage" | "fake_hunger" | "real_hunger" | "countdown" | "countdown_done";

const COUNTDOWN_SECONDS = 10 * 60;

/**
 * v3.0 嘴馋急救 SOS：3 分钟多巴胺阻断交互。
 * 生理鉴别 → 替代处方 → 10 分钟冲动延迟（80% 的冲动会在 10 分钟内消退）。
 */
export function CravingSosDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const goal = useGlucoFitStore((s) => s.goal);
  const updateGoal = useGlucoFitStore((s) => s.updateGoal);
  const [step, setStep] = useState<SosStep>("triage");
  const [remaining, setRemaining] = useState(COUNTDOWN_SECONDS);
  const [adjusted, setAdjusted] = useState(false);

  useEffect(() => {
    if (open) {
      setStep("triage");
      setRemaining(COUNTDOWN_SECONDS);
      setAdjusted(false);
    }
  }, [open]);

  useEffect(() => {
    if (step !== "countdown") return;
    const timer = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(timer);
          setStep("countdown_done");
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [step]);

  // 放宽明日断食窗口（次日可手动切回）
  const relaxTomorrowWindow = () => {
    updateGoal({ fastingProtocol: "14:10" });
    setAdjusted(true);
  };

  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");
  const progress = 1 - remaining / COUNTDOWN_SECONDS;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-warning" />
            嘴馋急救 SOS
          </DialogTitle>
          <DialogDescription>
            不讲大道理 · 3 分钟多巴胺阻断交互，80% 的冲动会在 10 分钟内自行消退
          </DialogDescription>
        </DialogHeader>

        {step === "triage" && (
          <div className="space-y-4">
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm">
              <div className="mb-2 flex items-center gap-1.5 font-semibold text-primary">
                <Brain className="h-4 w-4" />
                第 1 步 · 生理鉴别
              </div>
              <p>
                现在端给你一盘<span className="font-medium">水煮鸡胸肉 + 西兰花</span>，
                你想吃吗？（不想吃 = 多巴胺假性饥饿；想吃 = 真低血糖）
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => setStep("fake_hunger")}>
                不想吃
              </Button>
              <Button variant="outline" onClick={() => setStep("real_hunger")}>
                真的想吃
              </Button>
            </div>
          </div>
        )}

        {step === "fake_hunger" && (
          <div className="space-y-4">
            <div className="break-words rounded-lg border border-info/30 bg-info/10 p-4 text-sm text-info">
              <div className="mb-2 flex items-center gap-1.5 font-semibold">
                <Wind className="h-4 w-4" />
                鉴别结果：多巴胺假性饥饿
              </div>
              <p>这不是身体需要能量，是大脑在索要即时奖赏。执行下方替代处方：</p>
            </div>

            <div className="space-y-2">
              <PrescriptionRow
                icon={<CupSoda className="h-4 w-4 text-info" />}
                title="先喝 300ml 气泡水 / 零卡电解质水"
                desc="胃部机械扩张即可消除约一半假性食欲；想喝甜饮时选零卡电解质水或黑咖啡"
              />
              <PrescriptionRow
                icon={<Apple className="h-4 w-4 text-success" />}
                title="嚼 5 颗巴旦木（约 35 kcal）"
                desc="咀嚼动作 + 脂肪香气可诱导饱腹信号，给大脑 10 分钟缓冲"
              />
            </div>

            {/* 60 秒呼吸节律动画 */}
            <div className="flex flex-col items-center gap-2 rounded-lg border bg-muted/40 p-4">
              <div className="relative flex h-20 w-20 items-center justify-center">
                <span className="absolute h-16 w-16 animate-ping rounded-full bg-info/25" />
                <span className="absolute h-12 w-12 animate-breathe rounded-full bg-info/40" />
                <Wind className="h-5 w-5 text-info" />
              </div>
              <p className="text-xs text-muted-foreground">
                60 秒呼吸节律：吸气 4 秒 → 屏息 2 秒 → 缓慢呼气 6 秒，跟随圆圈脉动
              </p>
            </div>

            <Button className="w-full" onClick={() => setStep("countdown")}>
              <Hourglass className="h-4 w-4" />
              进入 10 分钟冲动延迟
            </Button>
          </div>
        )}

        {step === "real_hunger" && (
          <div className="space-y-4">
            <div className="break-words rounded-lg border border-success/30 bg-success/10 p-4 text-sm text-success">
              <div className="mb-2 flex items-center gap-1.5 font-semibold">
                <Drumstick className="h-4 w-4" />
                鉴别结果：真低血糖 / 真饥饿
              </div>
              <p>
                真饥饿无需压抑——压抑会引发报复性暴食。选择低胰岛素负荷食物，
                正常计入今日进食窗口即可。
              </p>
            </div>
            <div className="space-y-2">
              <PrescriptionRow
                icon={<Drumstick className="h-4 w-4 text-success" />}
                title="首选：2 个水煮蛋 / 无糖希腊酸奶"
                desc="蛋白质 20g 内、几乎不升胰岛素，直接关闭饥饿素"
              />
              <PrescriptionRow
                icon={<Apple className="h-4 w-4 text-warning" />}
                title="次选：一小把原味坚果 + 黑咖啡"
                desc="脂肪供能缓释，咖啡因可轻度抑制食欲与提升代谢"
              />
            </div>
            <Button className="w-full" variant="outline" onClick={() => onOpenChange(false)}>
              <CheckCircle2 className="h-4 w-4" />
              已执行，关闭急救箱
            </Button>
          </div>
        )}

        {step === "countdown" && (
          <div className="flex flex-col items-center gap-4 py-2">
            <div className="relative flex h-32 w-32 items-center justify-center">
              <svg className="absolute -rotate-90" width={128} height={128}>
                <circle className="text-border" cx="64" cy="64" r="56" fill="none" stroke="currentColor" strokeWidth={8} />
                <circle
                  className="text-primary"
                  cx="64"
                  cy="64"
                  r="56"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={8}
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 56}
                  strokeDashoffset={2 * Math.PI * 56 * (1 - progress)}
                  style={{ transition: "stroke-dashoffset 1s linear" }}
                />
              </svg>
              <span className="text-2xl font-bold tabular-nums text-primary">
                {mm}:{ss}
              </span>
            </div>
            <p className="text-center text-sm text-muted-foreground">
              冲动正在消退中…去喝水、刷牙或走动一下。
              <br />
              如果 10 分钟后你依然极度想吃，系统允许你
              <span className="font-medium text-foreground">无罪恶感地吃一小份</span>。
            </p>
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              我已经不想吃了
            </Button>
          </div>
        )}

        {step === "countdown_done" && (
          <div className="space-y-4">
            <div className="break-words rounded-lg border border-success/30 bg-success/10 p-4 text-sm text-success">
              <div className="mb-1 flex items-center gap-1.5 font-semibold">
                <CheckCircle2 className="h-4 w-4" />
                10 分钟已到 · 冲动大概率已消退
              </div>
              <p>
                若仍极度想吃：允许你无罪恶感地吃一小份（约 150 kcal），
                系统将帮你把明天的断食窗口放宽至 <span className="font-semibold">14:10</span>，
                以缓冲今日额外摄入。
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                冲动已消退
              </Button>
              <Button onClick={relaxTomorrowWindow} disabled={adjusted}>
                {adjusted ? "明日已放宽" : "放宽明日窗口"}
              </Button>
            </div>
            {adjusted && (
              <p className="text-center text-xs text-muted-foreground">
                已将断食协议临时调整为 {goal.fastingProtocol}，次日可在断食卡片手动切回。
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PrescriptionRow({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border p-3">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div>
        <div className={cn("text-sm font-medium")}>{title}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
    </div>
  );
}
