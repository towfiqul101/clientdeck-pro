import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { toCSV, forceCsvText, type CsvCell } from "@/lib/utils/csv";
import { formatPhone } from "@/lib/utils/helpers";
import { CREDIT_SCORE_RANGES, RESULTS_TIMELINES, EMPLOYMENT_STATUSES } from "@/lib/constants";

function yesNoCell(value: boolean | null): string {
  return value === null ? "" : value ? "Yes" : "No";
}

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
  "Monthly Fee",
  "EQ Score",
  "EXP Score",
  "TU Score",
  "Credit Score Range",
  "Reviewed Credit Report Recently",
  "Negative Items Reported",
  "Enrolled Other Program",
  "Primary Goal",
  "Results Timeline",
  "Employment Status",
  "Bankruptcy Filed",
  "Bankruptcy Date",
  "Intake Concerns",
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
 * Operational summary fields only — no SSN, signature, or document data.
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
      "first_name, last_name, email, phone, status, assigned_to, current_round, total_items_current, total_items_deleted, service_start_date, address_line1, address_line2, city, state, zip, monthly_fee, score_eq_current, score_exp_current, score_tu_current, credit_score_range, reviewed_credit_report_recently, negative_items_reported, enrolled_other_program, primary_goal, results_timeline, employment_status, bankruptcy_filed, bankruptcy_date, intake_concerns"
    )
    .order("last_name", { ascending: true })
    .order("first_name", { ascending: true });

  if (ids && ids.length > 0) {
    query = query.in("id", ids);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Client CSV export query failed:", error);
    return NextResponse.json(
      { error: "Could not export clients." },
      { status: 500 }
    );
  }

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
    c.monthly_fee ?? "",
    c.score_eq_current ?? "",
    c.score_exp_current ?? "",
    c.score_tu_current ?? "",
    c.credit_score_range
      ? CREDIT_SCORE_RANGES.find((r) => r.value === c.credit_score_range)?.label ?? ""
      : "",
    yesNoCell(c.reviewed_credit_report_recently),
    yesNoCell(c.negative_items_reported),
    yesNoCell(c.enrolled_other_program),
    c.primary_goal ?? "",
    c.results_timeline
      ? RESULTS_TIMELINES.find((r) => r.value === c.results_timeline)?.label ?? ""
      : "",
    c.employment_status
      ? EMPLOYMENT_STATUSES.find((s) => s.value === c.employment_status)?.label ?? ""
      : "",
    yesNoCell(c.bankruptcy_filed),
    c.bankruptcy_date ?? "",
    c.intake_concerns ?? "",
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
