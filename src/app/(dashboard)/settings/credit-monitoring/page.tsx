import Link from "next/link";
import { redirect } from "next/navigation";
import { Lock } from "lucide-react";
import { getSessionContext } from "@/lib/auth/session";
import { isAgencyPlanOrHigher } from "@/lib/billing/plans";
import { Card } from "@/components/ui/card";
import { CreditMonitoringForm } from "./credit-monitoring-form";

export default async function CreditMonitoringSettingsPage() {
  const session = await getSessionContext();
  if (!session) redirect("/login");

  const { agency } = session;

  if (!isAgencyPlanOrHigher(agency.plan)) {
    return (
      <Card className="p-8 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
          <Lock className="h-6 w-6 text-gray-400" />
        </span>
        <h2 className="mt-4 text-sm font-semibold text-gray-900">
          Credit Monitoring API — Available on Agency plan
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-gray-500">
          Connect MyFreeScoreNow, IdentityIQ, or SmartCredit to pull scores directly
          from within ClientDeck Pro.
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

  return (
    <CreditMonitoringForm
      initial={{
        service: agency.credit_monitoring_service === "none" ? "none" : agency.credit_monitoring_service,
        apiKey: agency.credit_monitoring_api_key ?? "",
        apiSecret: agency.credit_monitoring_api_secret ?? "",
      }}
    />
  );
}
