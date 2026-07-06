import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpen } from "lucide-react";
import { getSessionContext } from "@/lib/auth/session";
import { GHLForm } from "./ghl-form";
import { GHLSyncActivity } from "./sync-activity";
import { GhlFieldMapping } from "./ghl-field-mapping";
import { GhlSetupTools } from "./setup-tools";
import { OnboardingWebhookCard } from "./onboarding-webhook-card";
import { TagNotificationGuide } from "./tag-notification-guide";
import { PipelineConfigForm } from "./pipeline-config-form";

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
      <Link
        href="/onboarding/ghl-setup"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700"
      >
        <BookOpen className="h-4 w-4" /> View the full GHL workflow setup guide
      </Link>
      <GHLForm
        initial={{
          locationId: agency.ghl_location_id ?? "",
          apiKey: agency.ghl_api_key ?? "",
        }}
        webhookUrl={webhookUrl}
      />
      <GhlFieldMapping initial={agency.ghl_field_keys ?? {}} />
      <GhlSetupTools />
      <OnboardingWebhookCard webhookUrl={onboardingWebhookUrl} />
      <TagNotificationGuide ownerGhlContactId={agency.settings?.owner_ghl_contact_id ?? ""} />
      <PipelineConfigForm
        initial={{
          pipelineId: agency.settings?.ghl_pipeline_id ?? "",
          stages: agency.settings?.ghl_pipeline_stages ?? {},
        }}
      />
      <GHLSyncActivity />
    </div>
  );
}
