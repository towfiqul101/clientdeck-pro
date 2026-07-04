"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { cn, formatDate } from "@/lib/utils/helpers";
import { avatarColor, initials } from "@/lib/admin/avatar";
import { AgencySlideover } from "@/components/admin/agency-slideover";
import { Mail, Loader2 } from "lucide-react";

export interface PendingRow {
  id: string;
  name: string;
  owner_email: string;
  created_at: string;
  ghlConnected: boolean;
  clientCount: number;
  daysSince: number;
}

export function PendingList({ rows }: { rows: PendingRow[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [selected, setSelected] = useState<string | null>(null);
  const [sending, setSending] = useState<string | null>(null);

  async function sendReminder(id: string) {
    setSending(id);
    try {
      const res = await fetch("/api/admin/tools/resend-welcome", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agencyId: id }),
      });
      const json = await res.json();
      toast(json.message || json.error || "Done.", json.ok ? "success" : "error");
    } catch {
      toast("Request failed.", "error");
    } finally {
      setSending(null);
    }
  }

  if (rows.length === 0) {
    return (
      <div className="px-5 py-12 text-center text-sm text-gray-500">
        🎉 Nobody is stuck in setup right now.
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="border-b border-gray-200 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-5 py-3 font-medium">Agency</th>
              <th className="px-5 py-3 font-medium">Signup</th>
              <th className="px-5 py-3 font-medium">Days</th>
              <th className="px-5 py-3 font-medium">GHL</th>
              <th className="px-5 py-3 font-medium">Clients</th>
              <th className="px-5 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white",
                        avatarColor(r.name)
                      )}
                    >
                      {initials(r.name)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-gray-900">{r.name}</p>
                      <p className="truncate text-xs text-gray-500">{r.owner_email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3 text-gray-500">{formatDate(r.created_at)}</td>
                <td className="px-5 py-3">
                  <span className={cn("font-medium", r.daysSince > 4 ? "text-red-600" : "text-gray-700")}>
                    {r.daysSince}d
                  </span>
                </td>
                <td className="px-5 py-3">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-medium",
                      r.ghlConnected ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"
                    )}
                  >
                    {r.ghlConnected ? "Yes" : "No"}
                  </span>
                </td>
                <td className="px-5 py-3 text-gray-600">{r.clientCount}</td>
                <td className="px-5 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      disabled={sending === r.id}
                      onClick={() => sendReminder(r.id)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      {sending === r.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Mail className="h-3.5 w-3.5" />
                      )}
                      Send Reminder
                    </button>
                    <button
                      onClick={() => setSelected(r.id)}
                      className="rounded-md bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                    >
                      Open Panel
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AgencySlideover
        agencyId={selected}
        onClose={() => setSelected(null)}
        onChange={() => router.refresh()}
      />
    </>
  );
}
