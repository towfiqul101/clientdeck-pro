import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils/helpers";
import type { ActivityLog, ActorType } from "@/types";

const ACTORS: ActorType[] = ["system", "staff", "client", "ghl", "stripe"];

const field =
  "rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

const ACTOR_COLOR: Record<string, string> = {
  system: "bg-gray-100 text-gray-700",
  staff: "bg-blue-100 text-blue-700",
  client: "bg-green-100 text-green-700",
  ghl: "bg-purple-100 text-purple-700",
  stripe: "bg-indigo-100 text-indigo-700",
};

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
        <CardHeader
          title="System Activity"
          description={`${entries.length} recent entries across all agencies.`}
        />
        <form method="GET" className="flex flex-wrap items-center gap-3 border-b border-gray-100 px-5 py-3">
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
          <div className="px-5 py-10 text-center text-sm text-gray-500">
            No activity matches these filters.
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {entries.map((e) => (
              <li key={e.id} className="px-5 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  {e.actor_type && (
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                        ACTOR_COLOR[e.actor_type] ?? "bg-gray-100 text-gray-600"
                      )}
                    >
                      {e.actor_type}
                    </span>
                  )}
                  <span className="text-sm font-medium text-gray-900">{e.action}</span>
                  <span className="text-xs text-gray-400">
                    · {agencyName.get(e.agency_id) ?? "—"}
                    {e.client_id && clientName.get(e.client_id)
                      ? ` · ${clientName.get(e.client_id)}`
                      : ""}
                  </span>
                  <span className="ml-auto text-xs text-gray-400">
                    {new Date(e.created_at).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                {e.description && (
                  <p className="mt-0.5 text-sm text-gray-500">{e.description}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
