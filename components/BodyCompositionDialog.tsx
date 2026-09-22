"use client";

import { useEffect, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { BodyImageUploader } from "@/components/BodyImageUploader";
import { useGlucoFitStore } from "@/lib/storage";
import { todayDateStr, uid } from "@/lib/utils";
import type { BodyCompositionRecord } from "@/types";

interface NumericField {
  key: keyof Pick<
    BodyCompositionRecord,
    "weightKg" | "bmi" | "bodyFatRate" | "fatMassKg" | "waterWeightKg" | "proteinWeightKg" | "boneMassKg" | "bodyScore"
  >;
  label: string;
  unit: string;
  required?: boolean;
  step?: string;
}

const REQUIRED_FIELDS: NumericField[] = [
  { key: "weightKg", label: "体重", unit: "kg", required: true, step: "0.1" },
  { key: "bmi", label: "BMI", unit: "", required: true, step: "0.1" },
  { key: "bodyFatRate", label: "体脂率", unit: "%", required: true, step: "0.1" },
  { key: "fatMassKg", label: "脂肪量", unit: "kg", required: true, step: "0.1" },
];

const OPTIONAL_FIELDS: NumericField[] = [
  { key: "waterWeightKg", label: "体水分量", unit: "kg", step: "0.1" },
  { key: "proteinWeightKg", label: "蛋白质量", unit: "kg", step: "0.1" },
  { key: "boneMassKg", label: "骨盐量", unit: "kg", step: "0.01" },
  { key: "bodyScore", label: "身体得分", unit: "分", step: "1" },
];

export function BodyCompositionDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const addBodyRecord = useGlucoFitStore((s) => s.addBodyRecord);
  const [date, setDate] = useState(todayDateStr());
  const [values, setValues] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [imageUrl, setImageUrl] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDate(todayDateStr());
      setValues({});
      setNotes("");
      setImageUrl(undefined);
      setError(null);
    }
  }, [open]);

  const handleSave = () => {
    const parsed: Record<string, number> = {};
    for (const field of [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS]) {
      const raw = values[field.key]?.trim();
      if (raw) {
        const num = Number(raw);
        if (Number.isNaN(num) || num <= 0) {
          setError(`${field.label} 请输入有效的正数`);
          return;
        }
        parsed[field.key] = num;
      } else if (field.required) {
        setError(`请填写核心必填项：${field.label}`);
        return;
      }
    }
    setError(null);
    addBodyRecord({
      id: uid(),
      date,
      imageUrl,
      weightKg: parsed.weightKg,
      bmi: parsed.bmi,
      bodyFatRate: parsed.bodyFatRate,
      fatMassKg: parsed.fatMassKg,
      waterWeightKg: parsed.waterWeightKg,
      proteinWeightKg: parsed.proteinWeightKg,
      boneMassKg: parsed.boneMassKg,
      bodyScore: parsed.bodyScore,
      notes: notes.trim() || undefined,
    });
    onOpenChange(false);
  };

  const renderField = (field: NumericField) => (
    <div key={field.key} className="space-y-1.5">
      <Label htmlFor={`body-${field.key}`}>
        {field.label}
        {field.required && <span className="text-red-500"> *</span>}
        {field.unit && (
          <span className="ml-1 text-xs font-normal text-muted-foreground">({field.unit})</span>
        )}
      </Label>
      <Input
        id={`body-${field.key}`}
        type="number"
        inputMode="decimal"
        min="0"
        step={field.step}
        placeholder={field.label}
        value={values[field.key] ?? ""}
        onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
      />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>录入体脂秤数据</DialogTitle>
          <DialogDescription>
            照着体脂秤 App 报告一次性填入，追踪脂肪量下降与蛋白质维持情况
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* AI 截图识别 */}
          <BodyImageUploader
            onRecognized={(result, img) => {
              const next: Record<string, string> = {
                weightKg: String(result.weightKg),
                bmi: String(result.bmi),
                bodyFatRate: String(result.bodyFatRate),
                fatMassKg: String(result.fatMassKg),
              };
              if (result.bodyScore != null) next.bodyScore = String(result.bodyScore);
              if (result.waterWeightKg != null) next.waterWeightKg = String(result.waterWeightKg);
              if (result.boneMassKg != null) next.boneMassKg = String(result.boneMassKg);
              if (result.proteinWeightKg != null)
                next.proteinWeightKg = String(result.proteinWeightKg);
              setValues(next);
              setImageUrl(img);
              setError(null);
            }}
          />

          <div className="space-y-1.5">
            <Label htmlFor="body-date">记录日期</Label>
            <Input
              id="body-date"
              type="date"
              value={date}
              max={todayDateStr()}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div>
            <div className="mb-2 text-xs font-medium text-muted-foreground">核心指标（必填）</div>
            <div className="grid grid-cols-2 gap-3">{REQUIRED_FIELDS.map(renderField)}</div>
          </div>

          <div>
            <div className="mb-2 text-xs font-medium text-muted-foreground">体成分细分（选填）</div>
            <div className="grid grid-cols-2 gap-3">{OPTIONAL_FIELDS.map(renderField)}</div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="body-notes">备注（选填）</Label>
            <Textarea
              id="body-notes"
              placeholder="如：晨起空腹称重"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
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
