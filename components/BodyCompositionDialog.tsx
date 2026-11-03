"use client";

import { useEffect, useRef, useState } from "react";
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
import { downscaleDataUrl } from "@/lib/image";
import { putFullImage } from "@/lib/image-idb";
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

/** OCR 字段 key → 中文名（用于「识别失败请手填」提示） */
const FIELD_LABEL: Record<string, string> = Object.fromEntries(
  [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS].map((f) => [f.key, f.label])
);

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
  /** OCR 部分字段识别失败/越界时的可见提示 */
  const [ocrWarning, setOcrWarning] = useState<string | null>(null);
  /** 本条记录的 id：原图以该 id 存入 IndexedDB，store 只留缩略图 */
  const recordIdRef = useRef<string>(uid());

  useEffect(() => {
    if (open) {
      recordIdRef.current = uid();
      setDate(todayDateStr());
      setValues({});
      setNotes("");
      setImageUrl(undefined);
      setError(null);
      setOcrWarning(null);
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
      id: recordIdRef.current,
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
        {field.required && <span className="text-[#c23430] dark:text-[#e5645a]"> *</span>}
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
              // 只预填识别成功的字段；越界/解析失败留空，由用户手填
              const next: Record<string, string> = {};
              if (result.weightKg != null) next.weightKg = String(result.weightKg);
              if (result.bmi != null) next.bmi = String(result.bmi);
              if (result.bodyFatRate != null) next.bodyFatRate = String(result.bodyFatRate);
              if (result.fatMassKg != null) next.fatMassKg = String(result.fatMassKg);
              if (result.bodyScore != null) next.bodyScore = String(result.bodyScore);
              if (result.waterWeightKg != null) next.waterWeightKg = String(result.waterWeightKg);
              if (result.boneMassKg != null) next.boneMassKg = String(result.boneMassKg);
              if (result.proteinWeightKg != null)
                next.proteinWeightKg = String(result.proteinWeightKg);
              setValues(next);
              setError(null);
              setOcrWarning(
                result.invalidFields.length
                  ? `以下字段未能识别或超出合理范围（体重 20–300kg、体脂率 3–70%、骨盐量 0.5–6kg 等），已留空请手动填写：${result.invalidFields
                      .map((key) => FIELD_LABEL[key] ?? key)
                      .join("、")}`
                  : null
              );
              // 原图转存 IndexedDB（store 只保留缩略图）；IDB 不可用时降级为原始 Base64
              void (async () => {
                const thumb = await downscaleDataUrl(img, 160, 0.6).catch(
                  () => undefined
                );
                const stored = thumb
                  ? await putFullImage(recordIdRef.current, img)
                  : false;
                setImageUrl(stored && thumb ? thumb : img);
              })();
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
            <div className="mb-2 text-[11px] font-semibold tracking-wider text-muted-foreground">
              核心指标（必填）
            </div>
            <div className="grid grid-cols-2 gap-3">{REQUIRED_FIELDS.map(renderField)}</div>
          </div>

          <div>
            <div className="mb-2 text-[11px] font-semibold tracking-wider text-muted-foreground">
              体成分细分（选填）
            </div>
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

          {ocrWarning && (
            <p className="break-words rounded-md border border-[#d9a441]/40 bg-[#fff7e3] px-3 py-2 text-xs text-[#8a5a00] dark:border-[#d9a441]/40 dark:bg-[#332a18] dark:text-[#e2b768]">
              {ocrWarning}
            </p>
          )}

          {error && <p className="break-words text-sm text-[#c23430] dark:text-[#e5645a]">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" className="w-full sm:w-auto" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button className="w-full sm:w-auto" onClick={handleSave}>保存记录</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
