import { cn } from "@/lib/utils/helpers";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  /** Accent color for the icon chip. */
  accent?: "blue" | "green" | "amber" | "purple" | "teal";
  /** Short status/trend caption shown under the value. */
  trend?: string;
  /** Tone controls the trend caption color + arrow. Defaults to neutral. */
  trendTone?: "up" | "down" | "neutral";
}

const accents: Record<
  NonNullable<StatCardProps["accent"]>,
  { bg: string; text: string }
> = {
  blue: { bg: "bg-blue-500/20", text: "text-blue-400" },
  green: { bg: "bg-emerald-500/20", text: "text-emerald-400" },
  amber: { bg: "bg-amber-500/20", text: "text-amber-400" },
  purple: { bg: "bg-violet-500/20", text: "text-violet-400" },
  teal: { bg: "bg-teal-500/20", text: "text-teal-400" },
};

const trendTones: Record<
  NonNullable<StatCardProps["trendTone"]>,
  { text: string; icon: LucideIcon }
> = {
  up: { text: "text-emerald-400", icon: TrendingUp },
  down: { text: "text-amber-400", icon: TrendingDown },
  neutral: { text: "text-slate-500", icon: Minus },
};

export function StatCard({
  label,
  value,
  icon: Icon,
  accent = "blue",
  trend,
  trendTone = "neutral",
}: StatCardProps) {
  const color = accents[accent];
  const tone = trendTones[trendTone];
  const TrendIcon = tone.icon;

  return (
    <div className="glass-card animate-fade-up flex flex-col gap-3 p-5">
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-xl",
            color.bg
          )}
        >
          <Icon className={cn("h-5 w-5", color.text)} />
        </span>
        <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-slate-500">
          {label}
        </span>
      </div>
      <div>
        <div className="text-3xl font-bold tracking-tight text-slate-100">
          {value}
        </div>
        {trend && (
          <div className="mt-1 flex items-center gap-1.5">
            <TrendIcon className={cn("h-3.5 w-3.5", tone.text)} />
            <span className={cn("text-xs font-medium", tone.text)}>
              {trend}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
