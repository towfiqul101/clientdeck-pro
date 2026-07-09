"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils/helpers";
import { useToast } from "@/components/ui/toast";
import { PLANS } from "@/lib/billing/plans";
import { createCheckoutSession } from "@/app/(dashboard)/settings/billing/checkout-actions";

export function PlanCards({ billingEnabled = true }: { billingEnabled?: boolean }) {
  const { toast } = useToast();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function choose(planId: (typeof PLANS)[number]["id"]) {
    setLoadingId(planId);
    const result = await createCheckoutSession(planId);
    if (!result.success) {
      setLoadingId(null);
      toast(result.error, "error");
      return;
    }
    window.location.assign(result.url);
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {PLANS.map((plan) => (
        <div
          key={plan.id}
          className={cn(
            "flex flex-col rounded-lg border bg-[#1a1a2e] p-6 shadow-sm",
            plan.highlight ? "border-blue-500 ring-1 ring-blue-500" : "border-white/10"
          )}
        >
          {plan.highlight && (
            <span className="mb-2 self-start rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-400">
              Most popular
            </span>
          )}
          <h3 className="text-lg font-semibold text-slate-100">{plan.name}</h3>
          <p className="mt-1 text-2xl font-semibold text-slate-100">
            {plan.priceLabel}
            <span className="text-sm font-normal text-slate-500">/mo</span>
          </p>
          <p className="mt-1 text-sm text-slate-500">{plan.clientsLabel}</p>
          <ul className="mt-4 flex-1 space-y-2">
            {plan.features.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-slate-400">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-400" />
                {f}
              </li>
            ))}
          </ul>
          <button
            onClick={() => choose(plan.id)}
            disabled={loadingId !== null || !billingEnabled}
            title={billingEnabled ? undefined : "Payment setup required"}
            className={cn(
              "mt-5 w-full rounded-md px-4 py-2 text-sm font-medium",
              plan.highlight
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "border border-white/10 bg-[#1a1a2e] text-slate-300 hover:bg-white/[0.03]",
              "disabled:cursor-not-allowed disabled:opacity-60"
            )}
          >
            {!billingEnabled
              ? "Payment setup required"
              : loadingId === plan.id
                ? "Redirecting…"
                : "Start 14-day free trial"}
          </button>
        </div>
      ))}
    </div>
  );
}
