import { redirect } from "next/navigation";
import { getPortalSession } from "@/lib/portal/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { PortalDocumentsManager } from "./documents-manager";
import type { Document } from "@/types";

export default async function PortalDocumentsPage() {
  const session = await getPortalSession();
  if (!session) redirect("/portal?expired=true");

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("documents")
    .select("*")
    .eq("client_id", session.client.id)
    .order("created_at", { ascending: false });

  const docs = (data ?? []) as Document[];
  const clientDocs = docs.filter((d) => d.uploaded_by === "client");
  const staffDocs = docs.filter((d) => d.uploaded_by !== "client");

  return (
    <PortalDocumentsManager staffDocs={staffDocs} clientDocs={clientDocs} />
  );
}
