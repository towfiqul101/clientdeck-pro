"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import {
  recordManualPayment,
  markPaid,
  cancelAgency,
  extendTrialDays,
  addPaymentNote,
} from "./actions";

const field =
  "rounded-md border border-white/10 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

const METHODS = ["Bank Transfer", "Cash", "Check", "Card Manual", "Other"];

export function PaymentForm({
  agencies,
}: {
  agencies: { id: string; name: string }[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();

  const [agencyId, setAgencyId] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState(METHODS[0]);
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  function submit() {
    start(async () => {
      const res = await recordManualPayment({
        agencyId,
        amount: Number(amount),
        method,
        reference,
        notes,
      });
      if (res.success) {
        toast("Payment recorded.", "success");
        setAmount("");
        setReference("");
        setNotes("");
        router.refresh();
      } else {
        toast(res.error ?? "Failed.", "error");
      }
    });
  }

  return (
    <div className="rounded-lg border border-white/10 bg-[#1a1a2e] p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-100">Record a manual payment</h3>
      <p className="mt-0.5 text-sm text-slate-500">
        Logs the payment and sets the agency to <strong>active</strong>.
      </p>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <select
          value={agencyId}
          onChange={(e) => setAgencyId(e.target.value)}
          className={field}
        >
          <option value="">Select agency…</option>
          {agencies.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <input
          type="number"
          min={0}
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Amount received"
          className={field}
        />
        <select value={method} onChange={(e) => setMethod(e.target.value)} className={field}>
          {METHODS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder="Reference number (optional)"
          className={field}
        />
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes (optional)"
          className={`${field} sm:col-span-2 lg:col-span-1`}
        />
      </div>
      <button
        disabled={pending || !agencyId || !amount}
        onClick={submit}
        className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        Record Payment
      </button>
    </div>
  );
}

export function RowActions({ agencyId }: { agencyId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");

  function run(fn: () => Promise<{ success: boolean; error?: string }>, ok: string) {
    start(async () => {
      const res = await fn();
      if (res.success) {
        toast(ok, "success");
        setNoteOpen(false);
        setNote("");
        router.refresh();
      } else {
        toast(res.error ?? "Failed.", "error");
      }
    });
  }

  const btn =
    "rounded-md border border-white/10 bg-[#1a1a2e] px-2 py-1 text-xs font-medium text-slate-300 hover:bg-white/[0.03] disabled:opacity-40";

  return (
    <div className="flex flex-col items-start gap-1.5">
      <div className="flex flex-wrap gap-1.5">
        <button disabled={pending} onClick={() => run(() => markPaid(agencyId), "Marked paid.")} className={btn}>
          Mark Paid
        </button>
        <button disabled={pending} onClick={() => run(() => extendTrialDays(agencyId, 14), "Trial extended.")} className={btn}>
          +14d Trial
        </button>
        <button disabled={pending} onClick={() => setNoteOpen((v) => !v)} className={btn}>
          Add Note
        </button>
        <button
          disabled={pending}
          onClick={() => run(() => cancelAgency(agencyId), "Cancelled.")}
          className="rounded-md border border-red-300 bg-[#1a1a2e] px-2 py-1 text-xs font-medium text-red-400 hover:bg-red-500/10 disabled:opacity-40"
        >
          Cancel
        </button>
      </div>
      {noteOpen && (
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Payment note…"
            className="rounded-md border border-white/10 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none"
          />
          <button
            disabled={pending || !note.trim()}
            onClick={() => run(() => addPaymentNote(agencyId, note), "Note saved.")}
            className="rounded-md bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-40"
          >
            Save
          </button>
        </div>
      )}
    </div>
  );
}
