import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CopyPortalLink } from "./copy-portal-link";
import { AssignClient } from "./assign-client";
import { cn, scoreChange } from "@/lib/utils/helpers";
import type { Client } from "@/types";
import { ArrowLeft, ArrowRight, Pencil, Plus, ArrowUp, ArrowDown } from "lucide-react";

function BureauScore({
  label,
  start,
  current,
}: {
  label: string;
  start: number | null;
  current: number | null;
}) {
  const change = scoreChange(start, current);
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
        {label}
      </p>
      <div className="mt-1 flex items-center gap-1.5">
        <span className="text-sm text-gray-400 tabular-nums">
          {start ?? "—"}
        </span>
        <ArrowRight className="h-3 w-3 text-gray-300" />
        <span className="text-lg font-semibold text-gray-900 tabular-nums">
          {current ?? "—"}
        </span>
        {change.direction !== "same" && (
          <span
            className={cn(
              "ml-0.5 inline-flex items-center gap-0.5 text-xs font-medium",
              change.direction === "up" ? "text-green-600" : "text-red-600"
            )}
          >
            {change.direction === "up" ? (
              <ArrowUp className="h-3 w-3" />
            ) : (
              <ArrowDown className="h-3 w-3" />
            )}
            {change.value}
          </span>
        )}
      </div>
    </div>
  );
}

export function ClientHeader({
  client,
  members,
}: {
  client: Client;
  members: { id: string; name: string }[];
}) {
  // total_items_current tracks all items on file; total_items_deleted is the
  // subset resolved by deletion.
  const totalItems = Math.max(
    client.total_items_start,
    client.total_items_current
  );
  const resolvedPct =
    totalItems > 0
      ? Math.round((client.total_items_deleted / totalItems) * 100)
      : 0;

  return (
    <div className="space-y-5">
      <Link
        href="/clients"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to clients
      </Link>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-gray-900">
              {client.first_name} {client.last_name}
            </h1>
            <Badge status={client.status} />
          </div>
          {(client.email || client.phone) && (
            <p className="text-sm text-gray-500">
              {[client.email, client.phone].filter(Boolean).join(" · ")}
            </p>
          )}
          <div className="flex items-center gap-1.5 text-sm text-gray-500">
            <span>Assigned to:</span>
            <AssignClient
              clientId={client.id}
              assignedTo={client.assigned_to}
              members={members}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/clients/${client.id}/edit`}>
            <Button variant="secondary">
              <Pencil className="h-4 w-4" />
              Edit Client
            </Button>
          </Link>
          <Link href={`/clients/${client.id}/rounds/new`}>
            <Button>
              <Plus className="h-4 w-4" />
              Start New Round
            </Button>
          </Link>
          <CopyPortalLink clientId={client.id} />
        </div>
      </div>

      {/* Scores */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <BureauScore
          label="Equifax"
          start={client.score_eq_start}
          current={client.score_eq_current}
        />
        <BureauScore
          label="Experian"
          start={client.score_exp_start}
          current={client.score_exp_current}
        />
        <BureauScore
          label="TransUnion"
          start={client.score_tu_start}
          current={client.score_tu_current}
        />
      </div>

      {/* Progress */}
      <div>
        <div className="mb-1.5 flex items-center justify-between text-sm">
          <span className="text-gray-600">
            {client.total_items_deleted} of {totalItems} items resolved
          </span>
          <span className="font-medium text-gray-900">{resolvedPct}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-green-500 transition-all"
            style={{ width: `${resolvedPct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
