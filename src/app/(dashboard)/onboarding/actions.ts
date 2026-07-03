"use server";

import { revalidatePath } from "next/cache";
import { getSessionContext } from "@/lib/auth/session";
import { markOnboardingStep } from "@/lib/onboarding/mark";
import type { OnboardingStepKey } from "@/lib/onboarding/steps";

/**
 * Public onboarding-step setter. Validates the caller owns the agency, then
 * delegates to markOnboardingStep. Signature matches the spec: (agencyId, step, value).
 */
export async function updateOnboardingStep(
  agencyId: string,
  step: OnboardingStepKey,
  value: boolean
): Promise<{ success: boolean; error?: string }> {
  const session = await getSessionContext();
  if (!session) return { success: false, error: "Not authenticated." };
  if (session.agency.id !== agencyId) {
    return { success: false, error: "Forbidden." };
  }

  await markOnboardingStep(agencyId, step, value);
  revalidatePath("/dashboard");
  revalidatePath("/onboarding");
  return { success: true };
}
