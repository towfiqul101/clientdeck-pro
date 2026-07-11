import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { toCSV } from "@/lib/utils/csv";

const HEADERS = [
  "Name",
  "Email",
  "Phone",
  "Status",
  "Assigned To",
  "Current Round",
  "Items Deleted",
  "Onboarding Date",
];

/**
 * Streams a CSV of every client in the caller's agency (RLS-scoped via
 * createServerSupabaseClient). Operational summary fields only — no
 * ssn_last4, signature, or document data.
 */
export async function GET() {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const supabase = await createServerSupabaseClient();

  const { data: teamMembers } = await supabase
    .from("team_members")
    .select("id, name");
  const memberNames = new Map((teamMembers ?? []).map((m) => [m.id, m.name]));

  const { data } = await supabase
    .from("clients")
    .select(
      "first_name, last_name, email, phone, status, assigned_to, current_round, total_items_deleted, service_start_date"
    )
    .order("last_name", { ascending: true })
    .order("first_name", { ascending: true });

  const rows = (data ?? []).map((c) => [
    `${c.first_name} ${c.last_name}`.trim(),
    c.email ?? "",
    c.phone ?? "",
    c.status ?? "",
    c.assigned_to ? memberNames.get(c.assigned_to) ?? "" : "",
    c.current_round ?? 0,
    c.total_items_deleted ?? 0,
    c.service_start_date ?? "",
  ]);

  const csv = toCSV([HEADERS, ...rows]);
  const filename = `clients-export-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
