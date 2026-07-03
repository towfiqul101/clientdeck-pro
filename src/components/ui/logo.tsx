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
      <span className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-600 text-white">
        <LayoutGrid className="h-5 w-5" />
      </span>
      <span
        className={cn(
          "text-lg font-semibold tracking-tight",
          variant === "light" ? "text-white" : "text-gray-900"
        )}
      >
        ClientDeck<span className="text-blue-500"> Pro</span>
      </span>
    </span>
  );
}
