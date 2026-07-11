"use client";

import { Check, Download } from "lucide-react";
import { cn } from "@/lib/utils/helpers";
import { useClientSelection } from "./client-selection-context";

// Checkboxes may render inside a whole-card <Link> (cards view); preventDefault
// stops the anchor's native navigation, so the toggle is driven manually from
// the click handler.
function handleToggleClick(e: React.MouseEvent | React.KeyboardEvent, run: () => void) {
  e.preventDefault();
  e.stopPropagation();
  run();
}

/**
 * Custom checkbox — deliberately not a styled native <input>. The visible
 * box's color comes straight from explicit Tailwind classes driven by React
 * state, not accent-color/native rendering, so it can't end up looking
 * unchecked due to a browser/theme quirk. A visually-hidden native checkbox
 * mirrors the state purely so has-[:checked] can still highlight the row/card.
 */
function CheckboxVisual({
  checked,
  label,
  onClick,
}: {
  checked: boolean;
  label: string;
  onClick: (e: React.MouseEvent | React.KeyboardEvent) => void;
}) {
  return (
    <span
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "Enter") onClick(e);
      }}
      className="inline-flex cursor-pointer items-center justify-center"
    >
      <input type="checkbox" checked={checked} readOnly tabIndex={-1} aria-hidden="true" className="sr-only" />
      <span
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-colors",
          checked ? "border-violet-500 bg-violet-500" : "border-slate-400 bg-transparent"
        )}
      >
        {checked && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
      </span>
    </span>
  );
}

export function RowCheckbox({ id }: { id: string }) {
  const { selected, toggle } = useClientSelection();
  return (
    <CheckboxVisual
      checked={selected.has(id)}
      label="Select client"
      onClick={(e) => handleToggleClick(e, () => toggle(id))}
    />
  );
}

export function SelectAllCheckbox({ ids }: { ids: string[] }) {
  const { toggleAll, isAllSelected } = useClientSelection();
  return (
    <CheckboxVisual
      checked={isAllSelected(ids)}
      label="Select all clients on this page"
      onClick={(e) => handleToggleClick(e, () => toggleAll(ids))}
    />
  );
}

export function ExportButton() {
  const { selected } = useClientSelection();
  const href =
    selected.size > 0
      ? `/api/clients/export?ids=${[...selected].join(",")}`
      : "/api/clients/export";
  return (
    <a
      href={href}
      className="inline-flex items-center gap-2 rounded-[10px] border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-white/[0.06]"
    >
      <Download className="h-4 w-4" />
      {selected.size > 0 ? `Export Selected (${selected.size})` : "Export CSV"}
    </a>
  );
}
