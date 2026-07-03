import { createServerSupabaseClient } from "@/lib/supabase/server";
import { DocumentsManager } from "./documents-manager";
import type { Document } from "@/types";

export default async function ClientDocumentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const { data } = await supabase
    .from("documents")
    .select("*")
    .eq("client_id", id)
    .order("created_at", { ascending: false });

  return (
    <DocumentsManager clientId={id} documents={(data ?? []) as Document[]} />
  );
}
