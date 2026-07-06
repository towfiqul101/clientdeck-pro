import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/card";
import { ArrowLeft, MessageSquare } from "lucide-react";
import { NOTIFICATION_TAGS, type GHLNotificationType } from "@/lib/ghl/notifications";

interface WorkflowDoc {
  key: GHLNotificationType;
  title: string;
  mergeFields: string[];
  suggestedCopy: string;
}

const WORKFLOWS: WorkflowDoc[] = [
  {
    key: "round_sent",
    title: "Round Sent to Bureaus (Client SMS)",
    mergeFields: ["{{contact.first_name}}", "{{contact.dispute_round_current}}", "{{contact.cdp_items_disputed}}", "{{contact.clientdeck_portal_link}}"],
    suggestedCopy:
      "Hi {{contact.first_name}}! Your Round {{contact.dispute_round_current}} dispute letters have been sent to all 3 bureaus ({{contact.cdp_items_disputed}} items). Track your progress: {{contact.clientdeck_portal_link}}",
  },
  {
    key: "deletion_win",
    title: "Deletion Win (Client SMS)",
    mergeFields: ["{{contact.cdp_deletions_this_round}}", "{{contact.items_deleted_total}}", "{{contact.cdp_deleted_items_list}}", "{{contact.clientdeck_portal_link}}"],
    suggestedCopy:
      "Great news, {{contact.first_name}}! {{contact.cdp_deletions_this_round}} item(s) were removed this round. Total deleted so far: {{contact.items_deleted_total}}. View your progress: {{contact.clientdeck_portal_link}}",
  },
  {
    key: "round_results_in",
    title: "Round Results In (Client SMS)",
    mergeFields: ["{{contact.dispute_round_current}}", "{{contact.items_deleted_total}}", "{{contact.total_negative_items}}", "{{contact.clientdeck_portal_link}}"],
    suggestedCopy:
      "Hi {{contact.first_name}}, your Round {{contact.dispute_round_current}} results are in. Full details: {{contact.clientdeck_portal_link}}",
  },
  {
    key: "goal_achieved",
    title: "Goal Achieved (Client SMS + Email)",
    mergeFields: ["{{contact.items_deleted_total}}", "{{contact.cdp_score_improvement}}", "{{contact.cdp_google_review_link}}"],
    suggestedCopy:
      "Congratulations {{contact.first_name}}! You've reached your credit goal — {{contact.items_deleted_total}} items removed, +{{contact.cdp_score_improvement}} points. Mind leaving us a review? {{contact.cdp_google_review_link}}",
  },
  {
    key: "payment_failed",
    title: "Payment Failed (Client SMS)",
    mergeFields: ["{{contact.cdp_monthly_fee}}", "{{contact.clientdeck_portal_link}}", "{{contact.cdp_agency_phone}}"],
    suggestedCopy:
      "Hi {{contact.first_name}}, your payment of ${{contact.cdp_monthly_fee}}/month didn't go through. Update it here: {{contact.clientdeck_portal_link}} or call {{contact.cdp_agency_phone}}.",
  },
  {
    key: "portal_link",
    title: "Portal Link Sent (Client SMS)",
    mergeFields: ["{{contact.clientdeck_portal_link}}"],
    suggestedCopy: "Hi {{contact.first_name}}, here's your client portal link: {{contact.clientdeck_portal_link}}",
  },
  {
    key: "monthly_progress",
    title: "Monthly Progress Update (Client SMS)",
    mergeFields: ["{{contact.credit_score_eq_current}}", "{{contact.credit_score_exp_current}}", "{{contact.credit_score_tu_current}}", "{{contact.items_deleted_total}}", "{{contact.dispute_round_current}}"],
    suggestedCopy:
      "Hi {{contact.first_name}}, your monthly update: {{contact.items_deleted_total}} items resolved, currently on Round {{contact.dispute_round_current}}. Details: {{contact.clientdeck_portal_link}}",
  },
  {
    key: "staff_new_client",
    title: "New Client Onboarded (Staff alert)",
    mergeFields: ["(fires on YOUR contact — build the message from a GHL workflow lookup, not merge fields)"],
    suggestedCopy: "New client onboarded — check your ClientDeck Pro dashboard for details.",
  },
  {
    key: "staff_round_overdue",
    title: "Round Overdue Alert (Staff alert)",
    mergeFields: ["(fires on YOUR contact — no client fields attached)"],
    suggestedCopy: "A client's round is overdue for a bureau response — check your ClientDeck Pro dashboard.",
  },
  {
    key: "staff_next_round_ready",
    title: "Next Round Ready (Staff alert)",
    mergeFields: ["(fires on YOUR contact — no client fields attached)"],
    suggestedCopy: "A client's next round is ready to prepare — check your ClientDeck Pro dashboard.",
  },
];

export default function GHLSetupGuidePage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/settings/ghl"
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" /> Back to GHL Settings
        </Link>
        <h1 className="text-xl font-semibold text-gray-900">GHL Workflow Setup Guide</h1>
        <p className="mt-1 text-sm text-gray-500">
          ClientDeck Pro notifies your clients using free GHL contact tags — your own GHL
          workflow sends the SMS/email, so it looks like it comes from your agency.
        </p>
      </div>

      <Card>
        <CardHeader title="How it works" />
        <div className="space-y-2 p-6 text-sm text-gray-600">
          <p>1. Run <strong>Create Custom Fields</strong> from Settings → GHL (or use the CDP snapshot).</p>
          <p>2. In GHL, create a workflow with <strong>Tag Added</strong> as the trigger, watching the tag listed below for each event.</p>
          <p>3. Build SMS/email actions using the contact merge fields listed below.</p>
          <p>
            4. Set your owner GHL contact id in{" "}
            <Link href="/settings/ghl" className="font-medium text-blue-600 hover:text-blue-700">
              Settings → GHL
            </Link>{" "}
            so staff alerts have somewhere to land.
          </p>
        </div>
      </Card>

      {WORKFLOWS.map((wf) => (
        <Card key={wf.key}>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-blue-600" /> {wf.title}
              </span>
            }
            description={
              <>
                Trigger: <strong>Tag Added</strong> —{" "}
                <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs">
                  {NOTIFICATION_TAGS[wf.key]}
                </code>
              </>
            }
          />
          <div className="space-y-3 p-6 text-sm">
            <div>
              <p className="mb-1.5 font-medium text-gray-700">Merge fields available:</p>
              <div className="flex flex-wrap gap-1.5">
                {wf.mergeFields.map((f) => (
                  <code key={f} className="rounded bg-gray-100 px-2 py-1 font-mono text-xs text-gray-700">
                    {f}
                  </code>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1.5 font-medium text-gray-700">Suggested SMS/email copy:</p>
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
