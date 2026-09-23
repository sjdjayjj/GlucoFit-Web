"use client";

import { useEffect, useMemo, useState } from "react";
import { Gauge, Loader2, Sparkles, Target } from "lucide-react";
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
import { useGlucoFitStore } from "@/lib/storage";
import {
  ACTIVITY_LEVEL_OPTIONS,
  calcBmrMifflin,
  useProfileStore,
} from "@/lib/profile";
import { calculateTargetOptions, type TargetOption } from "@/lib/target-calculator";
import { GENDER_LABEL, TARGET_STRATEGY_LABEL } from "@/types";
import type { Gender, UserProfile } from "@/types";
import { cn } from "@/lib/utils";

const CURRENT_YEAR = new Date().getFullYear();

/** 三档卡片配色（保守 = 稳健绿 / 中性 = 推荐蓝 / 激进 = 进取紫） */
const STRATEGY_CARD_CLASS: Record<TargetOption["type"], string> = {
  conservative: "border-emerald-500 bg-emerald-50 text-emerald-700",
  moderate: "border-sky-500 bg-sky-50 text-sky-700",
  aggressive: "border-violet-500 bg-violet-50 text-violet-700",
};

const STRATEGY_TIP: Record<TargetOption["type"], string> = {
  conservative: "适合轻度 IR / 初学者 / 节奏忙碌者",
  moderate: "适合希望显著逆转内脏脂肪者",
  aggressive: "适合有力量训练基础者",
};

export function OnboardingModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const goal = useGlucoFitStore((s) => s.goal);
  const updateGoal = useGlucoFitStore((s) => s.updateGoal);
  const setActivityFactor = useGlucoFitStore((s) => s.setActivityFactor);
  const profile = useProfileStore((s) => s.profile);
  const saveProfile = useProfileStore((s) => s.saveProfile);

  const [form, setForm] = useState({
    gender: "male" as Gender,
    birthYear: String(CURRENT_YEAR - 30),
    heightCm: "",
    initialWeightKg: "",
    initialBodyFatRate: "",
    targetWeightKg: String(goal.targetWeightKg || ""),
    targetBodyFatRate: goal.targetBodyFatRate ? String(goal.targetBodyFatRate) : "",
    strategy: undefined as TargetOption["type"] | undefined,
    activityLevel: 1.375 as UserProfile["activityLevel"],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (profile) {
      // 编辑模式：预填已有档案
      setForm({
        gender: profile.gender,
        birthYear: String(profile.birthYear),
        heightCm: String(profile.heightCm),
        initialWeightKg: String(profile.initialWeightKg),
        initialBodyFatRate: profile.initialBodyFatRate
          ? String(profile.initialBodyFatRate)
          : "",
        targetWeightKg: String(profile.targetWeightKg),
        targetBodyFatRate: profile.targetBodyFatRate
          ? String(profile.targetBodyFatRate)
          : "",
        strategy: profile.strategy,
        activityLevel: profile.activityLevel,
      });
    } else {
      setForm((f) => ({
        ...f,
        strategy: undefined,
        targetWeightKg: String(goal.targetWeightKg || ""),
        targetBodyFatRate: goal.targetBodyFatRate
          ? String(goal.targetBodyFatRate)
          : "",
      }));
    }
  }, [open, profile, goal.targetWeightKg, goal.targetBodyFatRate]);

  const set = (partial: Partial<typeof form>) =>
    setForm((f) => ({ ...f, ...partial }));

  const heightM = Number(form.heightCm) / 100;
  const weight = Number(form.initialWeightKg);

  /** 基础参数齐全时生成三档目标推荐 */
  const targetOptions = useMemo(() => {
    const birthYear = Number(form.birthYear);
    if (
      !heightM ||
      !weight ||
      !(birthYear >= 1900 && birthYear <= CURRENT_YEAR) ||
      !(Number(form.heightCm) >= 100 && Number(form.heightCm) <= 250) ||
      !(weight >= 25 && weight <= 300)
    ) {
      return [];
    }
    return calculateTargetOptions(form.gender, birthYear, Number(form.heightCm), weight);
  }, [form.gender, form.birthYear, form.heightCm, weight, heightM]);

  const applyTarget = (opt: TargetOption) => {
    set({
      targetWeightKg: String(opt.targetWeightKg),
      targetBodyFatRate: String(opt.targetFatRate),
      strategy: opt.type,
    });
  };

  /** 实时衍生指标：BMI / BMR / TDEE */
  const derived = useMemo(() => {
    if (!heightM || !weight) return null;
    const bmi = weight / (heightM * heightM);
    const fatRate = Number(form.initialBodyFatRate);
    const draft: UserProfile = {
      id: "preview",
      gender: form.gender,
      birthYear: Number(form.birthYear) || CURRENT_YEAR - 30,
      heightCm: Number(form.heightCm),
      initialWeightKg: weight,
      targetWeightKg: Number(form.targetWeightKg) || weight,
      activityLevel: form.activityLevel,
      updatedAt: "",
      createdAt: "",
    };
    let bmr: number;
    if (fatRate > 0 && fatRate < 60) {
      bmr = 370 + 21.6 * (weight * (1 - fatRate / 100));
    } else {
      bmr = calcBmrMifflin(draft, weight);
    }
    return {
      bmi,
      bmr: Math.round(bmr),
      tdee: Math.round(bmr * form.activityLevel),
    };
  }, [heightM, weight, form.gender, form.birthYear, form.heightCm, form.initialBodyFatRate, form.targetWeightKg, form.activityLevel]);

  const handleSave = () => {
    if (!form.gender || !form.heightCm || !form.initialWeightKg || !form.targetWeightKg) {
      setError("性别、身高、初始体重与目标体重为必填项");
      return;
    }
    const birthYear = Number(form.birthYear);
    const h = Number(form.heightCm);
    const w = Number(form.initialWeightKg);
    const tw = Number(form.targetWeightKg);
    if (!(birthYear >= 1900 && birthYear <= CURRENT_YEAR)) {
      setError("请输入有效的出生年份");
      return;
    }
    if (!(h >= 100 && h <= 250)) {
      setError("请输入有效身高（100-250 cm）");
      return;
    }
    if (!(w >= 25 && w <= 300)) {
      setError("请输入有效体重（25-300 kg）");
      return;
    }
    if (!(tw >= 25 && tw <= 300)) {
      setError("请输入有效目标体重（25-300 kg）");
      return;
    }

    setSaving(true);
    setError(null);
    const now = new Date().toISOString();
    const fatRate = Number(form.initialBodyFatRate);
    const profile: UserProfile = {
      id: crypto.randomUUID(),
      gender: form.gender,
      birthYear,
      heightCm: h,
      initialWeightKg: w,
      initialBodyFatRate: fatRate > 0 ? fatRate : undefined,
      targetWeightKg: tw,
      targetBodyFatRate: form.targetBodyFatRate
        ? Number(form.targetBodyFatRate)
        : undefined,
      strategy: form.strategy,
      activityLevel: form.activityLevel,
      updatedAt: now,
      createdAt: now,
    };
    saveProfile(profile);
    // 目标与活动系数回写主存储，兼容既有模块
    updateGoal({
      targetWeightKg: tw,
      targetBodyFatRate: profile.targetBodyFatRate ?? goal.targetBodyFatRate,
    });
    setActivityFactor(form.activityLevel);
    setSaving(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {profile ? "编辑代谢初始档案" : "建立代谢初始档案"}
          </DialogTitle>
          <DialogDescription>
            填写生理参数后，系统将按标准 BMI 与体脂率基准智能推荐三档目标梯度，一键选中即可。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 性别 */}
          <div className="space-y-1.5">
            <Label>性别 *</Label>
            <div className="flex gap-1 rounded-lg border bg-muted/40 p-1">
              {(Object.keys(GENDER_LABEL) as Gender[]).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => set({ gender: g })}
                  className={cn(
                    "flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                    form.gender === g
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {GENDER_LABEL[g]}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ob-birth-year">出生年份 *</Label>
              <Input
                id="ob-birth-year"
                type="number"
                inputMode="numeric"
                placeholder="1990"
                value={form.birthYear}
                onChange={(e) => set({ birthYear: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ob-height">身高 (cm) *</Label>
              <Input
                id="ob-height"
                type="number"
                inputMode="decimal"
                placeholder="175"
                value={form.heightCm}
                onChange={(e) => set({ heightCm: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ob-initial-weight">初始空腹体重 (kg) *</Label>
              <Input
                id="ob-initial-weight"
                type="number"
                inputMode="decimal"
                placeholder="79.1"
                value={form.initialWeightKg}
                onChange={(e) => set({ initialWeightKg: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ob-initial-fat">初始体脂率 (%)</Label>
              <Input
                id="ob-initial-fat"
                type="number"
                inputMode="decimal"
                placeholder="选填，如 24.2"
                value={form.initialBodyFatRate}
                onChange={(e) => set({ initialBodyFatRate: e.target.value })}
              />
            </div>
          </div>

          {/* 三档智能目标推荐 */}
          {targetOptions.length > 0 && (
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Target className="h-3.5 w-3.5 text-primary" />
                智能目标推荐（三选一，也可手动微调）
              </Label>
              <div className="grid gap-2 sm:grid-cols-3">
                {targetOptions.map((opt) => (
                  <button
                    key={opt.type}
                    type="button"
                    onClick={() => applyTarget(opt)}
                    className={cn(
                      "rounded-lg border p-3 text-left transition-colors",
                      form.strategy === opt.type
                        ? STRATEGY_CARD_CLASS[opt.type]
                        : "border-input bg-card hover:bg-muted"
                    )}
                  >
                    <div className="flex items-center justify-between text-xs font-semibold">
                      {opt.label}
                      {form.strategy === opt.type && (
                        <Gauge className="h-3.5 w-3.5" />
                      )}
                    </div>
                    <div className="mt-1.5 text-lg font-bold tabular-nums">
                      {opt.targetWeightKg}
                      <span className="ml-0.5 text-xs font-normal">kg</span>
                      <span className="mx-1 text-muted-foreground">/</span>
                      {opt.targetFatRate}
                      <span className="ml-0.5 text-xs font-normal">%体脂</span>
                    </div>
                    <div className="mt-1 text-[10px] leading-snug opacity-80">
                      {STRATEGY_TIP[opt.type]}
                    </div>
                  </button>
                ))}
              </div>
              {form.strategy && (
                <p className="text-[11px] text-muted-foreground">
                  已选择「{TARGET_STRATEGY_LABEL[form.strategy]}」方案，可在下方微调具体数值。
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ob-target-weight">目标体重 (kg) *</Label>
              <Input
                id="ob-target-weight"
                type="number"
                inputMode="decimal"
                placeholder="70"
                value={form.targetWeightKg}
                onChange={(e) => set({ targetWeightKg: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ob-target-fat">目标体脂率 (%)</Label>
              <Input
                id="ob-target-fat"
                type="number"
                inputMode="decimal"
                placeholder="选填，如 18"
                value={form.targetBodyFatRate}
                onChange={(e) => set({ targetBodyFatRate: e.target.value })}
              />
            </div>
          </div>

          {/* 活动等级 */}
          <div className="space-y-1.5">
            <Label>日常静息活动等级</Label>
            <div className="grid grid-cols-4 gap-1 rounded-lg border bg-muted/40 p-1">
              {ACTIVITY_LEVEL_OPTIONS.map((a) => (
                <button
                  key={a.value}
                  type="button"
                  onClick={() => set({ activityLevel: a.value })}
                  className={cn(
                    "rounded-md px-1 py-1.5 text-xs font-medium transition-colors",
                    form.activityLevel === a.value
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>

          {/* 实时衍生指标 */}
          {derived && (
            <div className="grid grid-cols-3 gap-2 rounded-lg border bg-muted/40 p-3 text-center">
              <div>
                <div className="text-[11px] text-muted-foreground">基线 BMI</div>
                <div className="text-lg font-bold tabular-nums">{derived.bmi.toFixed(1)}</div>
              </div>
              <div>
                <div className="text-[11px] text-muted-foreground">BMR (kcal)</div>
                <div className="text-lg font-bold tabular-nums">{derived.bmr}</div>
              </div>
              <div>
                <div className="text-[11px] text-muted-foreground">初始 TDEE (kcal)</div>
                <div className="text-lg font-bold tabular-nums text-sky-600">{derived.tdee}</div>
              </div>
            </div>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            {profile ? "取消" : "稍后在设置中完善"}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            保存并开始
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
