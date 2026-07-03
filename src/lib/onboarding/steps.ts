import type { AgencySettings, OnboardingSteps } from "@/types";

export type OnboardingStepKey = keyof OnboardingSteps;

export const ONBOARDING_STEP_KEYS: OnboardingStepKey[] = [
  "ghl_connected",
  "first_client_added",
  "snapshot_installed",
  "test_portal_viewed",
];

export const DEFAULT_STEPS: OnboardingSteps = {
  ghl_connected: false,
  first_client_added: false,
  snapshot_installed: false,
  test_portal_viewed: false,
};

export interface OnboardingState {
  steps: OnboardingSteps;
  completedCount: number;
  total: number;
  allComplete: boolean;
  completed: boolean;
  /** True while the 24h post-completion congrats window is still open. */
  showCongrats: boolean;
  /** True once the banner should be permanently hidden. */
  hidden: boolean;
}

const CONGRATS_WINDOW_MS = 24 * 60 * 60 * 1000;

export function computeOnboarding(settings: AgencySettings): OnboardingState {
  const steps: OnboardingSteps = { ...DEFAULT_STEPS, ...settings.onboarding_steps };
  const total = ONBOARDING_STEP_KEYS.length;
  const completedCount = ONBOARDING_STEP_KEYS.filter((k) => steps[k]).length;
  const allComplete = completedCount === total;
  const completed = Boolean(settings.onboarding_completed);

  let showCongrats = false;
  let hidden = false;
  if (completed) {
    const at = settings.onboarding_completed_at
      ? new Date(settings.onboarding_completed_at).getTime()
      : 0;
    const elapsed = Date.now() - at;
    showCongrats = at > 0 && elapsed < CONGRATS_WINDOW_MS;
    hidden = !showCongrats; // completed + past 24h → hide permanently
  }

  return { steps, completedCount, total, allComplete, completed, showCongrats, hidden };
}
