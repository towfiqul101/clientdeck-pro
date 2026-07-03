import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ItemsManager } from "./items-manager";
import type { NegativeItem } from "@/types";

export default async function ClientItemsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const { data } = await supabase
    .from("negative_items")
    .select("*")
    .eq("client_id", id)
    .order("bureau", { ascending: true })
    .order("created_at", { ascending: false });

  return (
    <ItemsManager clientId={id} items={(data ?? []) as NegativeItem[]} />
  );
}
