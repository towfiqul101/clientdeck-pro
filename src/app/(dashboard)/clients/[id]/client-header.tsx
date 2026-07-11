import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PortalLinkMenu } from "./portal-link-menu";
import { AssignClient } from "./assign-client";
import { NotifyExtraStaff } from "./notify-extra-staff";
import { AIStrategyPanel } from "./ai-strategy-panel";
import { SendReviewRequestButton } from "./send-review-request-button";
import { PullScoresButton } from "./pull-scores-button";
import { ForceSyncButton } from "./force-sync-button";
import { DeleteClientButton } from "./delete-client-button";
import { cn, scoreChange } from "@/lib/utils/helpers";
import type { Client } from "@/types";
import {
  ArrowLeft,
  ArrowRight,
  Pencil,
  Plus,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  PartyPopper,
} from "lucide-react";

function BureauScore({
  label,
  start,
  current,
  tint,
}: {
  label: string;
  start: number | null;
  current: number | null;
  tint: string;
}) {
  const change = scoreChange(start, current);
  return (
    <div
      className={cn(
        "rounded-xl border border-t-2 px-3 py-2 backdrop-blur-sm",
        tint
      )}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <div className="mt-1 flex items-center gap-1.5">
        <span className="text-sm text-slate-500 tabular-nums">
          {start ?? "—"}
        </span>
        <ArrowRight className="h-3 w-3 text-slate-600" />
        <span className="text-lg font-semibold text-slate-100 tabular-nums">
          {current ?? "—"}
        </span>
        {change.direction !== "same" && (
          <span
            className={cn(
              "ml-0.5 inline-flex items-center gap-0.5 text-xs font-medium",
              change.direction === "up" ? "text-emerald-400" : "text-red-400"
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
  showCreditMonitoring,
  canDelete,
}: {
  client: Client;
  members: { id: string; name: string }[];
  showCreditMonitoring: boolean;
  canDelete: boolean;
}) {
  // total_items_current tracks all items on file; total_items_deleted is the
  // subset resolved by deletion.
  const totalItems = Math.max(
    client.total_items_start,
    client.total_items_current
  );
  // 2-segment progress bar (deleted / remaining) computed only from fields
  // already on `Client` — an "in dispute" 3rd segment would need a query
  // this component doesn't make, so it's intentionally out of scope here.
  const deletedPct =
    totalItems > 0
      ? Math.round((client.total_items_deleted / totalItems) * 100)
      : 0;
  const remainingPct = 100 - deletedPct;

  return (
    <div className="space-y-5">
      <Link
        href="/clients"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-300"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to clients
      </Link>

      <div className="flex flex-col gap-4 rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-500/10 to-blue-500/[0.05] p-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-slate-100">
              {client.first_name} {client.last_name}
            </h1>
            <Badge status={client.status} />
          </div>
          {(client.email || client.phone) && (
            <p className="text-sm text-slate-400">
              {[client.email, client.phone].filter(Boolean).join(" · ")}
            </p>
          )}
          <div className="flex items-center gap-1.5 text-sm text-slate-400">
            <span>Assigned to:</span>
            <AssignClient
              clientId={client.id}
              assignedTo={client.assigned_to}
              members={members}
            />
          </div>
          <NotifyExtraStaff
            clientId={client.id}
            selected={client.notify_team_member_ids}
            members={members}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <AIStrategyPanel clientId={client.id} />
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
          <PortalLinkMenu clientId={client.id} />
          {showCreditMonitoring && <PullScoresButton client={client} />}
          {client.ghl_contact_id && <ForceSyncButton clientId={client.id} />}
          {canDelete && (
            <DeleteClientButton
              clientId={client.id}
              clientName={`${client.first_name} ${client.last_name}`}
            />
          )}
        </div>
      </div>

      {(client.payment_status === "failed" || client.payment_status === "paused") && (
        <div
          className={cn(
            "flex items-start gap-3 rounded-xl border p-4 text-sm",
            client.payment_status === "failed"
              ? "border-red-500/30 bg-red-500/10 text-red-300"
              : "border-amber-500/30 bg-amber-500/10 text-amber-300"
          )}
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <span className="font-medium">
              Payment {client.payment_status} — new rounds cannot be created
              until resolved.
            </span>{" "}
            <Link
              href={`/clients/${client.id}/edit`}
              className="underline hover:no-underline"
            >
              Update payment status
            </Link>{" "}
            or check{" "}
            <Link href="/settings" className="underline hover:no-underline">
              billing settings
            </Link>
            .
          </span>
        </div>
      )}

      {client.status === "completed" && (
        <div className="flex flex-col gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <PartyPopper className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
            <div className="text-sm text-emerald-300">
              <p className="font-medium">Case completed — goal reached!</p>
              <p className="mt-0.5 text-emerald-400/80">
                {client.total_items_deleted} of {totalItems} items resolved.
                Ask them for a Google review while the win is fresh.
              </p>
            </div>
          </div>
          <SendReviewRequestButton clientId={client.id} />
        </div>
      )}

      {/* Scores */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <BureauScore
          label="Equifax"
          start={client.score_eq_start}
          current={client.score_eq_current}
          tint="border-violet-500/20 border-t-violet-500 bg-violet-500/10"
        />
        <BureauScore
          label="Experian"
          start={client.score_exp_start}
          current={client.score_exp_current}
          tint="border-orange-500/20 border-t-orange-500 bg-orange-500/10"
        />
        <BureauScore
          label="TransUnion"
          start={client.score_tu_start}
          current={client.score_tu_current}
          tint="border-emerald-500/20 border-t-emerald-500 bg-emerald-500/10"
        />
      </div>

      {/* Progress */}
      <div>
        <div className="mb-1.5 flex items-center justify-between text-sm">
          <span className="text-slate-400">
            {client.total_items_deleted} of {totalItems} items resolved
          </span>
          <span className="font-medium text-slate-100">{deletedPct}%</span>
        </div>
        <div className="flex h-2 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-150 ease-in-out"
            style={{ width: `${deletedPct}%` }}
          />
          <div
            className="h-full bg-white/5 transition-all duration-150 ease-in-out"
            style={{ width: `${remainingPct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
