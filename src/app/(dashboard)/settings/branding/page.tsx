import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth/session";
import { BrandingForm } from "./branding-form";

export default async function BrandingSettingsPage() {
  const session = await getSessionContext();
  if (!session) redirect("/login");

  const { agency } = session;

  return (
    <BrandingForm
      agencyId={agency.id}
      agencyName={agency.name}
      initial={{
        logoUrl: agency.logo_url,
        brandColor: agency.brand_color || "#2563EB",
      }}
    />
  );
}
