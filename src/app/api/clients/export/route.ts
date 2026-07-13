import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { toCSV, forceCsvText, type CsvCell } from "@/lib/utils/csv";
import { formatPhone } from "@/lib/utils/helpers";

const HEADERS = [
  "Name",
  "Email",
  "Phone",
  "Status",
  "Assigned To",
  "Current Round",
  "Total Negative Items",
  "Items Deleted",
  "Onboarding Date",
  "Address Line 1",
  "Address Line 2",
  "City",
  "State",
  "Zip",
  "SSN Last 4",
  "Monthly Fee",
  "EQ Score",
  "EXP Score",
  "TU Score",
];

/**
 * formatPhone() only reformats clean 10-digit US numbers; anything else
 * (11-digit with a country/trunk prefix, international, etc.) comes back
 * untouched — still a plain digit string Excel will mangle into scientific
 * notation on open. Force-text that case too.
 */
function csvSafePhone(phone: string): CsvCell {
  const formatted = formatPhone(phone);
  return /^\d+$/.test(formatted) ? forceCsvText(formatted) : formatted;
}

/**
 * Streams a CSV of clients in the caller's agency (RLS-scoped via
 * createServerSupabaseClient) — every client by default, or only the ids
 * passed via ?ids=a,b,c (from the clients list checkbox selection).
 * Operational summary fields only — no signature or document data.
 * SSN is last-4-only, same rule as the CSV import template.
 */
export async function GET(req: Request) {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const idsParam = new URL(req.url).searchParams.get("ids");
  const ids = idsParam
    ? idsParam.split(",").map((id) => id.trim()).filter(Boolean)
    : null;

  const supabase = await createServerSupabaseClient();

  const { data: teamMembers } = await supabase
    .from("team_members")
    .select("id, name");
  const memberNames = new Map((teamMembers ?? []).map((m) => [m.id, m.name]));

  let query = supabase
    .from("clients")
    .select(
      "first_name, last_name, email, phone, status, assigned_to, current_round, total_items_current, total_items_deleted, service_start_date, address_line1, address_line2, city, state, zip, ssn_last4, monthly_fee, score_eq_current, score_exp_current, score_tu_current"
    )
    .order("last_name", { ascending: true })
    .order("first_name", { ascending: true });

  if (ids && ids.length > 0) {
    query = query.in("id", ids);
  }

  const { data } = await query;

  const rows = (data ?? []).map((c) => [
    `${c.first_name} ${c.last_name}`.trim(),
    c.email ?? "",
    c.phone ? csvSafePhone(c.phone) : "",
    c.status ?? "",
    c.assigned_to ? memberNames.get(c.assigned_to) ?? "" : "",
    c.current_round ?? 0,
    c.total_items_current ?? 0,
    c.total_items_deleted ?? 0,
    c.service_start_date ?? "",
    c.address_line1 ?? "",
    c.address_line2 ?? "",
    c.city ?? "",
    c.state ?? "",
    c.zip ? forceCsvText(c.zip) : "",
    c.ssn_last4 ? forceCsvText(c.ssn_last4) : "",
    c.monthly_fee ?? "",
    c.score_eq_current ?? "",
    c.score_exp_current ?? "",
    c.score_tu_current ?? "",
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
