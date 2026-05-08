import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "flex h-12 w-full rounded-[8px] border border-[var(--line-strong)] bg-white px-4 py-3 text-sm text-[var(--text)] outline-none transition-all placeholder:text-slate-400 focus:border-[var(--secondary)] focus:ring-4 focus:ring-[rgba(0,89,187,0.12)]",
      className
    )}
    {...props}
  />
));

Input.displayName = "Input";

export { Input };
