import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Smartisan 按钮（Elevated Button 18:7 / Small 147:413 / Outlined 26:13）：
 * 主按钮 = 纵向蓝渐变 + 0.8px 深蓝描边 + 短投影；按下瞬时变纯色 #3a60c5。
 * 白色/描边按钮按下渐变上下反转（像被按进去）。无涟漪、无 hover 缩放。
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[10px] text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-30 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "s-grad-primary text-white border-[0.8px] border-[#3a5fc9] shadow-s-btn active:bg-[#3a60c5] active:border-[#3157bd] dark:active:border-[#3d63c4]",
        destructive:
          "s-grad-danger text-white border-[0.8px] border-[#d2463c] active:bg-[#df4f46] active:border-[#c43c33]",
        outline:
          "h-[30px] rounded-[4px] border-[0.5px] border-[#d3d3d3] bg-transparent text-[#606060] dark:text-[#a8a8a8] dark:border-[#4a4a4a] active:bg-muted dark:active:bg-secondary",
        secondary:
          "s-grad-white s-grad-white-press border-[0.8px] border-border text-title-other shadow-none",
        ghost:
          "text-muted-foreground active:bg-muted active:text-foreground",
        link: "text-accent-foreground underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-[30px] rounded-[4px] px-3 text-[13px] border-[0.4px]",
        lg: "h-11 px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
