"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn, formatDate, getStatusColor } from "@/lib/utils/helpers";
import { AgencySlideover } from "@/components/admin/agency-slideover";
import type { Plan, PlanStatus } from "@/types";

export interface AgencyRow {
  id: string;
  name: string;
  owner_name: string;
  owner_email: string;
  plan: Plan;
  plan_status: PlanStatus;
  trial_ends_at: string | null;
  created_at: string;
}

export function AgenciesTable({
  agencies,
  clientCounts,
  initialOpenId,
}: {
  agencies: AgencyRow[];
  clientCounts: Record<string, number>;
  initialOpenId: string | null;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(initialOpenId);

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="border-b border-white/10 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-5 py-3 font-medium">Agency</th>
              <th className="px-5 py-3 font-medium">Owner email</th>
              <th className="px-5 py-3 font-medium">Plan</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Clients</th>
              <th className="px-5 py-3 font-medium">Trial ends</th>
              <th className="px-5 py-3 font-medium">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.06]">
            {agencies.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-slate-500">
                  No agencies found.
                </td>
              </tr>
            ) : (
              agencies.map((a) => (
                <tr
                  key={a.id}
                  onClick={() => setSelected(a.id)}
                  className="cursor-pointer hover:bg-white/[0.03]"
                >
                  <td className="px-5 py-3">
                    <span className="font-medium text-slate-100">{a.name}</span>
                    <div className="text-xs text-slate-500">{a.owner_name}</div>
                  </td>
                  <td className="px-5 py-3 text-slate-400">{a.owner_email}</td>
                  <td className="px-5 py-3 capitalize text-slate-400">{a.plan}</td>
                  <td className="px-5 py-3">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                        getStatusColor(a.plan_status)
                      )}
                    >
                      {a.plan_status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-slate-400">{clientCounts[a.id] ?? 0}</td>
                  <td className="px-5 py-3 text-slate-500">
                    {a.trial_ends_at ? formatDate(a.trial_ends_at) : "—"}
                  </td>
                  <td className="px-5 py-3 text-slate-500">{formatDate(a.created_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <AgencySlideover
        agencyId={selected}
        onClose={() => setSelected(null)}
        onChange={() => router.refresh()}
      />
    </>
  );
}
