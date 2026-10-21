import * as React from "react";
import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "s-inset-field flex min-h-[72px] w-full rounded-[6px] border-[0.8px] border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-[#8f8f8f] dark:placeholder:text-[#838383] transition-colors focus-visible:outline-none focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-40",
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
