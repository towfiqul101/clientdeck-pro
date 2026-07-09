"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, Loader2, List, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils/helpers";
import { CLIENT_STATUSES, PAYMENT_STATUSES } from "@/lib/constants";

const SORT_OPTIONS = [
  { value: "name", label: "Name A–Z" },
  { value: "newest", label: "Newest" },
  { value: "score_high", label: "Score (highest)" },
  { value: "score_low", label: "Score (lowest)" },
];

const STATUS_PILLS = [
  { value: "", label: "All" },
  { value: "active", label: "Active" },
  { value: "on_hold", label: "On Hold" },
  { value: "completed", label: "Completed" },
];

const selectClass =
  "input-dark px-3 py-2 text-sm [&>option]:bg-[#1a1a2e]";

export function ClientsFilters({
  members = [],
}: {
  members?: { id: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const currentStatus = searchParams.get("status") ?? "";
  const currentView = searchParams.get("view") ?? "";

  const pushParams = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value) params.set(key, value);
        else params.delete(key);
      }
      // Any filter change resets pagination.
      params.delete("page");
      startTransition(() => {
        router.replace(`${pathname}?${params.toString()}`);
      });
    },
    [router, pathname, searchParams]
  );

  // Debounce the free-text search.
  useEffect(() => {
    const current = searchParams.get("q") ?? "";
    if (search === current) return;
    const t = setTimeout(() => pushParams({ q: search }), 350);
    return () => clearTimeout(t);
  }, [search, searchParams, pushParams]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {STATUS_PILLS.map((pill) => (
          <button
            key={pill.value}
            type="button"
            onClick={() => pushParams({ status: pill.value })}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors duration-150",
              currentStatus === pill.value
                ? "border-violet-500/30 bg-violet-500/20 text-violet-300"
                : "border-white/10 bg-white/5 text-slate-400 hover:bg-white/10"
            )}
          >
            {pill.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative flex-1 sm:min-w-[240px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          {isPending && (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-500" />
          )}
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, or phone…"
            className="input-dark w-full py-2 pl-9 pr-9 text-sm"
          />
        </div>

        <select
          value={currentStatus}
          onChange={(e) => pushParams({ status: e.target.value })}
          className={selectClass}
        >
          <option value="">All statuses</option>
          {CLIENT_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>

        <select
          value={searchParams.get("payment") ?? ""}
          onChange={(e) => pushParams({ payment: e.target.value })}
          className={selectClass}
        >
          <option value="">All payments</option>
          {PAYMENT_STATUSES.filter((p) =>
            ["active", "failed", "paused"].includes(p.value)
          ).map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>

        <select
          value={searchParams.get("assigned") ?? ""}
          onChange={(e) => pushParams({ assigned: e.target.value })}
          className={selectClass}
        >
          <option value="">All assignees</option>
          <option value="unassigned">Unassigned</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>

        <select
          value={searchParams.get("sort") ?? "name"}
          onChange={(e) => pushParams({ sort: e.target.value })}
          className={selectClass}
        >
          {SORT_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-1 rounded-[10px] border border-white/10 bg-white/5 p-0.5">
          <button
            type="button"
            onClick={() => pushParams({ view: "" })}
            className={cn(
              "rounded-md p-1.5 transition-colors duration-150",
              currentView !== "cards"
                ? "bg-white/10 text-slate-200"
                : "text-slate-500 hover:text-slate-300"
            )}
            aria-label="Table view"
          >
            <List className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => pushParams({ view: "cards" })}
            className={cn(
              "rounded-md p-1.5 transition-colors duration-150",
              currentView === "cards"
                ? "bg-white/10 text-slate-200"
                : "text-slate-500 hover:text-slate-300"
            )}
            aria-label="Card view"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
