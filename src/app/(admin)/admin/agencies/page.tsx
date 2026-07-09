import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardHeader } from "@/components/ui/card";
import { Search } from "lucide-react";
import { AgenciesTable, type AgencyRow } from "./agencies-table";
import { CreateAgencyButton } from "./create-agency-modal";

export const dynamic = "force-dynamic";

export default async function AdminAgenciesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; open?: string }>;
}) {
  const { q, open } = await searchParams;
  const query = (q ?? "").trim();

  const admin = createAdminClient();
  let builder = admin
    .from("agencies")
    .select(
      "id, name, owner_name, owner_email, plan, plan_status, trial_ends_at, created_at"
    )
    .order("created_at", { ascending: false });
  if (query) {
    builder = builder.or(`name.ilike.%${query}%,owner_email.ilike.%${query}%`);
  }
  const { data } = await builder;
  const agencies = (data ?? []) as AgencyRow[];

  // Client counts per agency (single pass).
  const { data: clientRows } = await admin.from("clients").select("agency_id");
  const clientCounts: Record<string, number> = {};
  for (const row of clientRows ?? []) {
    clientCounts[row.agency_id] = (clientCounts[row.agency_id] ?? 0) + 1;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Agencies"
          description={`${agencies.length} ${query ? "matching" : "total"}`}
          action={
            <div className="flex items-center gap-3">
              <form method="GET" className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  name="q"
                  defaultValue={query}
                  placeholder="Search name or email…"
                  className="w-56 rounded-md border border-white/10 py-1.5 pl-8 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </form>
              <CreateAgencyButton />
            </div>
          }
        />
        <AgenciesTable agencies={agencies} clientCounts={clientCounts} initialOpenId={open ?? null} />
      </Card>
    </div>
  );
}
