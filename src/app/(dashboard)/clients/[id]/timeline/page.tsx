import { createServerSupabaseClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils/helpers";
import type { ActivityLog, ActorType } from "@/types";
import { Activity, User, Webhook, CreditCard, Cpu, UserCircle } from "lucide-react";

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

  if (entries.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <EmptyState
          icon={Activity}
          title="No activity yet"
          description="Every action on this client — item edits, rounds, uploads, and syncs — will show up here."
        />
      </div>
    );
  }

  return (
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
  );
}
