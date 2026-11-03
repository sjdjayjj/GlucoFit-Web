"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Activity, RefreshCw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

/** 全局错误边界：渲染/数据异常时提供重试与回到首页 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 仅记录到控制台，避免把用户数据发往外部
    console.error("GlucoFit 页面异常：", error);
  }, [error]);

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-[10px] border border-border bg-card p-6 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-[10px] s-grad-primary text-white border-[0.8px] border-[#3a5fc9]">
          <Activity className="h-6 w-6 text-white" />
        </div>
        <h2 className="flex items-center justify-center gap-1.5 text-base font-semibold tracking-tight text-foreground">
          <TriangleAlert className="h-4 w-4 text-[#c23430] dark:text-[#e5645a]" />
          页面加载出错了
        </h2>
        <p className="mt-2 break-words text-sm leading-relaxed text-muted-foreground">
          {error.message || "出现未知异常，可重试或返回首页。"}
        </p>
        <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
          <Button onClick={reset} className="w-full sm:w-auto">
            <RefreshCw className="h-4 w-4" />
            重试
          </Button>
          <Link
            href="/"
            className="inline-flex h-10 w-full items-center justify-center rounded-[10px] border-[0.5px] border-[#d3d3d3] px-4 text-sm font-semibold text-[#606060] active:bg-muted sm:w-auto dark:border-[#4a4a4a] dark:text-[#a8a8a8] dark:active:bg-secondary"
          >
            回到首页
          </Link>
        </div>
      </div>
    </div>
  );
}
