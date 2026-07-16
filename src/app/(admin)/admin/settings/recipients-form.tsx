"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { Mail, Plus, Trash2 } from "lucide-react";
import { addAdminRecipient, removeAdminRecipient } from "./actions";

const MAX_RECIPIENTS = 3;

interface Recipient {
  id: string;
  email: string;
  created_at: string;
}

export function RecipientsForm({ initial }: { initial: Recipient[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [email, setEmail] = useState("");

  const atCap = initial.length >= MAX_RECIPIENTS;

  function add() {
    if (!email.trim()) return;
    start(async () => {
      const res = await addAdminRecipient(email);
      if (res.success) {
        toast("Recipient added.", "success");
        setEmail("");
        router.refresh();
      } else {
        toast(res.error ?? "Could not add recipient.", "error");
      }
    });
  }

  function remove(id: string) {
    start(async () => {
      const res = await removeAdminRecipient(id);
      if (res.success) {
        toast("Recipient removed.", "success");
        router.refresh();
      } else {
        toast(res.error ?? "Could not remove recipient.", "error");
      }
    });
  }

  return (
    <div className="space-y-4">
      {initial.length === 0 ? (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-400">
          No recipients configured — admin notifications only appear in the
          bell above until you add at least one email.
        </p>
      ) : (
        <ul className="divide-y divide-white/[0.06] rounded-lg border border-white/10">
          {initial.map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-4 py-3">
              <Mail className="h-4 w-4 shrink-0 text-slate-500" />
              <span className="min-w-0 flex-1 truncate text-sm text-slate-200">{r.email}</span>
              <button
                onClick={() => remove(r.id)}
                disabled={pending}
                aria-label={`Remove ${r.email}`}
                className="rounded-md p-1.5 text-slate-500 hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {atCap ? (
        <p className="text-xs text-slate-500">
          Maximum {MAX_RECIPIENTS} recipients — remove one to add another.
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="you@example.com"
            className="w-64 rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
          />
          <button
            onClick={add}
            disabled={pending || !email.trim()}
            className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {pending ? "Saving…" : "Add recipient"}
          </button>
        </div>
      )}
    </div>
  );
}
