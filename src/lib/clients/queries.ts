import { cache } from "react";
import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Client } from "@/types";

/**
 * Fetches a single client (RLS scopes to the caller's agency). Cached per
 * request so the detail layout and the active tab page share one query.
 * Calls notFound() when the id doesn't resolve to a visible client.
 */
export const getClientOr404 = cache(async (id: string): Promise<Client> => {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) notFound();
  return data as Client;
});
