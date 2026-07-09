"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn, formatDate } from "@/lib/utils/helpers";
import { avatarColor, initials, statusDotClass } from "@/lib/admin/avatar";
import { AgencySlideover } from "@/components/admin/agency-slideover";
import type { Plan, PlanStatus } from "@/types";

export interface AgencyListRow {
  id: string;
  name: string;
  owner_email: string;
  plan: Plan;
  plan_status: PlanStatus;
  created_at: string;
}

export function AgencyList({
  agencies,
  emptyLabel = "No agencies yet.",
}: {
  agencies: AgencyListRow[];
  emptyLabel?: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);

  if (agencies.length === 0) {
    return <div className="px-5 py-10 text-center text-sm text-slate-500">{emptyLabel}</div>;
  }

  return (
    <>
      <ul className="divide-y divide-white/[0.06]">
        {agencies.map((a) => (
          <li key={a.id}>
            <button
              onClick={() => setSelected(a.id)}
              className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-white/[0.03]"
            >
              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white",
                  avatarColor(a.name)
                )}
              >
                {initials(a.name)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-100">{a.name}</p>
                <p className="truncate text-xs text-slate-500">
                  {a.owner_email} · {formatDate(a.created_at)}
                </p>
              </div>
              <span className="hidden shrink-0 text-xs capitalize text-slate-500 sm:block">
                {a.plan}
              </span>
              <span className="flex shrink-0 items-center gap-1.5 text-xs capitalize text-slate-400">
                <span className={cn("h-2 w-2 rounded-full", statusDotClass(a.plan_status))} />
                {a.plan_status.replace("_", " ")}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <AgencySlideover
        agencyId={selected}
        onClose={() => setSelected(null)}
        onChange={() => router.refresh()}
      />
    </>
  );
}
