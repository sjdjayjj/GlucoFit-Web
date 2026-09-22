"use client";

import { useEffect, useMemo, useState } from "react";
import { Dumbbell, Zap } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { useGlucoFitStore, useSortedBodyRecords } from "@/lib/storage";
import {
  EXERCISE_METS,
  estimateExerciseCalories,
} from "@/lib/profile";
import {
  EXERCISE_CATEGORY_DESC,
  EXERCISE_CATEGORY_LABEL,
  MUSCLE_FEEL_OPTIONS,
} from "@/types";
import type { ExerciseCategory, ExerciseLog } from "@/types";
import { cn, uid } from "@/lib/utils";

function nowLocalInputValue(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

const CATEGORY_ORDER: ExerciseCategory[] = [
  "post_meal_walk",
  "resistance",
  "cardio",
  "other",
];

export function ExerciseLogDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const addExerciseLog = useGlucoFitStore((s) => s.addExerciseLog);
  const records = useSortedBodyRecords();
  const latestWeight = records[records.length - 1]?.weightKg;

  const [form, setForm] = useState({
    category: "post_meal_walk" as ExerciseCategory,
    startAt: nowLocalInputValue(),
    durationMinutes: "30",
    caloriesBurned: "",
    isPostMeal: true,
    muscleFeel: [] as string[],
    notes: "",
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm({
        category: "post_meal_walk",
        startAt: nowLocalInputValue(),
        durationMinutes: "30",
        caloriesBurned: "",
        isPostMeal: true,
        muscleFeel: [],
        notes: "",
      });
      setError(null);
    }
  }, [open]);

  const set = (partial: Partial<typeof form>) =>
    setForm((f) => ({ ...f, ...partial }));

  /** MET 估算辅助：MET × 当前最新体重 × 时长 */
  const estimated = useMemo(() => {
    const minutes = Number(form.durationMinutes);
    if (!latestWeight || !minutes || minutes <= 0) return null;
    return {
      kcal: estimateExerciseCalories(form.category, latestWeight, minutes),
      met: EXERCISE_METS[form.category],
      weightKg: latestWeight,
      minutes,
    };
  }, [form.category, form.durationMinutes, latestWeight]);

  const toggleFeel = (tag: string) =>
    set({
      muscleFeel: form.muscleFeel.includes(tag)
        ? form.muscleFeel.filter((t) => t !== tag)
        : [...form.muscleFeel, tag],
    });

  const handleSave = () => {
    const minutes = Number(form.durationMinutes);
    const kcal = Number(form.caloriesBurned);
    if (!form.startAt) {
      setError("请选择运动开始时间");
      return;
    }
    if (!(minutes > 0 && minutes <= 600)) {
      setError("请输入有效时长（1-600 分钟）");
      return;
    }
    if (form.caloriesBurned && !(kcal >= 0 && kcal <= 5000)) {
      setError("请输入有效消耗热量（0-5000 kcal）");
      return;
    }
    const log: ExerciseLog = {
      id: uid(),
      timestamp: new Date(form.startAt).toISOString(),
      category: form.category,
      durationMinutes: minutes,
      caloriesBurned: form.caloriesBurned ? Math.round(kcal) : (estimated?.kcal ?? 0),
      isPostMeal: form.isPostMeal,
      muscleFeel: form.muscleFeel.length ? form.muscleFeel : undefined,
      notes: form.notes.trim() || undefined,
    };
    addExerciseLog(log);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Dumbbell className="h-5 w-5 text-primary" />
            记录运动
          </DialogTitle>
          <DialogDescription>
            抗阻增肌扩大肌糖原池、餐后肌肉泵激活 GLUT4
            非胰岛素依赖转位，消耗数据用于计算每日净热量平衡。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 运动类型 */}
          <div className="space-y-1.5">
            <Label>运动类型 *</Label>
            <div className="grid grid-cols-2 gap-1.5">
              {CATEGORY_ORDER.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => set({ category: c })}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-left transition-colors",
                    form.category === c
                      ? "border-primary bg-primary/10"
                      : "bg-card hover:bg-muted"
                  )}
                >
                  <div
                    className={cn(
                      "text-xs font-semibold",
                      form.category === c ? "text-primary" : "text-foreground"
                    )}
                  >
                    {EXERCISE_CATEGORY_LABEL[c]}
                  </div>
                  <div className="mt-0.5 text-[11px] leading-tight text-muted-foreground">
                    {EXERCISE_CATEGORY_DESC[c]}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ex-start">开始时间 *</Label>
              <Input
                id="ex-start"
                type="datetime-local"
                value={form.startAt}
                onChange={(e) => set({ startAt: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ex-duration">时长 (分钟) *</Label>
              <Input
                id="ex-duration"
                type="number"
                inputMode="numeric"
                min={1}
                max={600}
                value={form.durationMinutes}
                onChange={(e) => set({ durationMinutes: e.target.value })}
              />
            </div>
          </div>

          {/* 消耗热量 + MET 估算辅助 */}
          <div className="space-y-1.5">
            <Label htmlFor="ex-kcal">消耗热量 (kcal)</Label>
            <div className="flex gap-2">
              <Input
                id="ex-kcal"
                type="number"
                inputMode="decimal"
                min={0}
                max={5000}
                placeholder={estimated ? `估算 ${estimated.kcal} kcal` : "手动输入"}
                value={form.caloriesBurned}
                onChange={(e) => set({ caloriesBurned: e.target.value })}
              />
              {estimated && (
                <Button
                  type="button"
                  variant="outline"
                  className="shrink-0"
                  onClick={() => set({ caloriesBurned: String(estimated.kcal) })}
                >
                  <Zap className="h-4 w-4" />
                  填入估算
                </Button>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {estimated
                ? `MET ${estimated.met} × ${estimated.weightKg.toFixed(1)} kg × ${(estimated.minutes / 60).toFixed(2)} h ≈ ${estimated.kcal} kcal，留空保存时自动采用`
                : "暂无体重数据，无法按 MET 估算，请手动输入"}
            </p>
          </div>

          {/* 是否餐后 */}
          <div className="flex items-center justify-between rounded-lg border bg-muted/40 p-3">
            <div>
              <Label htmlFor="ex-post-meal" className="text-sm">
                紧邻餐后（30-45 分钟内）
              </Label>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                餐后肌肉泵计 入稳糖行为闭环
              </p>
            </div>
            <Switch
              id="ex-post-meal"
              checked={form.isPostMeal}
              onCheckedChange={(v) => set({ isPostMeal: v })}
            />
          </div>

          {/* 肌肉刺激体感 */}
          <div className="space-y-1.5">
            <Label>肌肉刺激体感（可多选）</Label>
            <div className="flex flex-wrap gap-1.5">
              {MUSCLE_FEEL_OPTIONS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleFeel(tag)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                    form.muscleFeel.includes(tag)
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-input bg-card text-muted-foreground hover:bg-muted"
                  )}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ex-notes">备注</Label>
            <Textarea
              id="ex-notes"
              rows={2}
              placeholder="如：深蹲 4×12，硬拉 3×8"
              value={form.notes}
              onChange={(e) => set({ notes: e.target.value })}
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSave}>保存记录</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
