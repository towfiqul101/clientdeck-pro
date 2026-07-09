import { cn } from "@/lib/utils/helpers";
import { LayoutGrid } from "lucide-react";

interface LogoProps {
  className?: string;
  /** Use light text for dark backgrounds (e.g. the sidebar). */
  variant?: "dark" | "light";
}

/** ClientDeck Pro wordmark with mark. */
export function Logo({ className, variant = "dark" }: LogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-violet-700 text-white shadow-[0_2px_10px_rgba(139,92,246,0.35)]">
        <LayoutGrid className="h-5 w-5" />
      </span>
      <span
        className={cn(
          "text-lg font-semibold tracking-tight",
          variant === "light" ? "text-white" : "text-slate-900"
        )}
      >
        ClientDeck<span className="text-violet-400"> Pro</span>
      </span>
    </span>
  );
}
