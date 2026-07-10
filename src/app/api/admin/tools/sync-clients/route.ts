import { NextResponse, type NextRequest } from "next/server";
import { requireAdminApi, loadAgencyGhl, hasGhlCreds } from "@/lib/admin/tool-helpers";
import { createAdminClient } from "@/lib/supabase/admin";
import { createGHLContact, updateGHLContactFields } from "@/lib/ghl/api";
import { buildClientSyncFields } from "@/lib/ghl/client-fields";
import type { Client } from "@/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Pushes all of an agency's RoundTrack clients to GHL as contacts (best-effort). */
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
          const fields = buildClientSyncFields(client);

          if (client.ghl_contact_id) {
            await updateGHLContactFields(client.ghl_contact_id, fields, opts);
            updated++;
            return;
          }

          const ghlRes = await createGHLContact(
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

          if (!ghlRes.ok) {
            errors.push(`${client.first_name} ${client.last_name}: ${ghlRes.error}`);
            return;
          }
          const contactId = ghlRes.id;

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
