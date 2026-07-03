import { createAdminClient } from "@/lib/supabase/admin";

interface LicenseValidation {
  valid: boolean;
  plan?: string;
  maxClients?: number;
  error?: string;
}

export async function validateLicense(
  licenseKey: string
): Promise<LicenseValidation> {
  const supabase = createAdminClient();

  const { data: agency, error } = await supabase
    .from("agencies")
    .select("id, plan, plan_status, max_clients, trial_ends_at")
    .eq("license_key", licenseKey)
    .single();

  if (error || !agency) {
    return { valid: false, error: "Invalid license key" };
  }

  // Check if trial expired
  if (agency.plan_status === "trialing" && agency.trial_ends_at) {
    if (new Date(agency.trial_ends_at) < new Date()) {
      return { valid: false, error: "Trial expired" };
    }
  }

  // Check if subscription is active
  if (!["active", "trialing"].includes(agency.plan_status)) {
    return { valid: false, error: `Subscription status: ${agency.plan_status}` };
  }

  return {
    valid: true,
    plan: agency.plan,
    maxClients: agency.max_clients,
  };
}

export async function checkClientLimit(agencyId: string): Promise<{
  allowed: boolean;
  current: number;
  max: number;
}> {
  const supabase = createAdminClient();

  const { data: agency } = await supabase
    .from("agencies")
    .select("max_clients, plan_status")
    .eq("id", agencyId)
    .single();

  const { count } = await supabase
    .from("clients")
    .select("id", { count: "exact", head: true })
    .eq("agency_id", agencyId)
    .in("status", ["onboarding", "analysis", "active", "on_hold"]);

  const current = count || 0;
  const max = agency?.max_clients || 15;
  const statusActive = agency
    ? ["active", "trialing"].includes(agency.plan_status)
    : true;

  return {
    allowed: current < max && statusActive,
    current,
    max,
  };
}
