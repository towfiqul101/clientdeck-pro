import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getGHLContact, updateGHLContactFields } from "@/lib/ghl/api";
import { GHL_FIELD_KEYS } from "@/lib/ghl/field-keys";
import { verifyGhlWebhook, locationBelongsToAgency } from "@/lib/ghl/webhook-auth";
import { generatePortalLink } from "@/lib/utils/portal-token";
import { syncDocumentToDrive } from "@/lib/google-drive/sync";
import { notifyStaffNewClient, type NotifiableClient } from "@/lib/ghl/notifications";
import { moveClientPipelineStage } from "@/lib/ghl/pipeline";
import { isAgencyPlanOrHigher } from "@/lib/billing/plans";
import { CREDIT_SCORE_RANGES, RESULTS_TIMELINES, EMPLOYMENT_STATUSES } from "@/lib/constants";
import type {
  Agency,
  GHLContact,
  GHLContactCustomField,
  GhlFieldKeys,
  CreditScoreRange,
  ResultsTimeline,
  EmploymentStatus,
} from "@/types";

// Hobby plan caps at 60s. Client creation runs inline; Drive/GHL sync run via
// after() so GHL gets a fast 200 while the heavier work still completes.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

// ── Field extraction ─────────────────────────────────────────────────────────

/**
 * Reads a GHL custom-field value by key. GHL reports a field's key prefixed
 * (`contact.rtp__ssn_last4`) while GHL_FIELD_KEYS stores it bare
 * (`rtp__ssn_last4`), so both forms are accepted. An id is also accepted,
 * since agency-configured mappings may hold either.
 */
function getFieldValue(contact: GHLContact, ghlKey: string | undefined): string | null {
  if (!ghlKey) return null;
  const bare = ghlKey.replace(/^contact\./, "");
  const fields = contact.customFields ?? [];
  const match = fields.find((f: GHLContactCustomField) => {
    const fieldKey = f.fieldKey?.replace(/^contact\./, "");
    return f.id === ghlKey || fieldKey === bare;
  });
  const value = match?.value;
  return value === undefined || value === null ? null : String(value);
}

function toInt(value: string | null): number | null {
  if (!value) return null;
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * The 4 Onboarding Details yes/no fields are stored as TEXT in GHL (see
 * field-keys.ts) — no distinct "no answer given" vs "no" without this
 * three-way read: null/blank stays null (not captured), anything else is
 * tested against yes/true/1.
 */
function toBool(value: string | null): boolean | null {
  if (value === null || value.trim() === "") return null;
  return /^(yes|true|1)$/i.test(value.trim());
}

/**
 * Best-effort GHL option-label -> our enum key normalizer. GHL reports
 * whatever text the agency's dropdown/radio is configured with, which won't
 * necessarily match our snake_case keys verbatim ("800+", "Self-Employed").
 * An unrecognized value is dropped to null rather than stored — these
 * columns are CHECK-constrained (migration 034), and passing through an
 * unmapped value would fail the whole client upsert. Same reasoning as the
 * ssn_last4 truncation below: never let attacker/agency-controlled GHL text
 * violate a DB constraint on our own insert.
 */
function normalizeEnum<T extends string>(value: string | null, allowed: readonly T[]): T | null {
  if (!value) return null;
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/\+/g, "_plus")
    .replace(/[\s-]+/g, "_");
  return (allowed as readonly string[]).includes(normalized) ? (normalized as T) : null;
}

function extractClientData(contact: GHLContact, agency: Agency) {
  // Bureau scores stay agency-configurable (the one thing an agency legitimately
  // captures on their own intake form). Everything identity-related is read from
  // RTP-owned fixed keys — see RTP_IDENTITY_FIELDS.
  const map = agency.ghl_field_keys ?? {};
  const mapped = (key: keyof GhlFieldKeys) => getFieldValue(contact, map[key]);
  const fixed = (key: string) => getFieldValue(contact, key);

  const eq = toInt(mapped("score_eq"));
  const exp = toInt(mapped("score_exp"));
  const tu = toInt(mapped("score_tu"));

  const dobRaw = fixed(GHL_FIELD_KEYS.DOB);
  const signatureRaw = fixed(GHL_FIELD_KEYS.SIGNATURE_STATUS);
  const isSigned = signatureRaw
    ? /^(signed|yes|true|complete)/i.test(signatureRaw)
    : false;

  // NEVER store a full SSN. Even reading from our own fixed field, strip to
  // digits and keep only the last 4 — the agency's GHL form writes into this
  // field and could well put a full SSN there. The dashboard form and CSV
  // import enforce the same rule; this webhook is the least-trusted entry
  // point. Anything that can't yield 4 digits is dropped rather than stored
  // short, which would violate the ssn_last4 CHECK constraint (migration 030).
  const ssnDigits = fixed(GHL_FIELD_KEYS.SSN_LAST4)?.replace(/\D/g, "") ?? "";
  const ssnLast4 = ssnDigits.length >= 4 ? ssnDigits.slice(-4) : null;

  // Onboarding Details intake (migration 034) — standard onboarding-form
  // data, RTP-owned fixed keys, same read pattern as the identity fields.
  const creditScoreRange = normalizeEnum(
    fixed(GHL_FIELD_KEYS.CREDIT_SCORE_RANGE),
    CREDIT_SCORE_RANGES.map((r) => r.value) as readonly CreditScoreRange[]
  );
  const resultsTimeline = normalizeEnum(
    fixed(GHL_FIELD_KEYS.RESULTS_TIMELINE),
    RESULTS_TIMELINES.map((r) => r.value) as readonly ResultsTimeline[]
  );
  const employmentStatus = normalizeEnum(
    fixed(GHL_FIELD_KEYS.EMPLOYMENT_STATUS),
    EMPLOYMENT_STATUSES.map((r) => r.value) as readonly EmploymentStatus[]
  );
  const bankruptcyFiled = toBool(fixed(GHL_FIELD_KEYS.BANKRUPTCY_FILED));
  const bankruptcyDateRaw = fixed(GHL_FIELD_KEYS.BANKRUPTCY_DATE);

  return {
    first_name: contact.firstName || "",
    last_name: contact.lastName || "",
    email: contact.email || null,
    phone: contact.phone || null,
    address_line1: contact.address1 || null,
    city: contact.city || null,
    state: contact.state || null,
    zip: contact.postalCode || null,
    ssn_last4: ssnLast4,
    dob: dobRaw ? new Date(dobRaw).toISOString().split("T")[0] : null,
    score_eq_start: eq,
    score_exp_start: exp,
    score_tu_start: tu,
    score_eq_current: eq,
    score_exp_current: exp,
    score_tu_current: tu,
    signature_status: (isSigned ? "signed" : "pending") as "signed" | "pending",
    signature_type: (isSigned ? "electronic" : null) as "electronic" | null,
    signed_at: isSigned
      ? fixed(GHL_FIELD_KEYS.SIGNATURE_DATE) || new Date().toISOString()
      : null,
    credit_score_range: creditScoreRange,
    reviewed_credit_report_recently: toBool(fixed(GHL_FIELD_KEYS.REVIEWED_CREDIT_REPORT_RECENTLY)),
    negative_items_reported: toBool(fixed(GHL_FIELD_KEYS.NEGATIVE_ITEMS_REPORTED)),
    enrolled_other_program: toBool(fixed(GHL_FIELD_KEYS.ENROLLED_OTHER_PROGRAM)),
    primary_goal: fixed(GHL_FIELD_KEYS.PRIMARY_GOAL),
    results_timeline: resultsTimeline,
    employment_status: employmentStatus,
    bankruptcy_filed: bankruptcyFiled,
    bankruptcy_date: bankruptcyFiled && bankruptcyDateRaw
      ? new Date(bankruptcyDateRaw).toISOString().split("T")[0]
      : null,
    intake_concerns: fixed(GHL_FIELD_KEYS.INTAKE_CONCERNS),
  };
}

// ── Drive sync (onboarding docs) ─────────────────────────────────────────────

async function syncOnboardingDocsToDrive(
  agency: Agency,
  contact: GHLContact
): Promise<void> {
  if (!agency.google_drive_enabled) return;

  const clientName = `${contact.firstName ?? ""} ${contact.lastName ?? ""}`.trim();

  // Fixed RTP-owned FILE_UPLOAD fields — no longer agency-mapped.
  const docTypes: { key: string; label: string }[] = [
    { key: GHL_FIELD_KEYS.CREDIT_REPORT_EQ, label: "Credit_Report_Equifax" },
    { key: GHL_FIELD_KEYS.CREDIT_REPORT_EXP, label: "Credit_Report_Experian" },
    { key: GHL_FIELD_KEYS.CREDIT_REPORT_TU, label: "Credit_Report_TransUnion" },
    { key: GHL_FIELD_KEYS.ID_DOCUMENT, label: "ID_Document" },
    { key: GHL_FIELD_KEYS.PROOF_OF_ADDRESS, label: "Proof_of_Address" },
  ];

  for (const doc of docTypes) {
    try {
      const fileUrl = getFieldValue(contact, doc.key);
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
  // Fails closed: no valid per-agency token (or legacy global secret) => reject.
  const auth = await verifyGhlWebhook(req);
  if (!auth.ok) {
    console.warn(`GHL onboarding webhook rejected: ${auth.reason}`);
    return Response.json({ received: true, processed: false });
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

    // Tenant binding: locationId is caller-controlled, so a token identifying
    // agency A must not be usable to onboard a client into agency B.
    if (!(await locationBelongsToAgency(auth, locationId))) {
      console.warn(
        "GHL onboarding webhook rejected: locationId does not belong to the token's agency"
      );
      return Response.json({ received: true, processed: false }, { status: 200 });
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
          const fields: Record<string, string> = { [GHL_FIELD_KEYS.CLIENT_ID]: clientId };
          if (portalLink) fields[GHL_FIELD_KEYS.PORTAL_LINK] = portalLink;
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
            assigned_to: null,
            notify_team_member_ids: [],
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
          // Put newly onboarded clients into the pipeline's Analysis stage so
          // they appear as an opportunity immediately (best-effort; no-ops if
          // the agency hasn't mapped a pipeline/Analysis stage).
          if (!isNewClient) return;
          await moveClientPipelineStage(
            agency,
            { id: clientId, ghl_contact_id: contactId, ghl_opportunity_id: null },
            "analysis"
          );
        })().catch((err) => console.error("[Onboarding] Pipeline opportunity error:", err)),
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
