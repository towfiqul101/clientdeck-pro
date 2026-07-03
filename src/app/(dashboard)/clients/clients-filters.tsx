"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, Loader2 } from "lucide-react";
import { CLIENT_STATUSES, PAYMENT_STATUSES } from "@/lib/constants";

const SORT_OPTIONS = [
  { value: "name", label: "Name A–Z" },
  { value: "newest", label: "Newest" },
  { value: "score_high", label: "Score (highest)" },
  { value: "score_low", label: "Score (lowest)" },
];

const selectClass =
  "rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

export function ClientsFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState(searchParams.get("q") ?? "");

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
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="relative flex-1 sm:min-w-[240px]">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        {isPending && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-400" />
        )}
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, email, or phone…"
          className="w-full rounded-md border border-gray-300 bg-white py-2 pl-9 pr-9 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <select
        value={searchParams.get("status") ?? ""}
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
    </div>
  );
}
