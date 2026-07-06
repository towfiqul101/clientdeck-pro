"use client";

import { useState } from "react";
import Link from "next/link";
import { cn, formatDate, getInitials, daysRemaining } from "@/lib/utils/helpers";
import { FileText, CheckSquare, Send, Clock, CheckCircle } from "lucide-react";
import type { RoundStatus, Bureau } from "@/types";
import type { LucideIcon } from "lucide-react";

export interface KanbanRound {
  id: string;
  round_number: number;
  status: RoundStatus;
  date_sent: string | null;
  response_deadline: string | null;
  client_id: string;
  client: { first_name: string; last_name: string } | null;
  bureauCounts: Record<Bureau, number>;
}

interface StageConfig {
  label: string;
  colorBorder: string;
  headerBg: string;
  icon: LucideIcon;
  description: string;
}

const STAGE_CONFIG: Record<RoundStatus, StageConfig> = {
  preparing: {
    label: "Preparing",
    colorBorder: "border-l-gray-400",
    headerBg: "bg-gray-50",
    icon: FileText,
    description: "Letters being prepared",
  },
  letters_generated: {
    label: "Letters Ready",
    colorBorder: "border-l-indigo-500",
    headerBg: "bg-indigo-50",
    icon: CheckSquare,
    description: "Ready to send",
  },
  sent: {
    label: "Sent to Bureaus",
    colorBorder: "border-l-blue-500",
    headerBg: "bg-blue-50",
    icon: Send,
    description: "Awaiting bureau response",
  },
  awaiting_response: {
    label: "Awaiting Response",
    colorBorder: "border-l-amber-500",
    headerBg: "bg-amber-50",
    icon: Clock,
    description: "Bureau has 35 days",
  },
  complete: {
    label: "Complete",
    colorBorder: "border-l-green-500",
    headerBg: "bg-green-50",
    icon: CheckCircle,
    description: "Results logged",
  },
};

const STAGE_ORDER: RoundStatus[] = ["preparing", "letters_generated", "sent", "awaiting_response", "complete"];

const BUREAU_DOTS: Record<Bureau, string> = {
  equifax: "bg-blue-500",
  experian: "bg-orange-500",
  transunion: "bg-green-500",
};

const BUREAU_LABELS: Record<Bureau, string> = {
  equifax: "EQ",
  experian: "EXP",
  transunion: "TU",
};

function DeadlinePill({ status, deadline }: { status: RoundStatus; deadline: string | null }) {
  if (!deadline || status === "complete") return null;
  const days = daysRemaining(deadline);
  if (days < 0) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
        {Math.abs(days)}d overdue
      </span>
    );
  }
  const tone = days <= 14 ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700";
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", tone)}>
      <Clock className="h-3 w-3" />
      {days}d remaining
    </span>
  );
}

function primaryAction(round: KanbanRound): { label: string; href: string } {
  const workspaceHref = `/clients/${round.client_id}/rounds/${round.id}`;
  switch (round.status) {
    case "preparing":
      return { label: "Generate Letters", href: workspaceHref };
    case "letters_generated":
      return { label: "Mark as Sent", href: workspaceHref };
    case "awaiting_response":
      return { label: "Log Results", href: workspaceHref };
    case "complete":
      return { label: "Start Next Round", href: `/clients/${round.client_id}/rounds/new` };
    case "sent":
    default:
      return { label: "View", href: workspaceHref };
  }
}

function RoundCard({ round }: { round: KanbanRound }) {
  const workspaceHref = `/clients/${round.client_id}/rounds/${round.id}`;
  const action = primaryAction(round);
  const clientName = round.client ? `${round.client.first_name} ${round.client.last_name}` : "Unknown client";
  const totalItems = round.bureauCounts.equifax + round.bureauCounts.experian + round.bureauCounts.transunion;

  return (
    <div className="w-[280px] shrink-0 rounded-xl border border-gray-200 bg-white shadow-[var(--shadow-card)] transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[var(--shadow-elevated)]">
      <Link href={workspaceHref} className="block border-b border-gray-100 p-3">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-medium text-blue-700">
            {getInitials(round.client?.first_name ?? "?", round.client?.last_name ?? "")}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-gray-900">{clientName}</p>
            <p className="truncate text-xs text-gray-500">
              Round {round.round_number}{round.date_sent ? ` · ${formatDate(round.date_sent)}` : ""}
            </p>
          </div>
        </div>
      </Link>
      {totalItems > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-gray-100 p-3">
          {(["equifax", "experian", "transunion"] as Bureau[]).map((b) =>
            round.bureauCounts[b] > 0 ? (
              <span key={b} className="flex items-center gap-1.5 text-xs text-gray-600">
                <span className={cn("h-1.5 w-1.5 rounded-full", BUREAU_DOTS[b])} />
                {BUREAU_LABELS[b]} {round.bureauCounts[b]}
              </span>
            ) : null
          )}
        </div>
      )}
      <div className="p-3">
        <DeadlinePill status={round.status} deadline={round.response_deadline} />
      </div>
      <div className="border-t border-gray-100 p-3">
        <Link
          href={action.href}
          className="flex w-full items-center justify-center rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition-colors duration-150 hover:bg-blue-700"
        >
          {action.label} →
        </Link>
      </div>
    </div>
  );
}

export function RoundsKanban({ rounds }: { rounds: KanbanRound[] }) {
  const [expandedMobileStage, setExpandedMobileStage] = useState<RoundStatus>("preparing");
  const [overdueOnly, setOverdueOnly] = useState(false);

  const visibleRounds = overdueOnly
    ? rounds.filter((r) => {
        if (!r.response_deadline || r.status === "complete") return false;
        return daysRemaining(r.response_deadline) < 0;
      })
    : rounds;

  const byStage = STAGE_ORDER.map((status) => ({
    status,
    config: STAGE_CONFIG[status],
    rounds: visibleRounds.filter((r) => r.status === status),
  }));

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOverdueOnly((v) => !v)}
          className={cn(
            "rounded-full px-3 py-1 text-xs font-medium transition-colors duration-150",
            overdueOnly ? "bg-red-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          )}
        >
          ⚠️ Overdue Only
        </button>
      </div>

      {/* Desktop/tablet: horizontal-scroll columns */}
      <div className="hidden gap-4 overflow-x-auto pb-2 sm:flex">
        {byStage.map(({ status, config, rounds: stageRounds }) => {
          const Icon = config.icon;
          return (
            <div key={status} className="w-[280px] shrink-0">
              <div className={cn("mb-3 rounded-lg border-l-4 px-3 py-2.5", config.colorBorder, config.headerBg)}>
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
                    <Icon className="h-4 w-4 text-gray-400" />
                    {config.label}
                  </span>
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-gray-600">
                    {stageRounds.length}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-gray-500">{config.description}</p>
              </div>
              <div className="space-y-3">
                {stageRounds.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-gray-300 bg-gray-50/50 px-4 py-8 text-center text-xs text-gray-400">
                    <Icon className="h-5 w-5 text-gray-300" />
                    No rounds here
                  </div>
                ) : (
                  stageRounds.map((round) => <RoundCard key={round.id} round={round} />)
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Mobile: single-column accordion, one stage expanded at a time */}
      <div className="space-y-2 sm:hidden">
        {byStage.map(({ status, config, rounds: stageRounds }) => {
          const Icon = config.icon;
          const expanded = expandedMobileStage === status;
          return (
            <div key={status} className="rounded-lg border border-gray-200">
              <button
                type="button"
                onClick={() => setExpandedMobileStage(status)}
                className={cn("flex w-full flex-col rounded-t-lg border-l-4 px-3 py-2.5 text-left", config.colorBorder, config.headerBg)}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
                    <Icon className="h-4 w-4 text-gray-400" />
                    {config.label}
                  </span>
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-gray-600">
                    {stageRounds.length}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-gray-500">{config.description}</p>
              </button>
              {expanded && (
                <div className="space-y-3 p-3">
                  {stageRounds.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-gray-300 bg-gray-50/50 px-4 py-8 text-center text-xs text-gray-400">
                      <Icon className="h-5 w-5 text-gray-300" />
                      No rounds here
                    </div>
                  ) : (
                    stageRounds.map((round) => (
                      <div key={round.id} className="w-full">
                        <RoundCard round={round} />
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
