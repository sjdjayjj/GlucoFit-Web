import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Smartisan Chip（253:2478）：胶囊形、12px 半粗、低饱和配色、0.4px 细描边。
 * 语义色映射到 Kit 的 Chip 五色 + 框架语义色（低饱和）。
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border-[0.4px] px-2.5 py-0.5 text-xs font-semibold leading-none transition-none",
  {
    variants: {
      variant: {
        default:
          "bg-secondary text-[#646464] border-[#cecece] dark:bg-secondary dark:text-[#a8a8a8] dark:border-[#4a4a4a]",
        secondary:
          "bg-[#f0f0f0] text-[#646464] border-[#dadada] dark:bg-secondary dark:text-[#a8a8a8] dark:border-[#4a4a4a]",
        outline:
          "bg-transparent text-muted-foreground border-border",
        success:
          "bg-[#eef5e2] text-[#54761e] border-[#b9d189] dark:bg-[#2a3320] dark:text-[#9cc35c] dark:border-[#4a5c33]",
        warning:
          "bg-[#fff5d9] text-[#96641c] border-[#ccb08c] dark:bg-[#362e1c] dark:text-[#dba75f] dark:border-[#5c4d2e]",
        danger:
          "bg-[#ffe7e5] text-[#c23430] border-[#eb7f77] dark:bg-[#3a2422] dark:text-[#f28a80] dark:border-[#63302c]",
        info: "bg-card text-[#3f6ad4] border-[#93b2f7] dark:bg-[#1e2739] dark:text-[#7fa3f0] dark:border-[#3d5284]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
