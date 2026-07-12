"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { getInitials, scoreChange } from "@/lib/utils/helpers";
import { ArrowUp } from "lucide-react";
import type { Client } from "@/types";
import { RowCheckbox, SelectAllCheckbox } from "./client-selection-controls";

interface ClientCardsViewProps {
  clients: Pick<
    Client,
    | "id"
    | "first_name"
    | "last_name"
    | "status"
    | "current_round"
    | "score_eq_start"
    | "score_eq_current"
    | "score_exp_start"
    | "score_exp_current"
    | "score_tu_start"
    | "score_tu_current"
    | "total_items_current"
    | "total_items_deleted"
  >[];
  clientIds: string[];
}

function BureauCell({
  start,
  current,
}: {
  start: number | null;
  current: number | null;
}) {
  const change = scoreChange(start, current);
  return (
    <div className="text-center">
      <p className="font-mono text-sm font-semibold text-slate-100">
        {current ?? "—"}
      </p>
      {change.direction === "up" && (
        <p className="flex items-center justify-center gap-0.5 text-xs text-emerald-400">
          <ArrowUp className="h-3 w-3" />+{change.value}
        </p>
      )}
    </div>
  );
}

export function ClientCardsView({ clients, clientIds }: ClientCardsViewProps) {
  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-sm text-slate-400">
        <SelectAllCheckbox ids={clientIds} />
        Select all
      </label>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
      {clients.map((client) => {
        const resolved =
          client.total_items_current > 0
            ? Math.round(
                (client.total_items_deleted / client.total_items_current) * 100
              )
            : 0;
        return (
          <Link
            key={client.id}
            href={`/clients/${client.id}`}
            className="glass-card relative block has-[:checked]:ring-2 has-[:checked]:ring-violet-500 has-[:checked]:bg-violet-500/5"
          >
            <span className="absolute right-3 top-3 z-10">
              <RowCheckbox id={client.id} />
            </span>
            <div className="flex items-center gap-3 border-b border-white/[0.06] p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-sm font-medium text-violet-300">
                {getInitials(client.first_name, client.last_name)}
              </span>
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-100">
                  {client.first_name} {client.last_name}
                </p>
                <p className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Badge status={client.status} size="sm" />
                  <span>
                    ·{" "}
                    {client.current_round > 0
                      ? `Round ${client.current_round}`
                      : "Not started"}
                  </span>
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 border-b border-white/[0.06] p-4">
              <BureauCell start={client.score_eq_start} current={client.score_eq_current} />
              <BureauCell start={client.score_exp_start} current={client.score_exp_current} />
              <BureauCell start={client.score_tu_start} current={client.score_tu_current} />
            </div>
            <div className="p-4">
              <p className="mb-1.5 text-xs text-slate-500">
                {client.total_items_deleted} of {client.total_items_current} items done
              </p>
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-violet-500 to-violet-700"
                  style={{ width: `${resolved}%` }}
                />
              </div>
            </div>
          </Link>
        );
      })}
      </div>
    </div>
  );
}
