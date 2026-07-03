import { createAdminClient } from "@/lib/supabase/admin";
import { computeOnboarding, DEFAULT_STEPS, type OnboardingStepKey } from "./steps";
import type { AgencySettings } from "@/types";

/**
 * Sets a single onboarding step and, when all four are complete, stamps
 * `onboarding_completed` + `onboarding_completed_at`. Server-only; callers must
 * pass an agencyId they've already authorized (session/webhook). Uses the
 * service-role client so it works from any trusted server context.
 */
export async function markOnboardingStep(
  agencyId: string,
  step: OnboardingStepKey,
  value = true
): Promise<void> {
  const supabase = createAdminClient();

  const { data: agency } = await supabase
    .from("agencies")
    .select("settings")
    .eq("id", agencyId)
    .single();
  if (!agency) return;

  const settings = (agency.settings ?? {}) as AgencySettings;
  const steps = { ...DEFAULT_STEPS, ...settings.onboarding_steps, [step]: value };

  const nextSettings: AgencySettings = { ...settings, onboarding_steps: steps };

  const state = computeOnboarding(nextSettings);
  if (state.allComplete && !settings.onboarding_completed) {
    nextSettings.onboarding_completed = true;
    nextSettings.onboarding_completed_at = new Date().toISOString();
  }

  await supabase
    .from("agencies")
    .update({ settings: nextSettings })
    .eq("id", agencyId);
}
