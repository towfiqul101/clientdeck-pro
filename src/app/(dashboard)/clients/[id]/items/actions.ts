"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import type {
  AccountType,
  Bureau,
  DisputeStatus,
  NegativeType,
} from "@/types";

export interface NewItemInput {
  bureau: Bureau;
  creditor_name: string;
  account_number_last4: string;
  account_type: AccountType | "";
  negative_type: NegativeType;
  balance: string;
  date_opened: string;
  date_of_first_delinquency: string;
}

export interface ItemActionResult {
  success: boolean;
  error?: string;
}

const nullable = (v: string) => (v.trim() ? v.trim() : null);
const num = (v: string) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * Recomputes the denormalized item counters on the client from the source
 * negative_items rows. Called after every item mutation to keep the header,
 * list, and stats consistent.
 */
async function recomputeClientItemTotals(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  clientId: string
) {
  const [{ count: total }, { count: deleted }] = await Promise.all([
    supabase
      .from("negative_items")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId),
    supabase
      .from("negative_items")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId)
      .eq("dispute_status", "deleted"),
  ]);

  const totalCount = total ?? 0;
  const deletedCount = deleted ?? 0;

  // Read the existing start so we never lower the intake baseline.
  const { data: client } = await supabase
    .from("clients")
    .select("total_items_start")
    .eq("id", clientId)
    .single();

  await supabase
    .from("clients")
    .update({
      total_items_current: totalCount,
      total_items_deleted: deletedCount,
      total_items_start: Math.max(client?.total_items_start ?? 0, totalCount),
    })
    .eq("id", clientId);
}

export async function addItems(
  clientId: string,
  items: NewItemInput[]
): Promise<ItemActionResult> {
  const session = await getSessionContext();
  if (!session) return { success: false, error: "Not authenticated." };

  const valid = items.filter((i) => i.creditor_name.trim());
  if (valid.length === 0) {
    return { success: false, error: "Add at least one creditor name." };
  }

  const supabase = await createServerSupabaseClient();

  const rows = valid.map((i) => ({
    client_id: clientId,
    agency_id: session.agency.id,
    bureau: i.bureau,
    creditor_name: i.creditor_name.trim(),
    account_number_last4: nullable(i.account_number_last4),
    account_type: i.account_type || null,
    negative_type: i.negative_type,
    balance: num(i.balance),
    date_opened: nullable(i.date_opened),
    date_of_first_delinquency: nullable(i.date_of_first_delinquency),
    dispute_status: "not_disputed" as DisputeStatus,
  }));

  const { error } = await supabase.from("negative_items").insert(rows);
  if (error) return { success: false, error: error.message };

  await recomputeClientItemTotals(supabase, clientId);

  await supabase.from("activity_log").insert({
    agency_id: session.agency.id,
    client_id: clientId,
    actor_type: "staff",
    actor_id: session.userId,
    action: "Items added",
    description: `${rows.length} negative item${
      rows.length === 1 ? "" : "s"
    } added to the client's profile.`,
  });

  revalidatePath(`/clients/${clientId}/items`);
  revalidatePath(`/clients/${clientId}`);
  return { success: true };
}

export async function updateItem(
  clientId: string,
  itemId: string,
  patch: Partial<NewItemInput> & { dispute_status?: DisputeStatus }
): Promise<ItemActionResult> {
  const session = await getSessionContext();
  if (!session) return { success: false, error: "Not authenticated." };

  const supabase = await createServerSupabaseClient();

  const update: Record<string, unknown> = {};
  if (patch.bureau) update.bureau = patch.bureau;
  if (patch.creditor_name !== undefined)
    update.creditor_name = patch.creditor_name.trim();
  if (patch.account_number_last4 !== undefined)
    update.account_number_last4 = nullable(patch.account_number_last4);
  if (patch.account_type !== undefined)
    update.account_type = patch.account_type || null;
  if (patch.negative_type) update.negative_type = patch.negative_type;
  if (patch.balance !== undefined) update.balance = num(patch.balance);
  if (patch.date_opened !== undefined)
    update.date_opened = nullable(patch.date_opened);
  if (patch.date_of_first_delinquency !== undefined)
    update.date_of_first_delinquency = nullable(
      patch.date_of_first_delinquency
    );
  if (patch.dispute_status) update.dispute_status = patch.dispute_status;

  const { error } = await supabase
    .from("negative_items")
    .update(update)
    .eq("id", itemId);

  if (error) return { success: false, error: error.message };

  await recomputeClientItemTotals(supabase, clientId);
  revalidatePath(`/clients/${clientId}/items`);
  revalidatePath(`/clients/${clientId}`);
  return { success: true };
}

export async function deleteItem(
  clientId: string,
  itemId: string
): Promise<ItemActionResult> {
  const session = await getSessionContext();
  if (!session) return { success: false, error: "Not authenticated." };

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("negative_items")
    .delete()
    .eq("id", itemId);

  if (error) return { success: false, error: error.message };

  await recomputeClientItemTotals(supabase, clientId);
  revalidatePath(`/clients/${clientId}/items`);
  revalidatePath(`/clients/${clientId}`);
  return { success: true };
}
