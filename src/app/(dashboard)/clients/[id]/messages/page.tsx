import { createServerSupabaseClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { MessagesPanel } from "./messages-panel";

export default async function ClientMessagesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: client, error } = await supabase
    .from("clients")
    .select("id, ghl_contact_id, phone, email")
    .eq("id", id)
    .single();

  if (error || !client) notFound();

  return (
    <MessagesPanel
      clientId={client.id}
      hasPhone={Boolean(client.phone)}
      hasEmail={Boolean(client.email)}
      linked={Boolean(client.ghl_contact_id)}
    />
  );
}
