"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import {
  cn,
  daysRemaining,
  formatDate,
  getBureauLabel,
  getLetterTypeLabel,
} from "@/lib/utils/helpers";
import { BUREAU_STYLES } from "@/lib/constants";
import {
  saveLetterContent,
  setLetterFinalized,
  markRoundSent,
  logResults,
  markClientCompleted,
  type ResultEntry,
} from "../actions";
import type {
  Bureau,
  DisputeResult,
  LetterType,
  RoundStatus,
} from "@/types";
import {
  Sparkles,
  RefreshCw,
  Check,
  Download,
  Send,
  ClipboardList,
  Loader2,
  PartyPopper,
  AlertTriangle,
} from "lucide-react";

export interface RoundDispute {
  id: string;
  bureau: Bureau;
  letter_type: LetterType;
  letter_content: string | null;
  certified_mail_number: string | null;
  is_finalized: boolean;
  result: DisputeResult;
  result_notes: string | null;
  negative_item_id: string;
  creditor_name: string;
}

export interface RoundData {
  id: string;
  round_number: number;
  status: RoundStatus;
  date_sent: string | null;
  response_deadline: string | null;
  total_items_disputed: number;
  total_deletions: number;
  total_updates: number;
  total_verified: number;
  total_no_response: number;
}

interface LetterState {
  content: string;
  state: "empty" | "generating" | "ready" | "error";
  error?: string;
  finalized: boolean;
  tracking: string;
}

const RESULT_OPTIONS = [
  { value: "deleted", label: "Deleted" },
  { value: "updated", label: "Updated" },
  { value: "verified", label: "Verified" },
  { value: "no_response", label: "No Response" },
  { value: "in_progress", label: "In Progress" },
];

const GEN_MESSAGES = [
  "Analyzing FCRA requirements…",
  "Reviewing account details…",
  "Drafting the letter…",
  "Checking legal citations…",
  "Finalizing formatting…",
];

export function RoundWorkspace({
  clientId,
  clientName,
  round,
  disputes,
}: {
  clientId: string;
  clientName: string;
  round: RoundData;
  disputes: RoundDispute[];
}) {
  const router = useRouter();
  const { toast } = useToast();

  const [status, setStatus] = useState<RoundStatus>(round.status);
  const [letters, setLetters] = useState<Record<string, LetterState>>(() =>
    Object.fromEntries(
      disputes.map((d) => [
        d.id,
        {
          content: d.letter_content ?? "",
          state: d.letter_content ? "ready" : "empty",
          finalized: d.is_finalized,
          tracking: d.certified_mail_number ?? "",
        } as LetterState,
      ])
    )
  );

  const [genProgress, setGenProgress] = useState<{
    active: boolean;
    done: number;
    total: number;
  }>({ active: false, done: 0, total: 0 });
  const [genMessage, setGenMessage] = useState(GEN_MESSAGES[0]);

  const [sendModal, setSendModal] = useState(false);
  const [resultsModal, setResultsModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [completePrompt, setCompletePrompt] = useState(false);

  // Rotate reassuring messages during generation.
  useEffect(() => {
    if (!genProgress.active) return;
    let i = 0;
    const t = setInterval(() => {
      i = (i + 1) % GEN_MESSAGES.length;
      setGenMessage(GEN_MESSAGES[i]);
    }, 2500);
    return () => clearInterval(t);
  }, [genProgress.active]);

  function patchLetter(id: string, patch: Partial<LetterState>) {
    setLetters((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  async function generateOne(disputeId: string): Promise<boolean> {
    patchLetter(disputeId, { state: "generating", error: undefined });
    try {
      const res = await fetch("/api/letters/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disputeId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        patchLetter(disputeId, {
          state: "error",
          error: data.error ?? "Generation failed.",
        });
        return false;
      }
      patchLetter(disputeId, {
        state: "ready",
        content: data.content,
        error: undefined,
      });
      return true;
    } catch {
      patchLetter(disputeId, {
        state: "error",
        error: "Network error during generation.",
      });
      return false;
    }
  }

  async function generateAll() {
    const pending = disputes.filter(
      (d) => letters[d.id].state === "empty" || letters[d.id].state === "error"
    );
    if (pending.length === 0) return;

    const total = pending.length;
    setGenProgress({ active: true, done: 0, total });
    let failures = 0;
    for (let i = 0; i < total; i++) {
      const ok = await generateOne(pending[i].id);
      if (!ok) failures++;
      setGenProgress((p) => ({ ...p, done: i + 1 }));
    }
    setGenProgress({ active: false, done: 0, total: 0 });

    if (failures === 0) {
      // Every letter saved successfully — move to the review screen.
      setStatus("letters_generated");
      toast("All letters generated.", "success");
    } else {
      toast(
        `${failures} letter${failures === 1 ? "" : "s"} failed — retry them below.`,
        "error"
      );
      // If at least one succeeded, still move to review so staff can retry the
      // failed cards individually.
      if (failures < total) setStatus("letters_generated");
    }
    router.refresh();
  }

  async function regenerate(disputeId: string) {
    const ok = await generateOne(disputeId);
    if (ok) {
      // A regenerated letter must be re-reviewed, so un-finalize it (DB + UI).
      patchLetter(disputeId, { finalized: false });
      if (letters[disputeId]?.finalized) {
        await setLetterFinalized(clientId, round.id, disputeId, false);
      }
      toast("Letter regenerated.", "success");
    } else {
      toast("Could not regenerate.", "error");
    }
  }

  async function persistEdit(disputeId: string) {
    const l = letters[disputeId];
    await saveLetterContent(clientId, round.id, disputeId, l.content);
  }

  // Optimistically toggle finalized, then persist to the disputes row.
  async function toggleFinalized(disputeId: string) {
    const next = !letters[disputeId].finalized;
    patchLetter(disputeId, { finalized: next });
    const result = await setLetterFinalized(
      clientId,
      round.id,
      disputeId,
      next
    );
    if (!result.success) {
      patchLetter(disputeId, { finalized: !next });
      toast(result.error ?? "Could not update finalize state.", "error");
    }
  }

  const allFinalized =
    disputes.length > 0 &&
    disputes.every((d) => letters[d.id]?.finalized && letters[d.id]?.content);

  async function confirmSend() {
    setSaving(true);
    const tracking: Record<string, string> = {};
    for (const d of disputes) tracking[d.id] = letters[d.id].tracking;
    const result = await markRoundSent(clientId, round.id, tracking);
    setSaving(false);
    if (result.success) {
      toast("Round marked as sent.", "success");
      setStatus("awaiting_response");
      setSendModal(false);
      router.refresh();
    } else {
      toast(result.error ?? "Could not mark as sent.", "error");
    }
  }

  // ---- Results logging ----
  const [entries, setEntries] = useState<Record<string, ResultEntry>>({});
  const [scoreInputs, setScoreInputs] = useState({ eq: "", exp: "", tu: "" });
  function openResults() {
    setEntries(
      Object.fromEntries(
        disputes.map((d) => [
          d.id,
          {
            disputeId: d.id,
            negativeItemId: d.negative_item_id,
            result:
              d.result !== "pending" ? d.result : ("deleted" as DisputeResult),
            notes: d.result_notes ?? "",
          },
        ])
      )
    );
    setResultsModal(true);
  }
  function bulkSetResult(result: DisputeResult) {
    setEntries((prev) =>
      Object.fromEntries(
        Object.entries(prev).map(([k, v]) => [k, { ...v, result }])
      )
    );
  }
  async function saveResults() {
    setSaving(true);
    const toScore = (v: string) => {
      const n = parseInt(v, 10);
      return Number.isFinite(n) ? n : null;
    };
    const result = await logResults(clientId, round.id, Object.values(entries), {
      eq: toScore(scoreInputs.eq),
      exp: toScore(scoreInputs.exp),
      tu: toScore(scoreInputs.tu),
    });
    setSaving(false);
    if (result.success) {
      toast("Results saved.", "success");
      setStatus("complete");
      setResultsModal(false);
      router.refresh();
      if ((result.remainingActive ?? 1) === 0) setCompletePrompt(true);
    } else {
      toast(result.error ?? "Could not save results.", "error");
    }
  }

  async function completeClient() {
    setSaving(true);
    const result = await markClientCompleted(clientId);
    setSaving(false);
    if (result.success) {
      toast("Client marked as completed.", "success");
      setCompletePrompt(false);
      router.refresh();
    } else {
      toast(result.error ?? "Could not complete client.", "error");
    }
  }

  const showGenerate = status === "preparing";
  const showReview = status === "letters_generated";
  const showAwaiting = status === "sent" || status === "awaiting_response";
  const showComplete = status === "complete";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-white/10 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-slate-100">
              Round {round.round_number}
            </h2>
            <Badge status={status} />
          </div>
          <p className="text-sm text-slate-500">
            {clientName} · {round.total_items_disputed} item
            {round.total_items_disputed === 1 ? "" : "s"} disputed
            {showComplete ? ` · ${round.total_deletions} deleted` : ""}
          </p>
        </div>
        {showAwaiting && round.response_deadline && (
          <DeadlineBadge deadline={round.response_deadline} />
        )}
      </div>

      {/* GENERATE (preparing) */}
      {showGenerate && (
        <div className="space-y-4">
          <div className="rounded-lg border border-white/10 bg-[#1a1a2e] p-6 text-center shadow-sm">
            {genProgress.active ? (
              <div className="space-y-3">
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-400" />
                <p className="text-sm font-medium text-slate-100">
                  Generating letters — {genProgress.done} of {genProgress.total}
                </p>
                <p className="text-sm text-slate-500">{genMessage}</p>
                <div className="mx-auto h-2 max-w-sm overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className="h-full rounded-full bg-blue-600 transition-all"
                    style={{
                      width: `${
                        (genProgress.done / genProgress.total) * 100
                      }%`,
                    }}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/10">
                  <Sparkles className="h-6 w-6 text-blue-400" />
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-slate-100">
                    Ready to generate {disputes.length} letter
                    {disputes.length === 1 ? "" : "s"}
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Claude will draft each dispute letter. You&apos;ll review and
                    edit every letter before anything is sent.
                  </p>
                </div>
                <Button onClick={generateAll}>
                  <Sparkles className="h-4 w-4" />
                  Generate All Letters with AI
                </Button>
              </div>
            )}
          </div>

          <div className="divide-y divide-white/[0.06] overflow-hidden rounded-lg border border-white/10 bg-[#1a1a2e] shadow-sm">
            {disputes.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between px-5 py-3"
              >
                <LetterCardHeader dispute={d} />
                <LetterStatePill state={letters[d.id].state} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* REVIEW (letters_generated) */}
      {showReview && (
        <div className="space-y-4 pb-24">
          {disputes.map((d) => {
            const l = letters[d.id];
            const style = BUREAU_STYLES[d.bureau];
            return (
              <div
                key={d.id}
                className="overflow-hidden rounded-lg border border-white/10 bg-[#1a1a2e] shadow-sm"
              >
                <div
                  className={cn(
                    "flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3",
                    l.finalized ? "bg-green-500/10" : "bg-white/[0.03]"
                  )}
                >
                  <LetterCardHeader dispute={d} />
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => regenerate(d.id)}
                      loading={l.state === "generating"}
                    >
                      <RefreshCw className="h-4 w-4" />
                      Regenerate
                    </Button>
                    <button
                      onClick={() => toggleFinalized(d.id)}
                      disabled={!l.content}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium",
                        l.finalized
                          ? "bg-green-600 text-white hover:bg-green-700"
                          : "border border-white/10 bg-[#1a1a2e] text-slate-300 hover:bg-white/[0.03]"
                      )}
                    >
                      <Check className="h-4 w-4" />
                      {l.finalized ? "Finalized" : "Mark as Finalized"}
                    </button>
                  </div>
                </div>
                {l.state === "error" ? (
                  <div className="flex items-center gap-2 px-5 py-4 text-sm text-red-400">
                    <AlertTriangle className="h-4 w-4" />
                    {l.error ?? "Generation failed."}
                  </div>
                ) : (
                  <textarea
                    value={l.content}
                    onChange={(e) =>
                      patchLetter(d.id, {
                        content: e.target.value,
                        finalized: false,
                      })
                    }
                    onBlur={() => persistEdit(d.id)}
                    spellCheck
                    className={cn(
                      "block max-h-[28rem] min-h-[20rem] w-full resize-y border-0 bg-[#1a1a2e] px-6 py-5 font-serif text-sm leading-relaxed text-slate-200 focus:outline-none focus:ring-0",
                      style.border
                    )}
                  />
                )}
              </div>
            );
          })}

          {/* Action bar */}
          <div className="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-white/95 backdrop-blur md:pl-64">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-8">
              <p className="text-sm text-slate-400">
                {disputes.filter((d) => letters[d.id].finalized).length} of{" "}
                {disputes.length} finalized
              </p>
              <div className="flex items-center gap-2">
                <a
                  href={`/api/letters/pdf?roundId=${round.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button variant="secondary">
                    <Download className="h-4 w-4" />
                    Download All as PDF
                  </Button>
                </a>
                <Button
                  onClick={() => setSendModal(true)}
                  disabled={!allFinalized}
                >
                  <Send className="h-4 w-4" />
                  Mark Round as Sent
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AWAITING RESPONSE */}
      {showAwaiting && (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-white/10 bg-[#1a1a2e] p-5 shadow-sm">
            <div>
              <h3 className="text-sm font-semibold text-slate-100">
                Awaiting bureau responses
              </h3>
              <p className="text-sm text-slate-500">
                Sent {round.date_sent ? formatDate(round.date_sent) : "—"}. Log
                the results as responses come in.
              </p>
            </div>
            <Button onClick={openResults}>
              <ClipboardList className="h-4 w-4" />
              Log Results
            </Button>
          </div>
          <DisputeResultTable disputes={disputes} letters={letters} />
        </div>
      )}

      {/* COMPLETE */}
      {showComplete && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SummaryStat label="Deleted" value={round.total_deletions} tone="green" />
            <SummaryStat label="Updated" value={round.total_updates} tone="teal" />
            <SummaryStat label="Verified" value={round.total_verified} tone="red" />
            <SummaryStat
              label="No response"
              value={round.total_no_response}
              tone="orange"
            />
          </div>
          <DisputeResultTable disputes={disputes} letters={letters} showResult />
          <div className="flex justify-end gap-2">
            <a
              href={`/api/letters/pdf?roundId=${round.id}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="secondary">
                <Download className="h-4 w-4" />
                Download PDF
              </Button>
            </a>
            <Button onClick={() => router.push(`/clients/${clientId}/rounds/new`)}>
              <Sparkles className="h-4 w-4" />
              Start Next Round
            </Button>
          </div>
        </div>
      )}

      {/* Mark-as-sent modal */}
      <Modal
        open={sendModal}
        onClose={() => setSendModal(false)}
        title="Mark round as sent?"
        description="This marks all letters as sent, starts the 35-day response clock, and notifies GHL."
        footer={
          <>
            <Button variant="secondary" onClick={() => setSendModal(false)}>
              Cancel
            </Button>
            <Button onClick={confirmSend} loading={saving}>
              Confirm &amp; mark sent
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-400">
            Optionally add certified-mail tracking numbers. You can leave these
            blank and add them later.
          </p>
          <div className="space-y-2">
            {disputes.map((d) => (
              <div key={d.id} className="flex items-center gap-3">
                <span className="w-40 shrink-0 truncate text-sm text-slate-300">
                  {d.creditor_name}{" "}
                  <span className="text-xs text-slate-500">
                    ({getBureauLabel(d.bureau)})
                  </span>
                </span>
                <input
                  value={letters[d.id].tracking}
                  onChange={(e) =>
                    patchLetter(d.id, { tracking: e.target.value })
                  }
                  placeholder="Tracking #"
                  className="flex-1 rounded-md border border-white/10 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            ))}
          </div>
        </div>
      </Modal>

      {/* Results logging modal */}
      <Modal
        open={resultsModal}
        onClose={() => setResultsModal(false)}
        title="Log round results"
        description="Record the outcome for each disputed item."
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setResultsModal(false)}>
              Cancel
            </Button>
            <Button onClick={saveResults} loading={saving}>
              Save results
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-md bg-white/[0.03] px-3 py-2">
            <span className="text-sm text-slate-400">Bulk mark all as:</span>
            <Select
              aria-label="Bulk result"
              defaultValue=""
              onChange={(e) =>
                e.target.value &&
                bulkSetResult(e.target.value as DisputeResult)
              }
              options={RESULT_OPTIONS}
              placeholder="Choose…"
              className="w-auto"
            />
          </div>

          {/* Optional score update — snapshots to the client's portal chart. */}
          <div className="rounded-md border border-white/10 p-3">
            <p className="mb-2 text-sm font-medium text-slate-300">
              Update credit scores{" "}
              <span className="font-normal text-slate-500">(optional)</span>
            </p>
            <div className="grid grid-cols-3 gap-2">
              {(["eq", "exp", "tu"] as const).map((k) => (
                <label key={k} className="text-xs text-slate-500">
                  <span className="mb-1 block uppercase">
                    {k === "eq" ? "Equifax" : k === "exp" ? "Experian" : "TransUnion"}
                  </span>
                  <input
                    type="number"
                    min={300}
                    max={850}
                    value={scoreInputs[k]}
                    onChange={(e) =>
                      setScoreInputs((s) => ({ ...s, [k]: e.target.value }))
                    }
                    placeholder="—"
                    className="w-full rounded-md border border-white/10 px-2 py-1.5 text-sm text-slate-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            {disputes.map((d) => {
              const entry = entries[d.id];
              if (!entry) return null;
              return (
                <div
                  key={d.id}
                  className="rounded-lg border border-white/10 p-3"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <LetterCardHeader dispute={d} />
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <Select
                      aria-label="Result"
                      value={entry.result}
                      onChange={(e) =>
                        setEntries((prev) => ({
                          ...prev,
                          [d.id]: {
                            ...prev[d.id],
                            result: e.target.value as DisputeResult,
                          },
                        }))
                      }
                      options={RESULT_OPTIONS}
                    />
                    <input
                      value={entry.notes}
                      onChange={(e) =>
                        setEntries((prev) => ({
                          ...prev,
                          [d.id]: { ...prev[d.id], notes: e.target.value },
                        }))
                      }
                      placeholder="Notes (optional)"
                      className="rounded-md border border-white/10 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Modal>

      {/* Goal-achieved prompt */}
      <Modal
        open={completePrompt}
        onClose={() => setCompletePrompt(false)}
        title="All items resolved!"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCompletePrompt(false)}>
              Not yet
            </Button>
            <Button onClick={completeClient} loading={saving}>
              Mark client completed
            </Button>
          </>
        }
      >
        <div className="flex items-start gap-3">
          <PartyPopper className="mt-0.5 h-5 w-5 shrink-0 text-green-400" />
          <p className="text-sm text-slate-400">
            This client has no remaining active items. Mark them as completed to
            fire the goal-achieved sync to GHL?
          </p>
        </div>
      </Modal>
    </div>
  );
}

function LetterCardHeader({ dispute }: { dispute: RoundDispute }) {
  const style = BUREAU_STYLES[dispute.bureau];
  return (
    <div className="flex items-center gap-2">
      <span className={cn("h-2 w-2 rounded-full", style.dot)} />
      <span className="font-medium text-slate-100">{dispute.creditor_name}</span>
      <span className={cn("text-xs font-medium", style.text)}>
        {getBureauLabel(dispute.bureau)}
      </span>
      <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-xs font-medium text-slate-400">
        {getLetterTypeLabel(dispute.letter_type)}
      </span>
    </div>
  );
}

function LetterStatePill({ state }: { state: LetterState["state"] }) {
  if (state === "generating")
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-blue-400">
        <Loader2 className="h-4 w-4 animate-spin" /> Generating…
      </span>
    );
  if (state === "ready")
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-green-400">
        <Check className="h-4 w-4" /> Ready for review
      </span>
    );
  if (state === "error")
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-red-400">
        <AlertTriangle className="h-4 w-4" /> Failed
      </span>
    );
  return <span className="text-sm text-slate-500">Not generated</span>;
}

function DeadlineBadge({ deadline }: { deadline: string }) {
  const days = daysRemaining(deadline);
  const overdue = days < 0;
  const tone = overdue
    ? "bg-red-500/10 text-red-400 border-red-500/30"
    : days <= 14
      ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
      : "bg-green-500/10 text-green-400 border-green-500/30";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-lg border px-3 py-1.5 text-sm font-medium",
        tone
      )}
    >
      {overdue
        ? `${Math.abs(days)} days overdue`
        : `${days} days until deadline`}
    </span>
  );
}

function SummaryStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "green" | "teal" | "red" | "orange";
}) {
  const tones = {
    green: "text-green-400",
    teal: "text-teal-400",
    red: "text-red-400",
    orange: "text-orange-400",
  };
  return (
    <div className="rounded-lg border border-white/10 bg-[#1a1a2e] p-4 shadow-sm">
      <p className={cn("text-2xl font-semibold", tones[tone])}>{value}</p>
      <p className="text-sm text-slate-500">{label}</p>
    </div>
  );
}

function DisputeResultTable({
  disputes,
  letters,
  showResult,
}: {
  disputes: RoundDispute[];
  letters: Record<string, LetterState>;
  showResult?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-white/10 bg-[#1a1a2e] shadow-sm">
      <table className="min-w-full divide-y divide-white/[0.08] text-sm">
        <thead className="bg-white/[0.03] text-left text-xs font-medium uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">Creditor</th>
            <th className="px-4 py-3">Bureau</th>
            <th className="px-4 py-3">Letter type</th>
            <th className="px-4 py-3">{showResult ? "Result" : "Status"}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.06]">
          {disputes.map((d) => (
            <tr key={d.id} className="hover:bg-white/[0.03]">
              <td className="px-4 py-3 font-medium text-slate-100">
                {d.creditor_name}
              </td>
              <td className="px-4 py-3 text-slate-400">
                {getBureauLabel(d.bureau)}
              </td>
              <td className="px-4 py-3 text-slate-400">
                {getLetterTypeLabel(d.letter_type)}
              </td>
              <td className="px-4 py-3">
                {showResult ? (
                  <Badge status={d.result} />
                ) : letters[d.id]?.content ? (
                  <span className="text-slate-500">Awaiting response</span>
                ) : (
                  <span className="text-slate-500">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
