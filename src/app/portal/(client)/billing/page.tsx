import { redirect } from "next/navigation";
import { getPortalSession } from "@/lib/portal/session";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils/helpers";
import { CreditCard, ExternalLink, AlertCircle } from "lucide-react";

export default async function PortalBillingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getPortalSession();
  if (!session) redirect("/portal?expired=true");

  const { client, agency } = session;
  const sp = await searchParams;
  const error = typeof sp.error === "string" ? sp.error : null;

  const contact =
    agency.phone || agency.owner_email || "your credit specialist";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Billing</h1>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {error === "no_customer"
              ? "No payment account is linked yet. Contact your specialist to set up billing."
              : "We couldn't open the billing portal right now. Please try again later."}
          </span>
        </div>
      )}

      {/* Plan card */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-lg"
            style={{
              backgroundColor: "color-mix(in srgb, var(--brand) 12%, white)",
            }}
          >
            <CreditCard className="h-5 w-5" style={{ color: "var(--brand)" }} />
          </span>
          <div>
            <p className="font-semibold text-gray-900">Credit Repair Service</p>
            <p className="text-sm text-gray-500">
              {formatCurrency(client.monthly_fee)}/month
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4 text-sm">
          <span className="text-gray-500">Payment status</span>
          <Badge status={client.payment_status} />
        </div>
        <div className="mt-2 flex items-center justify-between text-sm">
          <span className="text-gray-500">Member since</span>
          <span className="font-medium text-gray-900">
            {formatDate(client.service_start_date)}
          </span>
        </div>
      </div>

      {/* Manage payment */}
      {client.stripe_customer_id ? (
        <a
          href="/api/portal/stripe-portal"
          className="flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-sm"
          style={{ backgroundColor: "var(--brand)" }}
        >
          <ExternalLink className="h-4 w-4" />
          Manage Payment Method
        </a>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-600">
          To update your billing, contact your credit specialist:
          <br />
          <span className="font-medium text-gray-900">{contact}</span>
        </div>
      )}
    </div>
  );
}
