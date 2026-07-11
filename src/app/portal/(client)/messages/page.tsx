import { redirect } from "next/navigation";
import { getPortalSession } from "@/lib/portal/session";
import { PortalMessagesPanel } from "./messages-panel";

export default async function PortalMessagesPage() {
  const session = await getPortalSession();
  if (!session) redirect("/portal?expired=true");

  const { client } = session;

  return (
    <PortalMessagesPanel
      hasPhone={Boolean(client.phone)}
      hasEmail={Boolean(client.email)}
      linked={Boolean(client.ghl_contact_id)}
    />
  );
}
