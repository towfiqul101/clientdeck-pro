import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth/session";
import { GeneralForm } from "./general-form";

export default async function GeneralSettingsPage() {
  const session = await getSessionContext();
  if (!session) redirect("/login");

  const { agency } = session;

  return (
    <GeneralForm
      initial={{
        name: agency.name,
        phone: agency.phone ?? "",
        website: agency.website ?? "",
        timezone: agency.settings?.timezone ?? "America/New_York",
        autoCreateRounds: agency.settings?.auto_create_rounds ?? false,
        autoRoundDelayDays: agency.settings?.auto_round_delay_days ?? 5,
        googleReviewLink: agency.settings?.google_review_link ?? "",
        referralBonus: agency.settings?.referral_bonus ?? "",
        referralLink: agency.settings?.referral_link ?? "",
      }}
    />
  );
}
