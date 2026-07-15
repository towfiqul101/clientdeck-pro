"use server";

import { revalidatePath } from "next/cache";
import { getSessionContext } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkClientLimit } from "@/lib/utils/license";
import { parseCSV } from "@/lib/utils/csv";
import {
  validateImportRows,
  type ParsedClientRow,
  type ValidatedClientRow,
} from "@/lib/clients/import-validation";

const EXPECTED_HEADERS = ["name", "email", "phone", "ssn_last4"];

export interface ParsePreviewResult {
  success: boolean;
  error?: string;
  rows?: ValidatedClientRow[];
}

/** Fetches existing client emails for the agency, lowercased, for duplicate checks. */
async function existingEmailSet(agencyId: string): Promise<Set<string>> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("clients")
    .select("email")
    .eq("agency_id", agencyId)
    .not("email", "is", null);
  return new Set((data ?? []).map((c) => (c.email as string).trim().toLowerCase()));
}

function parseRows(text: string): { rows?: ParsedClientRow[]; error?: string } {
  const table = parseCSV(text);
  if (table.length === 0) return { error: "The file is empty." };

  const headerRow = table[0].map((h) => h.trim().toLowerCase());
  const nameIdx = headerRow.indexOf("name");
  if (nameIdx === -1) {
    return {
      error: `Missing a "name" column. Expected headers: ${EXPECTED_HEADERS.join(", ")}.`,
    };
  }
  const emailIdx = headerRow.indexOf("email");
  const phoneIdx = headerRow.indexOf("phone");
  const ssnIdx = headerRow.indexOf("ssn_last4");

  const dataRows = table.slice(1);
  if (dataRows.length === 0) return { error: "No data rows found below the header." };

  const rows: ParsedClientRow[] = dataRows.map((r, i) => ({
    rowNumber: i + 1,
    name: r[nameIdx] ?? "",
    email: emailIdx >= 0 ? r[emailIdx] ?? "" : "",
    phone: phoneIdx >= 0 ? r[phoneIdx] ?? "" : "",
    ssn_last4: ssnIdx >= 0 ? r[ssnIdx] ?? "" : "",
  }));

  return { rows };
}

/** Step 1: parse + validate the uploaded file, without writing anything. */
export async function parseImportPreview(formData: FormData): Promise<ParsePreviewResult> {
  const session = await getSessionContext();
  if (!session) return { success: false, error: "Not authenticated." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { success: false, error: "Attach a CSV file." };
  }
  if (!file.name.toLowerCase().endsWith(".csv")) {
    return { success: false, error: "File must be a .csv." };
  }
  if (file.size > 5 * 1024 * 1024) {
    return { success: false, error: "File must be under 5MB." };
  }

  const text = await file.text();
  const { rows, error } = parseRows(text);
  if (error || !rows) return { success: false, error };

  const existingEmails = await existingEmailSet(session.agency.id);
  const validated = validateImportRows(rows, existingEmails);

  return { success: true, rows: validated };
}

export interface ConfirmImportResult {
  success: boolean;
  error?: string;
  imported?: number;
  skipped?: number;
  summary?: string;
  details?: string[];
}

/**
 * Step 2: re-validates server-side (never trusts the client's "valid" flags
 * — the agency's client list or plan limit may have changed since preview)
 * and bulk-inserts. Checks the plan limit BEFORE inserting anything; the
 * whole batch is rejected if it would exceed the cap, never partially
 * imported.
 */
export async function confirmImport(rows: ParsedClientRow[]): Promise<ConfirmImportResult> {
  const session = await getSessionContext();
  if (!session) return { success: false, error: "Not authenticated." };

  if (!Array.isArray(rows) || rows.length === 0) {
    return { success: false, error: "No rows to import." };
  }

  const existingEmails = await existingEmailSet(session.agency.id);
  const revalidated = validateImportRows(rows, existingEmails);
  const validRows = revalidated.filter((r) => r.valid);
  const invalidRows = revalidated.filter((r) => !r.valid);

  const limit = await checkClientLimit(session.agency.id);
  if (limit.current + validRows.length > limit.max) {
    return {
      success: false,
      error: `Importing ${validRows.length} client(s) would put you at ${
        limit.current + validRows.length
      }, over your plan's limit of ${limit.max} active clients (currently at ${limit.current}). Remove rows or upgrade your plan.`,
    };
  }

  if (validRows.length > 0) {
    const admin = createAdminClient();
    // settings.default_monthly_fee was never settable via any UI (dead
    // config) — monthly_fee is simply omitted here so the clients table's
    // own column default (149.00) applies, same value this always resolved
    // to in practice.
    const inserts = validRows.map((r) => ({
      agency_id: session.agency.id,
      first_name: r.first_name,
      last_name: r.last_name,
      email: r.email || null,
      phone: r.phone || null,
      ssn_last4: r.ssn_last4 || null,
      status: "onboarding" as const,
      total_items_start: 0,
      total_items_current: 0,
      total_items_deleted: 0,
    }));

    const { error } = await admin.from("clients").insert(inserts);
    if (error) return { success: false, error: error.message };

    await admin.from("activity_log").insert({
      agency_id: session.agency.id,
      actor_type: "staff",
      actor_id: session.userId,
      action: "Clients imported",
      description: `${validRows.length} client(s) imported via CSV.`,
    });
  }

  const summaryParts = [`${validRows.length} imported`];
  if (invalidRows.length > 0) {
    summaryParts.push(
      `${invalidRows.length} skipped: ${invalidRows
        .map((r) => `row ${r.rowNumber} ${r.errors.join("; ")}`)
        .join(", ")}`
    );
  }

  revalidatePath("/clients");
  return {
    success: true,
    imported: validRows.length,
    skipped: invalidRows.length,
    summary: summaryParts.join(", "),
    details: invalidRows.map((r) => `Row ${r.rowNumber}: ${r.errors.join(", ")}`),
  };
}
