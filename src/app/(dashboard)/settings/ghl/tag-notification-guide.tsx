"use client";

import { useState } from "react";
import Link from "next/link";
import { Copy, Check } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import {
  NOTIFICATION_TAGS,
  INBOUND_TAGS,
  type GHLNotificationType,
} from "@/lib/ghl/notification-tags";
import { updateOwnerGhlContactId } from "../actions";

const ROWS: { key: GHLNotificationType; event: string; fields: string }[] = [
  { key: "round_sent", event: "Round Sent", fields: "rtp__round_number, rtp__items_disputed, rtp__portal_link" },
  { key: "deletion_win", event: "Deletion Win", fields: "rtp__deletions_this_round, rtp__items_deleted, rtp__deleted_items_list" },
  { key: "round_results_in", event: "Round Complete", fields: "rtp__round_number, rtp__items_deleted, rtp__total_items" },
  { key: "goal_achieved", event: "Goal Achieved", fields: "rtp__score_improvement, rtp__google_review_link" },
  { key: "payment_failed", event: "Payment Failed", fields: "rtp__monthly_fee, rtp__agency_phone" },
  { key: "portal_link", event: "Portal Link Sent", fields: "rtp__portal_link" },
  { key: "monthly_progress", event: "Monthly Update", fields: "rtp__eq_score, rtp__exp_score, rtp__tu_score" },
  { key: "staff_new_client", event: "Staff: New Client", fields: "(fires on your owner contact — no fields written)" },
  { key: "staff_round_overdue", event: "Staff: Round Overdue", fields: "(fires on your owner contact — no fields written)" },
  { key: "staff_next_round_ready", event: "Staff: Next Round Ready", fields: "(fires on your owner contact — no fields written)" },
];

export function TagNotificationGuide({ ownerGhlContactId }: { ownerGhlContactId: string }) {
  const { toast } = useToast();
  const [contactId, setContactId] = useState(ownerGhlContactId);
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleSave() {
    setPending(true);
    const result = await updateOwnerGhlContactId(contactId);
    setPending(false);
    if (result.success) toast("Owner GHL contact saved.", "success");
    else toast(result.error ?? "Could not save.", "error");
  }

  function copyAllTags() {
    navigator.clipboard?.writeText(Object.values(NOTIFICATION_TAGS).join(", "));
    setCopied(true);
    toast("All tag names copied.", "success");
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card>
      <CardHeader
        title="GHL Notifications (Free — No Per-Execution Cost)"
        description='RoundTrack Pro notifies clients using GHL contact tags. When an event happens, we update the contact’s custom fields with the event data, then add a tag like "rtp-round-sent" — your GHL workflow (Tag trigger, free in GHL) picks it up and sends SMS/email from your own number.'
      />
      <div className="space-y-4 p-6">
        <div className="overflow-x-auto rounded-md border border-white/10">
          <table className="w-full table-fixed text-left text-sm">
            <thead className="border-b border-white/10 bg-white/[0.03] text-xs uppercase text-slate-500">
              <tr>
                <th className="w-[28%] px-3 py-2 font-medium">Event</th>
                <th className="w-[27%] px-3 py-2 font-medium">Tag to watch</th>
                <th className="w-[45%] px-3 py-2 font-medium">Data fields available</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {ROWS.map((r) => (
                <tr key={r.key}>
                  <td className="break-words px-3 py-2 text-slate-100">{r.event}</td>
                  <td className="break-words px-3 py-2 font-mono text-xs text-blue-400">{NOTIFICATION_TAGS[r.key]}</td>
                  <td className="break-words px-3 py-2 font-mono text-xs text-slate-500">{r.fields}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Inbound tags — the opposite direction: GHL adds these, and they
            CHANGE client data here. Undocumented until now, which is how a
            generic tag name could quietly mutate a client's status. */}
        <div className="rounded-md border border-white/10 bg-white/[0.03] p-4">
          <h4 className="text-sm font-semibold text-slate-100">
            Tags YOU add that change a client in RoundTrack Pro
          </h4>
          <p className="mt-1 text-xs text-slate-500">
            The tags above are ones we add for your workflows to react to. These
            three work the other way: add one in GHL and it updates the client
            here. They&apos;re prefixed{" "}
            <code className="rounded bg-white/[0.06] px-1">rtp-</code> on purpose
            — a bare <code className="rounded bg-white/[0.06] px-1">payment-failed</code>{" "}
            is a tag another product in this GHL location could easily use, and it
            would have changed your credit clients&apos; billing status.
          </p>
          <div className="mt-3 overflow-x-auto rounded-md border border-white/10">
            <table className="w-full table-fixed text-left text-sm">
              <thead className="border-b border-white/10 bg-white/[0.03] text-xs uppercase text-slate-500">
                <tr>
                  <th className="w-[45%] px-3 py-2 font-medium">Add this tag in GHL</th>
                  <th className="w-[55%] px-3 py-2 font-medium">Effect on the client</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                <tr>
                  <td className="px-3 py-2 font-mono text-xs text-blue-400">
                    {INBOUND_TAGS.ENROLLED}
                  </td>
                  <td className="px-3 py-2 text-slate-400">Status → Onboarding</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-mono text-xs text-blue-400">
                    {INBOUND_TAGS.PAYMENT_FAILED}
                  </td>
                  <td className="px-3 py-2 text-slate-400">Payment status → Failed</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-mono text-xs text-blue-400">
                    {INBOUND_TAGS.SERVICES_PAUSED}
                  </td>
                  <td className="px-3 py-2 text-slate-400">
                    Status → On hold, payment → Paused
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Requires the inbound webhook (top of this page) to be wired up in a
            GHL workflow.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button type="button" variant="secondary" onClick={copyAllTags}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            Copy All Tags
          </Button>
          <Link
            href="/onboarding/ghl-setup"
            className="text-sm font-medium text-blue-400 hover:text-blue-400"
          >
            Full setup guide →
          </Link>
        </div>

        <Field
          label="Owner GHL Contact ID"
          htmlFor="ownerGhlContactId"
          hint="Your own contact in GHL — staff alert tags (overdue rounds, new clients) land here. Find it: GHL → Contacts → your profile → copy the id from the URL."
        >
          <Input
            id="ownerGhlContactId"
            value={contactId}
            onChange={(e) => setContactId(e.target.value)}
            placeholder="e.g. abc123XYZ"
          />
        </Field>
        <div className="flex justify-end">
          <Button onClick={handleSave} loading={pending}>
            Save
          </Button>
        </div>
      </div>
    </Card>
  );
}
