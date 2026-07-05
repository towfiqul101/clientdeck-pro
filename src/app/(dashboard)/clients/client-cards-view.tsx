"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { getInitials, scoreChange } from "@/lib/utils/helpers";
import { ArrowUp } from "lucide-react";
import type { Client } from "@/types";

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
      <p className="font-mono text-sm font-semibold text-gray-900">
        {current ?? "—"}
      </p>
      {change.direction === "up" && (
        <p className="flex items-center justify-center gap-0.5 text-xs text-green-600">
          <ArrowUp className="h-3 w-3" />+{change.value}
        </p>
      )}
    </div>
  );
}

export function ClientCardsView({ clients }: ClientCardsViewProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
            className="block rounded-xl border border-gray-200 bg-white shadow-[var(--shadow-card)] transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[var(--shadow-elevated)]"
          >
            <div className="flex items-center gap-3 border-b border-gray-100 p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-medium text-blue-700">
                {getInitials(client.first_name, client.last_name)}
              </span>
              <div className="min-w-0">
                <p className="truncate font-medium text-gray-900">
                  {client.first_name} {client.last_name}
                </p>
                <p className="flex items-center gap-1.5 text-xs text-gray-500">
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
            <div className="grid grid-cols-3 gap-2 border-b border-gray-100 p-4">
              <BureauCell start={client.score_eq_start} current={client.score_eq_current} />
              <BureauCell start={client.score_exp_start} current={client.score_exp_current} />
              <BureauCell start={client.score_tu_start} current={client.score_tu_current} />
            </div>
            <div className="p-4">
              <p className="mb-1.5 text-xs text-gray-500">
                {client.total_items_deleted} of {client.total_items_current} items done
              </p>
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full bg-blue-600"
                  style={{ width: `${resolved}%` }}
                />
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
