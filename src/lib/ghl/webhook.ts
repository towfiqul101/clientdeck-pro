// ============================================
// ClientDeck Pro — GHL Webhook Handler
// Processes inbound events from GHL
// ============================================

import { createAdminClient } from "@/lib/supabase/admin";

export type GHLWebhookEvent =
  | "ContactCreate"
  | "ContactUpdate"
  | "ContactTagUpdate"
  | "ContactDndUpdate"
  | "NoteCreate"
  | "TaskCreate"
  | "OpportunityStageUpdate";

interface GHLWebhookPayload {
  type: GHLWebhookEvent;
  locationId: string;
  contactId?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export async function handleGHLWebhook(payload: GHLWebhookPayload) {
  const supabase = createAdminClient();

  // Find the agency by GHL location ID
  const { data: agency } = await supabase
    .from("agencies")
    .select("id")
    .eq("ghl_location_id", payload.locationId)
    .single();

  if (!agency) {
    console.warn(`No agency found for GHL location: ${payload.locationId}`);
    return { success: false, error: "Agency not found" };
  }

  switch (payload.type) {
    case "ContactCreate":
      return handleContactCreate(agency.id, payload, supabase);
    case "ContactUpdate":
      return handleContactUpdate(agency.id, payload, supabase);
    case "ContactTagUpdate":
      return handleTagUpdate(agency.id, payload, supabase);
    default:
      console.log(`Unhandled GHL webhook type: ${payload.type}`);
      return { success: true, action: "ignored" };
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleContactCreate(agencyId: string, payload: any, supabase: any) {
  // Check if client already exists
  const { data: existing } = await supabase
    .from("clients")
    .select("id")
    .eq("agency_id", agencyId)
    .eq("ghl_contact_id", payload.contactId)
    .single();

  if (existing) {
    return { success: true, action: "already_exists" };
  }

  // Create new client from GHL contact data
  const { error } = await supabase.from("clients").insert({
    agency_id: agencyId,
    ghl_contact_id: payload.contactId,
    first_name: payload.firstName || payload.first_name || "Unknown",
    last_name: payload.lastName || payload.last_name || "Client",
    email: payload.email || null,
    phone: payload.phone || null,
    address_line1: payload.address1 || null,
    city: payload.city || null,
    state: payload.state || null,
    zip: payload.postalCode || null,
    status: "onboarding",
  });

  if (error) {
    console.error("Error creating client from GHL:", error);
    return { success: false, error: error.message };
  }

  // Log activity
  await supabase.from("activity_log").insert({
    agency_id: agencyId,
    actor_type: "ghl",
    action: "client_created",
    description: `New client synced from GHL: ${payload.firstName} ${payload.lastName}`,
    metadata: { ghl_contact_id: payload.contactId },
  });

  return { success: true, action: "client_created" };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleContactUpdate(agencyId: string, payload: any, supabase: any) {
  const { error } = await supabase
    .from("clients")
    .update({
      first_name: payload.firstName || undefined,
      last_name: payload.lastName || undefined,
      email: payload.email || undefined,
      phone: payload.phone || undefined,
    })
    .eq("agency_id", agencyId)
    .eq("ghl_contact_id", payload.contactId);

  if (error) {
    console.error("Error updating client from GHL:", error);
    return { success: false, error: error.message };
  }

  return { success: true, action: "client_updated" };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleTagUpdate(agencyId: string, payload: any, supabase: any) {
  const tags: string[] = payload.tags || [];

  // Handle specific tags
  if (tags.includes("enrolled")) {
    await supabase
      .from("clients")
      .update({ status: "onboarding" })
      .eq("agency_id", agencyId)
      .eq("ghl_contact_id", payload.contactId);
  }

  if (tags.includes("payment-failed")) {
    await supabase
      .from("clients")
      .update({ payment_status: "failed" })
      .eq("agency_id", agencyId)
      .eq("ghl_contact_id", payload.contactId);
  }

  if (tags.includes("services-paused")) {
    await supabase
      .from("clients")
      .update({ status: "on_hold", payment_status: "paused" })
      .eq("agency_id", agencyId)
      .eq("ghl_contact_id", payload.contactId);
  }

  return { success: true, action: "tags_processed" };
}
