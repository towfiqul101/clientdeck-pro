import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardHeader } from "@/components/ui/card";
import { PendingList, type PendingRow } from "./pending-list";
import type { AgencySettings, PlanStatus } from "@/types";

export const dynamic = "force-dynamic";

interface Row {
  id: string;
  name: string;
  owner_email: string;
  plan_status: PlanStatus;
  created_at: string;
  settings: AgencySettings | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export default async function AdminPendingPage() {
  const admin = createAdminClient();

  const [{ data: agencyData }, { data: clientRows }] = await Promise.all([
    admin
      .from("agencies")
      .select("id, name, owner_email, plan_status, created_at, settings")
      .order("created_at", { ascending: false }),
    admin.from("clients").select("agency_id"),
  ]);

  const agencies = (agencyData ?? []) as Row[];
  const clientCounts = new Map<string, number>();
  for (const row of clientRows ?? []) {
    clientCounts.set(row.agency_id, (clientCounts.get(row.agency_id) ?? 0) + 1);
  }

  const now = new Date().getTime();
  const rows: PendingRow[] = [];

  for (const a of agencies) {
    if (a.plan_status === "cancelled") continue;

    const ghlConnected = a.settings?.onboarding_steps?.ghl_connected === true;
    const clientCount = clientCounts.get(a.id) ?? 0;
    const daysSince = Math.floor((now - new Date(a.created_at).getTime()) / DAY_MS);
    const ageMs = now - new Date(a.created_at).getTime();

    // Pending when: still trialing without GHL connected,
    // OR older than 48h with no clients yet.
    const pending =
      (a.plan_status === "trialing" && !ghlConnected) ||
      (ageMs > 48 * 60 * 60 * 1000 && clientCount === 0);

    if (!pending) continue;

    rows.push({
      id: a.id,
      name: a.name,
      owner_email: a.owner_email,
      created_at: a.created_at,
      ghlConnected,
      clientCount,
      daysSince,
    });
  }

  // Nudge the longest-waiting first.
  rows.sort((x, y) => y.daysSince - x.daysSince);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Pending Setup"
          description={`${rows.length} ${
            rows.length === 1 ? "agency needs" : "agencies need"
          } a nudge — trialing without GHL, or 48h+ old with no clients.`}
        />
        <PendingList rows={rows} />
      </Card>
    </div>
  );
}
