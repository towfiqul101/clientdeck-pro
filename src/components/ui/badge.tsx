import { cn, getStatusColor } from "@/lib/utils/helpers";

interface BadgeProps {
  /** Status key resolved via getStatusColor(); falls back to gray. */
  status: string;
  label?: string;
  className?: string;
  /** Renders a small colored dot before the label, using the same color family as the pill. */
  showDot?: boolean;
  /** "sm" is a denser pill for tight table cells; "md" (default) matches existing usage. */
  size?: "sm" | "md";
}

const sizeClasses: Record<NonNullable<BadgeProps["size"]>, string> = {
  sm: "px-1.5 py-0.5 text-[11px]",
  md: "px-2 py-0.5 text-xs",
};

/** Colored status pill. Label defaults to a humanized version of the status. */
export function Badge({ status, label, className, showDot = false, size = "md" }: BadgeProps) {
  const text = label ?? status.replace(/_/g, " ");
  const colorClasses = getStatusColor(status);
  // getStatusColor returns "bg-{color}-100 text-{color}-800"-shaped strings; reuse the
  // text-color half for the dot so it always matches the pill without a second color map.
  const dotColor = colorClasses.split(" ").find((c) => c.startsWith("text-"));
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium capitalize",
        sizeClasses[size],
        colorClasses,
        className
      )}
    >
      {showDot && (
        <span className={cn("h-1.5 w-1.5 rounded-full bg-current", dotColor)} />
      )}
      {text}
    </span>
  );
}
