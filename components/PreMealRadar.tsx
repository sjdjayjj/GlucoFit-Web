"use client";

import { useRef, useState } from "react";
import {
  Camera,
  CircleCheck,
  Loader2,
  Radar,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Utensils,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAISettingsStore, useGlucoFitStore } from "@/lib/storage";
import { planMealScript } from "@/lib/ai-client";
import { downscaleImageFile } from "@/lib/image";
import type { PreMealPlanResult } from "@/types/v3";

/**
 * v3.0 吃前扫一扫：菜单排雷与 10 秒进食战术剧本生成器。
 * AI 介入节点前移至"动筷子前的 10 秒钟"。
 */
export function PreMealRadar() {
  const aiSettings = useAISettingsStore((s) => s.aiSettings);
  const carbFistLimit = useGlucoFitStore(
    (s) => s.weeklySchedule?.carbFistLimitPerMeal ?? 1
  );
  const fileRef = useRef<HTMLInputElement>(null);

  const [menuText, setMenuText] = useState("");
  const [imageUrl, setImageUrl] = useState<string | undefined>(undefined);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PreMealPlanResult | null>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      const dataUrl = await downscaleImageFile(file);
      setImageUrl(dataUrl);
    } catch {
      setError("图片处理失败，请重试");
    }
  };

  const handlePlan = async () => {
    if (!aiSettings.baseUrl || !aiSettings.apiKey || !aiSettings.model) {
      setError("请先在「设置 → AI 模型 (BYOK)」中配置 API");
      return;
    }
    if (!menuText.trim() && !imageUrl) {
      setError("请输入菜单文字，或上传外卖/菜单/食物照片");
      return;
    }
    setAnalyzing(true);
    setError(null);
    try {
      const plan = await planMealScript(aiSettings, {
        menuText: menuText.trim() || undefined,
        imageDataUrl: imageUrl,
      });
      setResult(plan);
    } catch (e) {
      setError((e as Error).message || "排雷分析失败，请重试");
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* 输入区：菜单文字 / 照片 */}
      <div className="space-y-2">
        <Label>
          眼前这顿饭 <span className="text-xs font-normal text-muted-foreground">(外卖截图 / 菜单拍照 / 手动输入)</span>
        </Label>
        <Textarea
          rows={2}
          placeholder="如：糖醋排骨、蒜蓉西兰花、番茄蛋汤、白米饭"
          value={menuText}
          onChange={(e) => setMenuText(e.target.value)}
          className="text-sm"
        />
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            void handleFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => fileRef.current?.click()}
          >
            <Camera className="h-4 w-4" />
            {imageUrl ? "已附照片 · 重新选择" : "拍照 / 上传菜单"}
          </Button>
          {imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="菜单" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
          )}
        </div>
      </div>

      <Button className="w-full" onClick={handlePlan} disabled={analyzing}>
        {analyzing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Radar className="h-4 w-4" />
        )}
        {analyzing ? "AI 正在扫雷排雷…" : "生成排雷分析与战术剧本"}
      </Button>

      {error && (
        <p className="text-xs leading-relaxed break-words text-[#c23430] dark:text-[#e5645a]">{error}</p>
      )}

      {/* 排雷结果 */}
      {result && (
        <div className="space-y-3">
          {/* 三区排雷 */}
          <div className="grid grid-cols-1 gap-2">
            <RadarZone
              tone="safe"
              icon={<ShieldCheck className="h-4 w-4 text-[#54761e] dark:text-[#9cc35c]" />}
              title="稳糖安全区"
              items={result.safeFoods}
              itemClass="bg-[#eef5e2] text-[#54761e] border-[#79ad31]/30 dark:bg-[#2a3320] dark:text-[#9cc35c] dark:border-[#79ad31]/30"
            />
            <RadarZone
              tone="warn"
              icon={<Sparkles className="h-4 w-4 text-[#96641c] dark:text-[#dba75f]" />}
              title="隐藏刺客区"
              items={result.hiddenThreats}
              itemClass="bg-[#fff5d9] text-[#96641c] border-[#96641c]/30 dark:bg-[#362e1c] dark:text-[#dba75f] dark:border-[#96641c]/30"
            />
            <RadarZone
              tone="bad"
              icon={<ShieldAlert className="h-4 w-4 text-[#c23430] dark:text-[#e5645a]" />}
              title="胰岛素炸弹"
              items={result.insulinBombs}
              itemClass="bg-[#ffe7e5] text-[#c23430] border-[#cf382e]/30 dark:bg-[#3a2422] dark:text-[#e5645a] dark:border-[#cf382e]/30"
            />
          </div>

          {/* 主食拳头量化 */}
          <div className="flex items-center justify-between rounded-[10px] border border-[#5b87eb]/30 bg-accent p-3 text-sm dark:border-[#5b87eb]/30 dark:bg-[#2a3552]">
            <span className="flex items-center gap-1.5 font-medium text-[#3861c6] dark:text-[#7fa3f0]">
              <Utensils className="h-4 w-4" />
              主食建议
            </span>
            <span className="text-xs tabular-nums text-muted-foreground">
              <span className="text-base font-semibold tabular-nums tracking-tight text-foreground">
                {Math.min(result.stapleFist, carbFistLimit)}
              </span>{" "}
              拳 ≈ {result.stapleGrams}g
              {result.stapleFist > carbFistLimit && "（已按你的双模上限收窄）"}
            </span>
          </div>

          {/* 10 秒战术剧本 */}
          {result.script.length > 0 && (
            <div className="space-y-1.5 rounded-[10px] border border-[#5b87eb]/30 bg-accent p-3 dark:border-[#5b87eb]/30 dark:bg-[#2a3552]">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#3861c6] dark:text-[#7fa3f0]">
                <Radar className="h-3.5 w-3.5" />
                10 秒进食战术剧本
              </div>
              <ol className="space-y-1.5">
                {result.script.map((line, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-xs leading-relaxed break-words text-foreground"
                  >
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#5b87eb] text-[10px] font-bold text-white">
                      {i + 1}
                    </span>
                    {line}
                  </li>
                ))}
              </ol>
              <p className="flex items-center gap-1 pt-1 text-[11px] leading-relaxed break-words text-[#3861c6] dark:text-[#7fa3f0]">
                <CircleCheck className="h-3 w-3" />
                开吃吧！吃完后回到「餐后打卡」页记录行为与反应即可。
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RadarZone({
  icon,
  title,
  items,
  itemClass,
}: {
  tone: "safe" | "warn" | "bad";
  icon: React.ReactNode;
  title: string;
  items: string[];
  itemClass: string;
}) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
        {icon}
        {title}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item, i) => (
          <span
            key={i}
            className={`rounded-md border px-2 py-1 text-[11px] leading-snug ${itemClass}`}
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
