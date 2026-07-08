import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getGHLContact, updateGHLContactFields } from "@/lib/ghl/api";
import { generatePortalLink } from "@/lib/utils/portal-token";
import { syncDocumentToDrive } from "@/lib/google-drive/sync";
import { notifyStaffNewClient, type NotifiableClient } from "@/lib/ghl/notifications";
import { isAgencyPlanOrHigher } from "@/lib/billing/plans";
import type { Agency, GHLContact, GHLContactCustomField } from "@/types";

// Hobby plan caps at 60s. Client creation runs inline; Drive/GHL sync run via
// after() so GHL gets a fast 200 while the heavier work still completes.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

// ── Field extraction ─────────────────────────────────────────────────────────

/** Reads a mapped GHL custom-field value by our internal key. */
function getFieldValue(contact: GHLContact, ghlKey: string | undefined): string | null {
  if (!ghlKey) return null;
  const fields = contact.customFields ?? [];
  const match = fields.find(
    (f: GHLContactCustomField) => f.id === ghlKey || f.fieldKey === ghlKey
  );
  const value = match?.value;
  return value === undefined || value === null ? null : String(value);
}

function toInt(value: string | null): number | null {
  if (!value) return null;
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : null;
}

function extractClientData(contact: GHLContact, agency: Agency) {
  const map = agency.ghl_field_keys ?? {};
  const get = (key: keyof typeof map) => getFieldValue(contact, map[key]);

  const eq = toInt(get("score_eq"));
  const exp = toInt(get("score_exp"));
  const tu = toInt(get("score_tu"));
  const dobRaw = get("dob");
  const signatureRaw = get("signature_status");
  const isSigned = signatureRaw
    ? /^(signed|yes|true|complete)/i.test(signatureRaw)
    : false;

  return {
    first_name: contact.firstName || "",
    last_name: contact.lastName || "",
    email: contact.email || null,
    phone: contact.phone || null,
    address_line1: contact.address1 || null,
    city: contact.city || null,
    state: contact.state || null,
    zip: contact.postalCode || null,
    ssn_last4: get("ssn_last4"),
    dob: dobRaw ? new Date(dobRaw).toISOString().split("T")[0] : null,
    score_eq_start: eq,
    score_exp_start: exp,
    score_tu_start: tu,
    score_eq_current: eq,
    score_exp_current: exp,
    score_tu_current: tu,
    signature_status: (isSigned ? "signed" : "pending") as "signed" | "pending",
    signature_type: (isSigned ? "electronic" : null) as "electronic" | null,
    signed_at: isSigned ? get("signed_at") || new Date().toISOString() : null,
  };
}

// ── Drive sync (onboarding docs) ─────────────────────────────────────────────

async function syncOnboardingDocsToDrive(
  agency: Agency,
  contact: GHLContact
): Promise<void> {
  if (!agency.google_drive_enabled) return;

  const clientName = `${contact.firstName ?? ""} ${contact.lastName ?? ""}`.trim();
  const map = agency.ghl_field_keys ?? {};

  const docTypes: { key: keyof typeof map; label: string }[] = [
    { key: "credit_report_eq", label: "Credit_Report_Equifax" },
    { key: "credit_report_exp", label: "Credit_Report_Experian" },
    { key: "credit_report_tu", label: "Credit_Report_TransUnion" },
    { key: "id_document", label: "ID_Document" },
    { key: "proof_of_address", label: "Proof_of_Address" },
  ];

  for (const doc of docTypes) {
    try {
      const fileUrl = getFieldValue(contact, map[doc.key]);
      if (!fileUrl || !/^https?:\/\//.test(fileUrl)) continue;

      const fileRes = await fetch(fileUrl, {
        headers: { Authorization: `Bearer ${agency.ghl_api_key}` },
      });
      if (!fileRes.ok) continue;

      const fileBuffer = Buffer.from(await fileRes.arrayBuffer());
      const mimeType = fileRes.headers.get("content-type") || "application/pdf";
      const ext = mimeType.includes("pdf") ? "pdf" : "dat";

      await syncDocumentToDrive(agency, {
        clientName,
        subFolder: "Onboarding",
        fileName: `${doc.label} - ${clientName}.${ext}`,
        fileBuffer,
        mimeType,
      });

      await new Promise((r) => setTimeout(r, 300));
    } catch (err) {
      console.error(`[Onboarding] Drive sync failed for ${doc.key}:`, err);
    }
  }
}

// ── Webhook ──────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  // Shared-secret check (same GHL_WEBHOOK_SECRET as /api/ghl/webhook). When
  // configured, callers MUST present it — absent counts as invalid. Rejections
  // still return 200 so GHL doesn't spin on retries.
  const secret = process.env.GHL_WEBHOOK_SECRET;
  if (secret) {
    const provided =
      req.headers.get("x-clientdeck-secret") ||
      req.headers.get("x-wh-secret") ||
      new URL(req.url).searchParams.get("secret");
    if (!provided || provided !== secret) {
      console.warn("GHL onboarding webhook rejected: missing or invalid secret");
      return Response.json({ received: true, processed: false });
    }
  }

  try {
    const payload = await req.json();
    const contactId: string | undefined = payload.contactId;
    const locationId: string | undefined = payload.locationId;

    if (!contactId || !locationId) {
      return Response.json(
        { success: false, error: "Missing contactId or locationId" },
        { status: 200 }
      );
    }

    const supabase = createAdminClient();
    const { data: agencyRow } = await supabase
      .from("agencies")
      .select("*")
      .eq("ghl_location_id", locationId)
      .single();
    if (!agencyRow) {
      return Response.json({ success: false, error: "Agency not found" }, { status: 200 });
    }
    const agency = agencyRow as Agency;

    if (!agency.ghl_api_key) {
      return Response.json({ success: false, error: "Agency GHL not configured" }, { status: 200 });
    }

    const opts = { apiKey: agency.ghl_api_key, locationId };
    const contactRes = await getGHLContact(contactId, opts).catch(() => null);
    const contact: GHLContact | null = contactRes?.contact ?? null;
    if (!contact) {
      return Response.json({ success: false, error: "Contact not found in GHL" }, { status: 200 });
    }
    contact.id = contactId;

    const clientData = extractClientData(contact, agency);

    const { data: existing } = await supabase
      .from("clients")
      .select("id, portal_token")
      .eq("agency_id", agency.id)
      .eq("ghl_contact_id", contactId)
      .maybeSingle();

    let clientId: string;
    const isNewClient = !existing;
    if (existing) {
      await supabase
        .from("clients")
        .update({
          ...clientData,
          onboarding_form_submitted: true,
          onboarding_submitted_at: new Date().toISOString(),
          status: "analysis",
        })
        .eq("id", existing.id);
      clientId = existing.id;
    } else {
      const { data: newClient, error: insertErr } = await supabase
        .from("clients")
        .insert({
          agency_id: agency.id,
          ghl_contact_id: contactId,
          ...clientData,
          onboarding_form_submitted: true,
          onboarding_submitted_at: new Date().toISOString(),
          status: "analysis",
        })
        .select("id")
        .single();
      if (insertErr || !newClient) {
        throw new Error(insertErr?.message ?? "Failed to create client");
      }
      clientId = newClient.id;
    }

    // Portal magic-link (also persists the token on the client row).
    const portalLink = await generatePortalLink(clientId, agency.id).catch(() => null);

    await supabase.from("activity_log").insert({
      agency_id: agency.id,
      client_id: clientId,
      actor_type: "ghl",
      action: "Onboarding complete",
      description: `Onboarding form submitted by ${clientData.first_name} ${clientData.last_name}.`,
      metadata: { contact_id: contactId },
    });

    // Heavier work runs after the response is flushed (guaranteed by after()).
    after(async () => {
      await Promise.allSettled([
        (async () => {
          await syncOnboardingDocsToDrive(agency, contact);
        })().catch((err) => console.error("[Onboarding] Drive sync error:", err)),
        (async () => {
          const fields: Record<string, string> = { clientdeck_client_id: clientId };
          if (portalLink) fields.clientdeck_portal_link = portalLink;
          await updateGHLContactFields(contactId, fields, opts);
        })().catch((err) => console.error("[Onboarding] GHL field sync error:", err)),
        (async () => {
          if (!isNewClient) return;
          const notifClient: NotifiableClient = {
            id: clientId,
            first_name: clientData.first_name,
            last_name: clientData.last_name,
            email: clientData.email,
            phone: clientData.phone,
            ghl_contact_id: contactId,
            ghl_opportunity_id: null,
            portal_token: portalLink ? new URL(portalLink).searchParams.get("token") : null,
            monthly_fee: 0,
            total_items_deleted: 0,
            total_items_start: 0,
            service_start_date: new Date().toISOString().split("T")[0],
            score_eq_current: clientData.score_eq_current,
            score_exp_current: clientData.score_exp_current,
            score_tu_current: clientData.score_tu_current,
            score_eq_start: clientData.score_eq_start,
            score_exp_start: clientData.score_exp_start,
            score_tu_start: clientData.score_tu_start,
          };
          await notifyStaffNewClient(agency, notifClient);
        })().catch((err) => console.error("[Onboarding] Staff notification error:", err)),
        (async () => {
          if (!isNewClient) return;
          if (!agency.settings?.auto_pull_scores) return;
          if (!isAgencyPlanOrHigher(agency.plan)) return;
          if (
            agency.credit_monitoring_service === "none" ||
            !agency.credit_monitoring_api_key ||
            !agency.credit_monitoring_api_secret
          )
            return;
          if (
            !clientData.ssn_last4 ||
            !clientData.dob ||
            !clientData.address_line1 ||
            !clientData.city ||
            !clientData.state ||
            !clientData.zip
          )
            return;

          const { pullCreditScores } = await import("@/lib/credit-monitoring");
          const result = await pullCreditScores(
            agency.credit_monitoring_service,
            agency.credit_monitoring_api_key,
            agency.credit_monitoring_api_secret,
            {
              firstName: clientData.first_name,
              lastName: clientData.last_name,
              ssnLast4: clientData.ssn_last4,
              dob: clientData.dob,
              address: clientData.address_line1,
              city: clientData.city,
              state: clientData.state,
              zip: clientData.zip,
            }
          );

          const succeeded =
            !result.error &&
            (result.score_eq !== null || result.score_exp !== null || result.score_tu !== null);

          await supabase.from("credit_monitoring_pulls").insert({
            agency_id: agency.id,
            client_id: clientId,
            service: agency.credit_monitoring_service,
            score_eq: result.score_eq,
            score_exp: result.score_exp,
            score_tu: result.score_tu,
            raw_response: result.raw_response ?? null,
            status: succeeded ? "success" : "failed",
            error_message: result.error ?? null,
          });

          if (succeeded) {
            await supabase
              .from("clients")
              .update({
                score_eq_current: result.score_eq ?? clientData.score_eq_current,
                score_exp_current: result.score_exp ?? clientData.score_exp_current,
                score_tu_current: result.score_tu ?? clientData.score_tu_current,
              })
              .eq("id", clientId);
          }
        })().catch((err) => console.error("[Onboarding] Credit monitoring auto-pull error:", err)),
      ]);
    });

    return Response.json({ success: true, clientId });
  } catch (err) {
    console.error("[Onboarding webhook] Error:", err);
    // Always 200 so GHL doesn't enter a retry storm.
    return Response.json({ success: false, error: String(err) }, { status: 200 });
  }
}
