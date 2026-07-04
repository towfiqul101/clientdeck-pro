"use client";

import { useState } from "react";
import { Field, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { updateNotificationWebhooks } from "../actions";
import type { GHLNotificationType } from "@/lib/ghl/notifications";

const CLIENT_TYPES: { key: GHLNotificationType; label: string }[] = [
  { key: "round_sent", label: "Round Sent to Bureaus" },
  { key: "deletion_win", label: "Deletion Win" },
  { key: "round_results_in", label: "Round Results In" },
  { key: "goal_achieved", label: "Goal Achieved" },
  { key: "payment_failed", label: "Payment Failed" },
  { key: "portal_link", label: "Portal Link Sent" },
  { key: "monthly_progress", label: "Monthly Progress Update" },
];

const STAFF_TYPES: { key: GHLNotificationType; label: string }[] = [
  { key: "staff_new_client", label: "New Client Onboarded" },
  { key: "staff_round_overdue", label: "Round Overdue Alert" },
  { key: "staff_next_round_ready", label: "Next Round Ready" },
];

interface NotificationWebhooksFormProps {
  initial: {
    triggers: Partial<Record<GHLNotificationType, string>>;
    ownerGhlContactId: string;
  };
}

export function NotificationWebhooksForm({ initial }: NotificationWebhooksFormProps) {
  const { toast } = useToast();
  const [triggers, setTriggers] = useState(initial.triggers);
  const [ownerGhlContactId, setOwnerGhlContactId] = useState(initial.ownerGhlContactId);
  const [pending, setPending] = useState(false);

  function setTrigger(key: GHLNotificationType, value: string) {
    setTriggers((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setPending(true);
    const result = await updateNotificationWebhooks({
      ghlWebhookTriggers: triggers,
      ownerGhlContactId,
    });
    setPending(false);
    if (result.success) toast("Webhook URLs saved.", "success");
    else toast(result.error ?? "Could not save.", "error");
  }

  const [testing, setTesting] = useState<GHLNotificationType | null>(null);

  async function handleTest(key: GHLNotificationType) {
    const url = triggers[key];
    if (!url) {
      toast("Enter a webhook URL first.", "error");
      return;
    }
    setTesting(key);
    try {
      const res = await fetch("/api/ghl/test-webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webhookUrl: url, notificationType: key }),
      });
      const data = await res.json();
      if (data.success) toast("GHL received the test payload.", "success");
      else toast(data.error ?? "GHL did not respond successfully.", "error");
    } catch {
      toast("Could not reach the webhook URL.", "error");
    } finally {
      setTesting(null);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Notification Webhooks"
        description="Connect your GHL workflows to receive automatic notifications. In GHL, create a workflow with a Custom Webhook trigger, then paste its URL here."
      />
      <div className="space-y-5 p-6">
        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Client Notifications
          </h3>
          <div className="space-y-4">
            {CLIENT_TYPES.map(({ key, label }) => (
              <Field key={key} label={label} htmlFor={key}>
                <div className="flex gap-2">
                  <Input
                    id={key}
                    value={triggers[key] ?? ""}
                    onChange={(e) => setTrigger(key, e.target.value)}
                    placeholder="https://hooks.gohighlevel.com/hooks/..."
                    className="font-mono text-xs"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    className="shrink-0"
                    loading={testing === key}
                    onClick={() => handleTest(key)}
                  >
                    Test
                  </Button>
                </div>
              </Field>
            ))}
          </div>
        </div>

        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Staff Notifications
          </h3>
          <div className="space-y-4">
            {STAFF_TYPES.map(({ key, label }) => (
              <Field key={key} label={label} htmlFor={key}>
                <div className="flex gap-2">
                  <Input
                    id={key}
                    value={triggers[key] ?? ""}
                    onChange={(e) => setTrigger(key, e.target.value)}
                    placeholder="https://hooks.gohighlevel.com/hooks/..."
                    className="font-mono text-xs"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    className="shrink-0"
                    loading={testing === key}
                    onClick={() => handleTest(key)}
                  >
                    Test
                  </Button>
                </div>
              </Field>
            ))}
          </div>
        </div>

        <Field
          label="Owner GHL Contact ID"
          htmlFor="ownerGhlContactId"
          hint="Your own contact ID in GHL — staff alerts go to this contact. Find it: GHL → Contacts → your profile → copy the ID from the URL."
        >
          <Input
            id="ownerGhlContactId"
            value={ownerGhlContactId}
            onChange={(e) => setOwnerGhlContactId(e.target.value)}
            placeholder="e.g. abc123XYZ"
          />
        </Field>

        <div className="flex justify-end">
          <Button onClick={handleSave} loading={pending}>
            Save Webhook URLs
          </Button>
        </div>
      </div>
    </Card>
  );
}
