"use client";

import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

/**
 * Smartisan 开关（Switch 42:1333）：
 * 白色内凹凹槽里一颗白色拨钮，另一侧露出小圆点指示：
 * 关 = 拨钮在左、右侧灰点；开 = 拨钮在右、左侧蓝点。归位线性移动。
 */
const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      "group peer relative inline-flex h-6 w-[52px] shrink-0 cursor-pointer items-center rounded-full border-[0.4px] border-border bg-card shadow-inset-switch focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-75",
      className
    )}
    {...props}
    ref={ref}
  >
    {/* 指示圆点：关时在右（灰），开时在左（蓝） */}
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute top-1/2 h-[9.6px] w-[9.6px] -translate-y-1/2 rounded-full border-[0.4px] transition-[left,background-color,border-color] duration-100 ease-linear",
        "left-[34.5px] bg-[#f4f4f4] border-[#e8e8e8] dark:bg-[#4a4a4a] dark:border-[#555]",
        "group-data-[state=checked]:left-[7.9px] group-data-[state=checked]:bg-[linear-gradient(180deg,#9cbcff,#7da7ff)] group-data-[state=checked]:border-[#769dfe]"
      )}
    />
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none block h-6 w-6 rounded-full s-grad-white border-[0.4px] border-border shadow-s-thumb transition-transform duration-100 ease-linear data-[state=checked]:translate-x-[27px]"
      )}
    />
  </SwitchPrimitives.Root>
));
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
