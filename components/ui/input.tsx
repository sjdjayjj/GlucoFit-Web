import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Smartisan Text Field（172:455）：
 * 白底 + 0.8px 描边 + 6px 圆角 + 内凹阴影；聚焦描边变 #93b2f7，无外发光 ring。
 */
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "s-inset-field flex h-10 w-full rounded-[6px] border-[0.8px] border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-[#8f8f8f] dark:placeholder:text-[#838383] transition-colors focus-visible:outline-none focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-40",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
