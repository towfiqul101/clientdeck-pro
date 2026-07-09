import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils/helpers";
import { AlertTriangle } from "lucide-react";
import type { ActivityLog, ActorType } from "@/types";

export const dynamic = "force-dynamic";

const ACTORS: ActorType[] = ["system", "staff", "client", "ghl", "stripe"];

const field =
  "rounded-md border border-white/10 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

const ACTOR_COLOR: Record<string, string> = {
  system: "bg-white/[0.06] text-slate-300",
  staff: "bg-blue-500/15 text-blue-400",
  client: "bg-green-500/15 text-green-400",
  ghl: "bg-purple-500/15 text-purple-400",
  stripe: "bg-indigo-500/15 text-indigo-400",
};

function HealthDot({
  label,
  ok,
  okText,
  badText,
  neutral = false,
}: {
  label: string;
  ok: boolean;
  okText: string;
  badText: string;
  neutral?: boolean;
}) {
  const dot = neutral ? "bg-gray-400" : ok ? "bg-green-500" : "bg-amber-500";
  return (
    <div className="flex items-center gap-2">
      <span className={cn("h-2.5 w-2.5 rounded-full", dot)} />
      <span className="text-sm text-slate-400">
        <span className="font-medium text-slate-100">{label}:</span> {ok ? okText : badText}
      </span>
    </div>
  );
}

export default async function AdminActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ agency?: string; actor?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const agencyFilter = sp.agency ?? "";
  const actorFilter = sp.actor ?? "";
  const query = (sp.q ?? "").trim();

  const admin = createAdminClient();

  const { data: agencyRows } = await admin
    .from("agencies")
    .select("id, name")
    .order("name");
  const agencyName = new Map((agencyRows ?? []).map((a) => [a.id, a.name]));

  // ── System health ──────────────────────────────────────────────────────────
  const supabaseOk = agencyRows !== null;
  const deployed = Boolean(process.env.VERCEL);
  const since24h = new Date(
    new Date().getTime() - 24 * 60 * 60 * 1000
  ).toISOString();

  const { count: ghlFailCount } = await admin
    .from("ghl_sync_log")
    .select("id", { count: "exact", head: true })
    .eq("status", "failed")
    .gte("attempted_at", since24h);
  const ghlFailures = ghlFailCount ?? 0;

  let failedSyncs: {
    agency_id: string;
    sync_action: string;
    error_message: string | null;
    attempted_at: string;
  }[] = [];
  if (ghlFailures > 0) {
    const { data: fails } = await admin
      .from("ghl_sync_log")
      .select("agency_id, sync_action, error_message, attempted_at")
      .eq("status", "failed")
      .gte("attempted_at", since24h)
      .order("attempted_at", { ascending: false })
      .limit(10);
    failedSyncs = fails ?? [];
  }

  let builder = admin
    .from("activity_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (agencyFilter) builder = builder.eq("agency_id", agencyFilter);
  if (actorFilter) builder = builder.eq("actor_type", actorFilter);
  if (query) builder = builder.ilike("description", `%${query}%`);
  const { data } = await builder;
  const entries = (data ?? []) as ActivityLog[];

  // Resolve client names for entries that have a client_id.
  const clientIds = [...new Set(entries.map((e) => e.client_id).filter(Boolean))] as string[];
  const clientName = new Map<string, string>();
  if (clientIds.length) {
    const { data: clientRows } = await admin
      .from("clients")
      .select("id, first_name, last_name")
      .in("id", clientIds);
    for (const c of clientRows ?? []) {
      clientName.set(c.id, `${c.first_name} ${c.last_name}`);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="System Health" description="Live status across services." />
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3 px-5 py-4">
          <HealthDot label="Supabase" ok={supabaseOk} okText="Connected" badText="Unreachable" />
          <HealthDot label="Vercel" ok={deployed} okText="Deployed" badText="Local dev" neutral={!deployed} />
          <HealthDot
            label="GHL Sync"
            ok={ghlFailures === 0}
            okText="Healthy"
            badText={`${ghlFailures} failure${ghlFailures === 1 ? "" : "s"} in last 24h`}
          />
        </div>
        {ghlFailures > 0 && (
          <div className="border-t border-amber-500/20 bg-amber-50/60 px-5 py-4">
            <div className="flex items-center gap-2 text-sm font-medium text-amber-300">
              <AlertTriangle className="h-4 w-4" />
              {ghlFailures} GHL sync failure{ghlFailures === 1 ? "" : "s"} in the last 24 hours
            </div>
            <ul className="mt-2 space-y-1 text-xs text-amber-400">
              {failedSyncs.map((f, i) => (
                <li key={i} className="flex flex-wrap gap-x-2">
                  <span className="font-medium">{agencyName.get(f.agency_id) ?? "Unknown agency"}</span>
                  <span className="text-amber-400">{f.sync_action}</span>
                  {f.error_message && <span className="text-amber-500">— {f.error_message}</span>}
                  <span className="ml-auto text-amber-400">
                    {new Date(f.attempted_at).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader
          title="System Activity"
          description={`${entries.length} recent entries across all agencies.`}
        />
        <form method="GET" className="flex flex-wrap items-center gap-3 border-b border-white/[0.06] px-5 py-3">
          <select name="agency" defaultValue={agencyFilter} className={field}>
            <option value="">All agencies</option>
            {(agencyRows ?? []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <select name="actor" defaultValue={actorFilter} className={field}>
            <option value="">All actors</option>
            {ACTORS.map((a) => (
              <option key={a} value={a} className="capitalize">
                {a}
              </option>
            ))}
          </select>
          <input
            type="text"
            name="q"
            defaultValue={query}
            placeholder="Search description…"
            className={`${field} w-52`}
          />
          <button
            type="submit"
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            Filter
          </button>
        </form>

        {entries.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-slate-500">
            No activity matches these filters.
          </div>
        ) : (
          <ul className="divide-y divide-white/[0.06]">
            {entries.map((e) => (
              <li key={e.id} className="px-5 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  {e.actor_type && (
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                        ACTOR_COLOR[e.actor_type] ?? "bg-white/[0.06] text-slate-400"
                      )}
                    >
                      {e.actor_type}
                    </span>
                  )}
                  <span className="text-sm font-medium text-slate-100">{e.action}</span>
                  <span className="text-xs text-slate-500">
                    · {agencyName.get(e.agency_id) ?? "—"}
                    {e.client_id && clientName.get(e.client_id)
                      ? ` · ${clientName.get(e.client_id)}`
                      : ""}
                  </span>
                  <span className="ml-auto text-xs text-slate-500">
                    {new Date(e.created_at).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                {e.description && (
                  <p className="mt-0.5 text-sm text-slate-500">{e.description}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
