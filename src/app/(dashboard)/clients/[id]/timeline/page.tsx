import { createServerSupabaseClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardHeader } from "@/components/ui/card";
import { cn, formatDate } from "@/lib/utils/helpers";
import type { ActivityLog, ActorType } from "@/types";
import { Activity, User, Webhook, CreditCard, Cpu, UserCircle, Clock } from "lucide-react";

const ACTOR_META: Record<
  ActorType,
  { icon: typeof Activity; className: string; label: string }
> = {
  staff: { icon: User, className: "bg-blue-50 text-blue-600", label: "Staff" },
  ghl: { icon: Webhook, className: "bg-purple-50 text-purple-600", label: "GHL" },
  stripe: {
    icon: CreditCard,
    className: "bg-emerald-50 text-emerald-600",
    label: "Stripe",
  },
  system: { icon: Cpu, className: "bg-gray-100 text-gray-500", label: "System" },
  client: {
    icon: UserCircle,
    className: "bg-amber-50 text-amber-600",
    label: "Client",
  },
};

function formatTimestamp(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function NotificationMethodBadge({ method }: { method?: string }) {
  if (method === "ghl") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700">
        ✓ GHL
      </span>
    );
  }
  if (method === "resend") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
        ⚠ Email fallback
      </span>
    );
  }
  return null;
}

export default async function ClientTimelinePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const { data } = await supabase
    .from("activity_log")
    .select("*")
    .eq("client_id", id)
    .order("created_at", { ascending: false })
    .limit(100);

  const entries = (data ?? []) as ActivityLog[];

  const { data: creditPulls } = await supabase
    .from("credit_monitoring_pulls")
    .select("id, service, pulled_at, score_eq, score_exp, score_tu, status, error_message")
    .eq("client_id", id)
    .order("pulled_at", { ascending: false })
    .limit(10);

  const scorePullHistory = creditPulls && creditPulls.length > 0 && (
    <Card>
      <CardHeader title="Score Pull History" />
      <ul className="divide-y divide-gray-100">
        {creditPulls.map((pull) => (
          <li key={pull.id} className="flex items-center justify-between px-5 py-3 text-sm">
            <span className="text-gray-500">{formatDate(pull.pulled_at)}</span>
            <span className="capitalize text-gray-700">{pull.service.replace(/_/g, " ")}</span>
            <span className="font-mono text-gray-900">
              {pull.status === "success"
                ? `EQ:${pull.score_eq ?? "—"} EXP:${pull.score_exp ?? "—"} TU:${pull.score_tu ?? "—"}`
                : "—"}
            </span>
            <span>{pull.status === "success" ? "✅" : "❌"}</span>
          </li>
        ))}
      </ul>
    </Card>
  );

  if (entries.length === 0) {
    return (
      <div className="space-y-6">
        {scorePullHistory}
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
          <EmptyState
            icon={Clock}
            title="No activity yet"
            description="Actions taken on this client will appear here."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {scorePullHistory}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <ol className="relative space-y-6 border-l border-gray-200 pl-6">
          {entries.map((entry) => {
            const meta = ACTOR_META[entry.actor_type ?? "system"];
            const Icon = meta.icon;
            return (
              <li key={entry.id} className="relative">
                <span
                  className={cn(
                    "absolute -left-[2.15rem] flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-white",
                    meta.className
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm font-medium text-gray-900">
                    {entry.action}
                  </p>
                  <time className="shrink-0 text-xs text-gray-400">
                    {formatTimestamp(entry.created_at)}
                  </time>
                </div>
                {entry.description && (
                  <p className="mt-0.5 text-sm text-gray-500">
                    {entry.description}
                  </p>
                )}
                <div className="mt-1 flex items-center gap-2">
                  <span className="inline-block text-xs text-gray-400">
                    {meta.label}
                  </span>
                  {entry.action === "notification_sent" && (
                    <NotificationMethodBadge
                      method={(entry.metadata as { method?: string } | null)?.method}
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
