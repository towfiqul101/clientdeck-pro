import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionContext } from "@/lib/auth/session";
import { Card, CardHeader } from "@/components/ui/card";
import { getInitials } from "@/lib/utils/helpers";
import { maxTeamMembersForPlan, PLAN_BY_ID } from "@/lib/billing/plans";
import { resolveSubscribedTypes } from "@/lib/team/notification-prefs";
import { TeamInvite } from "./team-invite";
import { ResendInviteButton } from "./resend-invite-button";
import { NotificationPrefsForm } from "./notification-prefs-form";
import { MemberGhlContactField } from "./member-ghl-contact-field";
import { Users, ArrowRight, Briefcase, Trash2, Percent } from "lucide-react";
import type { TeamMember } from "@/types";

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  staff: "Staff",
  viewer: "Viewer",
};

// Client statuses that count as an active caseload (mirrors reports/page.tsx).
const ACTIVE_CLIENT_STATUSES = ["onboarding", "analysis", "active", "on_hold"];

interface CaseloadStats {
  activeClients: number;
  roundsDueThisWeek: number;
  totalDeletions: number;
  successRate: number;
}

async function getCaseloadStats(
  activeMembers: TeamMember[]
): Promise<Map<string, CaseloadStats>> {
  const supabase = await createServerSupabaseClient();

  const today = new Date().toISOString().slice(0, 10);
  const weekFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const [clientsRes, roundsRes, disputesRes] = await Promise.all([
    supabase.from("clients").select("id, assigned_to, status, total_items_deleted"),
    supabase
      .from("dispute_rounds")
      .select("id, client_id")
      .eq("status", "awaiting_response")
      .gte("response_deadline", today)
      .lte("response_deadline", weekFromNow),
    supabase.from("disputes").select("client_id, result"),
  ]);

  const clients = clientsRes.data ?? [];
  const rounds = roundsRes.data ?? [];
  const disputes = disputesRes.data ?? [];

  const clientAssignee = new Map(clients.map((c) => [c.id, c.assigned_to]));

  const stats = new Map<string, CaseloadStats>(
    activeMembers.map((m) => [
      m.id,
      { activeClients: 0, roundsDueThisWeek: 0, totalDeletions: 0, successRate: 0 },
    ])
  );

  for (const c of clients) {
    if (!c.assigned_to) continue;
    const entry = stats.get(c.assigned_to);
    if (!entry) continue; // assigned to an inactive member — not shown on cards
    if (ACTIVE_CLIENT_STATUSES.includes(c.status)) entry.activeClients += 1;
    entry.totalDeletions += c.total_items_deleted ?? 0;
  }

  for (const r of rounds) {
    const memberId = clientAssignee.get(r.client_id);
    if (!memberId) continue;
    const entry = stats.get(memberId);
    if (entry) entry.roundsDueThisWeek += 1;
  }

  const disputeTotals = new Map<string, { deleted: number; nonPending: number }>();
  for (const d of disputes) {
    const memberId = clientAssignee.get(d.client_id);
    if (!memberId || !stats.has(memberId)) continue;
    if (d.result === "pending") continue;
    const entry = disputeTotals.get(memberId) ?? { deleted: 0, nonPending: 0 };
    entry.nonPending += 1;
    if (d.result === "deleted") entry.deleted += 1;
    disputeTotals.set(memberId, entry);
  }
  for (const [memberId, entry] of stats) {
    const totals = disputeTotals.get(memberId);
    entry.successRate =
      totals && totals.nonPending > 0
        ? Math.round((totals.deleted / totals.nonPending) * 100)
        : 0;
  }

  return stats;
}

/**
 * Members who have never signed in are "pending" — the invite email went out
 * (team_members row + auth user were created up front by inviteTeamMember),
 * but the person hasn't clicked their action link yet. Supabase's
 * last_sign_in_at is the signal: it stays NULL until the invite/recovery link
 * is first verified. A member with no auth user at all (user_id NULL — the
 * original generateLink call failed) is also pending.
 */
async function getPendingMemberIds(members: TeamMember[]): Promise<Set<string>> {
  const admin = createAdminClient();
  const pending = new Set<string>();
  await Promise.all(
    members.map(async (m) => {
      if (!m.user_id) {
        pending.add(m.id);
        return;
      }
      const { data } = await admin.auth.admin.getUserById(m.user_id);
      if (!data?.user?.last_sign_in_at) pending.add(m.id);
    })
  );
  return pending;
}

export default async function TeamPage() {
  const session = await getSessionContext();
  if (!session) redirect("/login");

  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("team_members")
    .select("*")
    .order("created_at", { ascending: true });
  const members = (data ?? []) as TeamMember[];

  const activeMembers = members.filter((m) => m.is_active);
  const activeCount = activeMembers.length;
  const maxMembers = maxTeamMembersForPlan(session.agency.plan);
  const planName = PLAN_BY_ID[session.agency.plan]?.name ?? session.agency.plan;
  const canInvite =
    session.teamMember.role === "owner" || session.teamMember.role === "admin";

  const [caseloadStats, pendingMemberIds] = await Promise.all([
    getCaseloadStats(activeMembers),
    getPendingMemberIds(members),
  ]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Caseload"
          description="Active clients, rounds due, and results per team member."
        />
        {activeMembers.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
            <Briefcase className="h-8 w-8 text-slate-600" />
            <p className="mt-3 text-sm text-slate-500">
              No active team members to show a caseload for.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
            {activeMembers.map((m) => {
              const stats = caseloadStats.get(m.id) ?? {
                activeClients: 0,
                roundsDueThisWeek: 0,
                totalDeletions: 0,
                successRate: 0,
              };
              return (
                <div
                  key={m.id}
                  className="flex flex-col gap-4 rounded-lg border border-white/10 p-4"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-800 text-xs font-medium text-white">
                      {getInitials(
                        m.name.split(" ")[0] ?? m.name,
                        m.name.split(" ")[1] ?? ""
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-slate-100">{m.name}</p>
                      <p className="truncate text-xs text-slate-500 capitalize">
                        {ROLE_LABEL[m.role] ?? m.role}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500">
                        Active Clients
                      </p>
                      <p className="font-semibold text-slate-100">
                        {stats.activeClients}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-500">
                        Due This Week
                      </p>
                      <p
                        className={`font-semibold ${
                          stats.roundsDueThisWeek > 0
                            ? "text-amber-400"
                            : "text-slate-100"
                        }`}
                      >
                        {stats.roundsDueThisWeek}
                      </p>
                    </div>
                    <div>
                      <p className="flex items-center gap-1 text-xs uppercase tracking-wide text-slate-500">
                        <Trash2 className="h-3 w-3" /> Deletions
                      </p>
                      <p className="font-semibold text-green-400">
                        {stats.totalDeletions}
                      </p>
                    </div>
                    <div>
                      <p className="flex items-center gap-1 text-xs uppercase tracking-wide text-slate-500">
                        <Percent className="h-3 w-3" /> Success Rate
                      </p>
                      <p className="font-semibold text-slate-100">
                        {stats.successRate}%
                      </p>
                    </div>
                  </div>

                  <Link
                    href={`/clients?assigned=${m.id}`}
                    className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-blue-400 hover:text-blue-400"
                  >
                    View Caseload
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader
          title="My Notifications"
          description="Choose which staff alerts you personally receive."
        />
        <div className="px-5 py-4">
          <NotificationPrefsForm initial={resolveSubscribedTypes(session.teamMember)} />
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Team"
          description="Staff who can access this agency's workspace."
        />
        <div className="border-b border-white/[0.06] px-5 py-4">
          <TeamInvite
            current={activeCount}
            max={maxMembers}
            planName={planName}
            canInvite={canInvite}
          />
        </div>
        {members.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <Users className="h-8 w-8 text-slate-600" />
            <p className="mt-3 text-sm text-slate-500">No team members yet.</p>
          </div>
        ) : (
          <ul className="divide-y divide-white/[0.06]">
            {members.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-800 text-sm font-medium text-white">
                  {getInitials(
                    m.name.split(" ")[0] ?? m.name,
                    m.name.split(" ")[1] ?? ""
                  )}
                </span>
                <div className="min-w-0 flex-1 basis-40">
                  <p className="truncate font-medium text-slate-100">{m.name}</p>
                  <p className="truncate text-sm text-slate-500">{m.email}</p>
                </div>
                <MemberGhlContactField
                  memberId={m.id}
                  initialValue={m.ghl_contact_id ?? ""}
                  canEdit={canInvite || m.id === session.teamMember.id}
                />
                <span className="rounded-full bg-white/[0.06] px-2.5 py-0.5 text-xs font-medium capitalize text-slate-300">
                  {ROLE_LABEL[m.role] ?? m.role}
                </span>
                {!m.is_active && (
                  <span className="rounded-full bg-red-500/10 px-2.5 py-0.5 text-xs font-medium text-red-400">
                    Inactive
                  </span>
                )}
                {m.is_active && pendingMemberIds.has(m.id) && (
                  <>
                    <span
                      className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-400"
                      title="Invited, but hasn't signed in yet"
                    >
                      Pending
                    </span>
                    {canInvite && <ResendInviteButton memberId={m.id} />}
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
