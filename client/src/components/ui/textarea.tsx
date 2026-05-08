import * as React from "react";
import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "flex min-h-[110px] w-full rounded-[8px] border border-[var(--line-strong)] bg-white px-4 py-3 text-sm text-[var(--text)] outline-none transition-all placeholder:text-slate-400 focus:border-[var(--secondary)] focus:ring-4 focus:ring-[rgba(0,89,187,0.12)]",
      className
    )}
    {...props}
  />
));

Textarea.displayName = "Textarea";

export { Textarea };
