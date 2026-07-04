import { NextResponse, type NextRequest } from "next/server";
import { requireAdminApi, loadAgencyGhl, hasGhlCreds } from "@/lib/admin/tool-helpers";
import { createAdminClient } from "@/lib/supabase/admin";
import { createGHLContact, updateGHLContactFields } from "@/lib/ghl/api";
import type { Client } from "@/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Pushes all of an agency's ClientDeck clients to GHL as contacts (best-effort). */
export async function POST(request: NextRequest) {
  const unauthorized = await requireAdminApi();
  if (unauthorized) return unauthorized;

  const { agencyId } = await request.json().catch(() => ({ agencyId: "" }));
  if (!agencyId) {
    return NextResponse.json({ ok: false, error: "Missing agencyId" }, { status: 400 });
  }

  const agency = await loadAgencyGhl(agencyId);
  if (!hasGhlCreds(agency)) {
    return NextResponse.json(
      { ok: false, error: "Configure the GHL API key and Location ID first." },
      { status: 400 }
    );
  }

  const opts = { apiKey: agency.ghl_api_key, locationId: agency.ghl_location_id };
  const admin = createAdminClient();

  const { data: clients } = await admin
    .from("clients")
    .select("*")
    .eq("agency_id", agencyId);

  const list = (clients ?? []) as Client[];
  if (list.length === 0) {
    return NextResponse.json({ ok: true, message: "No clients to sync.", created: 0, updated: 0 });
  }

  let created = 0;
  let updated = 0;
  const errors: string[] = [];

  // Process in small batches to stay within GHL rate limits.
  const BATCH = 3;
  for (let i = 0; i < list.length; i += BATCH) {
    const batch = list.slice(i, i + BATCH);
    await Promise.all(
      batch.map(async (client) => {
        try {
          const fields: Record<string, string | number> = {
            clientdeck_client_id: client.id,
            dispute_round_current: client.current_round ?? 0,
            items_deleted_total: client.total_items_deleted ?? 0,
            total_negative_items: client.total_items_current ?? 0,
          };
          if (client.score_eq_current) fields.credit_score_eq_current = client.score_eq_current;
          if (client.score_exp_current) fields.credit_score_exp_current = client.score_exp_current;
          if (client.score_tu_current) fields.credit_score_tu_current = client.score_tu_current;

          if (client.ghl_contact_id) {
            await updateGHLContactFields(client.ghl_contact_id, fields, opts);
            updated++;
            return;
          }

          const contactId = await createGHLContact(
            {
              firstName: client.first_name,
              lastName: client.last_name,
              email: client.email,
              phone: client.phone,
              address1: client.address_line1,
              city: client.city,
              state: client.state,
              postalCode: client.zip,
            },
            opts
          );

          if (!contactId) {
            errors.push(`${client.first_name} ${client.last_name}: create failed`);
            return;
          }

          await admin
            .from("clients")
            .update({ ghl_contact_id: contactId })
            .eq("id", client.id);
          await updateGHLContactFields(contactId, fields, opts);
          created++;
        } catch (e) {
          errors.push(
            `${client.first_name} ${client.last_name}: ${
              e instanceof Error ? e.message : "failed"
            }`
          );
        }
      })
    );
  }

  return NextResponse.json({
    ok: errors.length === 0,
    message: `Synced ${created + updated} of ${list.length} clients (${created} new, ${updated} updated).`,
    created,
    updated,
    errors: errors.slice(0, 10),
  });
}
