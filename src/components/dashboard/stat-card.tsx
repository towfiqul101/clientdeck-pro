import { cn } from "@/lib/utils/helpers";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  /** Tailwind color token base, e.g. "blue", "green", "amber". */
  accent?: "blue" | "green" | "amber" | "purple";
  trend?: string;
}

const accents: Record<
  NonNullable<StatCardProps["accent"]>,
  { bg: string; text: string }
> = {
  blue: { bg: "bg-blue-50", text: "text-blue-600" },
  green: { bg: "bg-green-50", text: "text-green-600" },
  amber: { bg: "bg-amber-50", text: "text-amber-600" },
  purple: { bg: "bg-purple-50", text: "text-purple-600" },
};

export function StatCard({
  label,
  value,
  icon: Icon,
  accent = "blue",
  trend,
}: StatCardProps) {
  const color = accents[accent];
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-lg",
            color.bg
          )}
        >
          <Icon className={cn("h-5 w-5", color.text)} />
        </span>
        {trend && (
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
            {trend}
          </span>
        )}
      </div>
      <p className="mt-4 text-3xl font-bold tracking-tight text-gray-900">
        {value}
      </p>
      <p className="mt-1 text-sm text-gray-500">{label}</p>
    </div>
  );
}
