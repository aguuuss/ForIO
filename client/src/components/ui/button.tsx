import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-[8px] text-sm font-semibold transition-all disabled:pointer-events-none disabled:opacity-60",
  {
    variants: {
      variant: {
        default: "bg-[var(--secondary)] text-white shadow-[0_10px_24px_rgba(0,89,187,0.18)] hover:bg-[var(--secondary-strong)]",
        ghost: "border border-transparent bg-[var(--bg-soft)] text-slate-700 hover:border-[rgba(0,89,187,0.2)] hover:text-[var(--secondary)]",
        outline: "border border-[var(--line)] bg-white text-slate-800 hover:border-[var(--secondary)] hover:text-[var(--secondary)]",
        danger: "bg-[var(--danger-soft)] text-[var(--danger)] hover:bg-[#f9d8d6]"
      },
      size: {
        default: "h-11 px-4 py-2",
        sm: "h-9 px-3",
        lg: "h-12 px-5",
        icon: "size-10"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, ...props }, ref) => (
  <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
));

Button.displayName = "Button";

export { Button, buttonVariants };
