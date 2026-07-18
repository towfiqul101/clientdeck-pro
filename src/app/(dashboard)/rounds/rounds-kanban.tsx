"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { cn, formatDate, getInitials, daysRemaining } from "@/lib/utils/helpers";
import { useToast } from "@/components/ui/toast";
import { ScrollFadeX } from "@/components/ui/scroll-fade";
import { FileText, CheckSquare, Send, Clock, CheckCircle, GripVertical } from "lucide-react";
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
    colorBorder: "border-l-indigo-500",
    headerBg: "bg-indigo-500/10",
    icon: FileText,
    description: "Letters being prepared",
  },
  letters_generated: {
    label: "Letters Ready",
    colorBorder: "border-l-violet-500",
    headerBg: "bg-violet-500/10",
    icon: CheckSquare,
    description: "Ready to send",
  },
  sent: {
    label: "Sent to Bureaus",
    colorBorder: "border-l-blue-500",
    headerBg: "bg-blue-500/10",
    icon: Send,
    description: "Awaiting bureau response",
  },
  awaiting_response: {
    label: "Awaiting Response",
    colorBorder: "border-l-amber-500",
    headerBg: "bg-amber-500/10",
    icon: Clock,
    description: "Bureau has 35 days",
  },
  complete: {
    label: "Complete",
    colorBorder: "border-l-green-500",
    headerBg: "bg-green-500/10",
    icon: CheckCircle,
    description: "Results logged",
  },
};

const STAGE_ORDER: RoundStatus[] = ["preparing", "letters_generated", "sent", "awaiting_response", "complete"];

const BUREAU_DOTS: Record<Bureau, string> = {
  equifax: "bg-violet-500",
  experian: "bg-orange-500",
  transunion: "bg-emerald-500",
};

const BUREAU_LABELS: Record<Bureau, string> = {
  equifax: "EQ",
  experian: "EXP",
  transunion: "TU",
};

// ---- Drag-and-drop stage changes ------------------------------------------
//
// A drag NEVER mutates a round directly. Each valid transition maps to the
// SAME existing flow the on-card buttons use (letter generation, Mark-Sent,
// Log-Results), reached by navigating to the round workspace with an ?intent
// the workspace consumes to auto-open that flow's dialog. So there is no
// parallel stage-change path — the automation (SMS, GHL pipeline move, the
// response clock, GHL win notifications) fires only through the existing
// server actions, and only after the user completes the confirmed flow.
type MoveIntent = "generate" | "send" | "results";

// source status -> { droppable target status -> the flow it triggers }.
// `sent` is a phantom column (nothing ever sets status "sent" — Mark-Sent
// jumps straight to awaiting_response), so it's accepted purely as a drop
// target for the send flow, alongside awaiting_response for a drag that
// overshoots the empty column.
const TRANSITIONS: Partial<Record<RoundStatus, Partial<Record<RoundStatus, MoveIntent>>>> = {
  preparing: { letters_generated: "generate" },
  letters_generated: { sent: "send", awaiting_response: "send" },
  awaiting_response: { complete: "results" },
};

function clientLabel(round: KanbanRound): string {
  return round.client ? `${round.client.first_name} ${round.client.last_name}` : "this client";
}

function transitionCopy(round: KanbanRound, intent: MoveIntent): {
  destination: RoundStatus;
  title: string;
  body: string;
  cta: string;
} {
  const name = clientLabel(round);
  const n = round.round_number;
  switch (intent) {
    case "generate":
      return {
        destination: "letters_generated",
        title: `Generate letters for Round ${n}?`,
        body: `This opens the letter workspace and drafts every dispute letter for ${name} with AI so you can review and edit them. No letters are sent and ${name} is not notified yet.`,
        cta: "Generate letters",
      };
    case "send":
      return {
        destination: "sent",
        title: `Mark ${name}'s Round ${n} as sent?`,
        body: `You'll enter certified-mail tracking numbers and acknowledge any compliance-flagged letters. On completion this will: notify ${name} by SMS through your GHL workflow, move their GHL pipeline stage, and start the 30-day response clock.`,
        cta: "Continue to send",
      };
    case "results":
      return {
        destination: "complete",
        title: `Log results for ${name}'s Round ${n}?`,
        body: `This opens the results form to record each item's outcome (deleted, verified, or updated) and any new bureau scores. Saving updates ${name}'s deletions and scores, notifies GHL of any wins, and completes the round.`,
        cta: "Continue to results",
      };
  }
}

function DeadlinePill({ status, deadline }: { status: RoundStatus; deadline: string | null }) {
  if (!deadline || status === "complete") return null;
  const days = daysRemaining(deadline);
  if (days < 0) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-medium text-red-400">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
        {Math.abs(days)}d overdue
      </span>
    );
  }
  const tone = days <= 14 ? "bg-amber-500/15 text-amber-400" : "bg-green-500/15 text-green-400";
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

function RoundCard({ round, dragHandle }: { round: KanbanRound; dragHandle?: React.ReactNode }) {
  const workspaceHref = `/clients/${round.client_id}/rounds/${round.id}`;
  const action = primaryAction(round);
  const clientName = round.client ? `${round.client.first_name} ${round.client.last_name}` : "Unknown client";
  const totalItems = round.bureauCounts.equifax + round.bureauCounts.experian + round.bureauCounts.transunion;

  return (
    <div className="relative w-[280px] shrink-0 rounded-xl border border-white/10 bg-[#1a1a2e] shadow-[var(--shadow-card)] transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[var(--shadow-elevated)]">
      {dragHandle}
      <Link href={workspaceHref} className="block border-b border-white/[0.06] p-3 pr-9">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-xs font-medium text-blue-400">
            {getInitials(round.client?.first_name ?? "?", round.client?.last_name ?? "")}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-100">{clientName}</p>
            <p className="truncate text-xs text-slate-500">
              Round {round.round_number}{round.date_sent ? ` · ${formatDate(round.date_sent)}` : ""}
            </p>
          </div>
        </div>
      </Link>
      {totalItems > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-white/[0.06] p-3">
          {(["equifax", "experian", "transunion"] as Bureau[]).map((b) =>
            round.bureauCounts[b] > 0 ? (
              <span key={b} className="flex items-center gap-1.5 text-xs text-slate-400">
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
      <div className="border-t border-white/[0.06] p-3">
        <Link
          href={action.href}
          className="flex w-full items-center justify-center rounded-[10px] bg-gradient-to-br from-violet-500 to-violet-700 px-3 py-2 text-xs font-semibold text-white shadow-[0_4px_15px_rgba(139,92,246,0.3)] transition-all duration-150 hover:-translate-y-px"
        >
          {action.label} →
        </Link>
      </div>
    </div>
  );
}

// Wraps RoundCard with a dedicated drag handle so the card's existing links
// stay clickable — dragging is initiated only from the grip.
function DraggableRoundCard({ round }: { round: KanbanRound }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: round.id,
    data: { round },
  });

  const handle = (
    <button
      type="button"
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      aria-label={`Drag Round ${round.round_number} for ${clientLabel(round)} to another stage`}
      className="absolute right-1.5 top-2.5 z-10 flex h-6 w-6 cursor-grab touch-none items-center justify-center rounded-md text-slate-500 hover:bg-white/[0.06] hover:text-slate-300 active:cursor-grabbing"
    >
      <GripVertical className="h-4 w-4" />
    </button>
  );

  return (
    <div
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn(isDragging && "opacity-40")}
    >
      <RoundCard round={round} dragHandle={handle} />
    </div>
  );
}

function DroppableColumn({
  status,
  children,
}: {
  status: RoundStatus;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "w-[280px] shrink-0 rounded-xl transition-colors duration-150",
        isOver && "bg-white/[0.04] ring-2 ring-violet-500/50"
      )}
    >
      {children}
    </div>
  );
}

export function RoundsKanban({ rounds }: { rounds: KanbanRound[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [expandedMobileStage, setExpandedMobileStage] = useState<RoundStatus>("preparing");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [activeRound, setActiveRound] = useState<KanbanRound | null>(null);
  const [pendingMove, setPendingMove] = useState<{ round: KanbanRound; intent: MoveIntent } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

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

  function onDragStart(e: DragStartEvent) {
    const round = e.active.data.current?.round as KanbanRound | undefined;
    setActiveRound(round ?? null);
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveRound(null);
    const round = e.active.data.current?.round as KanbanRound | undefined;
    const target = e.over?.id as RoundStatus | undefined;
    if (!round || !target || target === round.status) return;

    const intent = TRANSITIONS[round.status]?.[target];
    if (!intent) {
      const src = STAGE_ORDER.indexOf(round.status);
      const dst = STAGE_ORDER.indexOf(target);
      toast(
        dst < src
          ? "Rounds can't move backwards — the dispute lifecycle only runs forward."
          : "That move isn't available. Rounds advance one step at a time — drag to the next stage, or open the round to manage it.",
        "error"
      );
      return;
    }
    setPendingMove({ round, intent });
  }

  function confirmMove() {
    if (!pendingMove) return;
    const { round, intent } = pendingMove;
    setPendingMove(null);
    router.push(`/clients/${round.client_id}/rounds/${round.id}?intent=${intent}`);
  }

  const pendingCopy = pendingMove ? transitionCopy(pendingMove.round, pendingMove.intent) : null;

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOverdueOnly((v) => !v)}
          className={cn(
            "rounded-full px-3 py-1 text-xs font-medium transition-colors duration-150",
            overdueOnly ? "bg-red-600 text-white" : "bg-white/[0.06] text-slate-400 hover:bg-white/[0.08]"
          )}
        >
          ⚠️ Overdue Only
        </button>
        <span className="hidden text-xs text-slate-500 sm:inline">
          Drag a card by its grip to advance its stage.
        </span>
      </div>

      {/* Desktop/tablet: horizontal-scroll columns with drag-and-drop */}
      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <ScrollFadeX className="hidden gap-4 pb-2 sm:flex">
          {byStage.map(({ status, config, rounds: stageRounds }) => {
            const Icon = config.icon;
            return (
              <DroppableColumn key={status} status={status}>
                <div className={cn("mb-3 rounded-lg border-l-4 px-3 py-2.5", config.colorBorder, config.headerBg)}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-100">
                      <Icon className="h-4 w-4 text-slate-500" />
                      {config.label}
                    </span>
                    <span className="rounded-full bg-[#1a1a2e] px-2 py-0.5 text-xs font-medium text-slate-400">
                      {stageRounds.length}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">{config.description}</p>
                </div>
                <div className="space-y-3">
                  {stageRounds.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-8 text-center text-xs text-slate-500">
                      <Icon className="h-5 w-5 text-slate-600" />
                      No rounds here
                    </div>
                  ) : (
                    stageRounds.map((round) => <DraggableRoundCard key={round.id} round={round} />)
                  )}
                </div>
              </DroppableColumn>
            );
          })}
        </ScrollFadeX>

        <DragOverlay dropAnimation={null}>
          {activeRound ? <RoundCard round={activeRound} /> : null}
        </DragOverlay>
      </DndContext>

      {/* Mobile: single-column accordion, one stage expanded at a time (no DnD) */}
      <div className="space-y-2 sm:hidden">
        {byStage.map(({ status, config, rounds: stageRounds }) => {
          const Icon = config.icon;
          const expanded = expandedMobileStage === status;
          return (
            <div key={status} className="rounded-lg border border-white/10">
              <button
                type="button"
                onClick={() => setExpandedMobileStage(status)}
                className={cn("flex w-full flex-col rounded-t-lg border-l-4 px-3 py-2.5 text-left", config.colorBorder, config.headerBg)}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-100">
                    <Icon className="h-4 w-4 text-slate-500" />
                    {config.label}
                  </span>
                  <span className="rounded-full bg-[#1a1a2e] px-2 py-0.5 text-xs font-medium text-slate-400">
                    {stageRounds.length}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-slate-500">{config.description}</p>
              </button>
              {expanded && (
                <div className="space-y-3 p-3">
                  {stageRounds.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-8 text-center text-xs text-slate-500">
                      <Icon className="h-5 w-5 text-slate-600" />
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

      {/* Transition confirmation — nothing fires until confirmed. */}
      {pendingMove && pendingCopy && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setPendingMove(null)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-white/10 bg-[#1a1a2e] p-5 shadow-[var(--shadow-elevated)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center gap-2 text-xs font-medium text-slate-400">
              <span className="rounded-full bg-white/[0.06] px-2 py-0.5">{STAGE_CONFIG[pendingMove.round.status].label}</span>
              <span>→</span>
              <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-violet-300">{STAGE_CONFIG[pendingCopy.destination].label}</span>
            </div>
            <h3 className="text-base font-semibold text-slate-100">{pendingCopy.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">{pendingCopy.body}</p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingMove(null)}
                className="rounded-md px-3 py-2 text-sm font-medium text-slate-400 hover:bg-white/[0.06] hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmMove}
                className="rounded-md bg-gradient-to-br from-violet-500 to-violet-700 px-4 py-2 text-sm font-semibold text-white shadow-[0_4px_15px_rgba(139,92,246,0.3)] transition-all duration-150 hover:-translate-y-px"
              >
                {pendingCopy.cta} →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
