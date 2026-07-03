"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Rocket, Check, ChevronDown, ChevronUp, PartyPopper } from "lucide-react";
import { cn } from "@/lib/utils/helpers";
import { updateOnboardingStep } from "@/app/(dashboard)/onboarding/actions";
import type { OnboardingSteps } from "@/types";

interface Props {
  agencyId: string;
  steps: OnboardingSteps;
  completedCount: number;
  total: number;
  showCongrats: boolean;
  allComplete: boolean;
  firstClientId: string | null;
}

interface Row {
  key: keyof OnboardingSteps | "account";
  label: string;
  href: string;
  cta: string;
  done: boolean;
}

export function OnboardingBanner({
  steps,
  completedCount,
  total,
  showCongrats,
  allComplete,
  firstClientId,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  // Account creation is implicitly done; show it as a satisfying first ✅.
  const rows: Row[] = [
    { key: "account", label: "Create your account", href: "/settings", cta: "", done: true },
    {
      key: "first_client_added",
      label: "Add your first client",
      href: "/clients/new",
      cta: "Add client",
      done: steps.first_client_added,
    },
    {
      key: "ghl_connected",
      label: "Connect GoHighLevel",
      href: "/settings/ghl",
      cta: "Go to Settings",
      done: steps.ghl_connected,
    },
    {
      key: "snapshot_installed",
      label: "Install GHL Snapshot",
      href: "/onboarding",
      cta: "View Instructions",
      done: steps.snapshot_installed,
    },
    {
      key: "test_portal_viewed",
      label: "View client portal",
      href: firstClientId ? `/clients/${firstClientId}` : "/clients",
      cta: "Open a client",
      done: steps.test_portal_viewed,
    },
  ];

  const pct = Math.round((completedCount / total) * 100);

  if (showCongrats) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-4">
        <PartyPopper className="h-5 w-5 text-green-600" />
        <div>
          <p className="text-sm font-semibold text-green-900">
            You&apos;re all set up! 🎉
          </p>
          <p className="text-sm text-green-700">
            ClientDeck Pro is fully configured. This message disappears
            automatically.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50/60 shadow-sm">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 p-4 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <Rocket className="h-4 w-4 text-blue-600" />
          Get ClientDeck Pro ready in {total} steps
        </span>
        <span className="flex items-center gap-3">
          <span className="text-xs font-medium text-gray-600">
            {completedCount} of {total} complete
          </span>
          {open ? (
            <ChevronUp className="h-4 w-4 text-gray-500" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-500" />
          )}
        </span>
      </button>

      <div className="px-4">
        <div className="h-2 w-full overflow-hidden rounded-full bg-blue-100">
          <div
            className="h-full rounded-full bg-blue-600 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {open && (
        <ul className="space-y-1 p-4">
          {rows.map((row) => (
            <li
              key={row.key}
              className="flex items-center justify-between rounded-md px-2 py-2"
            >
              <span className="flex items-center gap-2 text-sm text-gray-700">
                <span
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full border",
                    row.done
                      ? "border-green-500 bg-green-500 text-white"
                      : "border-gray-300 bg-white"
                  )}
                >
                  {row.done && <Check className="h-3 w-3" />}
                </span>
                <span className={cn(row.done && "text-gray-500 line-through")}>
                  {row.label}
                </span>
              </span>
              {!row.done && row.cta && (
                <Link
                  href={row.href}
                  className="rounded-md border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  {row.cta}
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}

      {open && allComplete && (
        <div className="border-t border-blue-100 p-3 text-right">
          <button
            onClick={() => router.refresh()}
            className="text-xs font-medium text-blue-600 hover:text-blue-700"
          >
            Dismiss — I&apos;ll finish later
          </button>
        </div>
      )}
    </div>
  );
}
