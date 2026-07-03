import { cn, getStatusColor } from "@/lib/utils/helpers";

interface BadgeProps {
  /** Status key resolved via getStatusColor(); falls back to gray. */
  status: string;
  label?: string;
  className?: string;
}

/** Colored status pill. Label defaults to a humanized version of the status. */
export function Badge({ status, label, className }: BadgeProps) {
  const text = label ?? status.replace(/_/g, " ");
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize",
        getStatusColor(status),
        className
      )}
    >
      {text}
    </span>
  );
}
