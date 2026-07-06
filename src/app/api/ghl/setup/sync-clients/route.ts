import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createGHLContact, updateGHLContactFields } from "@/lib/ghl/api";
import type { Client } from "@/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Pushes all of the signed-in agency's own clients to GHL as contacts (best-effort). RLS scopes this to the agency automatically. */
export async function POST() {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }

  const { ghl_api_key, ghl_location_id } = session.agency;
  if (!ghl_api_key || !ghl_location_id) {
    return NextResponse.json(
      { ok: false, error: "Connect GHL (Location ID + API key) first." },
      { status: 400 }
    );
  }
  const opts = { apiKey: ghl_api_key, locationId: ghl_location_id };

  const supabase = await createServerSupabaseClient();
  const { data: clients } = await supabase.from("clients").select("*");
  const list = (clients ?? []) as Client[];
  if (list.length === 0) {
    return NextResponse.json({ ok: true, message: "No clients to sync." });
  }

  let created = 0;
  let updated = 0;
  const errors: string[] = [];
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

          await supabase.from("clients").update({ ghl_contact_id: contactId }).eq("id", client.id);
          await updateGHLContactFields(contactId, fields, opts);
          created++;
        } catch (e) {
          errors.push(`${client.first_name} ${client.last_name}: ${e instanceof Error ? e.message : "failed"}`);
        }
      })
    );
  }

  return NextResponse.json({
    ok: errors.length === 0,
    message: `Synced ${created + updated} of ${list.length} clients (${created} new, ${updated} updated).`,
    errors: errors.slice(0, 10),
  });
}
