import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpen, AlertTriangle } from "lucide-react";
import { getSessionContext } from "@/lib/auth/session";
import { maskSecret } from "@/lib/utils/secrets";
import { GHLForm } from "./ghl-form";
import { GHLSyncActivity } from "./sync-activity";
import { GhlFieldMapping } from "./ghl-field-mapping";
import { IdentityFieldsNotice } from "./identity-fields-notice";
import { getGhlFieldStatus } from "@/lib/ghl/field-status";
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
    "https://app.roundtrackpro.com";

  // The webhook endpoints authenticate with a shared secret. Ship it inside the
  // copyable URL so the agency pastes a URL that actually authenticates —
  // previously the displayed URL carried no secret, so there was no way for an
  // agency to configure an authenticated webhook at all, and the endpoints were
  // left accepting unauthenticated callers.
  //
  // Server-only env var: this page is a Server Component, so the secret is
  // rendered into the URL string rather than shipped as a client-side value.
  const webhookSecret = process.env.GHL_WEBHOOK_SECRET ?? "";
  const secretQuery = webhookSecret
    ? `?secret=${encodeURIComponent(webhookSecret)}`
    : "";
  const webhookUrl = `${appUrl}/api/ghl/webhook${secretQuery}`;
  const onboardingWebhookUrl = `${appUrl}/api/ghl/onboarding${secretQuery}`;
  const webhookSecretConfigured = Boolean(webhookSecret);

  // Best-effort: resolves mapped keys to human-readable GHL names and reports
  // whether the RTP-owned identity fields exist. No-ops if GHL isn't connected.
  const fieldStatus = await getGhlFieldStatus(agency);

  return (
    <div className="space-y-6">
      <Link
        href="/onboarding/ghl-setup"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-400 hover:text-blue-400"
      >
        <BookOpen className="h-4 w-4" /> View the full GHL workflow setup guide
      </Link>

      {!webhookSecretConfigured && (
        <div className="flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
          <div className="text-sm">
            <p className="font-semibold text-red-300">
              Webhook secret not configured — your webhooks are unauthenticated
            </p>
            <p className="mt-1 text-red-300/90">
              <code className="rounded bg-black/30 px-1 py-0.5 font-mono text-xs">
                GHL_WEBHOOK_SECRET
              </code>{" "}
              isn&apos;t set on the server, so the webhook URLs below carry no
              secret and anyone who knows your GHL Location ID (it&apos;s in your
              GHL dashboard URL) can post to them. Set it in your hosting
              environment and redeploy, then re-copy the URLs below into GHL.
            </p>
          </div>
        </div>
      )}

      <GHLForm
        initial={{
          locationId: agency.ghl_location_id ?? "",
          // Never send the plaintext key to the browser — the save action
          // treats the masked placeholder as "keep the existing key".
          apiKey: maskSecret(agency.ghl_api_key),
        }}
        webhookUrl={webhookUrl}
      />
      <IdentityFieldsNotice
        present={fieldStatus.identityPresent}
        missing={fieldStatus.identityMissing}
        available={fieldStatus.available}
      />
      <GhlFieldMapping
        initial={agency.ghl_field_keys ?? {}}
        namesByKey={fieldStatus.namesByKey}
      />
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
