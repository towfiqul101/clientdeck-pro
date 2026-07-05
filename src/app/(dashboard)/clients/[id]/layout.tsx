import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getClientOr404 } from "@/lib/clients/queries";
import { getSessionContext } from "@/lib/auth/session";
import { isAgencyPlanOrHigher } from "@/lib/billing/plans";
import { ClientHeader } from "./client-header";
import { ClientTabs } from "./client-tabs";

export default async function ClientDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = await getClientOr404(id);
  const session = await getSessionContext();

  const supabase = await createServerSupabaseClient();
  const { data: teamMembers } = await supabase
    .from("team_members")
    .select("id, name")
    .eq("is_active", true)
    .order("name", { ascending: true });
  const members = teamMembers ?? [];

  return (
    <div className="space-y-6">
      <ClientHeader
        client={client}
        members={members}
        showCreditMonitoring={session ? isAgencyPlanOrHigher(session.agency.plan) : false}
      />
      <ClientTabs clientId={client.id} />
      <div>{children}</div>
    </div>
  );
}
