import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth/session";
import { GHLForm } from "./ghl-form";
import { GHLSyncActivity } from "./sync-activity";
import { GhlFieldMapping } from "./ghl-field-mapping";
import { OnboardingWebhookCard } from "./onboarding-webhook-card";
import { NotificationWebhooksForm } from "./notification-webhooks-form";
import { ResendFallbackBanner } from "./resend-fallback-banner";

export default async function GHLSettingsPage() {
  const session = await getSessionContext();
  if (!session) redirect("/login");

  const { agency } = session;
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "https://app.clientdeckpro.com";
  const webhookUrl = `${appUrl}/api/ghl/webhook`;
  const onboardingWebhookUrl = `${appUrl}/api/ghl/onboarding`;

  return (
    <div className="space-y-6">
      <GHLForm
        initial={{
          locationId: agency.ghl_location_id ?? "",
          apiKey: agency.ghl_api_key ?? "",
        }}
        webhookUrl={webhookUrl}
      />
      <GhlFieldMapping initial={agency.ghl_field_keys ?? {}} />
      <OnboardingWebhookCard webhookUrl={onboardingWebhookUrl} />
      <ResendFallbackBanner triggers={agency.settings?.ghl_webhook_triggers ?? {}} />
      <NotificationWebhooksForm
        initial={{
          triggers: agency.settings?.ghl_webhook_triggers ?? {},
          ownerGhlContactId: agency.settings?.owner_ghl_contact_id ?? "",
        }}
      />
      <GHLSyncActivity />
    </div>
  );
}
