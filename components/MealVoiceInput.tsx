"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, Sparkles, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAISettingsStore } from "@/lib/storage";
import type { EnergyReaction, MealType } from "@/types";
import { cn } from "@/lib/utils";

// ---------- Web Speech API 最小类型声明 ----------

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: { length: number; [index: number]: SpeechRecognitionResultLike };
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

// ---------- 语音解析结果 ----------

export interface VoiceMealParse {
  mealType: MealType;
  foodSummary: string;
  followedSequence: boolean;
  avoidedRefinedCarb: boolean;
  postMealActivity: boolean;
  energyReaction: EnergyReaction;
  calories: number;
  carbsG: number;
  proteinG: number;
  fatG: number;
}

/**
 * 语音快记 (v2.2)：
 * 浏览器 Web Speech API 实时转写（zh-CN）→ /api/ai/voice-parse 解析为结构化餐食字段。
 * 不支持的浏览器自动隐藏降级为普通输入。
 */
export function MealVoiceInput({
  onParsed,
}: {
  onParsed: (result: VoiceMealParse) => void;
}) {
  const aiSettings = useAISettingsStore((s) => s.aiSettings);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSupported(getSpeechRecognition() !== null);
    return () => recognitionRef.current?.abort();
  }, []);

  const parseTranscript = async (text: string) => {
    if (!aiSettings.baseUrl || !aiSettings.apiKey || !aiSettings.model) {
      setError("请先在设置中配置 AI 模型后再使用语音解析");
      return;
    }
    setParsing(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/voice-parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          baseUrl: aiSettings.baseUrl,
          apiKey: aiSettings.apiKey,
          model: aiSettings.model,
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        parsed?: VoiceMealParse;
        error?: string;
      } | null;
      if (!res.ok || !data?.parsed) {
        throw new Error(data?.error || "解析失败，请重试");
      }
      onParsed(data.parsed);
      setTranscript("");
    } catch (e) {
      setError((e as Error).message || "解析失败，请重试");
    } finally {
      setParsing(false);
    }
  };

  const startListening = () => {
    const Ctor = getSpeechRecognition();
    if (!Ctor) return;
    setError(null);
    setTranscript("");

    const recognition = new Ctor();
    recognitionRef.current = recognition;
    recognition.lang = "zh-CN";
    recognition.continuous = false;
    recognition.interimResults = true;

    let finalText = "";
    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0]?.transcript ?? "";
        if (result.isFinal) finalText += text;
        else interim += text;
      }
      setTranscript(finalText || interim);
    };
    recognition.onerror = (event) => {
      setListening(false);
      const code = event.error;
      if (code === "not-allowed" || code === "service-not-allowed") {
        setError("麦克风权限被拒绝，请在浏览器设置中允许后重试");
      } else if (code === "no-speech") {
        setError("没有识别到语音，请靠近麦克风再说一次");
      } else {
        setError("语音识别出错，请重试");
      }
    };
    recognition.onend = () => {
      setListening(false);
      // 结束后若有最终文本 → 交给 LLM 解析
      if (finalText.trim()) void parseTranscript(finalText.trim());
    };

    setListening(true);
    recognition.start();
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
  };

  if (!supported) return null;

  const busy = listening || parsing;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={listening ? stopListening : startListening}
          disabled={parsing}
          className={cn(
            "shrink-0",
            listening && "border-red-300 bg-red-50 text-red-600"
          )}
        >
          {parsing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : listening ? (
            <Square className="h-3.5 w-3.5" />
          ) : (
            <Mic className="h-4 w-4" />
          )}
          {listening ? "停止录音" : parsing ? "AI 解析中…" : "语音快记"}
        </Button>
        <span
          className={cn(
            "text-[11px] text-muted-foreground",
            listening && "animate-pulse text-red-500"
          )}
        >
          {listening
            ? "正在听…例如：中午吃了一大碗牛肉面，吃完特别困，没去散步"
            : "说一句话，AI 自动填好整张打卡表单"}
        </span>
      </div>

      {transcript && (
        <div className="flex items-start gap-1.5 rounded-lg border border-sky-200 bg-sky-50 p-2 text-xs text-sky-800">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-500" />
          <span className="leading-snug">{transcript}</span>
        </div>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
