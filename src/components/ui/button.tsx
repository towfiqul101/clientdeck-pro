"use client";

import { cn } from "@/lib/utils/helpers";
import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";
type Size = "sm" | "md";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variants: Record<Variant, string> = {
  primary:
    "bg-gradient-to-br from-violet-500 to-violet-700 text-white shadow-[0_4px_15px_rgba(139,92,246,0.3)] hover:-translate-y-px hover:shadow-[0_6px_20px_rgba(139,92,246,0.4)] focus-visible:ring-violet-500 active:translate-y-0 disabled:opacity-50 disabled:shadow-none",
  secondary:
    "bg-white/[0.06] text-slate-200 border border-white/10 hover:bg-white/10 hover:border-white/[0.15] focus-visible:ring-violet-500 disabled:opacity-50",
  danger:
    "bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25 focus-visible:ring-red-500 disabled:opacity-50",
  ghost:
    "bg-transparent text-slate-400 hover:bg-white/5 hover:text-slate-200 focus-visible:ring-slate-500 disabled:opacity-50",
};

const sizes: Record<Size, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-sm",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-[10px] font-medium transition-all duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f0f1a]",
        "disabled:cursor-not-allowed",
        variants[variant],
        sizes[size],
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}
