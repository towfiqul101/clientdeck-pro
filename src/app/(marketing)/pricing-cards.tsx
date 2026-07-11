"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { PLANS } from "@/lib/billing/plans";
import { cn } from "@/lib/utils/helpers";

/**
 * Pricing block for the marketing page. Client component only for the
 * monthly/annual toggle — annual bills 10 months (2 free), shown as an
 * effective per-month figure. Prices come from PLANS (single source of truth).
 */
export function PricingCards() {
  const [annual, setAnnual] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-center gap-3">
        <span
          className={cn(
            "text-sm font-medium transition-colors",
            annual ? "text-slate-400" : "text-slate-900"
          )}
        >
          Monthly
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={annual}
          aria-label="Toggle annual billing"
          onClick={() => setAnnual((a) => !a)}
          className={cn(
            "relative h-7 w-12 rounded-full border transition-colors",
            annual
              ? "border-violet-500 bg-violet-600"
              : "border-slate-300 bg-slate-200"
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
              annual ? "translate-x-[22px]" : "translate-x-0.5"
            )}
          />
        </button>
        <span
          className={cn(
            "text-sm font-medium transition-colors",
            annual ? "text-slate-900" : "text-slate-400"
          )}
        >
          Annual
        </span>
        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
          Save 2 months
        </span>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
        {PLANS.map((plan) => {
          const annualTotal = plan.priceMonthly * 10;
          const perMonth = annual
            ? Math.round(annualTotal / 12)
            : plan.priceMonthly;

          return (
            <div
              key={plan.id}
              className={cn(
                "relative flex h-full flex-col rounded-2xl border bg-white p-7 transition-transform duration-200",
                plan.highlight
                  ? "border-violet-400 shadow-[0_20px_50px_-20px_rgba(139,92,246,0.45)] md:-translate-y-2"
                  : "border-slate-200 shadow-sm"
              )}
            >
              {plan.highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-violet-500 to-blue-600 px-3.5 py-1 text-xs font-semibold text-white shadow-md">
                  Most Popular
                </span>
              )}

              <h3 className="font-display text-lg font-semibold text-slate-900">
                {plan.name}
              </h3>
              <div className="mt-4 flex items-end gap-1.5">
                <span className="font-display text-4xl font-bold tracking-tight text-slate-900">
                  ${perMonth}
                </span>
                <span className="mb-1.5 text-sm text-slate-500">/mo</span>
              </div>
              <p className="mt-1 h-5 text-xs text-slate-500">
                {annual
                  ? `Billed $${annualTotal.toLocaleString()}/year`
                  : "Billed monthly"}
              </p>
              <p className="mt-3 text-sm font-medium text-slate-600">
                {plan.clientsLabel}
              </p>

              <ul className="mt-6 flex-1 space-y-3">
                {plan.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-2.5 text-sm text-slate-600"
                  >
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    {feature}
                  </li>
                ))}
              </ul>

              <a
                href={annual ? plan.gumroadYearlyUrl : plan.gumroadMonthlyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "mt-7 rounded-xl px-4 py-3 text-center text-sm font-semibold transition-all duration-150",
                  plan.highlight
                    ? "cta-gradient text-white"
                    : "border border-slate-300 text-slate-800 hover:border-slate-400 hover:bg-slate-50"
                )}
              >
                Start free trial
              </a>
            </div>
          );
        })}
      </div>

      <p className="mt-8 text-center text-sm text-slate-500">
        Prices in USD. Cancel anytime — no contracts.
      </p>
    </div>
  );
}
