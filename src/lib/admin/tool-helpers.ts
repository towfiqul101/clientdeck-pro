import { NextResponse } from "next/server";
import { validateAdminSession } from "@/lib/admin/session";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Guard for /api/admin/* route handlers. Returns a 401 response to short-circuit
 * with when the caller is not an authenticated super-admin, or null to proceed.
 */
export async function requireAdminApi(): Promise<NextResponse | null> {
  if (!(await validateAdminSession())) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export interface AgencyGhlCreds {
  id: string;
  name: string;
  owner_name: string;
  owner_email: string;
  ghl_api_key: string | null;
  ghl_location_id: string | null;
}

/** Loads the fields an admin tool needs to talk to an agency's GHL location. */
export async function loadAgencyGhl(
  agencyId: string
): Promise<AgencyGhlCreds | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("agencies")
    .select("id, name, owner_name, owner_email, ghl_api_key, ghl_location_id")
    .eq("id", agencyId)
    .single();
  return (data as AgencyGhlCreds) ?? null;
}

/** True when both GHL credentials are present. */
export function hasGhlCreds(a: AgencyGhlCreds | null): a is AgencyGhlCreds & {
  ghl_api_key: string;
  ghl_location_id: string;
} {
  return Boolean(a?.ghl_api_key && a?.ghl_location_id);
}
