"use client";

import { useRef, useState } from "react";
import { CheckCircle2, ImagePlus, Loader2 } from "lucide-react";
import { useAISettingsStore } from "@/lib/storage";
import { recognizeBodyReport, type BodyOcrResult } from "@/lib/ai-client";
import { downscaleImageFile } from "@/lib/image";
import { cn } from "@/lib/utils";

/**
 * 体脂秤截图 AI 识别上传区：
 * 上传报告截图 -> 视觉模型 OCR -> 回调识别结果与原图供预填表单。
 */
export function BodyImageUploader({
  onRecognized,
}: {
  onRecognized: (result: BodyOcrResult, imageDataUrl: string) => void;
}) {
  const aiSettings = useAISettingsStore((s) => s.aiSettings);
  const inputRef = useRef<HTMLInputElement>(null);
  const [recognizing, setRecognizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setSuccess(false);
    try {
      if (!aiSettings.baseUrl || !aiSettings.apiKey) {
        throw new Error("请先在右上角「AI 模型设置」中配置 API 与视觉模型");
      }
      if (!aiSettings.visionModel) {
        throw new Error("当前未配置视觉模型，请在设置中补充后重试");
      }
      const dataUrl = await downscaleImageFile(file);
      setPreview(dataUrl);
      setRecognizing(true);
      const result = await recognizeBodyReport(aiSettings, dataUrl);
      onRecognized(result, dataUrl);
      setSuccess(true);
    } catch (e) {
      setError((e as Error).message || "识别失败，请重试");
    } finally {
      setRecognizing(false);
    }
  };

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          void handleFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        disabled={recognizing}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-emerald-300 bg-emerald-50/60 px-4 py-3 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-50 disabled:opacity-60"
        )}
      >
        {recognizing ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            AI 正在识别报告，请稍候…
          </>
        ) : (
          <>
            <ImagePlus className="h-4 w-4" />
            上传体脂秤截图，AI 一键识别录入
          </>
        )}
      </button>

      {preview && (
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="体脂秤报告截图"
            className="h-12 w-12 rounded-md border object-cover"
          />
          {success && (
            <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
              <CheckCircle2 className="h-3.5 w-3.5" />
              识别完成，请核对下方数据
            </span>
          )}
        </div>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
