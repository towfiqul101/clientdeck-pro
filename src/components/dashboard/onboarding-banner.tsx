"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Rocket, Check, ChevronDown, ChevronUp, PartyPopper } from "lucide-react";
import { cn } from "@/lib/utils/helpers";
import type { OnboardingSteps } from "@/types";

interface Props {
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
      <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
        <PartyPopper className="h-5 w-5 text-emerald-400" />
        <div>
          <p className="text-sm font-semibold text-emerald-300">
            You&apos;re all set up! 🎉
          </p>
          <p className="text-sm text-emerald-400/80">
            ClientDeck Pro is fully configured. This message disappears
            automatically.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 via-violet-700 to-blue-800 shadow-[0_8px_30px_rgba(139,92,246,0.25)]">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(ellipse at 85% 15%, rgba(37,99,235,0.6) 0%, transparent 55%)",
        }}
      />
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative z-10 flex w-full items-center justify-between gap-3 p-4 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-white">
          <Rocket className="h-4 w-4 text-white" />
          Get ClientDeck Pro ready in {total} steps
        </span>
        <span className="flex items-center gap-3">
          <span className="text-xs font-medium text-blue-100">
            {completedCount} of {total} complete
          </span>
          {open ? (
            <ChevronUp className="h-4 w-4 text-blue-100" />
          ) : (
            <ChevronDown className="h-4 w-4 text-blue-100" />
          )}
        </span>
      </button>

      <div className="relative z-10 px-4">
        <div className="h-2 w-full overflow-hidden rounded-full bg-white/20">
          <div
            className="h-full rounded-full bg-white transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {open && (
        <ul className="relative z-10 space-y-1 p-4">
          {rows.map((row) => (
            <li
              key={row.key}
              className="flex items-center justify-between rounded-md px-2 py-2"
            >
              <span className="flex items-center gap-2 text-sm text-white">
                <span
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full border",
                    row.done
                      ? "border-white bg-white text-blue-600"
                      : "border-white/40 bg-transparent"
                  )}
                >
                  {row.done && <Check className="h-3 w-3" />}
                </span>
                <span className={cn(row.done && "text-blue-100 line-through")}>
                  {row.label}
                </span>
              </span>
              {!row.done && row.cta && (
                <Link
                  href={row.href}
                  className="rounded-md bg-white/20 px-3 py-1 text-xs font-medium text-white transition-colors duration-150 hover:bg-white/30"
                >
                  {row.cta}
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}

      {open && allComplete && (
        <div className="relative z-10 border-t border-white/20 p-3 text-right">
          <button
            onClick={() => router.refresh()}
            className="text-xs font-medium text-white hover:text-blue-100"
          >
            Dismiss — I&apos;ll finish later
          </button>
        </div>
      )}
    </div>
  );
}
