import Link from "next/link";
import { redirect } from "next/navigation";
import { Lock } from "lucide-react";
import { getSessionContext } from "@/lib/auth/session";
import { isAgencyPlanOrHigher } from "@/lib/billing/plans";
import { Card } from "@/components/ui/card";
import { getDomainVerification } from "@/lib/vercel/domains";
import { DomainForm } from "./domain-form";

export default async function DomainSettingsPage() {
  const session = await getSessionContext();
  if (!session) redirect("/login");

  const { agency } = session;

  if (!isAgencyPlanOrHigher(agency.plan)) {
    return (
      <Card className="p-8 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.06]">
          <Lock className="h-6 w-6 text-slate-500" />
        </span>
        <h2 className="mt-4 text-sm font-semibold text-slate-100">
          Custom Portal Domain — Available on Agency plan
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">
          White-label your client portal on your own domain instead of
          roundtrackpro.com.
        </p>
        <Link
          href="/settings/billing"
          className="mt-4 inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Upgrade to Agency Plan →
        </Link>
      </Card>
    );
  }

  let status: Awaited<ReturnType<typeof getDomainVerification>> | null = null;
  if (agency.custom_domain && !agency.custom_domain_verified) {
    try {
      status = await getDomainVerification(agency.custom_domain);
    } catch {
      status = null;
    }
  }

  return (
    <DomainForm
      initial={{
        domain: agency.custom_domain,
        verified: agency.custom_domain_verified,
        ownershipChallenge: status?.ownershipChallenge ?? null,
        recommendedCname: status?.recommendedCname ?? null,
      }}
    />
  );
}
