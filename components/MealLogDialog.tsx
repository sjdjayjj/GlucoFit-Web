"use client";

import { useEffect, useRef, useState } from "react";
import {
  Camera,
  Check,
  Cookie,
  ImagePlus,
  Loader2,
  Moon,
  Sandwich,
  Sparkles,
  Sunrise,
  X,
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
import { Switch } from "@/components/ui/switch";
import {
  ENERGY_REACTION_LABEL,
  SATIETY_DURATION_LABEL,
  type EnergyReaction,
  type MealLog,
  type MealLogPrefill,
  type MealType,
  type NutritionSummary,
  type SatietyDuration,
} from "@/types";
import { computeMealScore, getScoreTone, SCORE_TONE_CLASS } from "@/lib/scoring";
import { useAISettingsStore, useGlucoFitStore } from "@/lib/storage";
import { analyzeMealPhoto } from "@/lib/ai-client";
import { downscaleImageFile } from "@/lib/image";
import { cn, uid } from "@/lib/utils";

const MEAL_TYPE_OPTIONS: Array<{ value: MealType; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { value: "breakfast", label: "早餐", icon: Sunrise },
  { value: "lunch", label: "午餐", icon: Sandwich },
  { value: "dinner", label: "晚餐", icon: Moon },
  { value: "snack", label: "加餐", icon: Cookie },
];

const ENERGY_OPTIONS: Array<{ value: EnergyReaction; label: string; activeClass: string }> = [
  { value: "energetic", label: "精力充沛", activeClass: "border-emerald-500 bg-emerald-50 text-emerald-700" },
  { value: "normal", label: "正常平稳", activeClass: "border-slate-500 bg-slate-100 text-slate-700" },
  { value: "food_coma", label: "明显嗜睡脑雾", activeClass: "border-red-500 bg-red-50 text-red-600" },
];

const SATIETY_OPTIONS: Array<{ value: SatietyDuration; label: string }> = [
  { value: "under_2h", label: "< 2 小时" },
  { value: "2_to_4h", label: "2 - 4 小时" },
  { value: "over_4h", label: "> 4 小时" },
];

const NUTRITION_FIELDS: Array<{ key: keyof NutritionSummary; label: string; unit: string }> = [
  { key: "calories", label: "热量", unit: "kcal" },
  { key: "carbsG", label: "碳水", unit: "g" },
  { key: "proteinG", label: "蛋白质", unit: "g" },
  { key: "fatG", label: "脂肪", unit: "g" },
  { key: "fiberG", label: "纤维", unit: "g" },
];

/** 按当前时间猜测用餐时段 */
function guessMealType(): MealType {
  const h = new Date().getHours();
  if (h < 11) return "breakfast";
  if (h < 15) return "lunch";
  if (h < 21) return "dinner";
  return "snack";
}

function SegmentedButton({
  selected,
  onClick,
  activeClass,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  activeClass?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium transition-colors",
        selected
          ? activeClass ?? "border-primary bg-primary/10 text-primary"
          : "border-input bg-card text-muted-foreground hover:bg-muted"
      )}
    >
      {children}
    </button>
  );
}

export function MealLogDialog({
  open,
  onOpenChange,
  prefill,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefill?: MealLogPrefill | null;
}) {
  const addMealLog = useGlucoFitStore((s) => s.addMealLog);
  const aiSettings = useAISettingsStore((s) => s.aiSettings);
  const fileRef = useRef<HTMLInputElement>(null);

  const [mealType, setMealType] = useState<MealType>("lunch");
  const [followedSequence, setFollowedSequence] = useState(true);
  const [avoidedRefinedCarb, setAvoidedRefinedCarb] = useState(true);
  const [postMealActivity, setPostMealActivity] = useState(false);
  const [energyReaction, setEnergyReaction] = useState<EnergyReaction>("normal");
  const [satietyDuration, setSatietyDuration] = useState<SatietyDuration | null>(null);
  const [foodSummary, setFoodSummary] = useState("");
  const [imageUrl, setImageUrl] = useState<string | undefined>(undefined);
  const [nutrition, setNutrition] = useState<NutritionSummary | null>(null);
  const [sequenceAdvice, setSequenceAdvice] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setMealType(prefill?.mealType ?? guessMealType());
      setFollowedSequence(true);
      setAvoidedRefinedCarb(true);
      setPostMealActivity(false);
      setEnergyReaction("normal");
      setSatietyDuration(null);
      setFoodSummary(prefill?.foodSummary ?? "");
      setNutrition(prefill?.nutrition ?? null);
      setImageUrl(undefined);
      setSequenceAdvice(prefill?.sourceNote ?? null);
      setAnalyzing(false);
      setAnalysisError(null);
    }
  }, [open, prefill]);

  const runAnalysis = async (dataUrl: string) => {
    if (!aiSettings.baseUrl || !aiSettings.apiKey) {
      throw new Error("请先在右上角「AI 模型设置」中配置 API");
    }
    if (!aiSettings.visionModel) {
      throw new Error("当前未配置视觉模型，请在设置中补充后重试");
    }
    setAnalyzing(true);
    setAnalysisError(null);
    try {
      const result = await analyzeMealPhoto(aiSettings, dataUrl);
      setFoodSummary(result.foodSummary);
      setNutrition({
        calories: result.calories,
        carbsG: result.carbsG,
        proteinG: result.proteinG,
        fatG: result.fatG,
        fiberG: result.fiberG ?? 0,
      });
      setAvoidedRefinedCarb(!result.hasRefinedCarb);
      if (result.sequenceAdvice) setSequenceAdvice(result.sequenceAdvice);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setAnalysisError(null);
    try {
      const dataUrl = await downscaleImageFile(file);
      setImageUrl(dataUrl);
      await runAnalysis(dataUrl);
    } catch (e) {
      setAnalysisError((e as Error).message || "照片识别失败，请重试");
    }
  };

  const score = computeMealScore({
    followedSequence,
    avoidedRefinedCarb,
    postMealActivity,
    energyReaction,
  });
  const tone = getScoreTone(score);

  const handleSave = () => {
    const log: MealLog = {
      id: uid(),
      timestamp: new Date().toISOString(),
      mealType,
      followedSequence,
      avoidedRefinedCarb,
      postMealActivity,
      energyReaction,
      satietyDuration: satietyDuration ?? undefined,
      score,
      foodSummary: foodSummary.trim() || "未记录",
      imageUrl,
      nutrition: nutrition ?? undefined,
    };
    addMealLog(log);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>控糖饮食打卡</DialogTitle>
          <DialogDescription>
            拍照识别热量宏量，记录进食行为与餐后代谢反应
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 餐食照片 + AI 识别 */}
          <div className="space-y-2">
            <Label>
              餐食照片 <span className="text-xs font-normal text-muted-foreground">(拍照后 AI 自动估算热量与宏量)</span>
            </Label>
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
            {imageUrl ? (
              <div className="flex items-center gap-3 rounded-lg border p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl}
                  alt="餐食照片"
                  className="h-16 w-16 rounded-md object-cover"
                />
                <div className="flex-1 text-xs text-muted-foreground">
                  {analyzing ? (
                    <span className="flex items-center gap-1.5 text-emerald-600">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      AI 正在分析菜品与热量…
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="flex items-center gap-1 font-medium text-primary hover:underline"
                      onClick={() => fileRef.current?.click()}
                    >
                      <ImagePlus className="h-3.5 w-3.5" />
                      重新选择照片
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  aria-label="移除照片"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setImageUrl(undefined);
                    setAnalysisError(null);
                  }}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={analyzing}
                onClick={() => fileRef.current?.click()}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-sky-300 bg-sky-50/60 px-4 py-3 text-sm font-medium text-sky-700 transition-colors hover:bg-sky-50 disabled:opacity-60"
              >
                <Camera className="h-4 w-4" />
                拍摄 / 上传餐食照片
              </button>
            )}
            {analysisError && <p className="text-xs text-red-500">{analysisError}</p>}
          </div>

          {/* AI 进食顺序建议 */}
          {sequenceAdvice && (
            <div className="flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs text-sky-800">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-500" />
              <span>
                <span className="font-semibold">进食顺序建议：</span>
                {sequenceAdvice}
              </span>
            </div>
          )}

          {/* 用餐时段 */}
          <div className="space-y-1.5">
            <Label>用餐时段</Label>
            <div className="flex gap-2">
              {MEAL_TYPE_OPTIONS.map((opt) => (
                <SegmentedButton
                  key={opt.value}
                  selected={mealType === opt.value}
                  onClick={() => setMealType(opt.value)}
                >
                  <opt.icon className="h-3.5 w-3.5" />
                  {opt.label}
                </SegmentedButton>
              ))}
            </div>
          </div>

          {/* 热量与宏量（AI 识别后可手动修正） */}
          {nutrition && (
            <div className="space-y-1.5">
              <Label>热量与宏量营养素 (AI 估算，可修正)</Label>
              <div className="grid grid-cols-5 gap-1.5">
                {NUTRITION_FIELDS.map((f) => (
                  <div key={String(f.key)}>
                    <div className="mb-1 text-center text-[10px] text-muted-foreground">
                      {f.label}
                    </div>
                    <Input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      className="h-8 px-1 text-center text-xs"
                      value={nutrition[f.key] ?? 0}
                      onChange={(e) =>
                        setNutrition((n) =>
                          n
                            ? { ...n, [f.key]: Number(e.target.value) || 0 }
                            : n
                        )
                      }
                    />
                    <div className="mt-0.5 text-center text-[9px] text-muted-foreground">
                      {f.unit}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 行为自检 */}
          <div className="space-y-2">
            <Label>行为自检</Label>
            {[
              {
                checked: followedSequence,
                onChange: setFollowedSequence,
                title: "进食顺序达标",
                desc: "蔬菜/纤维 → 蛋白质/脂肪 → 碳水主食",
              },
              {
                checked: avoidedRefinedCarb,
                onChange: setAvoidedRefinedCarb,
                title: "规避精制碳水",
                desc: "无白米面、无游离糖与含糖饮料",
              },
              {
                checked: postMealActivity,
                onChange: setPostMealActivity,
                title: "餐后肌肉泵激活",
                desc: "餐后 30 分钟内散步 / 提踵 10-15 分钟 (GLUT4)",
              },
            ].map((row) => (
              <div
                key={row.title}
                className="flex items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div>
                  <div className="text-sm font-medium">{row.title}</div>
                  <div className="text-xs text-muted-foreground">{row.desc}</div>
                </div>
                <Switch checked={row.checked} onCheckedChange={row.onChange} />
              </div>
            ))}
          </div>

          {/* 代谢反馈 */}
          <div className="space-y-1.5">
            <Label>餐后精力水平</Label>
            <div className="flex gap-2">
              {ENERGY_OPTIONS.map((opt) => (
                <SegmentedButton
                  key={opt.value}
                  selected={energyReaction === opt.value}
                  onClick={() => setEnergyReaction(opt.value)}
                  activeClass={opt.activeClass}
                >
                  {opt.label}
                </SegmentedButton>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>
              抗饿预期时长 <span className="text-xs font-normal text-muted-foreground">(选填)</span>
            </Label>
            <div className="flex gap-2">
              {SATIETY_OPTIONS.map((opt) => (
                <SegmentedButton
                  key={opt.value}
                  selected={satietyDuration === opt.value}
                  onClick={() =>
                    setSatietyDuration(satietyDuration === opt.value ? null : opt.value)
                  }
                >
                  {opt.label}
                </SegmentedButton>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="meal-summary">餐食简记</Label>
            <Input
              id="meal-summary"
              placeholder="如：牛肉菠菜糙米饭"
              value={foodSummary}
              onChange={(e) => setFoodSummary(e.target.value)}
            />
          </div>

          {/* 实时稳糖分 */}
          <div className="flex items-center justify-between rounded-lg border bg-muted/40 p-3">
            <div className="text-xs text-muted-foreground">
              单餐稳糖得分实时预估（顺序 30 · 控碳 30 · 餐后活动 20 · 神经状态 20）
            </div>
            <div
              className={cn(
                "ml-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border text-lg font-bold tabular-nums",
                SCORE_TONE_CLASS[tone]
              )}
            >
              {score}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSave}>
            <Check className="h-4 w-4" />
            完成打卡
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
