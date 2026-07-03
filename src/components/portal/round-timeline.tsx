"use client";

import { useState } from "react";
import { cn, formatDate, getBureauLabel, getNegativeTypeLabel } from "@/lib/utils/helpers";
import type { DisputeResult, RoundStatus } from "@/types";
import {
  CheckCircle2,
  AlertTriangle,
  Clock,
  ChevronDown,
  TrendingUp,
} from "lucide-react";

export interface TimelineResultItem {
  creditor: string;
  negativeType: string;
  result: DisputeResult;
  bureaus: string[];
}

export interface TimelineRound {
  id: string;
  round_number: number;
  status: RoundStatus;
  date_sent: string | null;
  date_responses_received: string | null;
  results: TimelineResultItem[];
  scoreChange: number | null;
}

const RESULT_META: Record<
  DisputeResult,
  { label: string; className: string; Icon: typeof CheckCircle2 }
> = {
  deleted: { label: "Deleted", className: "text-green-600", Icon: CheckCircle2 },
  updated: { label: "Updated", className: "text-teal-600", Icon: CheckCircle2 },
  verified: {
    label: "Verified",
    className: "text-amber-600",
    Icon: AlertTriangle,
  },
  no_response: { label: "No response", className: "text-gray-500", Icon: Clock },
  in_progress: { label: "In progress", className: "text-gray-500", Icon: Clock },
  pending: { label: "Pending", className: "text-gray-400", Icon: Clock },
};

const STATUS_LABEL: Record<RoundStatus, string> = {
  preparing: "Preparing",
  letters_generated: "Preparing",
  sent: "Sent",
  awaiting_response: "Awaiting response",
  complete: "Complete",
};

function ResultRow({ item }: { item: TimelineResultItem }) {
  const meta = RESULT_META[item.result];
  const Icon = meta.Icon;
  return (
    <li className="flex items-start gap-2 py-1.5 text-sm">
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", meta.className)} />
      <span className="text-gray-700">
        <span className={cn("font-semibold", meta.className)}>
          {meta.label}:
        </span>{" "}
        {item.creditor}{" "}
        <span className="text-gray-400">
          ({getNegativeTypeLabel(item.negativeType)})
        </span>
        {item.bureaus.length > 0 && (
          <span className="text-gray-500">
            {" "}
            — {item.bureaus.map((b) => getBureauLabel(b)).join(", ")}
          </span>
        )}
      </span>
    </li>
  );
}

function RoundCard({
  round,
  defaultOpen,
}: {
  round: TimelineRound;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const complete = round.status === "complete";

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-900">
              Round {round.round_number}
            </span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs font-medium",
                complete
                  ? "bg-green-50 text-green-700"
                  : "bg-blue-50 text-blue-700"
              )}
            >
              {STATUS_LABEL[round.status]}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-gray-500">
            {round.date_sent
              ? `Sent ${formatDate(round.date_sent)}`
              : "Not sent yet"}
          </p>
        </div>
        <ChevronDown
          className={cn(
            "h-5 w-5 shrink-0 text-gray-400 transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div className="border-t border-gray-100 px-4 py-3">
          <p className="text-xs text-gray-500">Letters sent to the bureaus.</p>
          {round.date_responses_received && (
            <p className="mt-1 text-xs text-gray-500">
              Responses received {formatDate(round.date_responses_received)}.
            </p>
          )}

          {round.results.length > 0 ? (
            <ul className="mt-2">
              {round.results.map((item, i) => (
                <ResultRow key={i} item={item} />
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-gray-500">
              Awaiting results for this round.
            </p>
          )}

          {round.scoreChange !== null && round.scoreChange !== 0 && (
            <p className="mt-3 flex items-center gap-1.5 text-sm font-medium text-green-700">
              <TrendingUp className="h-4 w-4" />
              Score change this round:{" "}
              {round.scoreChange > 0 ? "+" : ""}
              {round.scoreChange} points avg
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function RoundTimeline({ rounds }: { rounds: TimelineRound[] }) {
  return (
    <div className="space-y-3">
      {rounds.map((round, idx) => (
        <RoundCard key={round.id} round={round} defaultOpen={idx === 0} />
      ))}
    </div>
  );
}
