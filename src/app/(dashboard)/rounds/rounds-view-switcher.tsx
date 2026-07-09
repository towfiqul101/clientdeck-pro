"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { List, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils/helpers";

const STORAGE_KEY = "cdp-rounds-view";
type View = "list" | "pipeline";

// Minimal external store wrapping localStorage, read via useSyncExternalStore
// rather than useState+useEffect. This keeps the read hydration-safe
// (getServerSnapshot always returns "pipeline", matching the server render
// and the first client render) without ever calling setState from inside a
// useEffect body (flagged by the project's react-hooks/set-state-in-effect
// lint rule) — the recommended fix for syncing with an external mutable
// source like localStorage.
let listeners: Array<() => void> = [];

function subscribe(callback: () => void) {
  listeners.push(callback);
  return () => {
    listeners = listeners.filter((listener) => listener !== callback);
  };
}

function getSnapshot(): View {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "list" || stored === "pipeline" ? stored : "pipeline";
}

function getServerSnapshot(): View {
  return "pipeline";
}

function persistView(next: View) {
  window.localStorage.setItem(STORAGE_KEY, next);
  listeners.forEach((listener) => listener());
}

/**
 * Renders both the list and pipeline views (already server-rendered by the
 * caller) and toggles which is visible client-side, persisting the choice to
 * localStorage. Starts at "pipeline" on every render (server and first
 * client render must match to avoid a hydration mismatch) and only switches
 * after mount, once localStorage is readable.
 */
export function RoundsViewSwitcher({
  listView,
  pipelineView,
}: {
  listView: ReactNode;
  pipelineView: ReactNode;
}) {
  const view = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function choose(next: View) {
    persistView(next);
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <div className="flex items-center gap-1 rounded-md border border-white/10 p-0.5">
          <button
            type="button"
            onClick={() => choose("list")}
            className={cn(
              "flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors duration-150",
              view === "list" ? "bg-white/[0.06] text-slate-300" : "text-slate-500 hover:text-slate-400"
            )}
          >
            <List className="h-3.5 w-3.5" /> List
          </button>
          <button
            type="button"
            onClick={() => choose("pipeline")}
            className={cn(
              "flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors duration-150",
              view === "pipeline" ? "bg-white/[0.06] text-slate-300" : "text-slate-500 hover:text-slate-400"
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" /> Pipeline
          </button>
        </div>
      </div>
      <div className={view === "list" ? "" : "hidden"}>{listView}</div>
      <div className={view === "pipeline" ? "" : "hidden"}>{pipelineView}</div>
    </div>
  );
}
