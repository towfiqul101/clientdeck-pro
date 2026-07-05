import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/card";
import { ArrowLeft, MessageSquare } from "lucide-react";

interface WorkflowDoc {
  title: string;
  fields: string[];
  suggestedCopy: string;
}

const WORKFLOWS: WorkflowDoc[] = [
  {
    title: "Round Sent to Bureaus (Client SMS)",
    fields: ["{{contact.first_name}}", "{{round_number}}", "{{items_disputed}}", "{{response_deadline}}", "{{portal_link}}"],
    suggestedCopy:
      "Hi {{contact.first_name}}! Your Round {{round_number}} dispute letters have been sent to all 3 bureaus ({{items_disputed}} items). They have until {{response_deadline}} to respond. Track your progress: {{portal_link}}",
  },
  {
    title: "Deletion Win (Client SMS)",
    fields: ["{{deletions_this_round}}", "{{total_deletions}}", "{{deleted_items_list}}", "{{portal_link}}"],
    suggestedCopy:
      "Great news, {{contact.first_name}}! {{deletions_this_round}} item(s) were removed this round. Total deleted so far: {{total_deletions}}. View your progress: {{portal_link}}",
  },
  {
    title: "Round Results In (Client SMS)",
    fields: ["{{round_number}}", "{{total_deletions}}", "{{total_verified}}", "{{total_no_response}}", "{{has_wins}}", "{{portal_link}}"],
    suggestedCopy:
      "Hi {{contact.first_name}}, your Round {{round_number}} results are in — {{total_deletions}} deleted, {{total_verified}} verified. Full details: {{portal_link}}",
  },
  {
    title: "Goal Achieved (Client SMS + Email)",
    fields: ["{{total_deletions}}", "{{score_improvement}}", "{{months_in_program}}", "{{review_link}}", "{{portal_link}}"],
    suggestedCopy:
      "Congratulations {{contact.first_name}}! You've reached your credit goal — {{total_deletions}} items removed, +{{score_improvement}} points. It's been an honor working with you. Mind leaving us a review? {{review_link}}",
  },
  {
    title: "Payment Failed (Client SMS)",
    fields: ["{{monthly_fee}}", "{{portal_link}}", "{{agency_phone}}"],
    suggestedCopy:
      "Hi {{contact.first_name}}, your payment of ${{monthly_fee}}/month didn't go through. Update your payment method here: {{portal_link}} or call us at {{agency_phone}}.",
  },
  {
    title: "Portal Link Sent (Client SMS)",
    fields: ["{{portal_link}}", "{{agency_name}}"],
    suggestedCopy: "Hi {{contact.first_name}}, here's your {{agency_name}} client portal link: {{portal_link}}",
  },
  {
    title: "Monthly Progress Update (Client SMS)",
    fields: ["{{score_eq}}", "{{score_exp}}", "{{score_tu}}", "{{total_deletions}}", "{{total_items}}", "{{current_round}}", "{{months_in_program}}", "{{portal_link}}"],
    suggestedCopy:
      "Hi {{contact.first_name}}, your monthly update: {{total_deletions}} of {{total_items}} items resolved, currently on Round {{current_round}}. View details: {{portal_link}}",
  },
  {
    title: "New Client Onboarded (Staff alert)",
    fields: ["{{client_name}}", "{{client_email}}", "{{client_phone}}", "{{dashboard_link}}"],
    suggestedCopy: "New client onboarded: {{client_name}} ({{client_email}}, {{client_phone}}). Review: {{dashboard_link}}",
  },
  {
    title: "Round Overdue Alert (Staff alert)",
    fields: ["{{client_name}}", "{{round_number}}", "{{days_overdue}}", "{{dashboard_link}}"],
    suggestedCopy: "{{client_name}}'s Round {{round_number}} is {{days_overdue}} days overdue — bureau hasn't responded. Escalate: {{dashboard_link}}",
  },
  {
    title: "Next Round Ready (Staff alert)",
    fields: ["{{client_name}}", "{{round_number}}", "{{dashboard_link}}"],
    suggestedCopy: "Round {{round_number}} is ready for {{client_name}} — review and generate letters: {{dashboard_link}}",
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
          ClientDeck Pro sends notifications to your own GHL workflows via webhooks, so
          SMS and email look like they come from your agency — not from ClientDeck Pro.
        </p>
      </div>

      <Card>
        <CardHeader title="How it works" />
        <div className="space-y-2 p-6 text-sm text-gray-600">
          <p>1. In GHL, create a workflow with <strong>Custom Webhook</strong> as the trigger.</p>
          <p>2. Build SMS/email actions using the data fields listed below for each event.</p>
          <p>3. Copy the workflow&apos;s webhook trigger URL from GHL.</p>
          <p>
            4. Paste it into{" "}
            <Link href="/settings/ghl" className="font-medium text-blue-600 hover:text-blue-700">
              Settings → GHL → Notification Webhooks
            </Link>
            .
          </p>
        </div>
      </Card>

      {WORKFLOWS.map((wf) => (
        <Card key={wf.title}>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-blue-600" /> {wf.title}
              </span>
            }
          />
          <div className="space-y-3 p-6 text-sm">
            <div>
              <p className="mb-1.5 font-medium text-gray-700">Data fields available in GHL:</p>
              <div className="flex flex-wrap gap-1.5">
                {wf.fields.map((f) => (
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
