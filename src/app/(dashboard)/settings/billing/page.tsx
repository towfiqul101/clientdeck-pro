import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth/session";
import { Card, CardHeader } from "@/components/ui/card";
import { cn, getStatusColor } from "@/lib/utils/helpers";
import { ManageBillingButton } from "./manage-billing-button";
import { UpgradeButton } from "./upgrade-button";
import { PLANS } from "@/lib/billing/plans";
import { Check } from "lucide-react";

const ACTIVE_STATUSES = ["onboarding", "analysis", "active", "on_hold"];

export default async function BillingSettingsPage() {
  const session = await getSessionContext();
  if (!session) redirect("/login");

  const { agency } = session;
  const supabase = await createServerSupabaseClient();

  const { count } = await supabase
    .from("clients")
    .select("id", { count: "exact", head: true })
    .in("status", ACTIVE_STATUSES);

  const currentClients = count ?? 0;
  const usagePct = Math.min(
    100,
    Math.round((currentClients / agency.max_clients) * 100)
  );

  const billingEnabled = !!process.env.STRIPE_SECRET_KEY;

  return (
    <div className="space-y-6">
      {!billingEnabled && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          Billing is not yet configured — plan changes are managed manually.
          Contact support to upgrade or change your plan.
        </div>
      )}

      {/* Current plan */}
      <Card>
        <CardHeader
          title="Current Plan"
          action={<ManageBillingButton />}
        />
        <div className="space-y-5 p-6">
          <div className="flex items-center gap-3">
            <span className="text-2xl font-semibold capitalize text-slate-100">
              {agency.plan}
            </span>
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
                getStatusColor(agency.plan_status)
              )}
            >
              {agency.plan_status.replace("_", " ")}
            </span>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between text-sm">
              <span className="text-slate-400">Client usage</span>
              <span className="font-medium text-slate-100">
                {currentClients} / {agency.max_clients}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className={cn(
                  "h-full rounded-full",
                  usagePct >= 90 ? "bg-red-500" : "bg-blue-600"
                )}
                style={{ width: `${usagePct}%` }}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Plan comparison */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-slate-100">Plans</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {PLANS.map((plan) => {
            const current = plan.id === agency.plan;
            return (
              <div
                key={plan.id}
                className={cn(
                  "rounded-lg border bg-[#1a1a2e] p-5 shadow-sm",
                  current ? "border-blue-500 ring-1 ring-blue-500" : "border-white/10"
                )}
              >
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-slate-100">{plan.name}</h4>
                  {current && (
                    <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-400">
                      Current
                    </span>
                  )}
                </div>
                <p className="mt-2 text-xl font-semibold text-slate-100">
                  {plan.priceLabel}
                </p>
                <ul className="mt-4 space-y-2">
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2 text-sm text-slate-400"
                    >
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-400" />
                      {feature}
                    </li>
                  ))}
                </ul>
                {!current && billingEnabled && (
                  <UpgradeButton planId={plan.id} planName={plan.name} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
