import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpen, AlertTriangle, KeyRound } from "lucide-react";
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

  // Each agency authenticates its webhooks with its OWN token (migration 031),
  // not the old global GHL_WEBHOOK_SECRET — that one was shown to every agency,
  // so any of them could forge webhooks against another agency's locationId.
  // The token is embedded in the copyable URL so the agency pastes a URL that
  // actually authenticates. Server Component: the token is rendered into the
  // URL string, not shipped as a separate client-side value.
  const secretQuery = `?secret=${encodeURIComponent(agency.webhook_token)}`;
  const webhookUrl = `${appUrl}/api/ghl/webhook${secretQuery}`;
  const onboardingWebhookUrl = `${appUrl}/api/ghl/onboarding${secretQuery}`;
  const webhookSecretConfigured = Boolean(agency.webhook_token);

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

      {webhookSecretConfigured ? (
        <div className="flex items-start gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-4">
          <KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-blue-400" />
          <div className="text-sm">
            <p className="font-semibold text-slate-100">
              Your webhook URLs contain a private key — treat them as secrets
            </p>
            <p className="mt-1 text-slate-400">
              Each URL below carries a key unique to your agency, so it
              authenticates on its own. Anyone holding one can post contact data
              into your account — don&apos;t share or screenshot them. Paste each
              into the matching GHL workflow (inbound webhook, and the onboarding
              webhook further down). If a URL is ever exposed, ask support to
              rotate your key.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
          <div className="text-sm">
            <p className="font-semibold text-red-300">
              Webhook token missing — contact support
            </p>
            <p className="mt-1 text-red-300/90">
              This agency has no webhook token, so the URLs below cannot
              authenticate. Migration 031 should have issued one automatically.
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
