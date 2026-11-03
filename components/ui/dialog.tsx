"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

/* Smartisan 遮罩：纯 rgba(0,0,0,.6)，无毛玻璃 */
const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/60 dark:bg-black/70 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

/**
 * 设备自适应弹窗（Smartisan 规格）：
 * - 移动端（<sm）：底部菜单（Bottom Sheet），顶部圆角 20px，上滑 300ms
 * - 桌面端（≥sm）：对话框居中浮层，圆角 12px，卡片 0.9 缩放弹入
 *
 * 键盘安全：
 * - 高度上限走 CSS 变量 --sheet-max-h（由 visualViewport 实时写入，默认 85svh），
 *   不再依赖 dvh（dvh 不感知软键盘，键盘弹出后底部按钮会被遮挡）。
 * - 底部偏移走 --sheet-bottom = 布局视口高 - 可视视口高 - 可视视口偏移，
 *   键盘弹出时整体上移，保证「保存」按钮始终可达。
 * - 无 visualViewport 环境（旧浏览器 / 桌面）变量不写入，回落到 85svh + bottom:0。
 */
const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, style, ...props }, ref) => {
  const contentRef = React.useRef<HTMLDivElement | null>(null);
  const [viewport, setViewport] = React.useState<{
    maxHeight: number;
    bottomOffset: number;
  } | null>(null);

  const setContentRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      contentRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    },
    [ref]
  );

  React.useEffect(() => {
    const vv = window.visualViewport;
    const update = () => {
      const visible = vv ? vv.height : window.innerHeight;
      const offset = vv
        ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
        : 0;
      const next = {
        maxHeight: Math.round(visible * 0.9),
        bottomOffset: Math.round(offset),
      };
      setViewport((prev) =>
        prev && prev.maxHeight === next.maxHeight && prev.bottomOffset === next.bottomOffset
          ? prev
          : next
      );
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
    };
  }, []);

  // 输入框聚焦后滚进可视区（键盘弹出会压缩可视高度，nearest/center 均可）
  React.useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const onFocusIn = (event: FocusEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target || !el.contains(target)) return;
      const isField =
        /^(input|textarea|select)$/i.test(target.tagName) || target.isContentEditable;
      if (!isField) return;
      window.setTimeout(() => {
        target.scrollIntoView({ block: "center", behavior: "smooth" });
      }, 300); // 等软键盘展开动画结束再滚动，否则会按旧可视高度计算
    };
    el.addEventListener("focusin", onFocusIn);
    return () => el.removeEventListener("focusin", onFocusIn);
  }, []);

  const sheetStyle = viewport
    ? ({
        ...style,
        "--sheet-max-h": `${viewport.maxHeight}px`,
        "--sheet-bottom": `${viewport.bottomOffset}px`,
      } as React.CSSProperties)
    : style;

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={setContentRef}
        style={sheetStyle}
        className={cn(
          "fixed inset-x-0 bottom-[var(--sheet-bottom)] z-50 mx-auto flex max-h-[var(--sheet-max-h)] w-full flex-col gap-4 overflow-y-auto overscroll-contain rounded-t-[20px] border-[0.8px] border-b-0 border-border bg-card p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] duration-200 [--sheet-bottom:0px] [--sheet-max-h:85svh]",
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-[100%] data-[state=closed]:slide-out-to-bottom-[100%]",
          "sm:inset-x-auto sm:bottom-auto sm:left-[50%] sm:top-[50%] sm:max-h-[88dvh] sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[12px] sm:border-b-[0.8px] sm:p-6 sm:pb-6 sm:data-[state=open]:slide-in-from-bottom-0 sm:data-[state=closed]:slide-out-to-bottom-0 sm:data-[state=open]:zoom-in-95 sm:data-[state=closed]:zoom-out-95",
          className
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center text-sicon transition-none focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:pointer-events-none active:opacity-60 sm:right-4 sm:top-4">
          <X className="h-[18px] w-[18px]" strokeWidth={2} />
          <span className="sr-only">关闭</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  );
});
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      // 移动端底部弹窗：标题区吸顶，长表单滚动时标题常驻
      "sticky top-0 z-10 -mx-5 -mt-5 flex shrink-0 flex-col space-y-1 bg-card px-5 pb-2 pt-5 text-center",
      "sm:static sm:mx-0 sm:mt-0 sm:bg-transparent sm:px-0 sm:pb-0 sm:pt-0",
      className
    )}
    {...props}
  />
);
DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      // 移动端底部弹窗：操作区吸底（负外边距盖住弹窗内边距，视觉尺寸不变）
      "sticky bottom-0 z-10 -mx-5 -mb-5 flex flex-col-reverse gap-2 bg-card px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-3",
      "sm:static sm:mx-0 sm:mb-0 sm:flex-row sm:justify-end sm:space-x-0 sm:bg-transparent sm:px-0 sm:pb-0 sm:pt-0",
      className
    )}
    {...props}
  />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-[17px] font-bold leading-snug text-foreground",
      className
    )}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn(
      "text-[13px] leading-relaxed text-muted-foreground",
      className
    )}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
