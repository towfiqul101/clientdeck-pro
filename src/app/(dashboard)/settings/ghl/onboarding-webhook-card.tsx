"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils/helpers";
import { Copy, Check } from "lucide-react";
import { ONBOARDING_COMPLETE_TAG } from "@/lib/ghl/notification-tags";

export function OnboardingWebhookCard({ webhookUrl }: { webhookUrl: string }) {
  const [copied, setCopied] = useState<string | null>(null);

  const body = `{
  "contactId": "{{contact.id}}",
  "locationId": "{{location.id}}",
  "event": "onboarding_complete",
  "firstName": "{{contact.first_name}}",
  "lastName": "{{contact.last_name}}",
  "email": "{{contact.email}}"
}`;

  function copy(label: string, text: string) {
    navigator.clipboard?.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <Card>
      <div className="space-y-4 p-6">
        <div>
          <h3 className="text-base font-semibold text-slate-100">
            Onboarding Webhook Setup
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Wire this in GHL so a completed onboarding form auto-creates the client
            in RoundTrack Pro.
          </p>
        </div>

        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-slate-400">
          <li>GHL → Automations → New Workflow</li>
          <li>
            Trigger: <span className="font-medium">Tag added</span> —{" "}
            <code className="rounded bg-white/[0.06] px-1">{ONBOARDING_COMPLETE_TAG}</code>
          </li>
          <li>
            Action: <span className="font-medium">Webhook (POST)</span> to the URL
            below, with the JSON body below
          </li>
        </ol>

        <p className="rounded-md border border-white/10 bg-white/[0.03] p-3 text-xs text-slate-500">
          The tag is namespaced on purpose. A bare{" "}
          <code className="rounded bg-white/[0.06] px-1">onboarding-complete</code>{" "}
          is a common tag in credit-repair accounts — if another product or
          workflow in this GHL location adds it, it would create clients in
          RoundTrack Pro unexpectedly. Use{" "}
          <code className="rounded bg-white/[0.06] px-1">{ONBOARDING_COMPLETE_TAG}</code>{" "}
          and nothing else will trip it.
        </p>

        <CopyRow
          label="URL"
          value={webhookUrl}
          copied={copied === "url"}
          onCopy={() => copy("url", webhookUrl)}
        />

        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Body (JSON)</span>
            <button
              onClick={() => copy("body", body)}
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-400 hover:text-blue-400"
            >
              {copied === "body" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied === "body" ? "Copied" : "Copy"}
            </button>
          </div>
          <pre className="overflow-x-auto rounded-md border border-white/10 bg-white/[0.03] p-3 font-mono text-xs text-slate-300">
            {body}
          </pre>
        </div>
      </div>
    </Card>
  );
}

function CopyRow({
  label,
  value,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div>
      <span className="text-xs font-medium text-slate-400">{label}</span>
      <div className="mt-1 flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.03] px-3 py-2">
        <code className="flex-1 truncate font-mono text-xs text-slate-300">{value}</code>
        <button
          onClick={onCopy}
          className={cn("shrink-0 text-slate-500 hover:text-slate-300", copied && "text-green-400")}
          aria-label={`Copy ${label}`}
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
