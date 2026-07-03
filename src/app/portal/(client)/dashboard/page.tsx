import Link from "next/link";
import { redirect } from "next/navigation";
import { getPortalSession } from "@/lib/portal/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { cn, scoreChange, daysRemaining } from "@/lib/utils/helpers";
import { BUREAU_STYLES } from "@/lib/constants";
import type { Bureau, DisputeRound } from "@/types";
import {
  ArrowUp,
  ArrowDown,
  Upload,
  TrendingUp,
  Phone,
  PartyPopper,
  CheckCircle2,
} from "lucide-react";

function ScoreCard({
  bureau,
  label,
  start,
  current,
}: {
  bureau: Bureau;
  label: string;
  start: number | null;
  current: number | null;
}) {
  const style = BUREAU_STYLES[bureau];
  const change = scoreChange(start, current);

  return (
    <div className={cn("rounded-xl border p-4", style.border, style.bg)}>
      <div className="flex items-center gap-1.5">
        <span className={cn("h-2 w-2 rounded-full", style.dot)} />
        <span className={cn("text-xs font-semibold", style.text)}>{label}</span>
      </div>
      {current === null ? (
        <p className="mt-3 text-xs text-gray-500">
          Score pending — your specialist will update this soon.
        </p>
      ) : (
        <div className="mt-2">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-gray-900 tabular-nums">
              {current}
            </span>
            {change.direction !== "same" && (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 text-sm font-semibold",
                  change.direction === "up" ? "text-green-600" : "text-red-600"
                )}
              >
                {change.direction === "up" ? (
                  <ArrowUp className="h-3.5 w-3.5" />
                ) : (
                  <ArrowDown className="h-3.5 w-3.5" />
                )}
                {change.value}
              </span>
            )}
          </div>
          {start !== null && (
            <p className="mt-0.5 text-xs text-gray-500">Started at {start}</p>
          )}
        </div>
      )}
    </div>
  );
}

function statusMessage(
  status: string,
  round: DisputeRound | null
): { title: string; body: string } {
  if (status === "completed")
    return {
      title: "🎉 Goal reached!",
      body: "You've reached your credit goal. Congratulations on your progress!",
    };
  if (status === "onboarding")
    return {
      title: "Getting started",
      body: "Your specialist is reviewing your credit report.",
    };
  if (status === "analysis")
    return {
      title: "Analysis underway",
      body: "Your credit analysis is in progress.",
    };

  if (round) {
    const n = round.round_number;
    switch (round.status) {
      case "preparing":
      case "letters_generated":
        return {
          title: `Round ${n} in progress`,
          body: `Your Round ${n} dispute letters are being prepared.`,
        };
      case "sent":
        return {
          title: `Round ${n} sent`,
          body: `Round ${n} letters are on their way to the bureaus.`,
        };
      case "awaiting_response": {
        const days = round.response_deadline
          ? daysRemaining(round.response_deadline)
          : null;
        if (days !== null && days < 0)
          return {
            title: `Round ${n} — following up`,
            body: `The response window has passed. Your specialist is following up with the bureaus.`,
          };
        return {
          title: `Round ${n} — awaiting responses`,
          body:
            days !== null
              ? `Bureaus have ${days} day${days === 1 ? "" : "s"} left to respond.`
              : `Waiting on bureau responses.`,
        };
      }
      case "complete":
        return {
          title: `Round ${n} complete`,
          body: `Round ${n} is complete — check your Progress tab for the results.`,
        };
    }
  }

  return {
    title: "We're on it",
    body: "Your specialist is actively working on your case.",
  };
}

export default async function PortalDashboardPage() {
  const session = await getPortalSession();
  if (!session) redirect("/portal?expired=true");

  const { client, agency } = session;
  const supabase = createAdminClient();

  const { data: latestRound } = await supabase
    .from("dispute_rounds")
    .select("*")
    .eq("client_id", client.id)
    .order("round_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const round = (latestRound as DisputeRound | null) ?? null;

  const totalItems = Math.max(
    client.total_items_start,
    client.total_items_current
  );
  const resolved = client.total_items_deleted;
  const pct = totalItems > 0 ? Math.round((resolved / totalItems) * 100) : 0;

  const status = statusMessage(client.status, round);
  const today = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const contactHref = agency.owner_email
    ? `mailto:${agency.owner_email}`
    : agency.phone
      ? `tel:${agency.phone}`
      : "#";

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {client.first_name}!
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Here&apos;s your credit progress as of {today}.
        </p>
      </div>

      {/* Scores */}
      <div className="space-y-3">
        <ScoreCard
          bureau="equifax"
          label="Equifax"
          start={client.score_eq_start}
          current={client.score_eq_current}
        />
        <ScoreCard
          bureau="experian"
          label="Experian"
          start={client.score_exp_start}
          current={client.score_exp_current}
        />
        <ScoreCard
          bureau="transunion"
          label="TransUnion"
          start={client.score_tu_start}
          current={client.score_tu_current}
        />
      </div>

      {/* Progress summary */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">
            {resolved} of {totalItems} items resolved
          </span>
          <span className="text-sm font-semibold text-gray-900">{pct}%</span>
        </div>
        <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-green-500 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        {resolved > 0 ? (
          <p className="mt-3 flex items-center gap-1.5 text-sm font-medium text-green-700">
            <CheckCircle2 className="h-4 w-4" />
            {resolved} item{resolved === 1 ? "" : "s"} removed from your credit
            report!
          </p>
        ) : (
          <p className="mt-3 text-sm text-gray-500">
            Your specialist is actively working to remove negative items.
          </p>
        )}
      </div>

      {/* Current status */}
      <div
        className="rounded-xl border p-5"
        style={{
          borderColor: "color-mix(in srgb, var(--brand) 30%, transparent)",
          backgroundColor: "color-mix(in srgb, var(--brand) 8%, white)",
        }}
      >
        <div className="flex items-start gap-3">
          <PartyPopper
            className="mt-0.5 h-5 w-5 shrink-0"
            style={{ color: "var(--brand)" }}
          />
          <div>
            <h2 className="font-semibold text-gray-900">{status.title}</h2>
            <p className="mt-0.5 text-sm text-gray-600">{status.body}</p>
          </div>
        </div>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 gap-3">
        <Link
          href="/portal/documents"
          className="flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-sm"
          style={{ backgroundColor: "var(--brand)" }}
        >
          <Upload className="h-4 w-4" />
          Upload a Document
        </Link>
        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/portal/progress"
            className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700"
          >
            <TrendingUp className="h-4 w-4" />
            Progress
          </Link>
          <a
            href={contactHref}
            className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700"
          >
            <Phone className="h-4 w-4" />
            Contact Us
          </a>
        </div>
      </div>
    </div>
  );
}
