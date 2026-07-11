"use client";

import { Download } from "lucide-react";
import { useClientSelection } from "./client-selection-context";

// Checkboxes may render inside a whole-card <Link> (cards view); preventDefault
// stops the anchor's native navigation, so the toggle is driven manually from
// onClick rather than onChange (which wouldn't fire once preventDefault blocks
// the native checked-state change that onChange depends on).
function handleToggleClick(e: React.MouseEvent, run: () => void) {
  e.preventDefault();
  e.stopPropagation();
  run();
}

export function RowCheckbox({ id }: { id: string }) {
  const { selected, toggle } = useClientSelection();
  return (
    <input
      type="checkbox"
      checked={selected.has(id)}
      onChange={() => {}}
      onClick={(e) => handleToggleClick(e, () => toggle(id))}
      aria-label="Select client"
      className="h-4 w-4 rounded border-white/20 bg-transparent"
    />
  );
}

export function SelectAllCheckbox({ ids }: { ids: string[] }) {
  const { toggleAll, isAllSelected } = useClientSelection();
  return (
    <input
      type="checkbox"
      checked={isAllSelected(ids)}
      onChange={() => {}}
      onClick={(e) => handleToggleClick(e, () => toggleAll(ids))}
      aria-label="Select all clients on this page"
      className="h-4 w-4 rounded border-white/20 bg-transparent"
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
