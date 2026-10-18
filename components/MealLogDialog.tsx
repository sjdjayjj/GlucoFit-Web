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
import { analyzeMealPhoto, estimateMealNutrition } from "@/lib/ai-client";
import { downscaleImageFile } from "@/lib/image";
import { MealVoiceInput, type VoiceMealParse } from "@/components/MealVoiceInput";
import { PreMealRadar } from "@/components/PreMealRadar";
import { cn, uid } from "@/lib/utils";

const MEAL_TYPE_OPTIONS: Array<{ value: MealType; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { value: "breakfast", label: "早餐", icon: Sunrise },
  { value: "lunch", label: "午餐", icon: Sandwich },
  { value: "dinner", label: "晚餐", icon: Moon },
  { value: "snack", label: "加餐", icon: Cookie },
];

const ENERGY_OPTIONS: Array<{ value: EnergyReaction; label: string; activeClass: string }> = [
  {
    value: "energetic",
    label: "精力充沛",
    activeClass:
      "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:border-emerald-400/40 dark:bg-emerald-400/10 dark:text-emerald-400",
  },
  {
    value: "normal",
    label: "正常平稳",
    activeClass:
      "border-slate-400/60 bg-slate-100 text-slate-700 dark:border-slate-500/60 dark:bg-slate-700/60 dark:text-slate-200",
  },
  {
    value: "food_coma",
    label: "明显嗜睡脑雾",
    activeClass:
      "border-rose-500/40 bg-rose-500/10 text-rose-600 dark:border-rose-400/40 dark:bg-rose-400/10 dark:text-rose-400",
  },
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
        "flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium transition-all duration-200 ease-out",
        selected
          ? activeClass ?? "border-blue-500/40 bg-blue-500/10 text-blue-600 dark:border-blue-400/40 dark:bg-blue-400/10 dark:text-blue-400"
          : "border-slate-200/70 bg-white text-slate-500 hover:bg-slate-50 dark:border-white/10 dark:bg-slate-800/60 dark:text-slate-400 dark:hover:bg-slate-800"
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
  const updateMealLog = useGlucoFitStore((s) => s.updateMealLog);
  const aiSettings = useAISettingsStore((s) => s.aiSettings);
  const fileRef = useRef<HTMLInputElement>(null);

  // v3.0：吃前规划（排雷） / 餐后打卡 双模式
  const [mode, setMode] = useState<"plan" | "log">("log");

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
  const [textEstimating, setTextEstimating] = useState(false);
  const [textEstimateError, setTextEstimateError] = useState<string | null>(null);
  const estimatedTextRef = useRef<string | null>(null);

  useEffect(() => {
    if (open) {
      setMode("log");
      setMealType(prefill?.mealType ?? guessMealType());
      setFollowedSequence(prefill?.followedSequence ?? true);
      setAvoidedRefinedCarb(prefill?.avoidedRefinedCarb ?? true);
      setPostMealActivity(prefill?.postMealActivity ?? false);
      setEnergyReaction(prefill?.energyReaction ?? "normal");
      setSatietyDuration(prefill?.satietyDuration ?? null);
      setFoodSummary(prefill?.foodSummary ?? "");
      setNutrition(prefill?.nutrition ?? null);
      setImageUrl(prefill?.imageUrl);
      setSequenceAdvice(prefill?.sourceNote ?? null);
      setAnalyzing(false);
      setAnalysisError(null);
      setTextEstimating(false);
      setTextEstimateError(null);
      // 预填已带营养数据（推荐方案/编辑含营养记录）时跳过文字自动估算；
      // 编辑无营养的历史记录则允许估算补齐热量
      estimatedTextRef.current =
        prefill?.nutrition != null ? (prefill?.foodSummary ?? "").trim() : null;
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
      estimatedTextRef.current = result.foodSummary;
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

  /** 语音解析结果自动预填表单 */
  const applyVoiceParse = (r: VoiceMealParse) => {
    setMealType(r.mealType);
    estimatedTextRef.current = (r.foodSummary || "").trim();
    setFoodSummary(r.foodSummary);
    setFollowedSequence(r.followedSequence);
    setAvoidedRefinedCarb(r.avoidedRefinedCarb);
    setPostMealActivity(r.postMealActivity);
    setEnergyReaction(r.energyReaction);
    setNutrition((n) => ({
      calories: r.calories || n?.calories || 0,
      carbsG: r.carbsG || n?.carbsG || 0,
      proteinG: r.proteinG || n?.proteinG || 0,
      fatG: r.fatG || n?.fatG || 0,
      fiberG: n?.fiberG ?? 0,
    }));
  };

  /** 简记文字防抖触发 AI 热量估算；拍照/语音已带营养数据时跳过，避免重复调用 */
  useEffect(() => {
    if (!open || mode !== "log") return;
    const text = foodSummary.trim();
    if (text.length < 4 || text === estimatedTextRef.current) return;
    if (!aiSettings.baseUrl || !aiSettings.apiKey || !aiSettings.model) return;
    const timer = setTimeout(() => {
      estimatedTextRef.current = text;
      setTextEstimating(true);
      setTextEstimateError(null);
      estimateMealNutrition(aiSettings, text)
        .then(setNutrition)
        .catch((e) =>
          setTextEstimateError(
            (e as Error).message || "热量估算失败，可手动填写营养数据"
          )
        )
        .finally(() => setTextEstimating(false));
    }, 1200);
    return () => clearTimeout(timer);
  }, [foodSummary, open, mode, aiSettings]);

  const score = computeMealScore({
    followedSequence,
    avoidedRefinedCarb,
    postMealActivity,
    energyReaction,
  });
  const tone = getScoreTone(score);

  const handleSave = () => {
    const log: MealLog = {
      id: prefill?.id ?? uid(),
      timestamp: prefill?.timestamp ?? new Date().toISOString(),
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
    if (prefill?.id) {
      updateMealLog(prefill.id, log);
    } else {
      addMealLog(log);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{prefill?.id ? "编辑打卡记录" : "控糖饮食打卡"}</DialogTitle>
          <DialogDescription>
            吃前排雷规划，或拍照识别热量宏量记录进食行为与餐后反应
          </DialogDescription>
        </DialogHeader>

        {/* v3.0 模式切换：吃前排雷 / 餐后打卡 */}
        <div className="flex gap-1 rounded-xl border border-slate-200/70 bg-slate-100/80 p-1 dark:border-white/10 dark:bg-slate-800/60">
          {(
            [
              { key: "plan", label: "吃前规划 · 排雷" },
              { key: "log", label: "餐后打卡" },
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

        {mode === "plan" ? (
          <PreMealRadar />
        ) : (
        <div className="space-y-4">
          {/* 餐食照片 + AI 识别 */}
          <div className="space-y-2">
            <Label>
              餐食照片 <span className="text-xs font-normal text-slate-400 dark:text-slate-500">(拍照后 AI 自动估算热量与宏量)</span>
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
              <div className="flex items-center gap-3 rounded-xl border border-slate-200/70 p-2 dark:border-white/[0.08]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl}
                  alt="餐食照片"
                  className="h-16 w-16 shrink-0 rounded-lg object-cover"
                />
                <div className="min-w-0 flex-1 text-xs text-slate-500 dark:text-slate-400">
                  {analyzing ? (
                    <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      AI 正在分析菜品与热量…
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="flex items-center gap-1 font-medium text-blue-600 hover:underline dark:text-blue-400"
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
                  className="-m-1 rounded-md p-1 text-slate-400 transition-all duration-200 ease-out hover:bg-slate-500/10 hover:text-slate-900 dark:hover:text-white"
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
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-sky-500/40 bg-sky-500/10 px-4 py-3 text-sm font-medium text-sky-600 transition-all duration-200 ease-out hover:bg-sky-500/15 disabled:opacity-60 dark:border-sky-400/40 dark:bg-sky-400/10 dark:text-sky-400"
              >
                <Camera className="h-4 w-4" />
                拍摄 / 上传餐食照片
              </button>
            )}
            {analysisError && <p className="break-words text-xs text-rose-600 dark:text-rose-400">{analysisError}</p>}
          </div>

          {/* AI 进食顺序建议 */}
          {sequenceAdvice && (
            <div className="flex items-start gap-2 rounded-xl border border-sky-500/20 bg-sky-500/10 p-3 text-xs text-slate-700 dark:border-sky-400/20 dark:bg-sky-400/10 dark:text-slate-300">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-600 dark:text-sky-400" />
              <span className="min-w-0 break-words">
                <span className="font-semibold text-sky-600 dark:text-sky-400">进食顺序建议：</span>
                {sequenceAdvice}
              </span>
            </div>
          )}

          {/* 语音快记：口语一句话 → AI 预填表单 */}
          <MealVoiceInput onParsed={applyVoiceParse} />

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
              <div className="grid grid-cols-3 gap-2 xs:grid-cols-5">
                {NUTRITION_FIELDS.map((f) => (
                  <div key={String(f.key)}>
                    <div className="mb-1 text-center text-xs font-medium text-slate-400 dark:text-slate-500">
                      {f.label}
                    </div>
                    <Input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      className="h-9 px-1 text-center text-xs tabular-nums"
                      value={nutrition[f.key] ?? 0}
                      onChange={(e) =>
                        setNutrition((n) =>
                          n
                            ? { ...n, [f.key]: Number(e.target.value) || 0 }
                            : n
                        )
                      }
                    />
                    <div className="mt-0.5 text-center text-xs text-slate-400 dark:text-slate-500">
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
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/70 p-3 dark:border-white/[0.08]"
              >
                <div>
                  <div className="text-sm font-medium text-slate-900 dark:text-white">{row.title}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">{row.desc}</div>
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
              抗饿预期时长 <span className="text-xs font-normal text-slate-400 dark:text-slate-500">(选填)</span>
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
            {textEstimating && (
              <p className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <Loader2 className="h-3 w-3 animate-spin" />
                AI 正在估算热量与宏量营养素…
              </p>
            )}
            {textEstimateError && !textEstimating && (
              <p className="break-words text-xs text-rose-600 dark:text-rose-400">{textEstimateError}</p>
            )}
          </div>

          {/* 实时稳糖分 */}
          <div className="flex items-center justify-between rounded-xl border border-slate-200/70 bg-slate-50/60 p-3 dark:border-white/[0.06] dark:bg-slate-800/40">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              单餐稳糖得分实时预估（顺序 30 · 控碳 30 · 餐后活动 20 · 神经状态 20）
            </div>
            <div
              className={cn(
                "ml-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border text-lg font-bold tabular-nums tracking-tight",
                SCORE_TONE_CLASS[tone]
              )}
            >
              {score}
            </div>
          </div>
        </div>
        )}

        {mode === "log" && (
        <DialogFooter>
          <Button variant="outline" className="w-full sm:w-auto" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button className="w-full sm:w-auto" onClick={handleSave}>
            <Check className="h-4 w-4" />
            {prefill?.id ? "保存修改" : "完成打卡"}
          </Button>
        </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
