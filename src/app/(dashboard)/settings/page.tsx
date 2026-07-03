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
      }}
    />
  );
}
