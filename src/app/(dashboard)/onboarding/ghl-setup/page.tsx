import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/card";
import { ArrowLeft, MessageSquare, AlertTriangle } from "lucide-react";
import { NOTIFICATION_TAGS, type GHLNotificationType } from "@/lib/ghl/notifications";

interface WorkflowDoc {
  key: GHLNotificationType;
  title: string;
  mergeFields: string[];
  suggestedCopy: string;
  /** Staff alerts fire on the client's contact but the SMS/email goes to your team. */
  staffAlert?: boolean;
}

const WORKFLOWS: WorkflowDoc[] = [
  {
    key: "round_sent",
    title: "Round Sent to Bureaus (Client SMS)",
    mergeFields: ["{{contact.first_name}}", "{{contact.rtp__round_number}}", "{{contact.rtp__items_disputed}}", "{{contact.rtp__portal_link}}"],
    suggestedCopy:
      "Hi {{contact.first_name}}! Your Round {{contact.rtp__round_number}} dispute letters have been sent to all 3 bureaus ({{contact.rtp__items_disputed}} items). Track your progress: {{contact.rtp__portal_link}}",
  },
  {
    key: "deletion_win",
    title: "Deletion Win (Client SMS)",
    mergeFields: ["{{contact.rtp__deletions_this_round}}", "{{contact.rtp__items_deleted}}", "{{contact.rtp__deleted_items_list}}", "{{contact.rtp__portal_link}}"],
    suggestedCopy:
      "Great news, {{contact.first_name}}! {{contact.rtp__deletions_this_round}} item(s) were removed this round. Total deleted so far: {{contact.rtp__items_deleted}}. View your progress: {{contact.rtp__portal_link}}",
  },
  {
    key: "round_results_in",
    title: "Round Results In (Client SMS)",
    mergeFields: ["{{contact.rtp__round_number}}", "{{contact.rtp__items_deleted}}", "{{contact.rtp__total_items}}", "{{contact.rtp__portal_link}}"],
    suggestedCopy:
      "Hi {{contact.first_name}}, your Round {{contact.rtp__round_number}} results are in. Full details: {{contact.rtp__portal_link}}",
  },
  {
    key: "goal_achieved",
    title: "Goal Achieved (Client SMS + Email)",
    mergeFields: ["{{contact.rtp__items_deleted}}", "{{contact.rtp__score_improvement}}", "{{contact.rtp__google_review_link}}"],
    suggestedCopy:
      "Congratulations {{contact.first_name}}! You've reached your credit goal — {{contact.rtp__items_deleted}} items removed, +{{contact.rtp__score_improvement}} points. Mind leaving us a review? {{contact.rtp__google_review_link}}",
  },
  {
    key: "payment_failed",
    title: "Payment Failed (Client SMS)",
    mergeFields: ["{{contact.rtp__monthly_fee}}", "{{contact.rtp__portal_link}}", "{{contact.rtp__agency_phone}}"],
    suggestedCopy:
      "Hi {{contact.first_name}}, your payment of ${{contact.rtp__monthly_fee}}/month didn't go through. Update it here: {{contact.rtp__portal_link}} or call {{contact.rtp__agency_phone}}.",
  },
  {
    key: "portal_link",
    title: "Portal Link Sent (Client SMS)",
    mergeFields: ["{{contact.rtp__portal_link}}"],
    suggestedCopy: "Hi {{contact.first_name}}, here's your client portal link: {{contact.rtp__portal_link}}",
  },
  {
    key: "monthly_progress",
    title: "Monthly Progress Update (Client SMS)",
    mergeFields: ["{{contact.rtp__eq_score}}", "{{contact.rtp__exp_score}}", "{{contact.rtp__tu_score}}", "{{contact.rtp__items_deleted}}", "{{contact.rtp__round_number}}"],
    suggestedCopy:
      "Hi {{contact.first_name}}, your monthly update: {{contact.rtp__items_deleted}} items resolved, currently on Round {{contact.rtp__round_number}}. Details: {{contact.rtp__portal_link}}",
  },
  {
    key: "staff_new_client",
    title: "New Client Onboarded (Staff alert)",
    staffAlert: true,
    mergeFields: [
      "{{contact.first_name}}",
      "{{contact.last_name}}",
      "{{contact.email}}",
      "{{contact.phone}}",
      "{{contact.rtp__alert_dashboard_link}}",
    ],
    suggestedCopy:
      "New client onboarded: {{contact.first_name}} {{contact.last_name}} — {{contact.phone}} / {{contact.email}}. Open their file: {{contact.rtp__alert_dashboard_link}}",
  },
  {
    key: "staff_round_overdue",
    title: "Round Overdue Alert (Staff alert)",
    staffAlert: true,
    mergeFields: [
      "{{contact.first_name}}",
      "{{contact.last_name}}",
      "{{contact.rtp__alert_round_number}}",
      "{{contact.rtp__alert_days_overdue}}",
      "{{contact.rtp__alert_dashboard_link}}",
    ],
    suggestedCopy:
      "Round {{contact.rtp__alert_round_number}} for {{contact.first_name}} {{contact.last_name}} is {{contact.rtp__alert_days_overdue}} day(s) past the 35-day deadline. Escalate: {{contact.rtp__alert_dashboard_link}}",
  },
  {
    key: "staff_next_round_ready",
    title: "Next Round Ready (Staff alert)",
    staffAlert: true,
    mergeFields: [
      "{{contact.first_name}}",
      "{{contact.last_name}}",
      "{{contact.rtp__alert_round_number}}",
      "{{contact.rtp__alert_dashboard_link}}",
    ],
    suggestedCopy:
      "{{contact.first_name}} {{contact.last_name}} is ready for Round {{contact.rtp__alert_round_number}}. Prepare it: {{contact.rtp__alert_dashboard_link}}",
  },
];

export default function GHLSetupGuidePage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/settings/ghl"
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-300"
        >
          <ArrowLeft className="h-4 w-4" /> Back to GHL Settings
        </Link>
        <h1 className="text-xl font-semibold text-slate-100">GHL Workflow Setup Guide</h1>
        <p className="mt-1 text-sm text-slate-500">
          RoundTrack Pro notifies your clients using free GHL contact tags — your own GHL
          workflow sends the SMS/email, so it looks like it comes from your agency.
        </p>
      </div>

      <Card>
        <CardHeader title="How it works" />
        <div className="space-y-2 p-6 text-sm text-slate-400">
          <p>1. Run <strong>Create Custom Fields</strong> from Settings → GHL (or use the RoundTrack Pro snapshot).</p>
          <p>2. In GHL, create a workflow with <strong>Tag Added</strong> as the trigger, watching the tag listed below for each event.</p>
          <p>3. Build SMS/email actions using the contact merge fields listed below.</p>
          <p>
            4. Every tag below — client alerts <em>and</em> staff alerts — fires on the{" "}
            <strong>client&apos;s</strong> contact, so every workflow has that client&apos;s
            merge fields. For the 3 staff alerts, address the SMS/email to your team&apos;s
            own number instead of the contact&apos;s.
          </p>
        </div>
      </Card>

      {/* Breaking change: these 3 tags used to land on the owner's contact. An
          agency that already built them that way has a workflow that will now
          never fire, with no error to tell them so. */}
      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              Rebuilding the 3 staff alerts
            </span>
          }
          description="Only applies if you already built these workflows. The 7 client-facing alerts above are unchanged."
        />
        <div className="space-y-3 p-6 text-sm text-slate-400">
          <p>
            <strong className="text-slate-200">New Client Onboarded</strong>,{" "}
            <strong className="text-slate-200">Round Overdue Alert</strong> and{" "}
            <strong className="text-slate-200">Next Round Ready</strong> used to fire their
            tag on <em>your own</em> GHL contact. They now fire it on the{" "}
            <strong className="text-slate-200">client&apos;s</strong> contact — that is the
            whole point of the change, because a workflow triggered on your contact had no
            client attached and so had no client fields to put in the message.
          </p>
          <p>
            The <strong>Tag Added</strong> trigger and tag names are unchanged, so the
            workflow keeps working — but it will now run <em>with the client as the
            contact</em>. Two things to fix in each of the 3 workflows:
          </p>
          <ul className="list-inside list-disc space-y-1 pl-1">
            <li>
              Point the SMS/email action at your team&apos;s fixed number/address. If it
              currently sends to &quot;Contact&quot;, it would now text the{" "}
              <strong className="text-amber-300">client</strong> instead of you.
            </li>
            <li>
              Rewrite the message using the client merge fields listed on each card below —
              that&apos;s the detail you were missing.
            </li>
          </ul>
          <p className="text-slate-500">
            The 3 alert fields (<code className="rounded bg-white/[0.06] px-1">rtp__alert_*</code>)
            are new — re-run <strong>Create Custom Fields</strong> in Settings → GHL before
            you build the messages, or the merge tags render blank.
          </p>
        </div>
      </Card>

      {WORKFLOWS.map((wf) => (
        <Card key={wf.key}>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-blue-400" /> {wf.title}
              </span>
            }
            description={
              <>
                Trigger: <strong>Tag Added</strong> —{" "}
                <code className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-xs">
                  {NOTIFICATION_TAGS[wf.key]}
                </code>{" "}
                on the client&apos;s contact
              </>
            }
          />
          <div className="space-y-3 p-6 text-sm">
            {wf.staffAlert && (
              <p className="rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-200">
                Send this one to <strong>your team&apos;s number/email</strong>, not to the
                contact — the tag fires on the client so you get their details, but the
                message is for you.
              </p>
            )}
            <div>
              <p className="mb-1.5 font-medium text-slate-300">Merge fields available:</p>
              <div className="flex flex-wrap gap-1.5">
                {wf.mergeFields.map((f) => (
                  <code key={f} className="rounded bg-white/[0.06] px-2 py-1 font-mono text-xs text-slate-300">
                    {f}
                  </code>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1.5 font-medium text-slate-300">Suggested SMS/email copy:</p>
              <code className="block rounded-md bg-gray-900 px-3 py-2 font-mono text-xs leading-relaxed text-gray-100">
                {wf.suggestedCopy}
              </code>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
