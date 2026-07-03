import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth/session";
import { GHLForm } from "./ghl-form";
import { GHLSyncActivity } from "./sync-activity";

export default async function GHLSettingsPage() {
  const session = await getSessionContext();
  if (!session) redirect("/login");

  const { agency } = session;
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "https://app.clientdeckpro.com";
  const webhookUrl = `${appUrl}/api/ghl/webhook`;

  return (
    <>
      <GHLForm
        initial={{
          locationId: agency.ghl_location_id ?? "",
          apiKey: agency.ghl_api_key ?? "",
        }}
        webhookUrl={webhookUrl}
      />
      <GHLSyncActivity />
    </>
  );
}
